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

    static readonly string[] Roles=["Analist","Senior analist","Beheerder","Klant","Accountmanager"];
    public static void Require(bool condition,string message="Toegang geweigerd.",int status=403){if(!condition)throw new SocException(status,message);}
    public static string Required(string? value,int max=500){Require(!string.IsNullOrWhiteSpace(value)&&value.Length<=max,"Ongeldige of ontbrekende invoer.",400);return value!.Trim();}
    public static bool Analyst(AppUser u)=>u.Role is "Analist" or "Senior analist";
    internal static bool CanReadInternal(AppUser u)=>Analyst(u)||u.Role=="Beheerder";
    public static void Admin(AppUser u)=>Require(u.Role=="Beheerder");
    internal static bool Closed(ResearchCase c)=>c.Status==TicketStatus.Closed;

    internal static PriorityLevel Priority(string? p){Require(Enum.TryParse<PriorityLevel>(p,out var v)&&Enum.IsDefined(v),"Ongeldige prioriteit.",400);return v;}
    internal static string Hash(string key)=>Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(key)));
    internal const int DefaultResponseMinutes=60;
    static int SlaMinutes(int? minutes){var value=minutes??DefaultResponseMinutes;Require(value>=1&&value<=10080,"SLA moet tussen 1 en 10080 minuten liggen.",400);return value;}
    bool NeedsTwoFactor(AppUser u)=>!u.TwoFactorEnabled && (u.Role is "Analist" or "Senior analist" or "Beheerder") && !(config.GetValue<bool>("Demo:Enabled")&&u.Email!.EndsWith("@soc.demo",StringComparison.OrdinalIgnoreCase));
    public async Task<AppUser> UserAsync(System.Security.Claims.ClaimsPrincipal principal,bool allowSetup=false){var u=await users.GetUserAsync(principal);Require(u is {IsActive:true},"Log opnieuw in.",401);Require(allowSetup||!NeedsTwoFactor(u!),"Stel eerst tweestapsverificatie in via Account.",403);return u!;}
    public async Task<object> PublicUser(AppUser u)=>new{id=u.Id,u.Name,u.Email,u.Role,u.IsActive,u.TwoFactorEnabled,requiresTwoFactorSetup=NeedsTwoFactor(u),organizationIds=await db.Assignments.Where(x=>x.UserId==u.Id).Select(x=>x.TenantId).Distinct().ToArrayAsync()};
    public async Task<object> Access(AppUser u)=>new{user=await PublicUser(u),workspaces=await (from a in db.Assignments join s in db.Scopes on a.ScopeId equals s.Id join t in db.Tenants on a.TenantId equals t.Id where a.UserId==u.Id select new{workspaceId=t.Id,tenantName=t.Name,scopeId=s.Id,scopeName=s.Name}).ToListAsync()};
    public async Task Log(AppUser u,string action,Guid? tenant=null,string? target=null){db.Audit.Add(new(){Actor=u.Name,Action=action,TenantId=tenant,Target=target});await db.SaveChangesAsync();}
    internal static void LogTenant(TenantDbContext t,Guid scope,string actor,string action,string target)=>t.Audit.Add(new(){ScopeId=scope,Actor=actor,Action=action,Target=target});
    internal async Task<Tenant> Tenant(Guid? id)=>await db.Tenants.SingleOrDefaultAsync(x=>x.Id==id)??throw new SocException(404,"Klant niet gevonden.");
    internal async Task<List<Guid>> Scopes(AppUser u,Guid tenant)=>await db.Assignments.Where(x=>x.UserId==u.Id&&x.TenantId==tenant).Select(x=>x.ScopeId).ToListAsync();
    internal async Task<List<(Tenant Tenant,List<Guid> Scopes)>> Workspaces(AppUser u,Guid? tenant=null,Guid? scope=null){var ids=await db.Assignments.Where(x=>x.UserId==u.Id).Select(x=>x.TenantId).Distinct().ToListAsync();if(tenant.HasValue)Require(ids.Contains(tenant.Value)&&await db.Tenants.AnyAsync(t=>t.Id==tenant.Value&&t.IsActive));var ts=await db.Tenants.Where(x=>x.IsActive&&ids.Contains(x.Id)&&(!tenant.HasValue||x.Id==tenant.Value)).ToListAsync();var result=new List<(Tenant,List<Guid>)>();foreach(var t in ts){var scopes=await Scopes(u,t.Id);if(scope.HasValue)scopes=scopes.Where(x=>x==scope.Value).ToList();if(scopes.Count>0)result.Add((t,scopes));}if(scope.HasValue)Require(result.Count>0);return result;}
    // Platform administrators may inspect all tenants, including inactive ones.
    // Operational writes must still use the normal assigned, active workspace checks.
    internal async Task<List<(Tenant Tenant,List<Guid> Scopes)>> ReadWorkspaces(AppUser u,Guid? tenant=null,Guid? scope=null)
    {
        if(u.Role!="Beheerder")return await Workspaces(u,tenant,scope);
        var result=new List<(Tenant,List<Guid>)>();
        foreach(var t in await db.Tenants.Where(t=>!tenant.HasValue||t.Id==tenant.Value).ToListAsync())
        {
            var scopes=await db.Scopes.Where(x=>x.TenantId==t.Id&&(!scope.HasValue||x.Id==scope.Value)).Select(x=>x.Id).ToListAsync();
            if(scopes.Count>0)result.Add((t,scopes));
        }
        return result;
    }
    public async Task<List<Tenant>> Organizations(AppUser u){if(u.Role=="Beheerder")return await db.Tenants.OrderBy(x=>x.Name).ToListAsync();return (await Workspaces(u)).Select(x=>x.Tenant).OrderBy(x=>x.Name).ToList();}
    public async Task<Tenant> Organization(AppUser u,Guid id){var tenant=await Tenant(id);Require(u.Role=="Beheerder"||tenant.IsActive&&(await Scopes(u,id)).Count>0);return tenant;}
    async Task<Tenant> CreateTenant(string name,int responseMinutes=DefaultResponseMinutes){Require(!await db.Tenants.AnyAsync(x=>x.Name==name),"Naam bestaat al.",409);var t=new Tenant{Name=name,ResponseMinutes=responseMinutes};t.SchemaName="tenant_"+t.Id.ToString("N");await factory.ProvisionAsync(t);db.Tenants.Add(t);db.Scopes.Add(new(){TenantId=t.Id,Name="Algemeen"});await db.SaveChangesAsync();return t;}
    public async Task<Tenant> CreateOrganization(AppUser u,Input input,int? responseMinutes=null){Admin(u);var t=await CreateTenant(Required(input.Name,120),SlaMinutes(responseMinutes));await Log(u,"Klant aangemaakt",t.Id);return t;}
    public async Task<Tenant> RenameOrganization(AppUser u,Guid id,string? name,int? responseMinutes=null)
    {
        Admin(u);
        var value=Required(name,120);
        var t=await Tenant(id);
        Require(!await db.Tenants.AnyAsync(x=>x.Id!=id&&x.Name==value),"Naam bestaat al.",409);
        t.Name=value;
        if(responseMinutes.HasValue)t.ResponseMinutes=SlaMinutes(responseMinutes);
        await Log(u,"Klantinstellingen gewijzigd",t.Id,t.Id.ToString());
        return t;
    }
    public async Task<Tenant> SetOrganization(AppUser u,Guid id,bool active){Admin(u);var t=await Tenant(id);t.IsActive=active;t.DeactivatedAt=active?null:DateTimeOffset.UtcNow;await Log(u,"Klantstatus gewijzigd",id);return t;}
    static object KeyDto(ApiSource k)=>new{id=k.Id,k.Name,organizationId=k.TenantId,k.ScopeId,k.CreatedAt,k.IsActive,k.Prefix};
    public async Task<object> Keys(AppUser u){Admin(u);return (await db.Sources.ToListAsync()).Select(KeyDto);}
    public async Task<object> CreateKey(AppUser u,Input i){Admin(u);var t=await Tenant(i.OrganizationId);Require(t.IsActive,"Klant is inactief.",400);var scope=await db.Scopes.FirstOrDefaultAsync(x=>x.TenantId==t.Id&&(!i.ScopeId.HasValue||x.Id==i.ScopeId))??throw new SocException(400,"Scope ontbreekt.");var secret="soc_demo_"+Convert.ToHexString(RandomNumberGenerator.GetBytes(32));var k=new ApiSource{TenantId=t.Id,ScopeId=scope.Id,Name=Required(i.Name,80),Hash=Hash(secret),Prefix=secret[..16]};db.Sources.Add(k);await Log(u,"API-sleutel aangemaakt",t.Id);return new{id=k.Id,k.Name,organizationId=k.TenantId,k.ScopeId,k.CreatedAt,k.IsActive,k.Prefix,secret};}
    public async Task<object> Revoke(AppUser u,Guid id){Admin(u);var k=await db.Sources.FindAsync(id)??throw new SocException(404,"Sleutel niet gevonden.");k.IsActive=false;await Log(u,"API-sleutel ingetrokken",k.TenantId);return new{ok=true};}
    public async Task<object> Audit(AppUser u){Admin(u);var result=(await db.Audit.ToListAsync()).Select(x=>new AuditRow(x.Id,x.CreatedAt,x.Actor,x.Action,x.TenantId,x.Target)).ToList();foreach(var t in await db.Tenants.ToListAsync()){await using var td=factory.Open(t);result.AddRange((await td.Audit.ToListAsync()).Select(x=>new AuditRow(x.Id,x.CreatedAt,x.Actor,x.Action,t.Id,x.Target)));}return result.OrderByDescending(x=>x.CreatedAt);}
    public record AuditRow(Guid Id,DateTimeOffset CreatedAt,string Actor,string Action,Guid? OrganizationId,string? Target);
    // Administrative register: identifiers and lifecycle metadata only.
    // Do not include titles, owners, scope IDs, observables, payloads or investigation entries.
    public async Task<object> TicketRegister(AppUser u)
    {
        Admin(u);
        var rows = new List<object>();
        foreach (var tenant in await db.Tenants.OrderBy(t=>t.Name).ToListAsync())
        {
            await using var td = factory.Open(tenant);
            var cases = await td.Cases.AsNoTracking()
                .Select(x=>new { x.Id, x.Number, x.Status, x.CreatedAt, x.ClosedAt })
                .OrderByDescending(x=>x.CreatedAt).ToListAsync();
            foreach (var item in cases)
                rows.Add(new { item.Id, item.Number, item.Status, item.CreatedAt, item.ClosedAt, organizationId=tenant.Id });
        }
        await Log(u,"Ticketregister bekeken");
        return rows;
    }
    internal static void CheckVersion(byte[] actual,string? supplied)
    {
        Require(!string.IsNullOrWhiteSpace(supplied),"RowVersion is verplicht.",400);
        byte[] version;
        try {version=Convert.FromBase64String(supplied!);}catch(FormatException){throw new SocException(400,"Ongeldige RowVersion.");}
        Require(version.Length==8,"Ongeldige RowVersion.",400);
        Require(actual.SequenceEqual(version),"Dit record is ondertussen gewijzigd. Vernieuw de gegevens.",409);
    }

}
