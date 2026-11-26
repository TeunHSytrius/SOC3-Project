using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Soc.Data.Entities;
using Soc.Data.Domain.Context;
using DomainEntities = global::Soc.Data.Domain.Entities;

namespace Soc.Data.Context;

public sealed class SocDbContext : IdentityDbContext<AppUser, IdentityRole<Guid>, Guid>
{
    public SocDbContext(DbContextOptions<SocDbContext> options)
        : base(options)
    {
    }

    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<Scope> Scopes => Set<Scope>();
    public DbSet<RoleAssignment> Assignments => Set<RoleAssignment>();
    public DbSet<ApiSource> Sources => Set<ApiSource>();
    public DbSet<PlatformAudit> Audit => Set<PlatformAudit>();

    public DbSet<DomainEntities.Alert> Alerts => Set<DomainEntities.Alert>();
    public DbSet<DomainEntities.Research> Researches => Set<DomainEntities.Research>();
    public DbSet<DomainEntities.Ticket> Tickets => Set<DomainEntities.Ticket>();
    public DbSet<DomainEntities.Note> Notes => Set<DomainEntities.Note>();
    public DbSet<DomainEntities.Customer> Customers => Set<DomainEntities.Customer>();
    public DbSet<DomainEntities.Organization> Organizations => Set<DomainEntities.Organization>();
    public DbSet<DomainEntities.CustomerOrganization> CustomerOrganizations => Set<DomainEntities.CustomerOrganization>();
    public DbSet<DomainEntities.Contract> Contracts => Set<DomainEntities.Contract>();
    public DbSet<DomainEntities.Employee> Employees => Set<DomainEntities.Employee>();
    public DbSet<DomainEntities.Evidence> Evidences => Set<DomainEntities.Evidence>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.HasDefaultSchema("platform");

        ConfigureTenants(modelBuilder);
        ConfigureScopes(modelBuilder);
        ConfigureRoleAssignments(modelBuilder);
        ConfigureApiSources(modelBuilder);
        DomainModelConfiguration.Configure(modelBuilder);
    }

    private static void ConfigureTenants(ModelBuilder modelBuilder)
    {
        var tenants = modelBuilder.Entity<Tenant>();

        tenants.HasIndex(tenant => tenant.Name)
            .IsUnique();

        tenants.HasIndex(tenant => tenant.SchemaName)
            .IsUnique();
    }

    private static void ConfigureScopes(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Scope>()
            .HasOne<Tenant>()
            .WithMany()
            .HasForeignKey(scope => scope.TenantId)
            .OnDelete(DeleteBehavior.Restrict);
    }

    private static void ConfigureRoleAssignments(ModelBuilder modelBuilder)
    {
        var assignments = modelBuilder.Entity<RoleAssignment>();

        assignments.HasIndex(assignment => new { assignment.UserId, assignment.ScopeId })
            .IsUnique();

        assignments.HasOne<AppUser>()
            .WithMany()
            .HasForeignKey(assignment => assignment.UserId);

        assignments.HasOne<Scope>()
            .WithMany()
            .HasForeignKey(assignment => assignment.ScopeId)
            .OnDelete(DeleteBehavior.Restrict);
    }

    private static void ConfigureApiSources(ModelBuilder modelBuilder)
    {
        var sources = modelBuilder.Entity<ApiSource>();

        sources.HasIndex(source => source.Hash)
            .IsUnique();

        sources.HasOne<Scope>()
            .WithMany()
            .HasForeignKey(source => source.ScopeId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
