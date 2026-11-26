using Microsoft.EntityFrameworkCore;
using Soc.Data.Domain.Entities;

namespace Soc.Data.Domain.Context;

// Original domain model from feature/database; shared by the application and the additive schema initializer.
internal static class DomainModelConfiguration
{
    internal const string Schema = "domain";

    internal static void Configure(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Alert>().ToTable("Alerts", Schema);
        modelBuilder.Entity<Research>().ToTable("Researches", Schema);
        modelBuilder.Entity<Ticket>().ToTable("Tickets", Schema);
        modelBuilder.Entity<Note>().ToTable("Notes", Schema);
        modelBuilder.Entity<Customer>().ToTable("Customers", Schema);
        modelBuilder.Entity<Organization>().ToTable("Organizations", Schema);
        modelBuilder.Entity<CustomerOrganization>().ToTable("CustomerOrganizations", Schema);
        modelBuilder.Entity<Contract>().ToTable("Contracts", Schema);
        modelBuilder.Entity<Employee>().ToTable("Employees", Schema);
        modelBuilder.Entity<Evidence>().ToTable("Evidences", Schema);

        // Ticket constraints and relationships.
        modelBuilder.Entity<Ticket>(entity =>
        {
            entity.Property(t => t.SlaStatus)
                .HasConversion<string>()
                .HasMaxLength(15);
            entity.Property(t => t.CreatedAt)
                .IsRequired();
            entity.Property(t => t.Deadline)
                .IsRequired();
            entity.ToTable(t =>
            {
                t.HasCheckConstraint(
                    "CK_Ticket_Deadline",
                    "[Deadline] >= [CreatedAt]"
                );
            });
            entity.HasOne(t => t.ResolvedBy)
                .WithMany()
                .HasForeignKey(t => t.ResolvedById)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasMany(t => t.Notes)
                .WithOne(n => n.Ticket)
                .HasForeignKey(n => n.TicketId)
                .IsRequired()
                .OnDelete(DeleteBehavior.Restrict);
        });

        // Customer-organization relationships.
        modelBuilder.Entity<CustomerOrganization>(entity =>
        {

            entity.HasOne(co => co.Customer)
                .WithMany(c => c.CustomerOrganizations)
                .HasForeignKey(co => co.CustomerId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(co => co.Organization)
                .WithMany(c => c.CustomerOrganizations)
                .HasForeignKey(co => co.organizationId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(co => new
                {
                    co.CustomerId,
                    co.organizationId
                }
            ).IsUnique();
        });
        // Evidence relationships.
        modelBuilder.Entity<Evidence>(entity =>
        {
            entity.HasOne(e => e.Research)
                .WithMany(r => r.Evidences)
                .HasForeignKey(e => e.ResearchId)
                .IsRequired()
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(e => e.Analyst)
                .WithMany()
                .HasForeignKey(e => e.AnalystId)
                .IsRequired()
                .OnDelete(DeleteBehavior.Restrict);

        });
        // Alert constraints and relationships.
        modelBuilder.Entity<Alert>(entity =>
        {
            entity.HasOne(a => a.Customer)
                .WithMany()
                .HasForeignKey(a => a.CustomerId)
                .IsRequired()
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(a => a.Employee)
                .WithMany()
                .HasForeignKey(a => a.EmployeeId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(a => a.Ticket)
                .WithOne(t => t.Alert)
                .HasForeignKey<Ticket>(t => t.AlertId)
                .IsRequired()
                .OnDelete(DeleteBehavior.Restrict);
            entity.Property(a => a.ConfidentialityLevel)
                .IsRequired()
                .HasConversion<string>()
                .HasMaxLength(15);
            entity.Property(a => a.AlertCreatedAt)
                .IsRequired();
            entity.Property(a => a.AlertDescription)
                .IsRequired()
                .HasMaxLength(300);
        });
        modelBuilder.Entity<Contract>(entity =>
        {
            entity.Property(c => c.SlaInDays)
                .IsRequired();
            entity.Property(c => c.Confidentiality)
                .IsRequired()
                .HasConversion<string>()
                .HasMaxLength(15);
            entity.Property(c => c.StartDate)
                .IsRequired();
            entity.Property(c => c.EndDate)
                .IsRequired();
            entity.ToTable(t =>
            {
                t.HasCheckConstraint(
                    "CK_Contract_EndDate",
                    "[EndDate] >= [StartDate]"
                );
                t.HasCheckConstraint(
                    "CK_Contract_SlaInDays",
                    "[SlaInDays] > 0"
                );
            });
            entity.HasOne(c => c.CustomerOrganization)
                .WithOne(c => c.Contract)
                .HasForeignKey<Contract>(c => c.CustomerOrganizationId)
                .IsRequired()
                .OnDelete(DeleteBehavior.Restrict);

        });
        modelBuilder.Entity<Employee>(entity =>
        {
            entity.Property(e => e.Clearance)
                .IsRequired()
                .HasConversion<string>()
                .HasMaxLength(20);
        });
        modelBuilder.Entity<Note>(entity =>
        {
            entity.HasOne(n => n.Employee)
                .WithMany()
                .HasForeignKey(n => n.EmployeeId)
                .IsRequired()
                .OnDelete(DeleteBehavior.Restrict);

        });
        modelBuilder.Entity<Research>(entity =>
        {
            entity.HasOne(r => r.Alert)
                .WithOne()
                .HasForeignKey<Research>(r => r.AlertID)
                .IsRequired()
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(r => r.Employee)
                .WithMany()
                .HasForeignKey(r => r.EmployeeId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasMany(r => r.Evidences)
                .WithOne(e => e.Research)
                .HasForeignKey(e => e.ResearchId)
                .IsRequired()
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(r => r.Ticket)
                .WithOne(t => t.Research)
                .HasForeignKey<Research>(r => r.TicketId)
                .IsRequired()
                .OnDelete(DeleteBehavior.Restrict);

        });
    }
}
