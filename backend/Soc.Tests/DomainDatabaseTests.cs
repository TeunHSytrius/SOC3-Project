using Microsoft.EntityFrameworkCore;
using Soc.Data.Domain.Context;
using Soc.Data.Domain.Entities;

namespace Soc.Tests;

public class DomainDatabaseTests
{
    private const string PlatformConnection =
        "Server=localhost;Database=Soc3Demo;Integrated Security=True;TrustServerCertificate=True";

    [Fact]
    public void OriginalModelCanGenerateSqlServerSchema()
    {
        var options = new DbContextOptionsBuilder<DomainDbContext>()
            .UseSqlServer(DomainDatabaseConnection.Resolve(PlatformConnection, null))
            .Options;

        using var database = new DomainDbContext(options);

        var createScript = database.Database.GenerateCreateScript();

        Assert.Contains("CREATE TABLE [Alerts]", createScript);
        Assert.Contains("CREATE TABLE [Tickets]", createScript);
        Assert.Contains("CREATE TABLE [Researches]", createScript);
        Assert.Contains("CREATE TABLE [Customers]", createScript);
        Assert.Contains("CREATE TABLE [Organizations]", createScript);
        Assert.Contains("CREATE TABLE [Contracts]", createScript);
        Assert.Contains("CREATE TABLE [Employees]", createScript);
        Assert.Contains("CREATE TABLE [Evidences]", createScript);
        Assert.Contains("CREATE TABLE [Notes]", createScript);

        var ticket = database.Model.FindEntityType(typeof(Ticket));
        Assert.NotNull(ticket);
        Assert.Contains(ticket.GetForeignKeys(), foreignKey =>
            foreignKey.PrincipalEntityType.ClrType == typeof(Alert) && foreignKey.IsUnique);
    }

    [Fact]
    public void DefaultConnectionUsesSeparateDatabase()
    {
        var connectionString = DomainDatabaseConnection.Resolve(PlatformConnection, null);

        var connection = new Microsoft.Data.SqlClient.SqlConnectionStringBuilder(connectionString);

        Assert.Equal("Soc3Demo_Domain", connection.InitialCatalog);
    }

    [Fact]
    public void RejectsSameDatabaseName()
    {
        Assert.Throws<InvalidOperationException>(() =>
            DomainDatabaseConnection.Resolve(PlatformConnection, PlatformConnection));
    }
}
