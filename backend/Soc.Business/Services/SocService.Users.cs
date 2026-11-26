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
        Require(await db.Tenants.CountAsync(organization => organizationIds.Contains(organization.Id)) == organizationIds.Length, "Ongeldige klant.", 400);
        var desired = await db.Scopes.Where(scope => organizationIds.Contains(scope.TenantId)).ToListAsync();
        var existing = await db.Assignments.Where(assignment => assignment.UserId == user.Id).ToListAsync();
        var desiredIds = desired.Select(scope => scope.Id).ToHashSet();
        db.Assignments.RemoveRange(existing.Where(assignment => !desiredIds.Contains(assignment.ScopeId)));
        var existingIds = existing.Select(assignment => assignment.ScopeId).ToHashSet();
        foreach (var scope in desired.Where(availableScope => !existingIds.Contains(availableScope.Id)))
        {
            db.Assignments.Add(new()
            {
                UserId = user.Id,
                TenantId = scope.TenantId,
                ScopeId = scope.Id
            });
        }
        user.Role = role;
        await db.SaveChangesAsync();
    }
}
