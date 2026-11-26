using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Soc.Data.Context;
using Soc.Data.Entities;
using static Soc.Business.Services.SocService;
namespace Soc.Business.Services;

public sealed class AlertService(TenantDbFactory factory, SocService platform)
{
    // The SLA statuses are taken from the database branch. Compute from the actual timestamps.
    static Soc.Data.Entities.Enums.SlaStatus GetSlaStatus(Alert alert)
    {
        if ((alert.FirstHandledAt ?? DateTimeOffset.UtcNow) > alert.Deadline)
            return Soc.Data.Entities.Enums.SlaStatus.Breached;
        return alert.FirstHandledAt.HasValue ? Soc.Data.Entities.Enums.SlaStatus.Met : Soc.Data.Entities.Enums.SlaStatus.Pending;
    }
    internal static object AlertDto(Alert alert, Guid organizationId)
    {
        return new
        {
            id = alert.Id,
            organizationId,
            alert.ScopeId,
            alert.Number,
            alert.Title,
            alert.Description,
            alert.Source,
            alert.RawPayload,
            alert.NormalizedPayload,
            security = SecurityAlertDetails.FromRaw(alert.RawPayload),
            alert.SourceIntegrationId,
            alert.ExternalEventId,
            alert.OccurredAt,
            alert.RowVersion,
            alert.Priority,
            alert.Status,
            slaStatus = GetSlaStatus(alert),
            alert.CreatedAt,
            alert.Deadline,
            alert.FirstHandledAt,
            alert.Owner,
            alert.Triage,
            alert.CaseId,
            history = alert.History
                .OrderBy(historyEntry => historyEntry.At)
                .Select(historyEntry => new
                {
                    historyEntry.At,
                    historyEntry.Actor,
                    historyEntry.Text
                })
        };
    }
    internal static bool NeedsCase(string? value) => value is "Nader onderzoek" or "Bevestigd incident" or "True positive" or "Onbeslist";
    internal static void Event(Alert alert, string actor, string text)
    {
        alert.History.Add(new AlertEvent
        {
            Actor = actor,
            Text = text
        });
    }
    internal static Alert NewAlert(
        Guid scope,
        CreateAlertRequest request,
        string source,
        DateTimeOffset? received = null,
        int responseMinutes = DefaultResponseMinutes)
    {
        var priority = Priority(request.Priority);
        var createdAt = received ?? DateTimeOffset.UtcNow;

        var alert = new Alert
        {
            ScopeId = scope,
            Number = "ALT-" + Guid.NewGuid().ToString("N")[..8].ToUpperInvariant(),
            Title = Required(request.Title, 120),
            Description = Required(request.Description, 2000),
            Source = source,
            Priority = priority,
            CreatedAt = createdAt,
            Deadline = createdAt.AddMinutes(responseMinutes),
            RawPayload = JsonSerializer.Serialize(new
            {
                request.Title,
                request.Description,
                request.Priority
            })
        };

        alert.History.Add(new()
        {
            At = createdAt,
            Actor = source,
            Text = "Alert ontvangen"
        });

        return alert;
    }

