namespace Soc.Data.Entities;

    public class ApiSource
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid TenantId
    { get; set; }

    public Guid ScopeId
    { get; set; }

    public string Name { get; set; } = "";

    public string Hash { get; set; } = "";

    public string Prefix { get; set; } = "";

    public bool IsActive { get; set; } = true;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
