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

public sealed class CaseService(TenantDbFactory factory, UserManager<AppUser> users, SocService platform)
{
    // Existing project roles are retained: senior acts as coordinator in the demo.
    // Open cases start execution only through the assignment action.
    static bool CanChangeCaseStatus(TicketStatus from, TicketStatus to, bool senior)
    {
        return from switch
        {
            TicketStatus.UnderInvestigation => to is TicketStatus.WaitingForCustomer or TicketStatus.Resolved,
            TicketStatus.WaitingForCustomer => to == TicketStatus.UnderInvestigation,
            TicketStatus.Resolved => to is TicketStatus.UnderReview or TicketStatus.Closed or TicketStatus.UnderInvestigation,
            TicketStatus.UnderReview => to is TicketStatus.Closed or TicketStatus.UnderInvestigation,
            TicketStatus.Closed => senior && to == TicketStatus.UnderInvestigation,
            _ => false
        };
    }

    private static object CaseDto(ResearchCase researchCase, Guid organizationId, bool internalView)
    {
        var visibleEntries = researchCase.Entries
            .Where(entry => internalView || entry.Visible)
            .Select(entry => new EntryRow(
                entry.Id,
                entry.At,
                entry.Actor,
                entry.Kind,
                entry.Text,
                entry.Visible));

        // Observables contain internal investigation information.
        if (internalView)
        {
            var observableEntries = researchCase.Observables
                .Select(observable => new EntryRow(
                    observable.Id,
                    observable.At,
                    observable.Actor,
                    "Observable",
                    $"{observable.Type}: {observable.Value} — {observable.Assessment ?? "Niet beoordeeld"}",
                    false));

            visibleEntries = visibleEntries.Concat(observableEntries);
        }

        return new
        {
            id = researchCase.Id,
            organizationId,
            researchCase.ScopeId,
            researchCase.Number,
            researchCase.Title,
            researchCase.Priority,
            researchCase.Status,
            researchCase.Owner,
            ownerId = internalView ? (Guid?)researchCase.OwnerId : null,
            researchCase.CreatedAt,
            researchCase.ClosedAt,
            researchCase.CustomerVisible,
            researchCase.RowVersion,
            summary = researchCase.Summary,
            conclusion = internalView ? researchCase.Conclusion : null,
            alertIds = internalView
                ? researchCase.Alerts.Select(alert => alert.Id).ToArray()
                : Array.Empty<Guid>(),
            entries = visibleEntries.OrderBy(entry => entry.At)
        };
    }

    public record EntryRow(Guid Id, DateTimeOffset At, string Actor, string Kind, string Text, bool Visible);
    static void ValidateObservable(string type, string value, string assessment)
    {
        Require(new[] { "Verdacht", "Kwaadaardig", "Onschuldig" }.Contains(assessment), "Kies een beoordeling.", 400);
        bool valid = type switch
        {
            "IP" => System.Net.IPAddress.TryParse(value, out _),
            "Domain" => Uri.CheckHostName(value) == UriHostNameType.Dns && value.Contains('.'),
            "URL" => Uri.TryCreate(value, UriKind.Absolute, out var uri) && (uri.Scheme is "http" or "https"),
            "Email" => System.Net.Mail.MailAddress.TryCreate(value, out var address) && address.Address == value,
            "Hash" => (value.Length is 32 or 40 or 64 or 128) && value.All(Uri.IsHexDigit),
            _ => false
        };
        Require(valid, "Observable heeft geen geldig formaat voor dit type.", 400);
    }

    private static IQueryable<ResearchCase> CaseQuery(TenantDbContext tenantDb)
    {
        return tenantDb.Cases
            .Include(researchCase => researchCase.Entries)
            .Include(researchCase => researchCase.Observables)
            .Include(researchCase => researchCase.Alerts)
                .ThenInclude(alert => alert.History)
            .AsSplitQuery();
    }

    public async Task<object> Cases(AppUser currentUser, Guid? workspace, Guid? scope)
    {
        Require(CanReadInternal(currentUser) || currentUser.Role is "Klant" or "Accountmanager");
        var result = new List<object>();
        foreach (var (tenant, scopes) in await platform.ReadWorkspaces(currentUser, workspace, scope))
        {
            await using var tenantDb = factory.Open(tenant);
            foreach (var researchCase in await CaseQuery(tenantDb).AsNoTracking().Where(record => scopes.Contains(record.ScopeId) && (CanReadInternal(currentUser) || record.CustomerVisible)).ToListAsync())
                result.Add(CaseDto(researchCase, tenant.Id, CanReadInternal(currentUser)));
            foreach (var scopeId in scopes)
                LogTenant(tenantDb, scopeId, currentUser.Name, "Caseoverzicht bekeken", "Cases");
            await tenantDb.SaveChangesAsync();
        }
        return result;
    }

