using Microsoft.Data.SqlClient;

namespace Soc.Data.Domain.Context;

public static class DomainDatabaseConnection
{
    public static string Resolve(string platformConnectionString, string? domainConnectionString)
    {
        var platform = new SqlConnectionStringBuilder(platformConnectionString);

        if (string.IsNullOrWhiteSpace(platform.InitialCatalog))
        {
            throw new InvalidOperationException("De platformconnectie moet een databasenaam bevatten.");
        }

        var domain = string.IsNullOrWhiteSpace(domainConnectionString)
            ? new SqlConnectionStringBuilder(platformConnectionString)
            {
                InitialCatalog = platform.InitialCatalog + "_Domain"
            }
            : new SqlConnectionStringBuilder(domainConnectionString);

        if (string.IsNullOrWhiteSpace(domain.InitialCatalog) ||
            string.Equals(platform.InitialCatalog, domain.InitialCatalog, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                "Gebruik een afzonderlijke databasenaam voor het oorspronkelijke domeinmodel.");
        }

        return domain.ConnectionString;
    }
}
