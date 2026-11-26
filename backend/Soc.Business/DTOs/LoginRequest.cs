namespace Soc.Business.DTOs;

public sealed class LoginRequest
{
    public string? Username { get; init; }

    public string? Password { get; init; }

    public string? Code { get; init; }
}
