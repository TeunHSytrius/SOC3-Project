namespace Soc.Business.DTOs;

public sealed class ChangeUserAccessRequest
{
    public string? Role
    {
        get; init;
    }

    public Guid[]? OrganizationIds
    {
        get; init;
    }
}