    public async Task<object> CaseAction(AppUser currentUser, Guid id, string action, CaseActionRequest input, Guid? workspace, Guid? scope)
    {
        Require(action == "get" ? (CanReadInternal(currentUser) || currentUser.Role is "Klant" or "Accountmanager") : (Analyst(currentUser) || currentUser.Role == "Klant" && action == "entry"));
        foreach (var (tenant, scopes) in await (action == "get" ? platform.ReadWorkspaces(currentUser, workspace, scope) : platform.Workspaces(currentUser, workspace, scope)))
        {
            await using var tenantDb = factory.Open(tenant);
            await using var transaction = await tenantDb.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
            var researchCase = await CaseQuery(tenantDb).FirstOrDefaultAsync(record => record.Id == id && scopes.Contains(record.ScopeId) && (CanReadInternal(currentUser) || record.CustomerVisible));
            if (researchCase == null)
                continue;
            if (action == "get")
            {
                LogTenant(tenantDb, researchCase.ScopeId, currentUser.Name, "Case bekeken", researchCase.Number);
                await tenantDb.SaveChangesAsync();
                await transaction.CommitAsync();
                return CaseDto(researchCase, tenant.Id, CanReadInternal(currentUser));
            }
            Require(tenant.IsActive, "Klant is inactief.", 409);
            CheckVersion(researchCase.RowVersion, input.RowVersion);
            Require(!Closed(researchCase) || (action == "status" && currentUser.Role == "Senior analist" && input.Status == "UnderInvestigation"), "Case is afgesloten.", 409);
            Require(Analyst(currentUser) || (currentUser.Role == "Klant" && action == "entry"));
            if (Analyst(currentUser))
                Require(researchCase.OwnerId == currentUser.Id || currentUser.Role == "Senior analist", "Alleen de toegewezen analist of senior kan dit onderzoek aanpassen.", 403);
            switch (action)
            {
                case "entry":
                    AddEntry(researchCase, currentUser, input);
                    break;
                case "status":
                    ChangeStatus(researchCase, currentUser, input);
                    break;
                case "visibility":
                    ChangeVisibility(researchCase, input);
                    break;
                case "owner":
                    await AssignOwnerAsync(researchCase, currentUser, input, tenant);
                    break;
                case "link":
                    await LinkAlertAsync(tenantDb, researchCase, currentUser, input);
                    break;
                default:
                    throw new SocException(404, "Onbekende actie.");
            }
            tenantDb.Entry(researchCase).Property(record => record.Title).IsModified = true;
            LogTenant(tenantDb, researchCase.ScopeId, currentUser.Name, "Case " + action, researchCase.Number);
            await tenantDb.SaveChangesAsync();
            await transaction.CommitAsync();
            return CaseDto(researchCase, tenant.Id, CanReadInternal(currentUser));
        }
        throw new SocException(404, "Case niet gevonden.");
    }

    private static void AddEntry(ResearchCase researchCase, AppUser currentUser, CaseActionRequest input)
    {
        var kind = Analyst(currentUser) ? Required(input.Kind, 40) : "Klantreactie";
        Require(new[] { "Notitie", "Observable", "Actie", "Bewijsreferentie", "Klantreactie" }.Contains(kind), "Ongeldig type.", 400);
        var text = Required(input.Text, 2000);
        if (kind == "Observable")
        {
            var type = Required(input.Type, 20);
            var assessment = Required(input.Assessment, 20);
            ValidateObservable(type, text, assessment);
            researchCase.Observables.Add(new()
            {
                Actor = currentUser.Name,
                Value = text,
                Type = type,
                Assessment = assessment
            });
            researchCase.Entries.Add(new()
            {
                Actor = currentUser.Name,
                Kind = "Observablebeoordeling",
                Text = $"{type}: {text} — {assessment}"
            });
        }
        else
            researchCase.Entries.Add(new()
            {
                Actor = currentUser.Name,
                Kind = kind,
                Text = text,
                Visible = kind == "Klantreactie" || input.Visible == true && kind != "Bewijsreferentie"
            });
    }

