using System.Security.Cryptography;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Soc.Data.Context;
using Soc.Data.Entities;
using static Soc.Business.Services.SocService;

namespace Soc.Business.Services;

public sealed class UserManagementService(SocDbContext db, UserManager<AppUser> users, SocService platform)
{
    public async Task<List<object>> ListUsers(AppUser currentUser)
    {
        Admin(currentUser);

        var activeAccounts = await users.Users
            .Where(account => account.DeletedAt == null)
            .OrderBy(account => account.Name)
            .ToListAsync();

        var result = new List<object>();
        foreach (var account in activeAccounts)
        {
            result.Add(await platform.PublicUser(account));
        }

        return result;
    }

    public async Task<object> CreateUser(AppUser currentUser, CreateUserRequest input)
    {
        Admin(currentUser);
        var email = Required(input.Email, 120);
        Require(System.Net.Mail.MailAddress.TryCreate(email, out var address) &&
            string.Equals(address.Address, email, StringComparison.OrdinalIgnoreCase),
            "Ongeldig e-mailadres.", 400);
        var role = Required(input.Role, 30);
        var organizationIds = input.OrganizationIds ?? [];
        Require(
            Roles.Contains(role) &&
            (role != "Klant" || organizationIds.Distinct().Count() == 1) &&
            await db.Tenants.CountAsync(organization => organizationIds.Contains(organization.Id)) ==
                organizationIds.Distinct().Count(),
            "Ongeldige rol of klant.",
            400);
        var account = new AppUser
        {
            Id = Guid.NewGuid(),
            Name = Required(input.Name, 120),
            UserName = email,
            Email = email,
            EmailConfirmed = true,
            Role = role,
            LockoutEnabled = true
        };
        await using var transaction = await db.Database.BeginTransactionAsync();
        var result = await users.CreateAsync(account, RequiredPassword(input.Password));
        Require(result.Succeeded, string.Join(" ", result.Errors.Select(error => error.Description)), 400);
        await platform.SetGrants(account, role, organizationIds);
        await platform.Log(currentUser, "Gebruiker aangemaakt", target: email);
        await transaction.CommitAsync();

        return await platform.PublicUser(account);
    }

    public async Task<object> ChangeAccess(AppUser currentUser, Guid id, ChangeUserAccessRequest input)
    {
        Admin(currentUser);
        Require(currentUser.Id != id, "Eigen rechten wijzigen is niet toegestaan.", 400);
        var account = await users.FindByIdAsync(id.ToString()) ?? throw new SocException(404, "Gebruiker niet gevonden.");
        Require(account.DeletedAt == null, "Gebruiker is verwijderd.", 404);
        await using var transaction = await db.Database.BeginTransactionAsync();

        await platform.SetGrants(account, Required(input.Role, 30), input.OrganizationIds ?? []);
        var securityStampResult = await users.UpdateSecurityStampAsync(account);
        Require(securityStampResult.Succeeded, "Gebruikersrechten wijzigen mislukt.", 500);

        await platform.Log(currentUser, "Gebruikersrechten gewijzigd", target: account.Email);
        await transaction.CommitAsync();
        return await platform.PublicUser(account);
    }

    public async Task<object> RemoveUser(AppUser actor, Guid id)
    {
        Admin(actor);
        Require(actor.Id != id, "Je eigen account kan niet worden verwijderd.", 400);
        await using var transaction = await db.Database.BeginTransactionAsync();
        var user = await users.FindByIdAsync(id.ToString()) ?? throw new SocException(404, "Gebruiker niet gevonden.");
        Require(user.DeletedAt == null, "Gebruiker is al verwijderd.", 404);
        user.IsActive = false;
        user.DeletedAt = DateTimeOffset.UtcNow;
        db.Assignments.RemoveRange(await db.Assignments.Where(assignment => assignment.UserId == id).ToListAsync());
        var result = await users.UpdateSecurityStampAsync(user);
        Require(result.Succeeded, "Account verwijderen mislukt.", 500);
        await platform.Log(actor, "Gebruiker verwijderd", target: id.ToString());
        await transaction.CommitAsync();
        return new
        {
            ok = true
        };
    }

    public async Task<object> UpdateUser(AppUser actor, Guid id, UpdateUserRequest input)
    {
        Admin(actor);
        Require(actor.Id != id, "Je eigen account kan hier niet worden gewijzigd.", 400);
        var name = Required(input.Name, 120);
        var email = Required(input.Email, 120);
        Require(System.Net.Mail.MailAddress.TryCreate(email, out var address) && string.Equals(address.Address, email, StringComparison.OrdinalIgnoreCase), "Ongeldig e-mailadres.", 400);
        var role = Required(input.Role, 30);
        Require(input.OrganizationIds != null && input.IsActive.HasValue, "Klanttoegang en accountstatus zijn verplicht.", 400);
        var organizationIds = input.OrganizationIds!.Distinct().ToArray();
        Require(
            Roles.Contains(role) &&
            (role != "Klant" || organizationIds.Length == 1) &&
            await db.Tenants.CountAsync(organization => organizationIds.Contains(organization.Id)) ==
                organizationIds.Length,
            "Ongeldige rol of klant.",
            400);
        Require(input.Password == null || input.Password.Length <= 200, "Ongeldig wachtwoord.", 400);
        await using var transaction = await db.Database.BeginTransactionAsync();
        var user = await users.FindByIdAsync(id.ToString()) ?? throw new SocException(404, "Gebruiker niet gevonden.");
        Require(user.DeletedAt == null, "Gebruiker is verwijderd.", 404);
        var duplicate = await users.FindByEmailAsync(email);
        Require(duplicate == null || duplicate.Id == id, "E-mailadres is al in gebruik.", 409);
        var duplicateName = await users.FindByNameAsync(email);
        Require(duplicateName == null || duplicateName.Id == id, "Gebruikersnaam is al in gebruik.", 409);
        user.Name = name;
        if (!string.Equals(user.Email, email, StringComparison.OrdinalIgnoreCase))
        {
            user.EmailConfirmed = false;
        }
        user.Email = email;
        user.UserName = email;
        user.IsActive = input.IsActive!.Value;
        var result = await users.UpdateAsync(user);
        Require(result.Succeeded, string.Join(" ", result.Errors.Select(error => error.Description)), 400);
        if (!string.IsNullOrEmpty(input.Password))
        {
            var token = await users.GeneratePasswordResetTokenAsync(user);
            var reset = await users.ResetPasswordAsync(user, token, RequiredPassword(input.Password));
            Require(reset.Succeeded, string.Join(" ", reset.Errors.Select(error => error.Description)), 400);
            await users.ResetAccessFailedCountAsync(user);
            await users.SetLockoutEndDateAsync(user, null);
        }
        await platform.SetGrants(user, role, organizationIds);
        var stamp = await users.UpdateSecurityStampAsync(user);
        Require(stamp.Succeeded, string.Join(" ", stamp.Errors.Select(error => error.Description)), 500);
        await platform.Log(actor, "Gebruikersaccount gewijzigd", target: user.Id.ToString());
        if (!string.IsNullOrEmpty(input.Password))
        {
            await platform.Log(actor, "Gebruikerswachtwoord gereset", target: user.Id.ToString());
        }
        await transaction.CommitAsync();
        return await platform.PublicUser(user);
    }

}
