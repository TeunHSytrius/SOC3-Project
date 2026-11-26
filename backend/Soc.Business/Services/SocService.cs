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
    private readonly SocDbContext db;
    private readonly TenantDbFactory factory;
    private readonly UserManager<AppUser> users;
    private readonly IConfiguration config;

    public SocService(SocDbContext db, TenantDbFactory factory, UserManager<AppUser> users, IConfiguration config)
    {
        this.db = db;
        this.factory = factory;
        this.users = users;
        this.config = config;
    }

    internal static readonly string[] Roles = ["Analist", "Senior analist", "Beheerder", "Klant", "Accountmanager"];
    public static void Require(bool condition, string message = "Toegang geweigerd.", int status = 403)
    {
        if (!condition)
            throw new SocException(status, message);
    }

    public static string Required(string? value, int max = 500)
    {
        Require(!string.IsNullOrWhiteSpace(value) && value.Length <= max, "Ongeldige of ontbrekende invoer.", 400);
        return value!.Trim();
    }

    public static string RequiredPassword(string? password)
    {
        Require(!string.IsNullOrWhiteSpace(password) && password.Length <= 200,
            "Ongeldig of ontbrekend wachtwoord.", 400);

        // Passwords are opaque values. Do not normalize or trim them.
        return password!;
    }

    public static bool Analyst(AppUser user) => user.Role is "Analist" or "Senior analist";
    internal static bool CanReadInternal(AppUser user) => Analyst(user) || user.Role == "Beheerder";
    public static void Admin(AppUser user) => Require(user.Role == "Beheerder");
    internal static bool Closed(ResearchCase researchCase) => researchCase.Status == TicketStatus.Closed;

    internal static PriorityLevel Priority(string? value)
    {
        Require(Enum.TryParse<PriorityLevel>(value, out var priority) && Enum.IsDefined(priority), "Ongeldige prioriteit.", 400);
        return priority;
    }

    internal static string Hash(string key) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(key)));
    internal const int DefaultResponseMinutes = 60;
    internal static int SlaMinutes(int? minutes)
    {
        var value = minutes ?? DefaultResponseMinutes;
        Require(value >= 1 && value <= 10080, "SLA moet tussen 1 en 10080 minuten liggen.", 400);
        return value;
    }

    private bool NeedsTwoFactor(AppUser user)
    {
        bool internalRole = user.Role is "Analist" or "Senior analist" or "Beheerder";
        if (user.TwoFactorEnabled || !internalRole)
            return false;

        bool demoAccount = config.GetValue<bool>("Demo:Enabled") &&
            user.Email!.EndsWith("@soc.demo", StringComparison.OrdinalIgnoreCase);

        return !demoAccount;
    }

    public async Task<AppUser> UserAsync(System.Security.Claims.ClaimsPrincipal principal, bool allowSetup = false)
    {
        var user = await users.GetUserAsync(principal);
        Require(user is { IsActive: true }, "Log opnieuw in.", 401);
        Require(allowSetup || !NeedsTwoFactor(user!), "Stel eerst tweestapsverificatie in via Account.", 403);
        return user!;
    }

    public async Task<object> PublicUser(AppUser user)
    {
        var organizationIds = await db.Assignments
            .Where(assignment => assignment.UserId == user.Id)
            .Select(assignment => assignment.TenantId)
            .Distinct()
            .ToArrayAsync();

        return new
        {
            id = user.Id,
            user.Name,
            user.Email,
            user.Role,
            user.IsActive,
            user.TwoFactorEnabled,
            requiresTwoFactorSetup = NeedsTwoFactor(user),
            organizationIds
        };
    }

    public async Task<object> Access(AppUser user)
    {
        var publicUser = await PublicUser(user);
        var workspaces = await (
            from assignment in db.Assignments
            join scope in db.Scopes on assignment.ScopeId equals scope.Id
            join tenant in db.Tenants on assignment.TenantId equals tenant.Id
            where assignment.UserId == user.Id
            select new
            {
                workspaceId = tenant.Id,
                tenantName = tenant.Name,
                scopeId = scope.Id,
                scopeName = scope.Name
            }).ToListAsync();

        return new
        {
            user = publicUser,
            workspaces
        };
    }

    public async Task Log(AppUser user, string action, Guid? tenant = null, string? target = null)
    {
        db.Audit.Add(new()
        {
            Actor = user.Name,
            Action = action,
            TenantId = tenant,
            Target = target
        });
        await db.SaveChangesAsync();
    }

    internal static void LogTenant(TenantDbContext tenantDb, Guid scope, string actor, string action, string target)
    {
        tenantDb.Audit.Add(new TenantAudit
        {
            ScopeId = scope,
            Actor = actor,
            Action = action,
            Target = target
        });
    }

    internal async Task<Tenant> Tenant(Guid? id) => await db.Tenants.SingleOrDefaultAsync(organization => organization.Id == id) ?? throw new SocException(404, "Klant niet gevonden.");
    internal async Task<List<Guid>> Scopes(AppUser user, Guid tenant)
    {
        return await db.Assignments
            .Where(assignment => assignment.UserId == user.Id && assignment.TenantId == tenant)
            .Select(assignment => assignment.ScopeId)
            .ToListAsync();
    }

    internal async Task<List<(Tenant Tenant, List<Guid> Scopes)>> Workspaces(AppUser user, Guid? tenant = null, Guid? scope = null)
    {
        var organizationIds = await db.Assignments.Where(assignment => assignment.UserId == user.Id).Select(assignment => assignment.TenantId).Distinct().ToListAsync();
        if (tenant.HasValue)
            Require(organizationIds.Contains(tenant.Value) && await db.Tenants.AnyAsync(organization => organization.Id == tenant.Value && organization.IsActive));
        var activeTenants = await db.Tenants.Where(organization => organization.IsActive && organizationIds.Contains(organization.Id) && (!tenant.HasValue || organization.Id == tenant.Value)).ToListAsync();
        var result = new List<(Tenant, List<Guid>)>();
        foreach (var organization in activeTenants)
        {
            var scopes = await Scopes(user, organization.Id);
            if (scope.HasValue)
                scopes = scopes.Where(scopeId => scopeId == scope.Value).ToList();
            if (scopes.Count > 0)
                result.Add((organization, scopes));
        }
        if (scope.HasValue)
            Require(result.Count > 0);
        return result;
    }
    // Platform administrators may inspect all tenants, including inactive ones.
    // Operational writes must still use the normal assigned, active workspace checks.
    internal async Task<List<(Tenant Tenant, List<Guid> Scopes)>> ReadWorkspaces(AppUser user, Guid? tenant = null, Guid? scope = null)
    {
        if (user.Role != "Beheerder")
            return await Workspaces(user, tenant, scope);
        var result = new List<(Tenant, List<Guid>)>();
        foreach (var organization in await db.Tenants.Where(organization => !tenant.HasValue || organization.Id == tenant.Value).ToListAsync())
        {
            var scopes = await db.Scopes.Where(availableScope => availableScope.TenantId == organization.Id && (!scope.HasValue || availableScope.Id == scope.Value)).Select(availableScope => availableScope.Id).ToListAsync();
            if (scopes.Count > 0)
                result.Add((organization, scopes));
        }
        return result;
    }

    internal async Task<Tenant> CreateTenant(string name, int responseMinutes = DefaultResponseMinutes)
    {
        Require(!await db.Tenants.AnyAsync(organization => organization.Name == name), "Naam bestaat al.", 409);
        var organization = new Tenant { Name = name, ResponseMinutes = responseMinutes };
        organization.SchemaName = "tenant_" + organization.Id.ToString("N");
        await factory.ProvisionAsync(organization);
        db.Tenants.Add(organization);
        db.Scopes.Add(new()
        {
            TenantId = organization.Id,
            Name = "Algemeen"
        });
        await db.SaveChangesAsync();
        return organization;
    }

    internal static void CheckVersion(byte[] actual, string? supplied)
    {
        Require(!string.IsNullOrWhiteSpace(supplied), "RowVersion is verplicht.", 400);
        byte[] version;
        try
        {
            version = Convert.FromBase64String(supplied!);
        }
        catch (FormatException) { throw new SocException(400, "Ongeldige RowVersion."); }
        Require(version.Length == 8, "Ongeldige RowVersion.", 400);
        Require(actual.SequenceEqual(version), "Dit record is ondertussen gewijzigd. Vernieuw de gegevens.", 409);
    }

}
