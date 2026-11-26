using Microsoft.EntityFrameworkCore;
using Soc.Data.Context;
using Soc.Data.Entities;
using static Soc.Business.Services.SocService;

namespace Soc.Business.Services;

public sealed class AdministrationService(SocDbContext db)
{
    public async Task<object> Audit(AppUser user)
    {
        Admin(user);

        return await db.Audit.AsNoTracking()
            .OrderByDescending(entry => entry.CreatedAt)
            .Select(entry => new AuditRow(
                entry.Id, entry.CreatedAt, entry.Actor,
                entry.Action, entry.TenantId, entry.Target))
            .ToListAsync();
    }

    public record AuditRow(Guid Id, DateTimeOffset CreatedAt, string Actor,
        string Action, Guid? OrganizationId, string? Target);
}
