using Microsoft.AspNetCore.Identity;
namespace Soc.Data.Entities;

public class TenantAudit
{
    public Guid Id { get; set; } = Guid.NewGuid(); public Guid ScopeId
    {
        get; set;
    }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow; public string Actor { get; set; } = ""; public string Action { get; set; } = ""; public string? Target
    {
        get; set;
    }
}