    private static void ChangeStatus(ResearchCase researchCase, AppUser currentUser, CaseActionRequest input)
    {
        Require(Enum.TryParse<TicketStatus>(input.Status, out var status) && Enum.IsDefined(status), "Ongeldige status.", 400);
        Require(CanChangeCaseStatus(researchCase.Status, status, currentUser.Role == "Senior analist"), "Deze statusovergang is niet toegestaan. Volg de onderzoeksworkflow.", 409);
        if (Closed(researchCase))
        {
            researchCase.ClosedAt = null;
            researchCase.Entries.Add(new()
            {
                Actor = currentUser.Name,
                Kind = "Status",
                Text = "Heropend: " + Required(input.Reason)
            });
            foreach (var alert in researchCase.Alerts)
            {
                alert.Status = AlertStatus.Escalated;
                AlertService.Event(alert, currentUser.Name, "Case heropend");
            }
        }
        if (status == TicketStatus.Closed)
        {
            var summary = Required(input.Summary, 2000);
            researchCase.Summary = summary;
            researchCase.Conclusion = Required(input.Conclusion, 2000);
            researchCase.ClosedAt = DateTimeOffset.UtcNow;
            researchCase.Entries.Add(new()
            {
                Actor = currentUser.Name,
                Kind = "Samenvatting",
                Text = summary
            });
            foreach (var alert in researchCase.Alerts)
            {
                alert.Status = AlertStatus.Resolved;
                AlertService.Event(alert, currentUser.Name, "Case afgesloten");
            }
        }
        researchCase.Entries.Add(new()
        {
            Actor = currentUser.Name,
            Kind = "Status",
            Text = $"{researchCase.Status} → {status}"
        });
        researchCase.Status = status;
    }

    private static void ChangeVisibility(ResearchCase researchCase, CaseActionRequest input)
    {
        Require(input.Visible.HasValue, "Ongeldige zichtbaarheid.", 400);
        researchCase.CustomerVisible = input.Visible!.Value;
    }

    private async Task AssignOwnerAsync(ResearchCase researchCase, AppUser currentUser, CaseActionRequest input, Tenant tenant)
    {
        var owner = await users.FindByIdAsync(input.UserId.ToString()!) ?? throw new SocException(400, "Analist niet gevonden.");
        Require(owner.IsActive && Analyst(owner) && (await platform.Scopes(owner, tenant.Id)).Contains(researchCase.ScopeId), "Analist heeft geen toegang tot scope.", 400);
        var initial = researchCase.Status == TicketStatus.Open;
        Require(!initial || currentUser.Role == "Senior analist", "Een senior analist moet de case eerst prioriteren en toewijzen.", 403);
        Require(initial || owner.Id != researchCase.OwnerId, "Deze analist is al eigenaar.", 400);
        if (!string.IsNullOrWhiteSpace(input.Priority))
        {
            Require(currentUser.Role == "Senior analist", "Alleen een senior mag de prioriteit wijzigen.", 403);
            researchCase.Priority = Priority(input.Priority);
        }
        var reason = Required(input.Reason, 2000);
        var next = Required(input.NextAction, 2000);
        researchCase.Entries.Add(new()
        {
            Actor = currentUser.Name,
            Kind = "Overdracht",
            Text = $"Van {researchCase.Owner} ({researchCase.OwnerId}) naar {owner.Name} ({owner.Id}). Toelichting: {reason}. Volgende actie: {next}"
        });
        researchCase.OwnerId = owner.Id;
        researchCase.Owner = owner.Name;
        if (initial)
        {
            researchCase.Status = TicketStatus.UnderInvestigation;
            researchCase.Entries.Add(new()
            {
                Actor = currentUser.Name,
                Kind = "Status",
                Text = "Geprioriteerd (" + researchCase.Priority + ") en toegewezen aan " + owner.Name
            });
        }
    }

    private static async Task LinkAlertAsync(TenantDbContext tenantDb, ResearchCase researchCase, AppUser currentUser, CaseActionRequest input)
    {
        Require(input.AlertId.HasValue, "Alert vereist.", 400);
        var link = await tenantDb.Alerts.Include(record => record.History).SingleOrDefaultAsync(record => record.Id == input.AlertId && record.ScopeId == researchCase.ScopeId);
        Require(link != null && link.CaseId == null && AlertService.NeedsCase(link.Triage) && link.Status == AlertStatus.UnderReview, "Alert niet geschikt voor koppeling.", 409);
        link!.CaseId = researchCase.Id;
        link.Status = AlertStatus.Escalated;
        AlertService.Event(link, currentUser.Name, "Gekoppeld aan " + researchCase.Number);
        researchCase.Alerts.Add(link);
    }

}
