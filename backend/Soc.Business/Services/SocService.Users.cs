using Microsoft.Extensions.Configuration;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Soc.Data.Context;
using Soc.Data.Entities;
namespace Soc.Business.Services;

public sealed partial class SocService
{
    public async Task<List<object>> ListUsers(AppUser u)
    {
        Admin(u);
        var r = new List<object>();
        foreach (var x in await users.Users.Where(x => x.DeletedAt == null).OrderBy(x => x.Name).ToListAsync())
            r.Add(await PublicUser(x));
        return r;
    }
    async Task SetGrants(AppUser user, string role, Guid[] ids)
    {
        Require(Roles.Contains(role), "Ongeldige rol.", 400);
        ids = ids.Distinct().ToArray();
        Require(role != "Klant" || ids.Length == 1, "Een klantaccount moet precies één klant hebben.", 400);
        Require(await db.Tenants.CountAsync(t => ids.Contains(t.Id)) == ids.Length, "Ongeldige klant.", 400);
        var desired = await db.Scopes.Where(x => ids.Contains(x.TenantId)).ToListAsync();
        var existing = await db.Assignments.Where(x => x.UserId == user.Id).ToListAsync();
        var desiredIds = desired.Select(x => x.Id).ToHashSet();
        db.Assignments.RemoveRange(existing.Where(x => !desiredIds.Contains(x.ScopeId)));
        var existingIds = existing.Select(x => x.ScopeId).ToHashSet();
        foreach (var scope in desired.Where(x => !existingIds.Contains(x.Id)))
            db.Assignments.Add(new()
            {
                UserId = user.Id,
                TenantId = scope.TenantId,
                ScopeId = scope.Id
            });
        user.Role = role;
        await db.SaveChangesAsync();
    }
    public async Task<object> CreateUser(AppUser u, CreateUserRequest input)
    {
        Admin(u);
        var email = Required(input.Email, 120);
        Require(email.Contains('@'), "Ongeldig e-mailadres.", 400);
        var role = Required(input.Role, 30);
        var ids = input.OrganizationIds ?? [];
        Require(Roles.Contains(role) && (role != "Klant" || ids.Distinct().Count() == 1) && await db.Tenants.CountAsync(t => ids.Contains(t.Id)) == ids.Distinct().Count(), "Ongeldige rol of klant.", 400);
        var x = new AppUser { Id = Guid.NewGuid(), Name = Required(input.Name, 120), UserName = email, Email = email, EmailConfirmed = true, Role = role, LockoutEnabled = true };
        var result = await users.CreateAsync(x, Required(input.Password, 200));
        Require(result.Succeeded, string.Join(" ", result.Errors.Select(x => x.Description)), 400);
        await SetGrants(x, role, ids);
        await Log(u, "Gebruiker aangemaakt", target: email);
        return await PublicUser(x);
    }
    public async Task<object> ChangeAccess(AppUser u, Guid id, ChangeUserAccessRequest input)
    {
        Admin(u);
        Require(u.Id != id, "Eigen rechten wijzigen is niet toegestaan.", 400);
        var x = await users.FindByIdAsync(id.ToString()) ?? throw new SocException(404, "Gebruiker niet gevonden.");
        Require(x.DeletedAt == null, "Gebruiker is verwijderd.", 404);
        await SetGrants(x, Required(input.Role, 30), input.OrganizationIds ?? []);
        await users.UpdateSecurityStampAsync(x);
        await Log(u, "Gebruikersrechten gewijzigd", target: x.Email);
        return await PublicUser(x);
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
        db.Assignments.RemoveRange(await db.Assignments.Where(x => x.UserId == id).ToListAsync());
        var result = await users.UpdateSecurityStampAsync(user);
        Require(result.Succeeded, "Account verwijderen mislukt.", 500);
        await Log(actor, "Gebruiker verwijderd", target: id.ToString());
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
        var ids = input.OrganizationIds!.Distinct().ToArray();
        Require(Roles.Contains(role) && (role != "Klant" || ids.Length == 1) && await db.Tenants.CountAsync(t => ids.Contains(t.Id)) == ids.Length, "Ongeldige rol of klant.", 400);
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
            user.EmailConfirmed = false;
        user.Email = email;
        user.UserName = email;
        user.IsActive = input.IsActive!.Value;
        var result = await users.UpdateAsync(user);
        Require(result.Succeeded, string.Join(" ", result.Errors.Select(x => x.Description)), 400);
        if (!string.IsNullOrEmpty(input.Password))
        {
            var token = await users.GeneratePasswordResetTokenAsync(user);
            var reset = await users.ResetPasswordAsync(user, token, input.Password);
            Require(reset.Succeeded, string.Join(" ", reset.Errors.Select(x => x.Description)), 400);
            await users.ResetAccessFailedCountAsync(user);
            await users.SetLockoutEndDateAsync(user, null);
        }
        await SetGrants(user, role, ids);
        var stamp = await users.UpdateSecurityStampAsync(user);
        Require(stamp.Succeeded, string.Join(" ", stamp.Errors.Select(x => x.Description)), 500);
        await Log(actor, "Gebruikersaccount gewijzigd", target: user.Id.ToString());
        if (!string.IsNullOrEmpty(input.Password))
            await Log(actor, "Gebruikerswachtwoord gereset", target: user.Id.ToString());
        await transaction.CommitAsync();
        return await PublicUser(user);
    }
    public async Task<List<object>> Analysts(AppUser u)
    {
        Require(Analyst(u));
        var permitted = (await Workspaces(u)).Select(x => x.Tenant.Id).ToHashSet();
        var list = new List<object>();
        foreach (var a in await users.Users.Where(x => x.IsActive && (x.Role == "Analist" || x.Role == "Senior analist")).ToListAsync())
        {
            var ids = await db.Assignments.Where(x => x.UserId == a.Id).Select(x => x.TenantId).Distinct().ToListAsync();
            list.Add(new
            {
                id = a.Id,
                a.Name,
                organizationIds = ids.Where(permitted.Contains)
            });
        }
        return list;
    }
}
