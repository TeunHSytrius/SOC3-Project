namespace Soc.Business.DTOs;

public sealed class CreateApiKeyRequest
{
    public string? Name { get; init; }

    public Guid? OrganizationId { get; init; }

    public Guid? ScopeId { get; init; }
}
