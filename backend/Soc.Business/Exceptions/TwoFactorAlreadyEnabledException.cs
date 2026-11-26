namespace Soc.Business.Exceptions;

public sealed class TwoFactorAlreadyEnabledException : Exception
{
    public TwoFactorAlreadyEnabledException(Guid userId)
        : base($"Two-factor authentication is already enabled for user {userId}.")
    {
    }
}
