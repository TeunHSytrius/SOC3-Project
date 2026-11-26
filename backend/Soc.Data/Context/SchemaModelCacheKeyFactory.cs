using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;

namespace Soc.Data.Context;

public sealed class SchemaModelCacheKeyFactory : IModelCacheKeyFactory
{
    public object Create(DbContext context, bool designTime)
    {
        // EF must cache a separate model for every tenant schema.
        if (context is TenantDbContext tenantContext)
        {
            return (context.GetType(), tenantContext.Schema, designTime);
        }

        return (context.GetType(), designTime);
    }
}
