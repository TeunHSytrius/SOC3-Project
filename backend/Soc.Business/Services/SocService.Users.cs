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
    internal async Task SetGrants(AppUser user, string role, Guid[] organizationIds)
    {
        Require(Roles.Contains(role), "Ongeldige rol.", 400);
        organizationIds = organizationIds.Distinct().ToArray();
        Require(role != "Klant" || organizationIds.Length == 1, "Een klantaccount moet precies één klant hebben.", 400);
        Require(await db.Tenants.CountAsync(t => organizationIds.Contains(t.Id)) == organizationIds.Length, "Ongeldige klant.", 400);
        var desired = await db.Scopes.Where(x => organizationIds.Contains(x.TenantId)).ToListAsync();
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
}
