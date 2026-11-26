using Microsoft.AspNetCore.Identity;
namespace Soc.Data.Entities;

public class AppUser : IdentityUser<Guid>
{
    public string Name { get; set; } = "";

    public string Role { get; set; } = "Analist";

    public bool IsActive { get; set; } = true;

    public DateTimeOffset? DeletedAt
    {
        get; set;
    }
}
