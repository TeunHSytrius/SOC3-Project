using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Soc.Data.Entities;

namespace Soc.Data.Context;

public sealed class TenantDbContext : DbContext
{
    public TenantDbContext(DbContextOptions<TenantDbContext> options, string schema)
        : base(options)
    {
        if (!Regex.IsMatch(schema, "^tenant_[a-f0-9]{32}$"))
        {
            throw new ArgumentException("Invalid schema", nameof(schema));
        }

        Schema = schema;
    }

    public string Schema
    {
        get;
    }

    public DbSet<Alert> Alerts => Set<Alert>();
    public DbSet<ResearchCase> Cases => Set<ResearchCase>();
    public DbSet<CaseEvent> CaseEvents => Set<CaseEvent>();
    public DbSet<Observable> Observables => Set<Observable>();
    public DbSet<TenantAudit> Audit => Set<TenantAudit>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Schema);

        ConfigureAlerts(modelBuilder);
        ConfigureCases(modelBuilder);
        ConfigureApplicationGeneratedIds(modelBuilder);
    }

    private static void ConfigureApplicationGeneratedIds(ModelBuilder modelBuilder)
    {
        // The application assigns IDs to new records; SQL Server generates RowVersion.
        modelBuilder.Entity<Alert>().Property(alert => alert.Id).ValueGeneratedNever();
        modelBuilder.Entity<AlertEvent>().Property(alertEvent => alertEvent.Id).ValueGeneratedNever();
        modelBuilder.Entity<ResearchCase>().Property(ticket => ticket.Id).ValueGeneratedNever();
        modelBuilder.Entity<CaseEvent>().Property(caseEvent => caseEvent.Id).ValueGeneratedNever();
        modelBuilder.Entity<Observable>().Property(observable => observable.Id).ValueGeneratedNever();
        modelBuilder.Entity<TenantAudit>().Property(audit => audit.Id).ValueGeneratedNever();
    }

    private static void ConfigureAlerts(ModelBuilder modelBuilder)
    {
        var alerts = modelBuilder.Entity<Alert>();

        alerts.ToTable(table => table.HasCheckConstraint(
            "CK_Alert_Deadline", "[Deadline] >= [CreatedAt]"));

        alerts.Property(alert => alert.RowVersion).IsRowVersion();
        alerts.Property(alert => alert.ExternalEventId).HasMaxLength(200);
        alerts.Property(alert => alert.PayloadHash).HasMaxLength(64);
        alerts.Property(alert => alert.Status).HasConversion<string>();
        alerts.Property(alert => alert.Priority).HasConversion<string>();

        alerts.HasIndex(alert => new { alert.SourceIntegrationId, alert.ExternalEventId })
            .IsUnique()
            .HasFilter("[SourceIntegrationId] IS NOT NULL AND [ExternalEventId] IS NOT NULL");

        alerts.HasIndex(alert => new { alert.ScopeId, alert.CreatedAt });

        alerts.HasOne(alert => alert.Case)
            .WithMany(ticket => ticket.Alerts)
            .HasForeignKey(alert => new { alert.ScopeId, alert.CaseId })
            .HasPrincipalKey(ticket => new { ticket.ScopeId, ticket.Id })
            .HasConstraintName("FK_Alerts_Cases_ScopeId_CaseId")
            .OnDelete(DeleteBehavior.Restrict);

        alerts.HasMany(alert => alert.History)
            .WithOne()
            .HasForeignKey(alertEvent => alertEvent.AlertId);
    }

    private static void ConfigureCases(ModelBuilder modelBuilder)
    {
        var cases = modelBuilder.Entity<ResearchCase>();

        cases.Property(ticket => ticket.RowVersion).IsRowVersion();
        cases.Property(ticket => ticket.Status).HasConversion<string>();
        cases.Property(ticket => ticket.Priority).HasConversion<string>();

        cases.HasIndex(ticket => ticket.ScopeId);

        cases.HasAlternateKey(ticket => new { ticket.ScopeId, ticket.Id })
            .HasName("AK_Cases_ScopeId_Id");

        cases.HasMany(ticket => ticket.Entries)
            .WithOne()
            .HasForeignKey(caseEvent => new { caseEvent.ScopeId, caseEvent.CaseId })
            .HasPrincipalKey(ticket => new { ticket.ScopeId, ticket.Id })
            .HasConstraintName("FK_CaseEvents_Cases_ScopeId_CaseId");

        cases.HasMany(ticket => ticket.Observables)
            .WithOne()
            .HasForeignKey(observable => new { observable.ScopeId, observable.CaseId })
            .HasPrincipalKey(ticket => new { ticket.ScopeId, ticket.Id })
            .HasConstraintName("FK_Observables_Cases_ScopeId_CaseId");
    }
}
