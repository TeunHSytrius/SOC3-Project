using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Soc.Data.Entities;
namespace Soc.Data.Context;

public sealed class SocDbContext(DbContextOptions<SocDbContext> options) : IdentityDbContext<AppUser, IdentityRole<Guid>, Guid>(options)
{
    public DbSet<Tenant> Tenants => Set<Tenant>();

    public DbSet<Scope> Scopes => Set<Scope>();

    public DbSet<RoleAssignment> Assignments => Set<RoleAssignment>();

    public DbSet<ApiSource> Sources => Set<ApiSource>();

    public DbSet<PlatformAudit> Audit => Set<PlatformAudit>();
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.HasDefaultSchema("platform");
        modelBuilder.Entity<Tenant>().HasIndex(entity => entity.Name).IsUnique();
        modelBuilder.Entity<Tenant>().HasIndex(entity => entity.SchemaName).IsUnique();
        modelBuilder.Entity<Scope>()
            .HasOne<Tenant>()
            .WithMany()
            .HasForeignKey(entity => entity.TenantId)
            .OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<RoleAssignment>().HasIndex(entity => new { entity.UserId, entity.ScopeId }).IsUnique();
        modelBuilder.Entity<RoleAssignment>()
            .HasOne<AppUser>()
            .WithMany()
            .HasForeignKey(entity => entity.UserId);
        modelBuilder.Entity<RoleAssignment>()
            .HasOne<Scope>()
            .WithMany()
            .HasForeignKey(entity => entity.ScopeId)
            .OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<ApiSource>().HasIndex(entity => entity.Hash).IsUnique();
        modelBuilder.Entity<ApiSource>()
            .HasOne<Scope>()
            .WithMany()
            .HasForeignKey(entity => entity.ScopeId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