    public async Task<object> AddAlert(AppUser currentUser, CreateAlertRequest request)
    {
        Require(Analyst(currentUser));
        var tenant = await platform.Tenant(request.OrganizationId);
        Require(tenant.IsActive, "Klant is inactief.", 400);
        var grants = await platform.Scopes(currentUser, tenant.Id);
        var scope = request.ScopeId ?? grants.FirstOrDefault();
        Require(grants.Contains(scope));
        await using var tenantDb = factory.Open(tenant);
        var alert = NewAlert(scope, request, Required(request.Source, 80), responseMinutes: tenant.ResponseMinutes);
        tenantDb.Alerts.Add(alert);
        LogTenant(tenantDb, scope, currentUser.Name, "Alert handmatig ontvangen", alert.Number);
        await tenantDb.SaveChangesAsync();
        return AlertDto(alert, tenant.Id);
    }
    public async Task<object> Alerts(AppUser currentUser, Guid? workspace, Guid? scope)
    {
        Require(CanReadInternal(currentUser));
        var result = new List<(DateTimeOffset Time, object Dto)>();
        foreach (var (tenant, scopes) in await platform.ReadWorkspaces(currentUser, workspace, scope))
        {
            await using var tenantDb = factory.Open(tenant);
            foreach (var alert in await tenantDb.Alerts.Include(record => record.History).Where(record => scopes.Contains(record.ScopeId)).ToListAsync())
                result.Add((alert.CreatedAt, AlertDto(alert, tenant.Id)));
            foreach (var scopeId in scopes)
                LogTenant(tenantDb, scopeId, currentUser.Name, "Alertoverzicht bekeken", "Alerts");
            await tenantDb.SaveChangesAsync();
        }
        return result.OrderBy(record => record.Time).Select(record => record.Dto);
    }
    public async Task<object> AlertAction(AppUser currentUser, Guid id, string action, AlertActionRequest input, Guid? workspace, Guid? scope)
    {
        Require(action == "get" ? CanReadInternal(currentUser) : Analyst(currentUser));
        foreach (var (tenant, scopes) in await (action == "get" ? platform.ReadWorkspaces(currentUser, workspace, scope) : platform.Workspaces(currentUser, workspace, scope)))
        {
            await using var tenantDb = factory.Open(tenant);
            await using var transaction = await tenantDb.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
            var alert = await tenantDb.Alerts.Include(record => record.History).FirstOrDefaultAsync(record => record.Id == id && scopes.Contains(record.ScopeId));
            if (alert == null)
                continue;
            if (action == "get")
            {
                LogTenant(tenantDb, alert.ScopeId, currentUser.Name, "Alert bekeken", alert.Number);
                await tenantDb.SaveChangesAsync();
                await transaction.CommitAsync();
                return AlertDto(alert, tenant.Id);
            }
            Require(tenant.IsActive, "Klant is inactief.", 409);
            if (action == "promote" && alert.CaseId.HasValue)
            {
                await transaction.CommitAsync();
                return AlertDto(alert, tenant.Id);
            }
            CheckVersion(alert.RowVersion, input.RowVersion);
            Require(alert.Status is not (AlertStatus.Dismissed or AlertStatus.Resolved or AlertStatus.Escalated) || action == "reopen", "Alert is afgehandeld.", 409);
            if (action == "claim")
            {
                Require(alert.OwnerId == null && alert.Status is (AlertStatus.New or AlertStatus.PendingReview), "Alert is al opgepakt.", 409);
                alert.FirstHandledAt ??= DateTimeOffset.UtcNow;
                alert.OwnerId = currentUser.Id;
                alert.Owner = currentUser.Name;
            }
            else if (action != "reopen")
            {
                Require(alert.OwnerId.HasValue && (alert.OwnerId == currentUser.Id || currentUser.Role == "Senior analist"), "Pak de alert eerst op of draag deze over.", 409);
            }
            switch (action)
            {
                case "claim":
                    alert.Status = AlertStatus.UnderReview;
                    Event(alert, currentUser.Name, "Alert opgepakt");
                    break;
                case "triage":
                    ApplyTriage(alert, currentUser, input);
                    break;
                case "promote":
                    await PromoteAlertAsync(tenantDb, alert, currentUser, input);
                    break;
                case "reopen":
                    ReopenAlert(alert, currentUser, input);
                    break;
                default:
                    throw new SocException(404, "Onbekende actie.");
            }
            LogTenant(tenantDb, alert.ScopeId, currentUser.Name, "Alert " + action, alert.Number);
            await tenantDb.SaveChangesAsync();
            await transaction.CommitAsync();
            return AlertDto(alert, tenant.Id);
        }
        throw new SocException(404, "Alert niet gevonden.");
    }

    private static void ApplyTriage(Alert alert, AppUser currentUser, AlertActionRequest input)
    {
        var outcome = Required(input.Outcome, 30);
        Require(new[] { "False positive", "Verwacht gedrag", "Nader onderzoek", "Bevestigd incident" }.Contains(outcome), "Ongeldige triage.", 400);
        alert.Triage = outcome;
        alert.Status = outcome is "False positive" or "Verwacht gedrag" ? AlertStatus.Dismissed : AlertStatus.UnderReview;
        Event(alert, currentUser.Name, $"Triage: {outcome} — {Required(input.Reason)}");
    }

    private static async Task PromoteAlertAsync(TenantDbContext tenantDb, Alert alert, AppUser currentUser, AlertActionRequest input)
    {
        Require(NeedsCase(alert.Triage) && alert.CaseId == null, "Leg eerst triage nader onderzoek of bevestigd incident vast.", 409);
        ResearchCase researchCase;
        if (input.CaseId.HasValue)
        {
            researchCase = await tenantDb.Cases.SingleOrDefaultAsync(record => record.Id == input.CaseId && record.ScopeId == alert.ScopeId) ?? throw new SocException(400, "Case niet gevonden in dezelfde scope.");
            Require(!Closed(researchCase), "Case is afgesloten.", 409);
            Require(researchCase.OwnerId == currentUser.Id || currentUser.Role == "Senior analist", "Case heeft een andere eigenaar.", 403);
            tenantDb.Entry(researchCase).Property(record => record.Title).IsModified = true;
        }
        else
        {
            researchCase = new()
            {
                ScopeId = alert.ScopeId,
                Number = "CASE-" + Guid.NewGuid().ToString("N")[..8].ToUpperInvariant(),
                Title = Required(input.Title, 120),
                Priority = alert.Priority,
                OwnerId = currentUser.Id,
                Owner = currentUser.Name
            };
            researchCase.Entries.Add(new()
            {
                Actor = currentUser.Name,
                Kind = "Status",
                Text = "Onderzoek aangemaakt vanuit " + alert.Number
            });
            tenantDb.Cases.Add(researchCase);
        }
        alert.CaseId = researchCase.Id;
        alert.Status = AlertStatus.Escalated;
        Event(alert, currentUser.Name, "Gekoppeld aan " + researchCase.Number);
    }

    private static void ReopenAlert(Alert alert, AppUser currentUser, AlertActionRequest input)
    {
        Require(currentUser.Role == "Senior analist" && alert.Status is (AlertStatus.Dismissed or AlertStatus.Resolved) && alert.CaseId == null, "Heropenen niet toegestaan.", 409);
        alert.Status = AlertStatus.PendingReview;
        alert.Triage = null;
        alert.OwnerId = null;
        alert.Owner = null;
        Event(alert, currentUser.Name, "Heropend: " + Required(input.Reason));
    }

}
