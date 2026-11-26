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
    static object CaseDto(ResearchCase c, Guid tenant, bool internalView) => new { id = c.Id, organizationId = tenant, c.ScopeId, c.Number, c.Title, c.Priority, c.Status, c.Owner, ownerId = internalView ? (Guid?)c.OwnerId : null, c.CreatedAt, c.ClosedAt, c.CustomerVisible, c.RowVersion, summary = c.Summary, conclusion = internalView ? c.Conclusion : null, alertIds = internalView ? c.Alerts.Select(x => x.Id).ToArray() : Array.Empty<Guid>(), entries = c.Entries.Where(x => internalView || x.Visible).Select(x => new EntryRow(x.Id, x.At, x.Actor, x.Kind, x.Text, x.Visible)).Concat(internalView ? c.Observables.Select(x => new EntryRow(x.Id, x.At, x.Actor, "Observable", $"{x.Type}: {x.Value} — {x.Assessment ?? "Niet beoordeeld"}", false)) : Enumerable.Empty<EntryRow>()).OrderBy(x => x.At) };
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
    static IQueryable<ResearchCase> CaseQuery(TenantDbContext td) => td.Cases.Include(x => x.Entries).Include(x => x.Observables).Include(x => x.Alerts).ThenInclude(x => x.History).AsSplitQuery();
    public async Task<object> Cases(AppUser u, Guid? workspace, Guid? scope)
    {
        Require(CanReadInternal(u) || u.Role is "Klant" or "Accountmanager");
        var result = new List<object>();
        foreach (var (t, scopes) in await platform.ReadWorkspaces(u, workspace, scope))
        {
            await using var td = factory.Open(t);
            foreach (var c in await CaseQuery(td).Where(x => scopes.Contains(x.ScopeId) && (CanReadInternal(u) || x.CustomerVisible)).ToListAsync())
                result.Add(CaseDto(c, t.Id, CanReadInternal(u)));
            foreach (var sid in scopes)
                LogTenant(td, sid, u.Name, "Caseoverzicht bekeken", "Cases");
            await td.SaveChangesAsync();
        }
        return result;
    }
    public async Task<object> CaseAction(AppUser currentUser, Guid id, string action, Input input, Guid? workspace, Guid? scope)
    {
        Require(action == "get" ? (CanReadInternal(currentUser) || currentUser.Role is "Klant" or "Accountmanager") : (Analyst(currentUser) || currentUser.Role == "Klant" && action == "entry"));
        foreach (var (tenant, scopes) in await (action == "get" ? platform.ReadWorkspaces(currentUser, workspace, scope) : platform.Workspaces(currentUser, workspace, scope)))
        {
            await using var tenantDb = factory.Open(tenant);
            await using var transaction = await tenantDb.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
            var researchCase = await CaseQuery(tenantDb).FirstOrDefaultAsync(x => x.Id == id && scopes.Contains(x.ScopeId) && (CanReadInternal(currentUser) || x.CustomerVisible));
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
                    break;
                case "status":
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
                    break;
                case "visibility":
                    Require(input.Visible.HasValue, "Ongeldige zichtbaarheid.", 400);
                    researchCase.CustomerVisible = input.Visible!.Value;
                    break;
                case "owner":
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
                    break;
                case "link":
                    Require(input.AlertId.HasValue, "Alert vereist.", 400);
                    var link = await tenantDb.Alerts.Include(x => x.History).SingleOrDefaultAsync(x => x.Id == input.AlertId && x.ScopeId == researchCase.ScopeId);
                    Require(link != null && link.CaseId == null && AlertService.NeedsCase(link.Triage) && link.Status == AlertStatus.UnderReview, "Alert niet geschikt voor koppeling.", 409);
                    link!.CaseId = researchCase.Id;
                    link.Status = AlertStatus.Escalated;
                    AlertService.Event(link, currentUser.Name, "Gekoppeld aan " + researchCase.Number);
                    researchCase.Alerts.Add(link);
                    break;
                default:
                    throw new SocException(404, "Onbekende actie.");
            }
            tenantDb.Entry(researchCase).Property(x => x.Title).IsModified = true;
            LogTenant(tenantDb, researchCase.ScopeId, currentUser.Name, "Case " + action, researchCase.Number);
            await tenantDb.SaveChangesAsync();
            await transaction.CommitAsync();
            return CaseDto(researchCase, tenant.Id, CanReadInternal(currentUser));
        }
        throw new SocException(404, "Case niet gevonden.");
    }
}
