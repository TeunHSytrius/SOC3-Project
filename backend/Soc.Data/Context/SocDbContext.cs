using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage;
using Soc.Data.Entities;
namespace Soc.Data.Context;

public sealed class SocDbContext(DbContextOptions<SocDbContext> options) : IdentityDbContext<AppUser, IdentityRole<Guid>, Guid>(options)
{
    public DbSet<Tenant> Tenants => Set<Tenant>(); public DbSet<Scope> Scopes => Set<Scope>(); public DbSet<RoleAssignment> Assignments => Set<RoleAssignment>(); public DbSet<ApiSource> Sources => Set<ApiSource>(); public DbSet<PlatformAudit> Audit => Set<PlatformAudit>();
    protected override void OnModelCreating(ModelBuilder b) { base.OnModelCreating(b); b.HasDefaultSchema("platform"); b.Entity<Tenant>().HasIndex(x=>x.Name).IsUnique(); b.Entity<Tenant>().HasIndex(x=>x.SchemaName).IsUnique(); b.Entity<Scope>().HasOne<Tenant>().WithMany().HasForeignKey(x=>x.TenantId).OnDelete(DeleteBehavior.Restrict); b.Entity<RoleAssignment>().HasIndex(x=>new{x.UserId,x.ScopeId}).IsUnique(); b.Entity<RoleAssignment>().HasOne<AppUser>().WithMany().HasForeignKey(x=>x.UserId); b.Entity<RoleAssignment>().HasOne<Scope>().WithMany().HasForeignKey(x=>x.ScopeId).OnDelete(DeleteBehavior.Restrict); b.Entity<ApiSource>().HasIndex(x=>x.Hash).IsUnique(); b.Entity<ApiSource>().HasOne<Scope>().WithMany().HasForeignKey(x=>x.ScopeId).OnDelete(DeleteBehavior.Restrict); }
}
public sealed class TenantDbContext(DbContextOptions<TenantDbContext> options, string schema) : DbContext(options)
{
    public string Schema {get;}=Regex.IsMatch(schema,"^tenant_[a-f0-9]{32}$")?schema:throw new ArgumentException("Invalid schema");
    public DbSet<Alert> Alerts=>Set<Alert>(); public DbSet<ResearchCase> Cases=>Set<ResearchCase>(); public DbSet<CaseEvent> CaseEvents=>Set<CaseEvent>(); public DbSet<Observable> Observables=>Set<Observable>(); public DbSet<TenantAudit> Audit=>Set<TenantAudit>();
    protected override void OnModelCreating(ModelBuilder b) { b.HasDefaultSchema(Schema); b.Entity<Alert>().Property(x=>x.RowVersion).IsRowVersion(); b.Entity<ResearchCase>().Property(x=>x.RowVersion).IsRowVersion(); b.Entity<Alert>().Property(x=>x.ExternalEventId).HasMaxLength(200); b.Entity<Alert>().Property(x=>x.PayloadHash).HasMaxLength(64); b.Entity<Alert>().HasIndex(x=>new{x.SourceIntegrationId,x.ExternalEventId}).IsUnique().HasFilter("[SourceIntegrationId] IS NOT NULL AND [ExternalEventId] IS NOT NULL"); b.Entity<Alert>().Property(x=>x.Status).HasConversion<string>(); b.Entity<Alert>().Property(x=>x.Priority).HasConversion<string>(); b.Entity<ResearchCase>().Property(x=>x.Status).HasConversion<string>(); b.Entity<ResearchCase>().Property(x=>x.Priority).HasConversion<string>(); b.Entity<Alert>().HasIndex(x=>new{x.ScopeId,x.CreatedAt}); b.Entity<ResearchCase>().HasIndex(x=>x.ScopeId); b.Entity<Alert>().HasOne(x=>x.Case).WithMany(x=>x.Alerts).HasForeignKey(x=>x.CaseId).OnDelete(DeleteBehavior.Restrict); b.Entity<Alert>().HasMany(x=>x.History).WithOne().HasForeignKey(x=>x.AlertId); b.Entity<ResearchCase>().HasMany(x=>x.Entries).WithOne().HasForeignKey(x=>x.CaseId); b.Entity<ResearchCase>().HasMany(x=>x.Observables).WithOne().HasForeignKey(x=>x.CaseId); }
}
public sealed class SchemaModelCacheKeyFactory : IModelCacheKeyFactory { public object Create(DbContext context,bool designTime)=>context is TenantDbContext t?(context.GetType(),t.Schema,designTime):(context.GetType(),designTime); }
public sealed class TenantDbFactory(string connectionString)
{
    public TenantDbContext Open(Tenant tenant) => new(new DbContextOptionsBuilder<TenantDbContext>().UseSqlServer(connectionString).ReplaceService<IModelCacheKeyFactory,SchemaModelCacheKeyFactory>().Options,tenant.SchemaName);
    // Additive upgrade for existing local demo schemas; production requires separate reviewed deployment.
    public async Task UpgradeDemoAsync(Tenant tenant)
    {
        await using var db=Open(tenant);
        var schema=db.Schema;
        var alerts=$"[{schema}].[Alerts]";
        var cases=$"[{schema}].[Cases]";
        var observables=$"[{schema}].[Observables]";
        var sql=$"""
            IF COL_LENGTH('{alerts}', 'SourceIntegrationId') IS NULL ALTER TABLE {alerts} ADD SourceIntegrationId uniqueidentifier NULL;
            IF COL_LENGTH('{alerts}', 'ExternalEventId') IS NULL ALTER TABLE {alerts} ADD ExternalEventId nvarchar(200) NULL;
            IF COL_LENGTH('{alerts}', 'PayloadHash') IS NULL ALTER TABLE {alerts} ADD PayloadHash nvarchar(64) NULL;
            IF COL_LENGTH('{alerts}', 'OccurredAt') IS NULL ALTER TABLE {alerts} ADD OccurredAt datetimeoffset NULL;
            IF COL_LENGTH('{alerts}', 'RowVersion') IS NULL ALTER TABLE {alerts} ADD RowVersion rowversion NOT NULL;
            IF COL_LENGTH('{cases}', 'RowVersion') IS NULL ALTER TABLE {cases} ADD RowVersion rowversion NOT NULL;
            IF COL_LENGTH('{cases}', 'Summary') IS NULL ALTER TABLE {cases} ADD Summary nvarchar(max) NULL;
            IF COL_LENGTH('{observables}', 'Assessment') IS NULL ALTER TABLE {observables} ADD Assessment nvarchar(max) NULL;
            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('{alerts}') AND name='IX_Alerts_SourceIntegrationId_ExternalEventId')
                EXEC(N'CREATE UNIQUE INDEX [IX_Alerts_SourceIntegrationId_ExternalEventId] ON {alerts} ([SourceIntegrationId],[ExternalEventId]) WHERE [SourceIntegrationId] IS NOT NULL AND [ExternalEventId] IS NOT NULL');
            """;
        await using var tx=await db.Database.BeginTransactionAsync();
        await db.Database.ExecuteSqlRawAsync(sql);
        await tx.CommitAsync();
    }
    // Called on provision only; platform and tenant schemas share one database.
    public async Task ProvisionAsync(Tenant tenant) { await using var db=Open(tenant); await db.GetService<IRelationalDatabaseCreator>().CreateTablesAsync(); }
}
