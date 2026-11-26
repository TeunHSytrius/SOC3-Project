namespace Soc.Business.DTOs;

public sealed class TwoFactorRequest
{
    public string? Code
    {
        get; init;
    }
}
