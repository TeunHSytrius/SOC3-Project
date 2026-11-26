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
    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);
        b.HasDefaultSchema("platform");
        b.Entity<Tenant>().HasIndex(x => x.Name).IsUnique();
        b.Entity<Tenant>().HasIndex(x => x.SchemaName).IsUnique();
        b.Entity<Scope>().HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<RoleAssignment>().HasIndex(x => new { x.UserId, x.ScopeId }).IsUnique();
        b.Entity<RoleAssignment>().HasOne<AppUser>().WithMany().HasForeignKey(x => x.UserId);
        b.Entity<RoleAssignment>().HasOne<Scope>().WithMany().HasForeignKey(x => x.ScopeId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<ApiSource>().HasIndex(x => x.Hash).IsUnique();
        b.Entity<ApiSource>().HasOne<Scope>().WithMany().HasForeignKey(x => x.ScopeId).OnDelete(DeleteBehavior.Restrict);
    }
}
