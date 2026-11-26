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
        {
            return;
        }
        const string marker = "Projectgroep-demoaccounts ingericht v1";
        // Deactivate the former group member on existing demo databases, without deleting history.
        const string rosterMarker = "Projectgroep-demoaccounts bijgewerkt v2";
        if (!await db.Audit.AnyAsync(entry => entry.Action == rosterMarker))
        {
            await using var rosterTransaction = await db.Database.BeginTransactionAsync();
            var former = await users.FindByNameAsync("riza@soc.demo");
            if (former != null)
            {
                former.IsActive = false;
                db.Assignments.RemoveRange(db.Assignments.Where(assignment => assignment.UserId == former.Id));
                var result = await users.UpdateSecurityStampAsync(former);
                Require(result.Succeeded, string.Join(" ", result.Errors.Select(error => error.Description)), 500);
            }
            db.Audit.Add(new()
            {
                Actor = "Systeem",
                Action = rosterMarker
            });
            await db.SaveChangesAsync();
            await rosterTransaction.CommitAsync();
        }
        if (await db.Audit.AnyAsync(entry => entry.Action == marker))
        {
            return;
        }
        await using var transaction = await db.Database.BeginTransactionAsync();
        var tenants = await db.Tenants
            .OrderBy(organization => organization.Name == "Northstar Finance" ? 0 :
                organization.Name == "Delta Logistics" ? 1 : 2)
            .ThenBy(organization => organization.Name)
            .Select(organization => organization.Id)
            .ToArrayAsync();
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
            {
                continue;
            }
            var user = new AppUser
            {
                Id = Guid.NewGuid(),
                Name = member.Name,
                Email = member.Login,
                UserName = member.Login,
                EmailConfirmed = true,
                Role = member.Role,
                LockoutEnabled = true
            };
            var result = await users.CreateAsync(user, "Demo2026!");
            Require(result.Succeeded, string.Join(" ", result.Errors.Select(error => error.Description)), 500);
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
    public async Task InitializeAsync()
    {
        await db.Database.EnsureCreatedAsync();
        await db.Database.ExecuteSqlRawAsync("IF COL_LENGTH('platform.AspNetUsers','DeletedAt') IS NULL ALTER TABLE [platform].[AspNetUsers] ADD [DeletedAt] datetimeoffset NULL;");
        await db.Database.ExecuteSqlRawAsync("IF COL_LENGTH('platform.Tenants','ResponseMinutes') IS NULL ALTER TABLE [platform].[Tenants] ADD ResponseMinutes int NOT NULL CONSTRAINT DF_Tenants_ResponseMinutes DEFAULT(60);");
        if (await db.Tenants.AnyAsync())
        {
            Require(await db.Audit.AnyAsync(entry => entry.Action == "Demonstratiegegevens aangemaakt"), "Onvolledige demodatabase: reset uitsluitend de demo-volumes en start opnieuw.", 500);
            foreach (var tenant in await db.Tenants.ToListAsync())
            {
                await factory.UpgradeDemoAsync(tenant);
            }
            await InitializeTeamAccountsAsync();
            return;
        }
        var demoTenants = new List<Tenant>();
        foreach (var name in new[] { "Northstar Finance", "Delta Logistics", "Atlas Health" })
        {
            demoTenants.Add(await CreateTenant(name));
        }
        var organizationIds = demoTenants.Select(organization => organization.Id).ToArray();
        var demoAnalyst = new AppUser
        {
            Id = Guid.NewGuid(),
            Name = "Alex Morgan",
            Email = "analist@soc.demo",
            UserName = "analist@soc.demo",
            EmailConfirmed = true,
            Role = "Analist",
            LockoutEnabled = true
        };
        var accounts = new[]
        {
            demoAnalyst,
            new AppUser
            {
                Id = Guid.NewGuid(),
                Name = "Sam de Vries",
                Email = "senior@soc.demo",
                UserName = "senior@soc.demo",
                Role = "Senior analist",
                EmailConfirmed = true,
                LockoutEnabled = true
            },
            new AppUser
            {
                Id = Guid.NewGuid(),
                Name = "Robin Peters",
                Email = "beheerder@soc.demo",
                UserName = "beheerder@soc.demo",
                Role = "Beheerder",
                EmailConfirmed = true,
                LockoutEnabled = true
            },
            new AppUser
            {
                Id = Guid.NewGuid(),
                Name = "Jamie Bakker",
                Email = "klant@soc.demo",
                UserName = "klant@soc.demo",
                Role = "Klant",
                EmailConfirmed = true,
                LockoutEnabled = true
            },
            new AppUser
            {
                Id = Guid.NewGuid(),
                Name = "Kim Jansen",
                Email = "accountmanager@soc.demo",
                UserName = "accountmanager@soc.demo",
                Role = "Accountmanager",
                EmailConfirmed = true,
                LockoutEnabled = true
            }
        };
        foreach (var account in accounts)
        {
            var creationResult = await users.CreateAsync(account, "Demo2026!");
            Require(creationResult.Succeeded, string.Join(" ", creationResult.Errors.Select(error => error.Description)), 500);
            await SetGrants(account, account.Role, account.Role switch
            {
                "Klant" => organizationIds[..1],
                "Accountmanager" => organizationIds[..2],
                "Beheerder" => [],
                _ => organizationIds
            });
        }
        await Log(demoAnalyst, "Demonstratiegegevens aangemaakt");
        await InitializeTeamAccountsAsync();
    }
}
