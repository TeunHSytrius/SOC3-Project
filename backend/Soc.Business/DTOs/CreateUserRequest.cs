namespace Soc.Business.DTOs;

public sealed class CreateUserRequest
{
    public string? Name { get; init; }

    public string? Email { get; init; }

    public string? Password { get; init; }

    public string? Role { get; init; }

    public Guid[]? OrganizationIds { get; init; }
}
