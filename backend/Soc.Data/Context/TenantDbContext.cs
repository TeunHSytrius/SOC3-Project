using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage;
using Soc.Data.Entities;
namespace Soc.Data.Context;

public sealed class TenantDbContext(DbContextOptions<TenantDbContext> options, string schema) : DbContext(options)
{
    public string Schema { get; } = Regex.IsMatch(schema, "^tenant_[a-f0-9]{32}$") ? schema : throw new ArgumentException("Invalid schema");
    public DbSet<Alert> Alerts => Set<Alert>(); public DbSet<ResearchCase> Cases => Set<ResearchCase>(); public DbSet<CaseEvent> CaseEvents => Set<CaseEvent>(); public DbSet<Observable> Observables => Set<Observable>(); public DbSet<TenantAudit> Audit => Set<TenantAudit>();
    protected override void OnModelCreating(ModelBuilder b)
    {
        b.HasDefaultSchema(Schema);
        // All tenant IDs are assigned by the application (Guid.NewGuid()).
        // EF must recognize new children of tracked alerts/cases as INSERTs,
        // not UPDATEs against non-existent rows. RowVersion remains database-generated.
        b.Entity<Alert>().Property(x => x.Id).ValueGeneratedNever();
        b.Entity<AlertEvent>().Property(x => x.Id).ValueGeneratedNever();
        b.Entity<ResearchCase>().Property(x => x.Id).ValueGeneratedNever();
        b.Entity<CaseEvent>().Property(x => x.Id).ValueGeneratedNever();
        b.Entity<Observable>().Property(x => x.Id).ValueGeneratedNever();
        b.Entity<TenantAudit>().Property(x => x.Id).ValueGeneratedNever();
        // Adapted from feature/database CK_Ticket_Deadline: alerts carry the first-response deadline.
        b.Entity<Alert>().ToTable(t => t.HasCheckConstraint("CK_Alert_Deadline", "[Deadline] >= [CreatedAt]"));
        b.Entity<Alert>().Property(x => x.RowVersion).IsRowVersion();
        b.Entity<ResearchCase>().Property(x => x.RowVersion).IsRowVersion();
        b.Entity<Alert>().Property(x => x.ExternalEventId).HasMaxLength(200);
        b.Entity<Alert>().Property(x => x.PayloadHash).HasMaxLength(64);
        b.Entity<Alert>().HasIndex(x => new { x.SourceIntegrationId, x.ExternalEventId }).IsUnique().HasFilter("[SourceIntegrationId] IS NOT NULL AND [ExternalEventId] IS NOT NULL");
        b.Entity<Alert>().Property(x => x.Status).HasConversion<string>();
        b.Entity<Alert>().Property(x => x.Priority).HasConversion<string>();
        b.Entity<ResearchCase>().Property(x => x.Status).HasConversion<string>();
        b.Entity<ResearchCase>().Property(x => x.Priority).HasConversion<string>();
        b.Entity<Alert>().HasIndex(x => new { x.ScopeId, x.CreatedAt });
        b.Entity<ResearchCase>().HasIndex(x => x.ScopeId);
        b.Entity<ResearchCase>().HasAlternateKey(x => new { x.ScopeId, x.Id }).HasName("AK_Cases_ScopeId_Id");
        b.Entity<Alert>().HasOne(x => x.Case).WithMany(x => x.Alerts).HasForeignKey(x => new { x.ScopeId, x.CaseId }).HasPrincipalKey(x => new { x.ScopeId, x.Id }).HasConstraintName("FK_Alerts_Cases_ScopeId_CaseId").OnDelete(DeleteBehavior.Restrict);
        b.Entity<Alert>().HasMany(x => x.History).WithOne().HasForeignKey(x => x.AlertId);
        b.Entity<ResearchCase>().HasMany(x => x.Entries).WithOne().HasForeignKey(x => new { x.ScopeId, x.CaseId }).HasPrincipalKey(x => new { x.ScopeId, x.Id }).HasConstraintName("FK_CaseEvents_Cases_ScopeId_CaseId");
        b.Entity<ResearchCase>().HasMany(x => x.Observables).WithOne().HasForeignKey(x => new { x.ScopeId, x.CaseId }).HasPrincipalKey(x => new { x.ScopeId, x.Id }).HasConstraintName("FK_Observables_Cases_ScopeId_CaseId");
    }
}
