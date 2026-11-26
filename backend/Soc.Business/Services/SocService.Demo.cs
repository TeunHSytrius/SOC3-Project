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
    // Demo-only, one-time addition for both new and previously initialized databases.
    // Never reset an edited password, role, name or active status on restart.
    async Task InitializeTeamAccountsAsync()
    {
        if (!config.GetValue<bool>("Demo:Enabled"))
            return;
        const string marker = "Projectgroep-demoaccounts ingericht v1";
        // Deactivate the former group member on existing demo databases, without deleting history.
        const string rosterMarker = "Projectgroep-demoaccounts bijgewerkt v2";
        if (!await db.Audit.AnyAsync(x => x.Action == rosterMarker))
        {
            await using var rosterTransaction = await db.Database.BeginTransactionAsync();
            var former = await users.FindByNameAsync("riza@soc.demo");
            if (former != null)
            {
                former.IsActive = false;
                db.Assignments.RemoveRange(db.Assignments.Where(x => x.UserId == former.Id));
                var result = await users.UpdateSecurityStampAsync(former);
                Require(result.Succeeded, string.Join(" ", result.Errors.Select(x => x.Description)), 500);
            }
            db.Audit.Add(new()
            {
                Actor = "Systeem",
                Action = rosterMarker
            });
            await db.SaveChangesAsync();
            await rosterTransaction.CommitAsync();
        }
        if (await db.Audit.AnyAsync(x => x.Action == marker))
            return;
        await using var transaction = await db.Database.BeginTransactionAsync();
        var tenants = await db.Tenants.OrderBy(t => t.Name == "Northstar Finance" ? 0 : t.Name == "Delta Logistics" ? 1 : 2).ThenBy(t => t.Name).Select(t => t.Id).ToArrayAsync();
        Require(tenants.Length > 0, "Geen demoklanten beschikbaar.", 500);
        var members = new (string Name, string Login, string Role)[]
        {
            ("Teun Hanssen","teun@soc.demo","Beheerder"),
            ("Dominique Roosen","dominique@soc.demo","Senior analist"),
            ("Sergio Mendez","sergio@soc.demo","Analist"),
            ("Hamza Ben Ali","hamza@soc.demo","Analist"),
            ("Ruben Abrahamse","ruben@soc.demo","Accountmanager"),
            ("Thijs Dronkers","thijs@soc.demo","Klant")
        };
        foreach (var member in members)
        {
            if (await users.FindByNameAsync(member.Login) != null || await users.FindByEmailAsync(member.Login) != null)
                continue;
            var user = new AppUser { Id = Guid.NewGuid(), Name = member.Name, Email = member.Login, UserName = member.Login, EmailConfirmed = true, Role = member.Role, LockoutEnabled = true };
            var result = await users.CreateAsync(user, "Demo2026!");
            Require(result.Succeeded, string.Join(" ", result.Errors.Select(x => x.Description)), 500);
            await SetGrants(user, member.Role, member.Role switch
            {
                "Beheerder" => [],
                "Klant" => tenants.Take(1).ToArray(),
                "Accountmanager" => tenants.Take(2).ToArray(),
                _ => tenants
            });
        }
        db.Audit.Add(new()
        {
            Actor = "Systeem",
            Action = marker
        });
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
    }
    async Task EnrichOriginalDemoAlertsAsync()
    {
        foreach (var tenant in await db.Tenants.Where(t => t.Name == "Northstar Finance" || t.Name == "Delta Logistics" || t.Name == "Atlas Health").ToListAsync())
        {
            await using var td = factory.Open(tenant);
            var candidates = await td.Alerts.Where(a => a.SourceIntegrationId == null && a.ExternalEventId == null && a.PayloadHash == null).ToListAsync();
            foreach (var alert in candidates)
            {
                if (DemoAlertContext.Enrich(alert))
                    LogTenant(td, alert.ScopeId, "Demo-initialisatie", "Fictieve securitycontext aangevuld", alert.Number);
            }
            await td.SaveChangesAsync();
        }
    }
    public async Task InitializeAsync()
    {
        await db.Database.EnsureCreatedAsync();
        await db.Database.ExecuteSqlRawAsync("IF COL_LENGTH('platform.AspNetUsers','DeletedAt') IS NULL ALTER TABLE [platform].[AspNetUsers] ADD [DeletedAt] datetimeoffset NULL;");
        await db.Database.ExecuteSqlRawAsync("IF COL_LENGTH('platform.Tenants','ResponseMinutes') IS NULL ALTER TABLE [platform].[Tenants] ADD ResponseMinutes int NOT NULL CONSTRAINT DF_Tenants_ResponseMinutes DEFAULT(60);");
        if (await db.Tenants.AnyAsync())
        {
            Require(await db.Audit.AnyAsync(x => x.Action == "Demonstratiegegevens aangemaakt"), "Onvolledige demodatabase: reset uitsluitend de demo-volumes en start opnieuw.", 500);
            foreach (var tenant in await db.Tenants.ToListAsync())
                await factory.UpgradeDemoAsync(tenant);
            await InitializeTeamAccountsAsync();
            await EnrichOriginalDemoAlertsAsync();
            return;
        }
        var ts = new List<Tenant>();
        foreach (var name in new[] { "Northstar Finance", "Delta Logistics", "Atlas Health" })
            ts.Add(await CreateTenant(name));
        var ids = ts.Select(x => x.Id).ToArray();
        var a = new AppUser { Id = Guid.NewGuid(), Name = "Alex Morgan", Email = "analist@soc.demo", UserName = "analist@soc.demo", EmailConfirmed = true, Role = "Analist", LockoutEnabled = true };
        var accounts = new[] { a, new AppUser { Id = Guid.NewGuid(), Name = "Sam de Vries", Email = "senior@soc.demo", UserName = "senior@soc.demo", Role = "Senior analist", EmailConfirmed = true, LockoutEnabled = true }, new AppUser { Id = Guid.NewGuid(), Name = "Robin Peters", Email = "beheerder@soc.demo", UserName = "beheerder@soc.demo", Role = "Beheerder", EmailConfirmed = true, LockoutEnabled = true }, new AppUser { Id = Guid.NewGuid(), Name = "Jamie Bakker", Email = "klant@soc.demo", UserName = "klant@soc.demo", Role = "Klant", EmailConfirmed = true, LockoutEnabled = true }, new AppUser { Id = Guid.NewGuid(), Name = "Kim Jansen", Email = "accountmanager@soc.demo", UserName = "accountmanager@soc.demo", Role = "Accountmanager", EmailConfirmed = true, LockoutEnabled = true } };
        foreach (var u in accounts)
        {
            var r = await users.CreateAsync(u, "Demo2026!");
            Require(r.Succeeded, string.Join(" ", r.Errors.Select(x => x.Description)), 500);
            await SetGrants(u, u.Role, u.Role switch
            {
                "Klant" => ids[..1],
                "Accountmanager" => ids[..2],
                "Beheerder" => [],
                _ => ids
            });
        }
        var samples = new (string Title, string Description, string Source, string Priority, double Hours, int Tenant)[] { ("Verdachte inlogpogingen", "Meerdere mislukte aanmeldingen op een serviceaccount.", "Microsoft Sentinel", "Urgent", -5, 0), ("Malware gedetecteerd", "Endpointbeveiliging heeft een verdacht bestand geblokkeerd.", "Defender", "High", -7, 1), ("Ongebruikelijke dataoverdracht", "Afwijkend uitgaand netwerkverkeer gedetecteerd.", "Splunk", "Immediate", -.4, 0), ("Phishingmelding", "Gebruiker meldt een verdachte e-mail.", "Defender", "Moderate", -3, 2), ("Afwijkende VPN-login", "Inloggen vanaf een onbekende locatie.", "Sentinel", "High", -2, 0), ("Poortscan gedetecteerd", "Ongebruikelijke scans op een interne host.", "Suricata", "Low", -1, 1), ("Verdacht PowerShell-proces", "Endpoint heeft afwijkende uitvoering gemeld.", "Defender", "Urgent", -.6, 2), ("Geblokkeerde verbinding", "Firewall heeft ongebruikelijk verkeer geblokkeerd.", "Firewall", "Moderate", -.2, 1) };
        for (int n = 0; n < samples.Length; n++)
        {
            var s = samples[n];
            var t = ts[s.Tenant];
            var scope = await db.Scopes.FirstAsync(x => x.TenantId == t.Id);
            await using var td = factory.Open(t);
            var alert = AlertService.NewAlert(scope.Id, new CreateAlertRequest { Title = s.Title, Description = s.Description, Priority = s.Priority }, s.Source, DateTimeOffset.UtcNow.AddHours(s.Hours));
            alert.Number = $"ALT-{1001 + n}";
            DemoAlertContext.Enrich(alert);
            td.Alerts.Add(alert);
            if (n == 4)
            {
                var c = new ResearchCase { ScopeId = scope.Id, Number = "CASE-201", Title = "Onderzoek afwijkende VPN-login", Priority = alert.Priority, Status = TicketStatus.UnderInvestigation, OwnerId = a.Id, Owner = a.Name, CustomerVisible = true };
                c.Entries.Add(new()
                {
                    Actor = a.Name,
                    Kind = "Notitie",
                    Text = "Loginlog gecontroleerd; aanvullend onderzoek nodig.",
                    Visible = false
                });
                c.Entries.Add(new()
                {
                    Actor = a.Name,
                    Kind = "Actie",
                    Text = "Klant geïnformeerd over het onderzoek.",
                    Visible = true
                });
                td.Cases.Add(c);
                alert.CaseId = c.Id;
                alert.Triage = "True positive";
                alert.Status = AlertStatus.Escalated;
                alert.FirstHandledAt = DateTimeOffset.UtcNow.AddHours(-1.5);
                alert.OwnerId = a.Id;
                alert.Owner = a.Name;
            }
            if (n == 7)
            {
                alert.Status = AlertStatus.Dismissed;
                alert.Triage = "False positive";
                alert.FirstHandledAt = DateTimeOffset.UtcNow.AddHours(-.1);
                alert.OwnerId = accounts[1].Id;
                alert.Owner = accounts[1].Name;
            }
            await td.SaveChangesAsync();
        }
        await Log(a, "Demonstratiegegevens aangemaakt");
        await InitializeTeamAccountsAsync();
    }
}
