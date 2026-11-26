using Microsoft.Extensions.Configuration;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Soc.Data.Context;
using Soc.Data.Entities;
namespace Soc.Business.Services;

public sealed class SocService(SocDbContext db,TenantDbFactory factory,UserManager<AppUser> users,IConfiguration config)
{
    static readonly string[] Roles=["Analist","Senior analist","Beheerder","Klant","Accountmanager"];
    public static void Require(bool condition,string message="Toegang geweigerd.",int status=403){if(!condition)throw new SocException(status,message);}
    public static string Required(string? value,int max=500){Require(!string.IsNullOrWhiteSpace(value)&&value.Length<=max,"Ongeldige of ontbrekende invoer.",400);return value!.Trim();}
    public static bool Analyst(AppUser u)=>u.Role is "Analist" or "Senior analist";
    public static void Admin(AppUser u)=>Require(u.Role=="Beheerder");
    static bool Closed(ResearchCase c)=>c.Status==TicketStatus.Closed;

    // Existing project roles are retained: senior acts as coordinator in the demo.
    // Open cases start execution only through the assignment action.
    static bool CanChangeCaseStatus(TicketStatus from,TicketStatus to,bool senior)
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
    static PriorityLevel Priority(string? p){Require(Enum.TryParse<PriorityLevel>(p,out var v)&&Enum.IsDefined(v),"Ongeldige prioriteit.",400);return v;}
    static string Hash(string key)=>Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(key)));
    const int DefaultResponseMinutes=60;
    static int SlaMinutes(int? minutes){var value=minutes??DefaultResponseMinutes;Require(value>=1&&value<=10080,"SLA moet tussen 1 en 10080 minuten liggen.",400);return value;}
    bool NeedsTwoFactor(AppUser u)=>!u.TwoFactorEnabled && (u.Role is "Analist" or "Senior analist" or "Beheerder") && !(config.GetValue<bool>("Demo:Enabled")&&u.Email!.EndsWith("@soc.demo",StringComparison.OrdinalIgnoreCase));
    public async Task<AppUser> UserAsync(System.Security.Claims.ClaimsPrincipal principal,bool allowSetup=false){var u=await users.GetUserAsync(principal);Require(u is {IsActive:true},"Log opnieuw in.",401);Require(allowSetup||!NeedsTwoFactor(u!),"Stel eerst tweestapsverificatie in via Account.",403);return u!;}
    public async Task<object> PublicUser(AppUser u)=>new{id=u.Id,u.Name,u.Email,u.Role,u.IsActive,u.TwoFactorEnabled,requiresTwoFactorSetup=NeedsTwoFactor(u),organizationIds=await db.Assignments.Where(x=>x.UserId==u.Id).Select(x=>x.TenantId).Distinct().ToArrayAsync()};
    public async Task<object> Access(AppUser u)=>new{user=await PublicUser(u),workspaces=await (from a in db.Assignments join s in db.Scopes on a.ScopeId equals s.Id join t in db.Tenants on a.TenantId equals t.Id where a.UserId==u.Id select new{workspaceId=t.Id,tenantName=t.Name,scopeId=s.Id,scopeName=s.Name}).ToListAsync()};
    public async Task Log(AppUser u,string action,Guid? tenant=null,string? target=null){db.Audit.Add(new(){Actor=u.Name,Action=action,TenantId=tenant,Target=target});await db.SaveChangesAsync();}
    static void LogTenant(TenantDbContext t,Guid scope,string actor,string action,string target)=>t.Audit.Add(new(){ScopeId=scope,Actor=actor,Action=action,Target=target});
    async Task<Tenant> Tenant(Guid? id)=>await db.Tenants.SingleOrDefaultAsync(x=>x.Id==id)??throw new SocException(404,"Klant niet gevonden.");
    async Task<List<Guid>> Scopes(AppUser u,Guid tenant)=>await db.Assignments.Where(x=>x.UserId==u.Id&&x.TenantId==tenant).Select(x=>x.ScopeId).ToListAsync();
    async Task<List<(Tenant Tenant,List<Guid> Scopes)>> Workspaces(AppUser u,Guid? tenant=null,Guid? scope=null){var ids=await db.Assignments.Where(x=>x.UserId==u.Id).Select(x=>x.TenantId).Distinct().ToListAsync();if(tenant.HasValue)Require(ids.Contains(tenant.Value)&&await db.Tenants.AnyAsync(t=>t.Id==tenant.Value&&t.IsActive));var ts=await db.Tenants.Where(x=>x.IsActive&&ids.Contains(x.Id)&&(!tenant.HasValue||x.Id==tenant.Value)).ToListAsync();var result=new List<(Tenant,List<Guid>)>();foreach(var t in ts){var scopes=await Scopes(u,t.Id);if(scope.HasValue)scopes=scopes.Where(x=>x==scope.Value).ToList();if(scopes.Count>0)result.Add((t,scopes));}if(scope.HasValue)Require(result.Count>0);return result;}
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
    public async Task<List<object>> ListUsers(AppUser u){Admin(u);var r=new List<object>();foreach(var x in await users.Users.OrderBy(x=>x.Name).ToListAsync())r.Add(await PublicUser(x));return r;}
    async Task SetGrants(AppUser user,string role,Guid[] ids)
    {
        Require(Roles.Contains(role),"Ongeldige rol.",400);
        ids=ids.Distinct().ToArray();
        Require(role!="Klant"||ids.Length==1,"Een klantaccount moet precies één klant hebben.",400);
        Require(await db.Tenants.CountAsync(t=>ids.Contains(t.Id))==ids.Length,"Ongeldige klant.",400);
        var desired=await db.Scopes.Where(x=>ids.Contains(x.TenantId)).ToListAsync();
        var existing=await db.Assignments.Where(x=>x.UserId==user.Id).ToListAsync();
        var desiredIds=desired.Select(x=>x.Id).ToHashSet();
        db.Assignments.RemoveRange(existing.Where(x=>!desiredIds.Contains(x.ScopeId)));
        var existingIds=existing.Select(x=>x.ScopeId).ToHashSet();
        foreach(var scope in desired.Where(x=>!existingIds.Contains(x.Id)))
            db.Assignments.Add(new(){UserId=user.Id,TenantId=scope.TenantId,ScopeId=scope.Id});
        user.Role=role;
        await db.SaveChangesAsync();
    }
    public async Task<object> CreateUser(AppUser u,Input i){Admin(u);var email=Required(i.Email,120);Require(email.Contains('@'),"Ongeldig e-mailadres.",400);var role=Required(i.Role,30);var ids=i.OrganizationIds??[];Require(Roles.Contains(role)&& (role!="Klant"||ids.Distinct().Count()==1)&&await db.Tenants.CountAsync(t=>ids.Contains(t.Id))==ids.Distinct().Count(),"Ongeldige rol of klant.",400);var x=new AppUser{Id=Guid.NewGuid(),Name=Required(i.Name,120),UserName=email,Email=email,EmailConfirmed=true,Role=role,LockoutEnabled=true};var result=await users.CreateAsync(x,Required(i.Password,200));Require(result.Succeeded,string.Join(" ",result.Errors.Select(x=>x.Description)),400);await SetGrants(x,role,ids);await Log(u,"Gebruiker aangemaakt",target:email);return await PublicUser(x);}
    public async Task<object> ChangeAccess(AppUser u,Guid id,Input i){Admin(u);Require(u.Id!=id,"Eigen rechten wijzigen is niet toegestaan.",400);var x=await users.FindByIdAsync(id.ToString())??throw new SocException(404,"Gebruiker niet gevonden.");await SetGrants(x,Required(i.Role,30),i.OrganizationIds??[]);await users.UpdateSecurityStampAsync(x);await Log(u,"Gebruikersrechten gewijzigd",target:x.Email);return await PublicUser(x);}
    public async Task<object> UpdateUser(AppUser actor,Guid id,UpdateUserRequest input)
    {
        Admin(actor);
        Require(actor.Id!=id,"Je eigen account kan hier niet worden gewijzigd.",400);
        var name=Required(input.Name,120);
        var email=Required(input.Email,120);
        Require(System.Net.Mail.MailAddress.TryCreate(email,out var address)&&string.Equals(address.Address,email,StringComparison.OrdinalIgnoreCase),"Ongeldig e-mailadres.",400);
        var role=Required(input.Role,30);
        Require(input.OrganizationIds!=null&&input.IsActive.HasValue,"Klanttoegang en accountstatus zijn verplicht.",400);
        var ids=input.OrganizationIds!.Distinct().ToArray();
        Require(Roles.Contains(role)&&(role!="Klant"||ids.Length==1)&&await db.Tenants.CountAsync(t=>ids.Contains(t.Id))==ids.Length,"Ongeldige rol of klant.",400);
        Require(input.Password==null||input.Password.Length<=200,"Ongeldig wachtwoord.",400);
        await using var transaction=await db.Database.BeginTransactionAsync();
        var user=await users.FindByIdAsync(id.ToString())??throw new SocException(404,"Gebruiker niet gevonden.");
        var duplicate=await users.FindByEmailAsync(email);
        Require(duplicate==null||duplicate.Id==id,"E-mailadres is al in gebruik.",409);
        var duplicateName=await users.FindByNameAsync(email);
        Require(duplicateName==null||duplicateName.Id==id,"Gebruikersnaam is al in gebruik.",409);
        user.Name=name;
        if(!string.Equals(user.Email,email,StringComparison.OrdinalIgnoreCase))user.EmailConfirmed=false;
        user.Email=email;
        user.UserName=email;
        user.IsActive=input.IsActive!.Value;
        var result=await users.UpdateAsync(user);
        Require(result.Succeeded,string.Join(" ",result.Errors.Select(x=>x.Description)),400);
        if(!string.IsNullOrEmpty(input.Password))
        {
            var token=await users.GeneratePasswordResetTokenAsync(user);
            var reset=await users.ResetPasswordAsync(user,token,input.Password);
            Require(reset.Succeeded,string.Join(" ",reset.Errors.Select(x=>x.Description)),400);
            await users.ResetAccessFailedCountAsync(user);
            await users.SetLockoutEndDateAsync(user,null);
        }
        await SetGrants(user,role,ids);
        var stamp=await users.UpdateSecurityStampAsync(user);
        Require(stamp.Succeeded,string.Join(" ",stamp.Errors.Select(x=>x.Description)),500);
        await Log(actor,"Gebruikersaccount gewijzigd",target:user.Id.ToString());
        if(!string.IsNullOrEmpty(input.Password))await Log(actor,"Gebruikerswachtwoord gereset",target:user.Id.ToString());
        await transaction.CommitAsync();
        return await PublicUser(user);
    }
    public async Task<List<object>> Analysts(AppUser u){Require(Analyst(u));var permitted=(await Workspaces(u)).Select(x=>x.Tenant.Id).ToHashSet();var list=new List<object>();foreach(var a in await users.Users.Where(x=>x.IsActive&&(x.Role=="Analist"||x.Role=="Senior analist")).ToListAsync()){var ids=await db.Assignments.Where(x=>x.UserId==a.Id).Select(x=>x.TenantId).Distinct().ToListAsync();list.Add(new{id=a.Id,a.Name,organizationIds=ids.Where(permitted.Contains)});}return list;}
    static object KeyDto(ApiSource k)=>new{id=k.Id,k.Name,organizationId=k.TenantId,k.ScopeId,k.CreatedAt,k.IsActive,k.Prefix};
    public async Task<object> Keys(AppUser u){Admin(u);return (await db.Sources.ToListAsync()).Select(KeyDto);}
    public async Task<object> CreateKey(AppUser u,Input i){Admin(u);var t=await Tenant(i.OrganizationId);Require(t.IsActive,"Klant is inactief.",400);var scope=await db.Scopes.FirstOrDefaultAsync(x=>x.TenantId==t.Id&&(!i.ScopeId.HasValue||x.Id==i.ScopeId))??throw new SocException(400,"Scope ontbreekt.");var secret="soc_demo_"+Convert.ToHexString(RandomNumberGenerator.GetBytes(32));var k=new ApiSource{TenantId=t.Id,ScopeId=scope.Id,Name=Required(i.Name,80),Hash=Hash(secret),Prefix=secret[..16]};db.Sources.Add(k);await Log(u,"API-sleutel aangemaakt",t.Id);return new{id=k.Id,k.Name,organizationId=k.TenantId,k.ScopeId,k.CreatedAt,k.IsActive,k.Prefix,secret};}
    public async Task<object> Revoke(AppUser u,Guid id){Admin(u);var k=await db.Sources.FindAsync(id)??throw new SocException(404,"Sleutel niet gevonden.");k.IsActive=false;await Log(u,"API-sleutel ingetrokken",k.TenantId);return new{ok=true};}
    public async Task<object> Audit(AppUser u){Admin(u);var result=(await db.Audit.ToListAsync()).Select(x=>new AuditRow(x.Id,x.CreatedAt,x.Actor,x.Action,x.TenantId,x.Target)).ToList();foreach(var t in await db.Tenants.ToListAsync()){await using var td=factory.Open(t);result.AddRange((await td.Audit.ToListAsync()).Select(x=>new AuditRow(x.Id,x.CreatedAt,x.Actor,x.Action,t.Id,x.Target)));}return result.OrderByDescending(x=>x.CreatedAt);}
    public record AuditRow(Guid Id,DateTimeOffset CreatedAt,string Actor,string Action,Guid? OrganizationId,string? Target);
    // The SLA statuses are taken from the database branch. Compute from the actual timestamps.
    static Soc.Data.Entities.Enums.SlaStatus GetSlaStatus(Alert alert)
    {
        if((alert.FirstHandledAt??DateTimeOffset.UtcNow)>alert.Deadline)return Soc.Data.Entities.Enums.SlaStatus.Breached;
        return alert.FirstHandledAt.HasValue?Soc.Data.Entities.Enums.SlaStatus.Met:Soc.Data.Entities.Enums.SlaStatus.Pending;
    }
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
    static object AlertDto(Alert a,Guid tenant)=>new{id=a.Id,organizationId=tenant,a.ScopeId,a.Number,a.Title,a.Description,a.Source,a.RawPayload,a.NormalizedPayload,security=SecurityAlertDetails.FromRaw(a.RawPayload),a.SourceIntegrationId,a.ExternalEventId,a.OccurredAt,a.RowVersion,a.Priority,a.Status,slaStatus=GetSlaStatus(a),a.CreatedAt,a.Deadline,a.FirstHandledAt,a.Owner,a.Triage,a.CaseId,history=a.History.OrderBy(x=>x.At).Select(x=>new{x.At,x.Actor,x.Text})};
    static object CaseDto(ResearchCase c,Guid tenant,bool internalView)=>new{id=c.Id,organizationId=tenant,c.ScopeId,c.Number,c.Title,c.Priority,c.Status,c.Owner,ownerId=internalView?(Guid?)c.OwnerId:null,c.CreatedAt,c.ClosedAt,c.CustomerVisible,c.RowVersion,summary=c.Summary,conclusion=internalView?c.Conclusion:null,alertIds=internalView?c.Alerts.Select(x=>x.Id).ToArray():Array.Empty<Guid>(),entries=c.Entries.Where(x=>internalView||x.Visible).Select(x=>new EntryRow(x.Id,x.At,x.Actor,x.Kind,x.Text,x.Visible)).Concat(internalView?c.Observables.Select(x=>new EntryRow(x.Id,x.At,x.Actor,"Observable",$"{x.Type}: {x.Value} — {x.Assessment??"Niet beoordeeld"}",false)):Enumerable.Empty<EntryRow>()).OrderBy(x=>x.At)};
    public record EntryRow(Guid Id,DateTimeOffset At,string Actor,string Kind,string Text,bool Visible);
    static void ValidateObservable(string type,string value,string assessment)
    {
        Require(new[]{"Verdacht","Kwaadaardig","Onschuldig"}.Contains(assessment),"Kies een beoordeling.",400);
        bool valid=type switch
        {
            "IP"=>System.Net.IPAddress.TryParse(value,out _),
            "Domain"=>Uri.CheckHostName(value)==UriHostNameType.Dns&&value.Contains('.'),
            "URL"=>Uri.TryCreate(value,UriKind.Absolute,out var uri)&&(uri.Scheme is "http" or "https"),
            "Email"=>System.Net.Mail.MailAddress.TryCreate(value,out var address)&&address.Address==value,
            "Hash"=>(value.Length is 32 or 40 or 64 or 128)&&value.All(Uri.IsHexDigit),
            _=>false
        };
        Require(valid,"Observable heeft geen geldig formaat voor dit type.",400);
    }
    static bool NeedsCase(string? value)=>value is "Nader onderzoek" or "Bevestigd incident" or "True positive" or "Onbeslist";
    static void Event(Alert a,string actor,string text)=>a.History.Add(new(){Actor=actor,Text=text});
    static Alert NewAlert(Guid scope,Input i,string source,DateTimeOffset? received=null,int responseMinutes=DefaultResponseMinutes){var p=Priority(i.Priority);var created=received??DateTimeOffset.UtcNow;var a=new Alert{ScopeId=scope,Number="ALT-"+Guid.NewGuid().ToString("N")[..8].ToUpperInvariant(),Title=Required(i.Title,120),Description=Required(i.Description,2000),Source=source,Priority=p,CreatedAt=created,Deadline=created.AddMinutes(responseMinutes),RawPayload=JsonSerializer.Serialize(new{i.Title,i.Description,i.Priority})};a.History.Add(new(){At=created,Actor=source,Text="Alert ontvangen"});return a;}
    public async Task<(int Status,object Data)> Ingest(string? key,byte[] body)
    {
        Require(!string.IsNullOrWhiteSpace(key),"Ongeldige API-sleutel.",401);
        var hash=Hash(key!);
        var source=await db.Sources.SingleOrDefaultAsync(x=>x.Hash==hash&&x.IsActive);
        Require(source!=null,"Ongeldige API-sleutel.",401);
        var t=await Tenant(source!.TenantId);
        Require(t.IsActive,"Klant is inactief.");
        JsonDocument document;
        try { document=JsonDocument.Parse(body); }
        catch(JsonException){throw new SocException(400,"Ongeldig JSON-bericht.");}
        using(document)
        {
            var root=document.RootElement;
            Require(root.ValueKind==JsonValueKind.Object,"JSON-object vereist.",400);
            var allowed=new[]{"externalEventId","title","occurredAt","severity","payload"};
            Require(root.EnumerateObject().All(p=>allowed.Contains(p.Name))&&root.EnumerateObject().Select(p=>p.Name).Distinct().Count()==root.EnumerateObject().Count(),"Onbekend of dubbel veld in aanleverbericht.",400);
            string? Read(string name)=>root.TryGetProperty(name,out var value)&&value.ValueKind==JsonValueKind.String?value.GetString():null;
            var eventId=Required(Read("externalEventId"),200);
            var title=Required(Read("title"),120);
            Require(DateTimeOffset.TryParse(Read("occurredAt"),System.Globalization.CultureInfo.InvariantCulture,System.Globalization.DateTimeStyles.None,out var occurredAt),"Ongeldig gebeurtenistijdstip.",400);
            Require(root.TryGetProperty("payload",out var payload)&&payload.ValueKind==JsonValueKind.Object,"Payload-object vereist.",400);
            var severity=Priority(Read("severity"));
            var payloadHash=Convert.ToHexString(SHA256.HashData(body));
            await using var td=factory.Open(t);
            var existing=await td.Alerts.Include(x=>x.History).SingleOrDefaultAsync(x=>x.SourceIntegrationId==source.Id&&x.ExternalEventId==eventId);
            if(existing!=null)
            {
                Require(existing.PayloadHash==payloadHash,"Event-ID bestaat met andere inhoud.",409);
                return (200,AlertDto(existing,t.Id));
            }
            var details=SecurityAlertDetails.Read(payload);
            var description=details.Description??title;
            if(description.Length>2000)description=description[..2000];
            var a=NewAlert(source.ScopeId,new(Title:title,Description:description,Priority:severity.ToString()),source.Name,responseMinutes:t.ResponseMinutes);
            a.SourceIntegrationId=source.Id;a.ExternalEventId=eventId;a.OccurredAt=occurredAt.ToUniversalTime();
            a.PayloadHash=payloadHash;a.RawPayload=Encoding.UTF8.GetString(body);
            a.NormalizedPayload=SecurityAlertDetails.Normalize(a,details);
            td.Alerts.Add(a);LogTenant(td,a.ScopeId,source.Name,"Alert ontvangen",a.Number);
            try { await td.SaveChangesAsync(); }
            catch(DbUpdateException ex) when(ex.InnerException is Microsoft.Data.SqlClient.SqlException sql && sql.Number is 2601 or 2627)
            {
                td.ChangeTracker.Clear();
                var duplicate=await td.Alerts.Include(x=>x.History).SingleOrDefaultAsync(x=>x.SourceIntegrationId==source.Id&&x.ExternalEventId==eventId);
                if(duplicate==null)throw;
                Require(duplicate.PayloadHash==payloadHash,"Event-ID bestaat met andere inhoud.",409);
                return (200,AlertDto(duplicate,t.Id));
            }
            return (201,AlertDto(a,t.Id));
        }
    }
    static void CheckVersion(byte[] actual,string? supplied)
    {
        Require(!string.IsNullOrWhiteSpace(supplied),"RowVersion is verplicht.",400);
        byte[] version;
        try {version=Convert.FromBase64String(supplied!);}catch(FormatException){throw new SocException(400,"Ongeldige RowVersion.");}
        Require(version.Length==8,"Ongeldige RowVersion.",400);
        Require(actual.SequenceEqual(version),"Dit record is ondertussen gewijzigd. Vernieuw de gegevens.",409);
    }
    public async Task<object> AddAlert(AppUser u,Input i){Require(Analyst(u));var t=await Tenant(i.OrganizationId);Require(t.IsActive,"Klant is inactief.",400);var grants=await Scopes(u,t.Id);var scope=i.ScopeId??grants.FirstOrDefault();Require(grants.Contains(scope));await using var td=factory.Open(t);var a=NewAlert(scope,i,Required(i.Source,80),responseMinutes:t.ResponseMinutes);td.Alerts.Add(a);LogTenant(td,scope,u.Name,"Alert handmatig ontvangen",a.Number);await td.SaveChangesAsync();return AlertDto(a,t.Id);}
    public async Task<object> Alerts(AppUser u,Guid? workspace,Guid? scope){Require(Analyst(u));var result=new List<(DateTimeOffset Time,object Dto)>();foreach(var(t,scopes) in await Workspaces(u,workspace,scope)){await using var td=factory.Open(t);foreach(var a in await td.Alerts.Include(x=>x.History).Where(x=>scopes.Contains(x.ScopeId)).ToListAsync())result.Add((a.CreatedAt,AlertDto(a,t.Id)));foreach(var sid in scopes)LogTenant(td,sid,u.Name,"Alertoverzicht bekeken","Alerts");await td.SaveChangesAsync();}return result.OrderBy(x=>x.Time).Select(x=>x.Dto);}
    static IQueryable<ResearchCase> CaseQuery(TenantDbContext td)=>td.Cases.Include(x=>x.Entries).Include(x=>x.Observables).Include(x=>x.Alerts).ThenInclude(x=>x.History).AsSplitQuery();
    public async Task<object> AlertAction(AppUser u,Guid id,string action,Input i,Guid? workspace,Guid? scope){Require(Analyst(u));foreach(var(t,scopes) in await Workspaces(u,workspace,scope)){await using var td=factory.Open(t);await using var tx=await td.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);var a=await td.Alerts.Include(x=>x.History).FirstOrDefaultAsync(x=>x.Id==id&&scopes.Contains(x.ScopeId));if(a==null)continue;if(action=="get"){LogTenant(td,a.ScopeId,u.Name,"Alert bekeken",a.Number);await td.SaveChangesAsync();await tx.CommitAsync();return AlertDto(a,t.Id);}Require(t.IsActive,"Klant is inactief.",409);if(action=="promote"&&a.CaseId.HasValue){await tx.CommitAsync();return AlertDto(a,t.Id);}CheckVersion(a.RowVersion,i.RowVersion);Require(a.Status is not (AlertStatus.Dismissed or AlertStatus.Resolved or AlertStatus.Escalated)||action=="reopen","Alert is afgehandeld.",409);
        if(action=="claim"){Require(a.OwnerId==null&&a.Status is (AlertStatus.New or AlertStatus.PendingReview),"Alert is al opgepakt.",409);a.FirstHandledAt??=DateTimeOffset.UtcNow;a.OwnerId=u.Id;a.Owner=u.Name;}else if(action!="reopen"){Require(a.OwnerId.HasValue&&(a.OwnerId==u.Id||u.Role=="Senior analist"),"Pak de alert eerst op of draag deze over.",409);}
        switch(action){case "claim":a.Status=AlertStatus.UnderReview;Event(a,u.Name,"Alert opgepakt");break;
        case "triage":var outcome=Required(i.Outcome,30);Require(new[]{"False positive","Verwacht gedrag","Nader onderzoek","Bevestigd incident"}.Contains(outcome),"Ongeldige triage.",400);a.Triage=outcome;a.Status=outcome is "False positive" or "Verwacht gedrag"?AlertStatus.Dismissed:AlertStatus.UnderReview;Event(a,u.Name,$"Triage: {outcome} — {Required(i.Reason)}");break;
        case "promote":Require(NeedsCase(a.Triage)&&a.CaseId==null,"Leg eerst triage nader onderzoek of bevestigd incident vast.",409);ResearchCase c;if(i.CaseId.HasValue){c=await td.Cases.SingleOrDefaultAsync(x=>x.Id==i.CaseId&&x.ScopeId==a.ScopeId)??throw new SocException(400,"Case niet gevonden in dezelfde scope.");Require(!Closed(c),"Case is afgesloten.",409);Require(c.OwnerId==u.Id||u.Role=="Senior analist","Case heeft een andere eigenaar.",403);td.Entry(c).Property(x=>x.Title).IsModified=true;}else{c=new(){ScopeId=a.ScopeId,Number="CASE-"+Guid.NewGuid().ToString("N")[..8].ToUpperInvariant(),Title=Required(i.Title,120),Priority=a.Priority,OwnerId=u.Id,Owner=u.Name};c.Entries.Add(new(){Actor=u.Name,Kind="Status",Text="Onderzoek aangemaakt vanuit "+a.Number});td.Cases.Add(c);}a.CaseId=c.Id;a.Status=AlertStatus.Escalated;Event(a,u.Name,"Gekoppeld aan "+c.Number);break;
        case "reopen":Require(u.Role=="Senior analist"&&a.Status is (AlertStatus.Dismissed or AlertStatus.Resolved)&&a.CaseId==null,"Heropenen niet toegestaan.",409);a.Status=AlertStatus.PendingReview;a.Triage=null;a.OwnerId=null;a.Owner=null;Event(a,u.Name,"Heropend: "+Required(i.Reason));break;
        default:throw new SocException(404,"Onbekende actie.");}LogTenant(td,a.ScopeId,u.Name,"Alert "+action,a.Number);await td.SaveChangesAsync();await tx.CommitAsync();return AlertDto(a,t.Id);}throw new SocException(404,"Alert niet gevonden.");}
    public async Task<object> Cases(AppUser u,Guid? workspace,Guid? scope){Require(Analyst(u)||u.Role is "Klant" or "Accountmanager");var result=new List<object>();foreach(var(t,scopes) in await Workspaces(u,workspace,scope)){await using var td=factory.Open(t);foreach(var c in await CaseQuery(td).Where(x=>scopes.Contains(x.ScopeId)&&(Analyst(u)||x.CustomerVisible)).ToListAsync())result.Add(CaseDto(c,t.Id,Analyst(u)));foreach(var sid in scopes)LogTenant(td,sid,u.Name,"Caseoverzicht bekeken","Cases");await td.SaveChangesAsync();}return result;}
    public async Task<object> CaseAction(AppUser u,Guid id,string action,Input i,Guid? workspace,Guid? scope){Require(Analyst(u)||u.Role is "Klant" or "Accountmanager");foreach(var(t,scopes) in await Workspaces(u,workspace,scope)){await using var td=factory.Open(t);await using var tx=await td.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);var c=await CaseQuery(td).FirstOrDefaultAsync(x=>x.Id==id&&scopes.Contains(x.ScopeId)&&(Analyst(u)||x.CustomerVisible));if(c==null)continue;if(action=="get"){LogTenant(td,c.ScopeId,u.Name,"Case bekeken",c.Number);await td.SaveChangesAsync();await tx.CommitAsync();return CaseDto(c,t.Id,Analyst(u));}Require(t.IsActive,"Klant is inactief.",409);CheckVersion(c.RowVersion,i.RowVersion);Require(!Closed(c)||(action=="status"&&u.Role=="Senior analist"&&i.Status=="UnderInvestigation"),"Case is afgesloten.",409);Require(Analyst(u)||(u.Role=="Klant"&&action=="entry"));if(Analyst(u))Require(c.OwnerId==u.Id||u.Role=="Senior analist","Alleen de toegewezen analist of senior kan dit onderzoek aanpassen.",403);switch(action){case "entry":var kind=Analyst(u)?Required(i.Kind,40):"Klantreactie";Require(new[]{"Notitie","Observable","Actie","Bewijsreferentie","Klantreactie"}.Contains(kind),"Ongeldig type.",400);var text=Required(i.Text,2000);if(kind=="Observable"){var type=Required(i.Type,20);var assessment=Required(i.Assessment,20);ValidateObservable(type,text,assessment);c.Observables.Add(new(){Actor=u.Name,Value=text,Type=type,Assessment=assessment});c.Entries.Add(new(){Actor=u.Name,Kind="Observablebeoordeling",Text=$"{type}: {text} — {assessment}"});}else c.Entries.Add(new(){Actor=u.Name,Kind=kind,Text=text,Visible=kind=="Klantreactie"||i.Visible==true&&kind!="Bewijsreferentie"});break;
        case "status":Require(Enum.TryParse<TicketStatus>(i.Status,out var status)&&Enum.IsDefined(status),"Ongeldige status.",400);Require(CanChangeCaseStatus(c.Status,status,u.Role=="Senior analist"),"Deze statusovergang is niet toegestaan. Volg de onderzoeksworkflow.",409);if(Closed(c)){c.ClosedAt=null;c.Entries.Add(new(){Actor=u.Name,Kind="Status",Text="Heropend: "+Required(i.Reason)});foreach(var a in c.Alerts){a.Status=AlertStatus.Escalated;Event(a,u.Name,"Case heropend");}}if(status==TicketStatus.Closed){var summary=Required(i.Summary,2000);c.Summary=summary;c.Conclusion=Required(i.Conclusion,2000);c.ClosedAt=DateTimeOffset.UtcNow;c.Entries.Add(new(){Actor=u.Name,Kind="Samenvatting",Text=summary});foreach(var a in c.Alerts){a.Status=AlertStatus.Resolved;Event(a,u.Name,"Case afgesloten");}}c.Entries.Add(new(){Actor=u.Name,Kind="Status",Text=$"{c.Status} → {status}"});c.Status=status;break;
        case "visibility":Require(i.Visible.HasValue,"Ongeldige zichtbaarheid.",400);c.CustomerVisible=i.Visible!.Value;break;
        case "owner":var owner=await users.FindByIdAsync(i.UserId.ToString()!)??throw new SocException(400,"Analist niet gevonden.");Require(owner.IsActive&&Analyst(owner)&&(await Scopes(owner,t.Id)).Contains(c.ScopeId),"Analist heeft geen toegang tot scope.",400);var initial=c.Status==TicketStatus.Open;Require(!initial||u.Role=="Senior analist","Een senior analist moet de case eerst prioriteren en toewijzen.",403);Require(initial||owner.Id!=c.OwnerId,"Deze analist is al eigenaar.",400);if(!string.IsNullOrWhiteSpace(i.Priority)){Require(u.Role=="Senior analist","Alleen een senior mag de prioriteit wijzigen.",403);c.Priority=Priority(i.Priority);}var reason=Required(i.Reason,2000);var next=Required(i.NextAction,2000);c.Entries.Add(new(){Actor=u.Name,Kind="Overdracht",Text=$"Van {c.Owner} ({c.OwnerId}) naar {owner.Name} ({owner.Id}). Toelichting: {reason}. Volgende actie: {next}"});c.OwnerId=owner.Id;c.Owner=owner.Name;if(initial){c.Status=TicketStatus.UnderInvestigation;c.Entries.Add(new(){Actor=u.Name,Kind="Status",Text="Geprioriteerd ("+c.Priority+") en toegewezen aan "+owner.Name});}break;
        case "link":Require(i.AlertId.HasValue,"Alert vereist.",400);var link=await td.Alerts.Include(x=>x.History).SingleOrDefaultAsync(x=>x.Id==i.AlertId&&x.ScopeId==c.ScopeId);Require(link!=null&&link.CaseId==null&&NeedsCase(link.Triage)&&link.Status==AlertStatus.UnderReview,"Alert niet geschikt voor koppeling.",409);link!.CaseId=c.Id;link.Status=AlertStatus.Escalated;Event(link,u.Name,"Gekoppeld aan "+c.Number);c.Alerts.Add(link);break;
        default:throw new SocException(404,"Onbekende actie.");}td.Entry(c).Property(x=>x.Title).IsModified=true;LogTenant(td,c.ScopeId,u.Name,"Case "+action,c.Number);await td.SaveChangesAsync();await tx.CommitAsync();return CaseDto(c,t.Id,Analyst(u));}throw new SocException(404,"Case niet gevonden.");}
    // Demo-only, one-time addition for both new and previously initialized databases.
    // Never reset an edited password, role, name or active status on restart.
    async Task InitializeTeamAccountsAsync()
    {
        if(!config.GetValue<bool>("Demo:Enabled"))return;
        const string marker="Projectgroep-demoaccounts ingericht v1";
        // Deactivate the former group member on existing demo databases, without deleting history.
        const string rosterMarker="Projectgroep-demoaccounts bijgewerkt v2";
        if(!await db.Audit.AnyAsync(x=>x.Action==rosterMarker))
        {
            await using var rosterTransaction=await db.Database.BeginTransactionAsync();
            var former=await users.FindByNameAsync("riza@soc.demo");
            if(former!=null)
            {
                former.IsActive=false;
                db.Assignments.RemoveRange(db.Assignments.Where(x=>x.UserId==former.Id));
                var result=await users.UpdateSecurityStampAsync(former);
                Require(result.Succeeded,string.Join(" ",result.Errors.Select(x=>x.Description)),500);
            }
            db.Audit.Add(new(){Actor="Systeem",Action=rosterMarker});
            await db.SaveChangesAsync();
            await rosterTransaction.CommitAsync();
        }
        if(await db.Audit.AnyAsync(x=>x.Action==marker))return;
        await using var transaction=await db.Database.BeginTransactionAsync();
        var tenants=await db.Tenants.OrderBy(t=>t.Name=="Northstar Finance"?0:t.Name=="Delta Logistics"?1:2).ThenBy(t=>t.Name).Select(t=>t.Id).ToArrayAsync();
        Require(tenants.Length>0,"Geen demoklanten beschikbaar.",500);
        var members=new (string Name,string Login,string Role)[]
        {
            ("Teun Hanssen","teun@soc.demo","Beheerder"),
            ("Dominique Roosen","dominique@soc.demo","Senior analist"),
            ("Sergio Mendez","sergio@soc.demo","Analist"),
            ("Hamza Ben Ali","hamza@soc.demo","Analist"),
            ("Ruben Abrahamse","ruben@soc.demo","Accountmanager"),
            ("Thijs Dronkers","thijs@soc.demo","Klant")
        };
        foreach(var member in members)
        {
            if(await users.FindByNameAsync(member.Login)!=null||await users.FindByEmailAsync(member.Login)!=null)continue;
            var user=new AppUser{Id=Guid.NewGuid(),Name=member.Name,Email=member.Login,UserName=member.Login,EmailConfirmed=true,Role=member.Role,LockoutEnabled=true};
            var result=await users.CreateAsync(user,"Demo2026!");
            Require(result.Succeeded,string.Join(" ",result.Errors.Select(x=>x.Description)),500);
            await SetGrants(user,member.Role,member.Role switch
            {
                "Beheerder"=>[],
                "Klant"=>tenants.Take(1).ToArray(),
                "Accountmanager"=>tenants.Take(2).ToArray(),
                _=>tenants
            });
        }
        db.Audit.Add(new(){Actor="Systeem",Action=marker});
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
    }
    public async Task InitializeAsync(){await db.Database.EnsureCreatedAsync();await db.Database.ExecuteSqlRawAsync("IF COL_LENGTH('platform.Tenants','ResponseMinutes') IS NULL ALTER TABLE [platform].[Tenants] ADD ResponseMinutes int NOT NULL CONSTRAINT DF_Tenants_ResponseMinutes DEFAULT(60);");if(await db.Tenants.AnyAsync()){Require(await db.Audit.AnyAsync(x=>x.Action=="Demonstratiegegevens aangemaakt"),"Onvolledige demodatabase: reset uitsluitend de demo-volumes en start opnieuw.",500);foreach(var tenant in await db.Tenants.ToListAsync())await factory.UpgradeDemoAsync(tenant);await InitializeTeamAccountsAsync();return;}var ts=new List<Tenant>();foreach(var name in new[]{"Northstar Finance","Delta Logistics","Atlas Health"})ts.Add(await CreateTenant(name));var ids=ts.Select(x=>x.Id).ToArray();var a=new AppUser{Id=Guid.NewGuid(),Name="Alex Morgan",Email="analist@soc.demo",UserName="analist@soc.demo",EmailConfirmed=true,Role="Analist",LockoutEnabled=true};var accounts=new[]{a,new AppUser{Id=Guid.NewGuid(),Name="Sam de Vries",Email="senior@soc.demo",UserName="senior@soc.demo",Role="Senior analist",EmailConfirmed=true,LockoutEnabled=true},new AppUser{Id=Guid.NewGuid(),Name="Robin Peters",Email="beheerder@soc.demo",UserName="beheerder@soc.demo",Role="Beheerder",EmailConfirmed=true,LockoutEnabled=true},new AppUser{Id=Guid.NewGuid(),Name="Jamie Bakker",Email="klant@soc.demo",UserName="klant@soc.demo",Role="Klant",EmailConfirmed=true,LockoutEnabled=true},new AppUser{Id=Guid.NewGuid(),Name="Kim Jansen",Email="accountmanager@soc.demo",UserName="accountmanager@soc.demo",Role="Accountmanager",EmailConfirmed=true,LockoutEnabled=true}};foreach(var u in accounts){var r=await users.CreateAsync(u,"Demo2026!");Require(r.Succeeded,string.Join(" ",r.Errors.Select(x=>x.Description)),500);await SetGrants(u,u.Role,u.Role switch{"Klant"=>ids[..1],"Accountmanager"=>ids[..2],"Beheerder"=>[],_=>ids});}
        var samples=new (string Title,string Description,string Source,string Priority,double Hours,int Tenant)[]{("Verdachte inlogpogingen","Meerdere mislukte aanmeldingen op een serviceaccount.","Microsoft Sentinel","Urgent",-5,0),("Malware gedetecteerd","Endpointbeveiliging heeft een verdacht bestand geblokkeerd.","Defender","High",-7,1),("Ongebruikelijke dataoverdracht","Afwijkend uitgaand netwerkverkeer gedetecteerd.","Splunk","Immediate",-.4,0),("Phishingmelding","Gebruiker meldt een verdachte e-mail.","Defender","Moderate",-3,2),("Afwijkende VPN-login","Inloggen vanaf een onbekende locatie.","Sentinel","High",-2,0),("Poortscan gedetecteerd","Ongebruikelijke scans op een interne host.","Suricata","Low",-1,1),("Verdacht PowerShell-proces","Endpoint heeft afwijkende uitvoering gemeld.","Defender","Urgent",-.6,2),("Geblokkeerde verbinding","Firewall heeft ongebruikelijk verkeer geblokkeerd.","Firewall","Moderate",-.2,1)};for(int n=0;n<samples.Length;n++){var s=samples[n];var t=ts[s.Tenant];var scope=await db.Scopes.FirstAsync(x=>x.TenantId==t.Id);await using var td=factory.Open(t);var alert=NewAlert(scope.Id,new(Title:s.Title,Description:s.Description,Priority:s.Priority),s.Source,DateTimeOffset.UtcNow.AddHours(s.Hours));alert.Number=$"ALT-{1001+n}";td.Alerts.Add(alert);if(n==4){var c=new ResearchCase{ScopeId=scope.Id,Number="CASE-201",Title="Onderzoek afwijkende VPN-login",Priority=alert.Priority,Status=TicketStatus.UnderInvestigation,OwnerId=a.Id,Owner=a.Name,CustomerVisible=true};c.Entries.Add(new(){Actor=a.Name,Kind="Notitie",Text="Loginlog gecontroleerd; aanvullend onderzoek nodig.",Visible=false});c.Entries.Add(new(){Actor=a.Name,Kind="Actie",Text="Klant geïnformeerd over het onderzoek.",Visible=true});td.Cases.Add(c);alert.CaseId=c.Id;alert.Triage="True positive";alert.Status=AlertStatus.Escalated;alert.FirstHandledAt=DateTimeOffset.UtcNow.AddHours(-1.5);alert.OwnerId=a.Id;alert.Owner=a.Name;}if(n==7){alert.Status=AlertStatus.Dismissed;alert.Triage="False positive";alert.FirstHandledAt=DateTimeOffset.UtcNow.AddHours(-.1);alert.OwnerId=accounts[1].Id;alert.Owner=accounts[1].Name;}await td.SaveChangesAsync();}await Log(a,"Demonstratiegegevens aangemaakt");await InitializeTeamAccountsAsync();}
}
