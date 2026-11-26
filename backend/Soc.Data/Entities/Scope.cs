using Microsoft.AspNetCore.Identity;
namespace Soc.Data.Entities;

public class Scope
{
    public Guid Id { get; set; } = Guid.NewGuid(); public Guid TenantId
    {
        get; set;
    }
    public string Name { get; set; } = "Algemeen";
}
