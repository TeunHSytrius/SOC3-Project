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
    internal static bool Closed(ResearchCase c) => c.Status == TicketStatus.Closed;

    internal static PriorityLevel Priority(string? p)
    {
        Require(Enum.TryParse<PriorityLevel>(p, out var v) && Enum.IsDefined(v), "Ongeldige prioriteit.", 400);
        return v;
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
        var ids = await db.Assignments.Where(x => x.UserId == user.Id).Select(x => x.TenantId).Distinct().ToListAsync();
        if (tenant.HasValue)
            Require(ids.Contains(tenant.Value) && await db.Tenants.AnyAsync(t => t.Id == tenant.Value && t.IsActive));
        var ts = await db.Tenants.Where(x => x.IsActive && ids.Contains(x.Id) && (!tenant.HasValue || x.Id == tenant.Value)).ToListAsync();
        var result = new List<(Tenant, List<Guid>)>();
        foreach (var t in ts)
        {
            var scopes = await Scopes(user, t.Id);
            if (scope.HasValue)
                scopes = scopes.Where(x => x == scope.Value).ToList();
            if (scopes.Count > 0)
                result.Add((t, scopes));
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
        foreach (var t in await db.Tenants.Where(t => !tenant.HasValue || t.Id == tenant.Value).ToListAsync())
        {
            var scopes = await db.Scopes.Where(x => x.TenantId == t.Id && (!scope.HasValue || x.Id == scope.Value)).Select(x => x.Id).ToListAsync();
            if (scopes.Count > 0)
                result.Add((t, scopes));
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
        var t = new Tenant { Name = name, ResponseMinutes = responseMinutes };
        t.SchemaName = "tenant_" + t.Id.ToString("N");
        await factory.ProvisionAsync(t);
        db.Tenants.Add(t);
        db.Scopes.Add(new()
        {
            TenantId = t.Id,
            Name = "Algemeen"
        });
        await db.SaveChangesAsync();
        return t;
    }
    public async Task<Tenant> CreateOrganization(AppUser user, CreateOrganizationRequest input)
    {
        Admin(user);
        var t = await CreateTenant(Required(input.Name, 120), SlaMinutes(input.ResponseMinutes));
        await Log(user, "Klant aangemaakt", t.Id);
        return t;
    }
    public async Task<Tenant> RenameOrganization(AppUser user, Guid id, string? name, int? responseMinutes = null)
    {
        Admin(user);
        var value = Required(name, 120);
        var t = await Tenant(id);
        Require(!await db.Tenants.AnyAsync(x => x.Id != id && x.Name == value), "Naam bestaat al.", 409);
        t.Name = value;
        if (responseMinutes.HasValue)
            t.ResponseMinutes = SlaMinutes(responseMinutes);
        await Log(user, "Klantinstellingen gewijzigd", t.Id, t.Id.ToString());
        return t;
    }
    public async Task<Tenant> SetOrganization(AppUser user, Guid id, bool active)
    {
        Admin(user);
        var t = await Tenant(id);
        t.IsActive = active;
        t.DeactivatedAt = active ? null : DateTimeOffset.UtcNow;
        await Log(user, "Klantstatus gewijzigd", id);
        return t;
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
        var t = await Tenant(input.OrganizationId);
        Require(t.IsActive, "Klant is inactief.", 400);
        var scope = await db.Scopes.FirstOrDefaultAsync(x => x.TenantId == t.Id && (!input.ScopeId.HasValue || x.Id == input.ScopeId)) ?? throw new SocException(400, "Scope ontbreekt.");
        var secret = "soc_demo_" + Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var k = new ApiSource { TenantId = t.Id, ScopeId = scope.Id, Name = Required(input.Name, 80), Hash = Hash(secret), Prefix = secret[..16] };
        db.Sources.Add(k);
        await Log(user, "API-sleutel aangemaakt", t.Id);
        return new
        {
            id = k.Id,
            k.Name,
            organizationId = k.TenantId,
            k.ScopeId,
            k.CreatedAt,
            k.IsActive,
            k.Prefix,
            secret
        };
    }
    public async Task<object> Revoke(AppUser user, Guid id)
    {
        Admin(user);
        var k = await db.Sources.FindAsync(id) ?? throw new SocException(404, "Sleutel niet gevonden.");
        k.IsActive = false;
        await Log(user, "API-sleutel ingetrokken", k.TenantId);
        return new
        {
            ok = true
        };
    }
    public async Task<object> Audit(AppUser user)
    {
        Admin(user);
        var result = (await db.Audit.ToListAsync()).Select(x => new AuditRow(x.Id, x.CreatedAt, x.Actor, x.Action, x.TenantId, x.Target)).ToList();
        foreach (var t in await db.Tenants.ToListAsync())
        {
            await using var td = factory.Open(t);
            result.AddRange((await td.Audit.ToListAsync()).Select(x => new AuditRow(x.Id, x.CreatedAt, x.Actor, x.Action, t.Id, x.Target)));
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
            await using var td = factory.Open(tenant);
            var cases = await td.Cases.AsNoTracking()
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
