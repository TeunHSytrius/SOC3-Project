using System.Security.Cryptography;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Soc.Data.Context;
using Soc.Data.Entities;
using static Soc.Business.Services.SocService;

namespace Soc.Business.Services;

public sealed class OrganizationService(SocDbContext db, SocService platform)
{
    public async Task<List<Tenant>> Organizations(AppUser user)
    {
        if (user.Role == "Beheerder")
            return await db.Tenants.OrderBy(organization => organization.Name).ToListAsync();
        return (await platform.Workspaces(user)).Select(workspace => workspace.Tenant).OrderBy(organization => organization.Name).ToList();
    }
    public async Task<Tenant> Organization(AppUser user, Guid id)
    {
        var tenant = await platform.Tenant(id);
        Require(user.Role == "Beheerder" || tenant.IsActive && (await platform.Scopes(user, id)).Count > 0);
        return tenant;
    }
    public async Task<Tenant> CreateOrganization(AppUser user, CreateOrganizationRequest input)
    {
        Admin(user);
        var organization = await platform.CreateTenant(Required(input.Name, 120), SlaMinutes(input.ResponseMinutes));
        await platform.Log(user, "Klant aangemaakt", organization.Id);
        return organization;
    }
    public async Task<Tenant> RenameOrganization(AppUser user, Guid id, string? name, int? responseMinutes = null)
    {
        Admin(user);
        var value = Required(name, 120);
        var organization = await platform.Tenant(id);
        Require(!await db.Tenants.AnyAsync(organization => organization.Id != id && organization.Name == value), "Naam bestaat al.", 409);
        organization.Name = value;
        if (responseMinutes.HasValue)
            organization.ResponseMinutes = SlaMinutes(responseMinutes);
        await platform.Log(user, "Klantinstellingen gewijzigd", organization.Id, organization.Id.ToString());
        return organization;
    }
    public async Task<Tenant> SetOrganization(AppUser user, Guid id, bool active)
    {
        Admin(user);
        var organization = await platform.Tenant(id);
        organization.IsActive = active;
        organization.DeactivatedAt = active ? null : DateTimeOffset.UtcNow;
        await platform.Log(user, "Klantstatus gewijzigd", id);
        return organization;
    }
}
