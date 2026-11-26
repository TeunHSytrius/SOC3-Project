using Microsoft.AspNetCore.Identity;
namespace Soc.Data.Entities;

public class RoleAssignment
{
    public Guid Id { get; set; } = Guid.NewGuid(); public Guid UserId
    {
        get; set;
    }
    public Guid TenantId
    {
        get; set;
    }
    public Guid ScopeId
    {
        get; set;
    }
}
