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

    static readonly string[] Roles = ["Analist", "Senior analist", "Beheerder", "Klant", "Accountmanager"];
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
    static int SlaMinutes(int? minutes)
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
    internal async Task<Tenant> Tenant(Guid? id) => await db.Tenants.SingleOrDefaultAsync(x => x.Id == id) ?? throw new SocException(404, "Klant niet gevonden.");
    internal async Task<List<Guid>> Scopes(AppUser user, Guid tenant)
    {
        return await db.Assignments
            .Where(assignment => assignment.UserId == user.Id && assignment.TenantId == tenant)
            .Select(assignment => assignment.ScopeId)
            .ToListAsync();
    }
    internal async Task<List<(Tenant Tenant, List<Guid> Scopes)>> Workspaces(AppUser user, Guid? tenant = null, Guid? scope = null)
    {
        var organizationIds = await db.Assignments.Where(x => x.UserId == user.Id).Select(x => x.TenantId).Distinct().ToListAsync();
        if (tenant.HasValue)
            Require(organizationIds.Contains(tenant.Value) && await db.Tenants.AnyAsync(organization => organization.Id == tenant.Value && organization.IsActive));
        var activeTenants = await db.Tenants.Where(x => x.IsActive && organizationIds.Contains(x.Id) && (!tenant.HasValue || x.Id == tenant.Value)).ToListAsync();
        var result = new List<(Tenant, List<Guid>)>();
        foreach (var organization in activeTenants)
        {
            var scopes = await Scopes(user, organization.Id);
            if (scope.HasValue)
                scopes = scopes.Where(x => x == scope.Value).ToList();
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
            var scopes = await db.Scopes.Where(x => x.TenantId == organization.Id && (!scope.HasValue || x.Id == scope.Value)).Select(x => x.Id).ToListAsync();
            if (scopes.Count > 0)
                result.Add((organization, scopes));
        }
        return result;
    }
    public async Task<List<Tenant>> Organizations(AppUser user)
    {
        if (user.Role == "Beheerder")
            return await db.Tenants.OrderBy(x => x.Name).ToListAsync();
        return (await Workspaces(user)).Select(x => x.Tenant).OrderBy(x => x.Name).ToList();
    }
    public async Task<Tenant> Organization(AppUser user, Guid id)
    {
        var tenant = await Tenant(id);
        Require(user.Role == "Beheerder" || tenant.IsActive && (await Scopes(user, id)).Count > 0);
        return tenant;
    }
    async Task<Tenant> CreateTenant(string name, int responseMinutes = DefaultResponseMinutes)
    {
        Require(!await db.Tenants.AnyAsync(x => x.Name == name), "Naam bestaat al.", 409);
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
    public async Task<Tenant> CreateOrganization(AppUser user, CreateOrganizationRequest input)
    {
        Admin(user);
        var organization = await CreateTenant(Required(input.Name, 120), SlaMinutes(input.ResponseMinutes));
        await Log(user, "Klant aangemaakt", organization.Id);
        return organization;
    }
    public async Task<Tenant> RenameOrganization(AppUser user, Guid id, string? name, int? responseMinutes = null)
    {
        Admin(user);
        var value = Required(name, 120);
        var organization = await Tenant(id);
        Require(!await db.Tenants.AnyAsync(x => x.Id != id && x.Name == value), "Naam bestaat al.", 409);
        organization.Name = value;
        if (responseMinutes.HasValue)
            organization.ResponseMinutes = SlaMinutes(responseMinutes);
        await Log(user, "Klantinstellingen gewijzigd", organization.Id, organization.Id.ToString());
        return organization;
    }
    public async Task<Tenant> SetOrganization(AppUser user, Guid id, bool active)
    {
        Admin(user);
        var organization = await Tenant(id);
        organization.IsActive = active;
        organization.DeactivatedAt = active ? null : DateTimeOffset.UtcNow;
        await Log(user, "Klantstatus gewijzigd", id);
        return organization;
    }
    private static object KeyDto(ApiSource apiKey)
    {
        return new
        {
            id = apiKey.Id,
            apiKey.Name,
            organizationId = apiKey.TenantId,
            apiKey.ScopeId,
            apiKey.CreatedAt,
            apiKey.IsActive,
            apiKey.Prefix
        };
    }
    public async Task<object> Keys(AppUser user)
    {
        Admin(user);
        return (await db.Sources.ToListAsync()).Select(KeyDto);
    }
    public async Task<object> CreateKey(AppUser user, CreateApiKeyRequest input)
    {
        Admin(user);
        var organization = await Tenant(input.OrganizationId);
        Require(organization.IsActive, "Klant is inactief.", 400);
        var scope = await db.Scopes.FirstOrDefaultAsync(x => x.TenantId == organization.Id && (!input.ScopeId.HasValue || x.Id == input.ScopeId)) ?? throw new SocException(400, "Scope ontbreekt.");
        var secret = "soc_demo_" + Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var apiSource = new ApiSource { TenantId = organization.Id, ScopeId = scope.Id, Name = Required(input.Name, 80), Hash = Hash(secret), Prefix = secret[..16] };
        db.Sources.Add(apiSource);
        await Log(user, "API-sleutel aangemaakt", organization.Id);
        return new
        {
            id = apiSource.Id,
            apiSource.Name,
            organizationId = apiSource.TenantId,
            apiSource.ScopeId,
            apiSource.CreatedAt,
            apiSource.IsActive,
            apiSource.Prefix,
            secret
        };
    }
    public async Task<object> Revoke(AppUser user, Guid id)
    {
        Admin(user);
        var apiSource = await db.Sources.FindAsync(id) ?? throw new SocException(404, "Sleutel niet gevonden.");
        apiSource.IsActive = false;
        await Log(user, "API-sleutel ingetrokken", apiSource.TenantId);
        return new
        {
            ok = true
        };
    }
    public async Task<object> Audit(AppUser user)
    {
        Admin(user);
        var result = (await db.Audit.ToListAsync()).Select(x => new AuditRow(x.Id, x.CreatedAt, x.Actor, x.Action, x.TenantId, x.Target)).ToList();
        foreach (var organization in await db.Tenants.ToListAsync())
        {
            await using var tenantDb = factory.Open(organization);
            result.AddRange((await tenantDb.Audit.ToListAsync()).Select(x => new AuditRow(x.Id, x.CreatedAt, x.Actor, x.Action, organization.Id, x.Target)));
        }
        return result.OrderByDescending(x => x.CreatedAt);
    }
    public record AuditRow(Guid Id, DateTimeOffset CreatedAt, string Actor, string Action, Guid? OrganizationId, string? Target);
    // Administrative register: identifiers and lifecycle metadata only.
    // Do not include titles, owners, scope IDs, observables, payloads or investigation entries.
    public async Task<object> TicketRegister(AppUser user)
    {
        Admin(user);
        var rows = new List<object>();
        foreach (var tenant in await db.Tenants.OrderBy(t => t.Name).ToListAsync())
        {
            await using var tenantDb = factory.Open(tenant);
            var cases = await tenantDb.Cases.AsNoTracking()
                .Select(x => new { x.Id, x.Number, x.Status, x.CreatedAt, x.ClosedAt })
                .OrderByDescending(x => x.CreatedAt).ToListAsync();
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
        await Log(user, "Ticketregister bekeken");
        return rows;
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
