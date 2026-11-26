using Microsoft.EntityFrameworkCore;
using Soc.Data.Context;
using DomainEntities = global::Soc.Data.Domain.Entities;

namespace Soc.Tests;

public class DomainDatabaseTests
{
    [Fact]
    public void CombinedModelCanGenerateSqlServerSchema()
    {
        var options = new DbContextOptionsBuilder<SocDbContext>()
            .UseSqlServer("Server=localhost;Database=Soc3Demo;Integrated Security=True;TrustServerCertificate=True")
            .Options;

        using var database = new SocDbContext(options);

        var createScript = database.Database.GenerateCreateScript();

        Assert.Contains("CREATE TABLE [platform].[AspNetUsers]", createScript);
        Assert.Contains("CREATE TABLE [platform].[AspNetUserTokens]", createScript);
        Assert.Contains("CREATE TABLE [platform].[Tenants]", createScript);

        foreach (var table in new[]
        {
            "Alerts", "Tickets", "Researches", "Customers", "Organizations",
            "CustomerOrganizations", "Contracts", "Employees", "Evidences", "Notes"
        })
        {
            Assert.Contains($"CREATE TABLE [domain].[{table}]", createScript);
        }

        var ticket = database.Model.FindEntityType(typeof(DomainEntities.Ticket));
        Assert.NotNull(ticket);
        Assert.Contains(ticket.GetForeignKeys(), foreignKey =>
            foreignKey.PrincipalEntityType.ClrType == typeof(DomainEntities.Alert) && foreignKey.IsUnique);
    }
}
