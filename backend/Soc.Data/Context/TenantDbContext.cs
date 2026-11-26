using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Soc.Data.Entities;
namespace Soc.Data.Context;

public sealed class TenantDbContext(DbContextOptions<TenantDbContext> options, string schema) : DbContext(options)
{
    public string Schema { get; } = Regex.IsMatch(schema, "^tenant_[a-f0-9]{32}$") ? schema : throw new ArgumentException("Invalid schema");

    public DbSet<Alert> Alerts => Set<Alert>();

    public DbSet<ResearchCase> Cases => Set<ResearchCase>();

    public DbSet<CaseEvent> CaseEvents => Set<CaseEvent>();

    public DbSet<Observable> Observables => Set<Observable>();

    public DbSet<TenantAudit> Audit => Set<TenantAudit>();
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Schema);
        // All tenant IDs are assigned by the application (Guid.NewGuid()).
        // EF must recognize new children of tracked alerts/cases as INSERTs,
        // not UPDATEs against non-existent rows. RowVersion remains database-generated.
        modelBuilder.Entity<Alert>().Property(entity => entity.Id).ValueGeneratedNever();
        modelBuilder.Entity<AlertEvent>().Property(entity => entity.Id).ValueGeneratedNever();
        modelBuilder.Entity<ResearchCase>().Property(entity => entity.Id).ValueGeneratedNever();
        modelBuilder.Entity<CaseEvent>().Property(entity => entity.Id).ValueGeneratedNever();
        modelBuilder.Entity<Observable>().Property(entity => entity.Id).ValueGeneratedNever();
        modelBuilder.Entity<TenantAudit>().Property(entity => entity.Id).ValueGeneratedNever();
        // Adapted from feature/database CK_Ticket_Deadline: alerts carry the first-response deadline.
        modelBuilder.Entity<Alert>().ToTable(table => table.HasCheckConstraint("CK_Alert_Deadline", "[Deadline] >= [CreatedAt]"));
        modelBuilder.Entity<Alert>().Property(entity => entity.RowVersion).IsRowVersion();
        modelBuilder.Entity<ResearchCase>().Property(entity => entity.RowVersion).IsRowVersion();
        modelBuilder.Entity<Alert>().Property(entity => entity.ExternalEventId).HasMaxLength(200);
        modelBuilder.Entity<Alert>().Property(entity => entity.PayloadHash).HasMaxLength(64);
        modelBuilder.Entity<Alert>().HasIndex(entity => new { entity.SourceIntegrationId, entity.ExternalEventId })
            .IsUnique()
            .HasFilter("[SourceIntegrationId] IS NOT NULL AND [ExternalEventId] IS NOT NULL");
        modelBuilder.Entity<Alert>().Property(entity => entity.Status).HasConversion<string>();
        modelBuilder.Entity<Alert>().Property(entity => entity.Priority).HasConversion<string>();
        modelBuilder.Entity<ResearchCase>().Property(entity => entity.Status).HasConversion<string>();
        modelBuilder.Entity<ResearchCase>().Property(entity => entity.Priority).HasConversion<string>();
        modelBuilder.Entity<Alert>().HasIndex(entity => new { entity.ScopeId, entity.CreatedAt });
        modelBuilder.Entity<ResearchCase>().HasIndex(entity => entity.ScopeId);
        modelBuilder.Entity<ResearchCase>().HasAlternateKey(entity => new { entity.ScopeId, entity.Id })
            .HasName("AK_Cases_ScopeId_Id");
        modelBuilder.Entity<Alert>()
            .HasOne(entity => entity.Case)
            .WithMany(entity => entity.Alerts)
            .HasForeignKey(entity => new { entity.ScopeId, entity.CaseId })
            .HasPrincipalKey(entity => new { entity.ScopeId, entity.Id })
            .HasConstraintName("FK_Alerts_Cases_ScopeId_CaseId")
            .OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<Alert>()
            .HasMany(entity => entity.History)
            .WithOne()
            .HasForeignKey(entity => entity.AlertId);
        modelBuilder.Entity<ResearchCase>()
            .HasMany(entity => entity.Entries)
            .WithOne()
            .HasForeignKey(entity => new { entity.ScopeId, entity.CaseId })
            .HasPrincipalKey(entity => new { entity.ScopeId, entity.Id })
            .HasConstraintName("FK_CaseEvents_Cases_ScopeId_CaseId");
        modelBuilder.Entity<ResearchCase>()
            .HasMany(entity => entity.Observables)
            .WithOne()
            .HasForeignKey(entity => new { entity.ScopeId, entity.CaseId })
            .HasPrincipalKey(entity => new { entity.ScopeId, entity.Id })
            .HasConstraintName("FK_Observables_Cases_ScopeId_CaseId");
    }
}
