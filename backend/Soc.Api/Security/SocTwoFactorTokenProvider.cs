using System.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Soc.Business.DTOs;
using Soc.Business.Services;
using Soc.Data.Context;
using Soc.Data.Entities;

namespace Soc.Api.Security;

/// <summary>
/// Integrates the original two-factor service into Identity's password-verified sign-in flow.
/// </summary>
public sealed class SocTwoFactorTokenProvider : IUserTwoFactorTokenProvider<AppUser>
{
    public const string ProviderName = "SocTwoFactor";

    private readonly ITwoFactorService _twoFactor;
    private readonly SocDbContext _database;

    public SocTwoFactorTokenProvider(ITwoFactorService twoFactor, SocDbContext database)
    {
        _twoFactor = twoFactor;
        _database = database;
    }

    public Task<bool> CanGenerateTwoFactorTokenAsync(UserManager<AppUser> manager, AppUser user)
    {
        return _twoFactor.IsEnabledAsync(user.Id);
    }

    public Task<string> GenerateAsync(string purpose, UserManager<AppUser> manager, AppUser user)
    {
        throw new NotSupportedException("The authenticator app generates the code.");
    }

    public async Task<bool> ValidateAsync(
        string purpose, string token, UserManager<AppUser> manager, AppUser user)
    {
        await using var transaction = await _database.Database
            .BeginTransactionAsync(IsolationLevel.Serializable);

        var result = await _twoFactor.VerifyLoginAsync(user.Id, token);

        await transaction.CommitAsync();

        return result == TwoFactorVerificationResult.Success;
    }
}
