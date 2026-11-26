namespace Soc.Data.Entities;

    public class PlatformAudit
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public string Actor { get; set; } = "";

    public string Action { get; set; } = "";

    public Guid? TenantId
    { get; set; }

    public string? Target
    { get; set; }
}
