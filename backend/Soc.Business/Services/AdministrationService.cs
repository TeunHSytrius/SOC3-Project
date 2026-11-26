using System.Security.Cryptography;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Soc.Data.Context;
using Soc.Data.Entities;
using static Soc.Business.Services.SocService;

namespace Soc.Business.Services;

public sealed class AdministrationService(SocDbContext db, TenantDbFactory factory, SocService platform)
{
    public async Task<object> Audit(AppUser user)
    {
        Admin(user);
        var result = (await db.Audit.ToListAsync()).Select(entry => new AuditRow(entry.Id, entry.CreatedAt, entry.Actor, entry.Action, entry.TenantId, entry.Target)).ToList();
        foreach (var organization in await db.Tenants.ToListAsync())
        {
            await using var tenantDb = factory.Open(organization);
            result.AddRange((await tenantDb.Audit.ToListAsync()).Select(entry => new AuditRow(entry.Id, entry.CreatedAt, entry.Actor, entry.Action, organization.Id, entry.Target)));
        }
        return result.OrderByDescending(entry => entry.CreatedAt);
    }
    public record AuditRow(Guid Id, DateTimeOffset CreatedAt, string Actor, string Action, Guid? OrganizationId, string? Target);
    // Administrative register: identifiers and lifecycle metadata only.
    // Do not include titles, owners, scope IDs, observables, payloads or investigation entries.
    public async Task<object> TicketRegister(AppUser user)
    {
        Admin(user);
        var rows = new List<object>();
        foreach (var tenant in await db.Tenants.OrderBy(organization => organization.Name).ToListAsync())
        {
            await using var tenantDb = factory.Open(tenant);
            var cases = await tenantDb.Cases.AsNoTracking()
                .Select(ticket => new { ticket.Id, ticket.Number, ticket.Status, ticket.CreatedAt, ticket.ClosedAt })
                .OrderByDescending(ticket => ticket.CreatedAt).ToListAsync();
            foreach (var item in cases)
                rows.Add(new
                {
                    item.Id,
                    item.Number,
                    item.Status,
                    item.CreatedAt,
                    item.ClosedAt,
                    organizationId = tenant.Id
                });
        }
        await platform.Log(user, "Ticketregister bekeken");
        return rows;
    }
}
