using Microsoft.Extensions.Configuration;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Soc.Data.Context;
using Soc.Data.Entities;
using static Soc.Business.Services.SocService;
namespace Soc.Business.Services;

public sealed class AlertService(SocDbContext db, TenantDbFactory factory, SocService platform)
{
    // The SLA statuses are taken from the database branch. Compute from the actual timestamps.
    static Soc.Data.Entities.Enums.SlaStatus GetSlaStatus(Alert alert)
    {
        if ((alert.FirstHandledAt ?? DateTimeOffset.UtcNow) > alert.Deadline)
            return Soc.Data.Entities.Enums.SlaStatus.Breached;
        return alert.FirstHandledAt.HasValue ? Soc.Data.Entities.Enums.SlaStatus.Met : Soc.Data.Entities.Enums.SlaStatus.Pending;
    }
    private static object AlertDto(Alert alert, Guid organizationId)
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

    public async Task<(int Status, object Data)> Ingest(string? key, byte[] body)
    {
        Require(!string.IsNullOrWhiteSpace(key), "Ongeldige API-sleutel.", 401);
        var hash = Hash(key!);
        var source = await db.Sources.SingleOrDefaultAsync(x => x.Hash == hash && x.IsActive);
        Require(source != null, "Ongeldige API-sleutel.", 401);
        var t = await platform.Tenant(source!.TenantId);
        Require(t.IsActive, "Klant is inactief.");
        JsonDocument document;
        try
        {
            document = JsonDocument.Parse(body);
        }
        catch (JsonException) { throw new SocException(400, "Ongeldig JSON-bericht."); }
        using (document)
        {
            var root = document.RootElement;
            Require(root.ValueKind == JsonValueKind.Object, "JSON-object vereist.", 400);
            var allowed = new[] { "externalEventId", "title", "occurredAt", "severity", "payload" };
            Require(root.EnumerateObject().All(p => allowed.Contains(p.Name)) && root.EnumerateObject().Select(p => p.Name).Distinct().Count() == root.EnumerateObject().Count(), "Onbekend of dubbel veld in aanleverbericht.", 400);
            string? Read(string name) => root.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;
            var eventId = Required(Read("externalEventId"), 200);
            var title = Required(Read("title"), 120);
            Require(DateTimeOffset.TryParse(Read("occurredAt"), System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out var occurredAt), "Ongeldig gebeurtenistijdstip.", 400);
            Require(root.TryGetProperty("payload", out var payload) && payload.ValueKind == JsonValueKind.Object, "Payload-object vereist.", 400);
            var severity = Priority(Read("severity"));
            var payloadHash = Convert.ToHexString(SHA256.HashData(body));
            await using var td = factory.Open(t);
            var existing = await td.Alerts.Include(x => x.History).SingleOrDefaultAsync(x => x.SourceIntegrationId == source.Id && x.ExternalEventId == eventId);
            if (existing != null)
            {
                Require(existing.PayloadHash == payloadHash, "Event-ID bestaat met andere inhoud.", 409);
                return (200, AlertDto(existing, t.Id));
            }
            var details = SecurityAlertDetails.Read(payload);
            var description = details.Description ?? title;
            if (description.Length > 2000)
                description = description[..2000];
            var a = NewAlert(source.ScopeId, new CreateAlertRequest { Title = title, Description = description, Priority = severity.ToString() }, source.Name, responseMinutes: t.ResponseMinutes);
            a.SourceIntegrationId = source.Id;
            a.ExternalEventId = eventId;
            a.OccurredAt = occurredAt.ToUniversalTime();
            a.PayloadHash = payloadHash;
            a.RawPayload = Encoding.UTF8.GetString(body);
            a.NormalizedPayload = SecurityAlertDetails.Normalize(a, details);
            td.Alerts.Add(a);
            LogTenant(td, a.ScopeId, source.Name, "Alert ontvangen", a.Number);
            try
            {
                await td.SaveChangesAsync();
            }
            catch (DbUpdateException ex) when (ex.InnerException is Microsoft.Data.SqlClient.SqlException sql && sql.Number is 2601 or 2627)
            {
                td.ChangeTracker.Clear();
                var duplicate = await td.Alerts.Include(x => x.History).SingleOrDefaultAsync(x => x.SourceIntegrationId == source.Id && x.ExternalEventId == eventId);
                if (duplicate == null)
                    throw;
                Require(duplicate.PayloadHash == payloadHash, "Event-ID bestaat met andere inhoud.", 409);
                return (200, AlertDto(duplicate, t.Id));
            }
            return (201, AlertDto(a, t.Id));
        }
    }
    public async Task<object> AddAlert(AppUser u, CreateAlertRequest request)
    {
        Require(Analyst(u));
        var t = await platform.Tenant(request.OrganizationId);
        Require(t.IsActive, "Klant is inactief.", 400);
        var grants = await platform.Scopes(u, t.Id);
        var scope = request.ScopeId ?? grants.FirstOrDefault();
        Require(grants.Contains(scope));
        await using var td = factory.Open(t);
        var a = NewAlert(scope, request, Required(request.Source, 80), responseMinutes: t.ResponseMinutes);
        td.Alerts.Add(a);
        LogTenant(td, scope, u.Name, "Alert handmatig ontvangen", a.Number);
        await td.SaveChangesAsync();
        return AlertDto(a, t.Id);
    }
    public async Task<object> Alerts(AppUser u, Guid? workspace, Guid? scope)
    {
        Require(CanReadInternal(u));
        var result = new List<(DateTimeOffset Time, object Dto)>();
        foreach (var (t, scopes) in await platform.ReadWorkspaces(u, workspace, scope))
        {
            await using var td = factory.Open(t);
            foreach (var a in await td.Alerts.Include(x => x.History).Where(x => scopes.Contains(x.ScopeId)).ToListAsync())
                result.Add((a.CreatedAt, AlertDto(a, t.Id)));
            foreach (var sid in scopes)
                LogTenant(td, sid, u.Name, "Alertoverzicht bekeken", "Alerts");
            await td.SaveChangesAsync();
        }
        return result.OrderBy(x => x.Time).Select(x => x.Dto);
    }
    public async Task<object> AlertAction(AppUser currentUser, Guid id, string action, AlertActionRequest input, Guid? workspace, Guid? scope)
    {
        Require(action == "get" ? CanReadInternal(currentUser) : Analyst(currentUser));
        foreach (var (tenant, scopes) in await (action == "get" ? platform.ReadWorkspaces(currentUser, workspace, scope) : platform.Workspaces(currentUser, workspace, scope)))
        {
            await using var tenantDb = factory.Open(tenant);
            await using var transaction = await tenantDb.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
            var alert = await tenantDb.Alerts.Include(x => x.History).FirstOrDefaultAsync(x => x.Id == id && scopes.Contains(x.ScopeId));
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
                    var outcome = Required(input.Outcome, 30);
                    Require(new[] { "False positive", "Verwacht gedrag", "Nader onderzoek", "Bevestigd incident" }.Contains(outcome), "Ongeldige triage.", 400);
                    alert.Triage = outcome;
                    alert.Status = outcome is "False positive" or "Verwacht gedrag" ? AlertStatus.Dismissed : AlertStatus.UnderReview;
                    Event(alert, currentUser.Name, $"Triage: {outcome} — {Required(input.Reason)}");
                    break;
                case "promote":
                    Require(NeedsCase(alert.Triage) && alert.CaseId == null, "Leg eerst triage nader onderzoek of bevestigd incident vast.", 409);
                    ResearchCase researchCase;
                    if (input.CaseId.HasValue)
                    {
                        researchCase = await tenantDb.Cases.SingleOrDefaultAsync(x => x.Id == input.CaseId && x.ScopeId == alert.ScopeId) ?? throw new SocException(400, "Case niet gevonden in dezelfde scope.");
                        Require(!Closed(researchCase), "Case is afgesloten.", 409);
                        Require(researchCase.OwnerId == currentUser.Id || currentUser.Role == "Senior analist", "Case heeft een andere eigenaar.", 403);
                        tenantDb.Entry(researchCase).Property(x => x.Title).IsModified = true;
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
                    break;
                case "reopen":
                    Require(currentUser.Role == "Senior analist" && alert.Status is (AlertStatus.Dismissed or AlertStatus.Resolved) && alert.CaseId == null, "Heropenen niet toegestaan.", 409);
                    alert.Status = AlertStatus.PendingReview;
                    alert.Triage = null;
                    alert.OwnerId = null;
                    alert.Owner = null;
                    Event(alert, currentUser.Name, "Heropend: " + Required(input.Reason));
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
}
