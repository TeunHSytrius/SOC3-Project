namespace Soc.Business.DTOs;

/// <summary>Full editable account profile; a missing password leaves the current password unchanged.</summary>
public sealed record UpdateUserRequest(
    string? Name,
    string? Email,
    string? Role,
    Guid[]? OrganizationIds,
    bool? IsActive,
    string? Password = null);
