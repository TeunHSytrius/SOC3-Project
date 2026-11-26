namespace Soc.Business.DTOs;

public sealed class CreateAlertRequest
{
    public Guid? OrganizationId { get; init; }

    public Guid? ScopeId { get; init; }

    public string? Title { get; init; }

    public string? Description { get; init; }

    public string? Source { get; init; }

    public string? Priority { get; init; }
}
