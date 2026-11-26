using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage;
using Soc.Data.Context;

namespace Soc.Data.Domain.Context;

// Only provisions the restored tables on older demo databases. Runtime queries use SocDbContext.
public sealed class DomainSchemaInitializer
{
    private readonly SocDbContext _database;

    public DomainSchemaInitializer(SocDbContext database)
    {
        _database = database;
    }

    public async Task InitializeAsync(CancellationToken cancellationToken = default)
    {
        var expectedTables = _database.Model.GetEntityTypes()
            .Where(entity => entity.GetSchema() == DomainModelConfiguration.Schema)
            .Select(entity => entity.GetTableName())
            .OfType<string>()
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var existingTables = await _database.Database.SqlQueryRaw<string>(
            """
            SELECT t.name AS [Value]
            FROM sys.tables AS t
            INNER JOIN sys.schemas AS s ON s.schema_id = t.schema_id
            WHERE s.name = N'domain'
            """)
            .ToListAsync(cancellationToken);

        if (expectedTables.IsSubsetOf(existingTables))
        {
            return;
        }

        if (existingTables.Count != 0)
        {
            throw new InvalidOperationException(
                "Het domeinschema is onvolledig. Controleer de database; verwijder geen bestaande gegevens.");
        }

        // Use the existing connection, not a second database or separate credentials.
        var options = new DbContextOptionsBuilder<DomainSchemaContext>()
            .UseSqlServer(_database.Database.GetDbConnection())
            .Options;

        await using var schemaContext = new DomainSchemaContext(options);
        await schemaContext.GetService<IRelationalDatabaseCreator>()
            .CreateTablesAsync(cancellationToken);
    }

    private sealed class DomainSchemaContext : DbContext
    {
        public DomainSchemaContext(DbContextOptions<DomainSchemaContext> options)
            : base(options)
        {
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            DomainModelConfiguration.Configure(modelBuilder);
        }
    }
}
