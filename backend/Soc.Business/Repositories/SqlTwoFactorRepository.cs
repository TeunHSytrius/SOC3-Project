using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Soc.Business.Models;
using Soc.Data.Context;

namespace Soc.Business.Repositories;

/// <summary>
/// Stores Thijs' two-factor state in the existing Identity user-token table.
/// The API runs each complete setup or verification operation in a serializable transaction.
/// </summary>
public sealed class SqlTwoFactorRepository : ITwoFactorRepository
{
    private const string LoginProvider = "SOC3.TwoFactor";
    private const string TokenName = "State";
    private readonly SocDbContext _database;

    public SqlTwoFactorRepository(SocDbContext database)
    {
        _database = database;
    }

    private IQueryable<IdentityUserToken<Guid>> UserTokens(Guid userId)
    {
        return _database.Set<IdentityUserToken<Guid>>()
            .Where(token => token.UserId == userId &&
                token.LoginProvider == LoginProvider &&
                token.Name == TokenName);
    }

    public async Task<UserTwoFactor?> GetByUserIdAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var token = await UserTokens(userId).AsNoTracking()
            .SingleOrDefaultAsync(cancellationToken);

        return token?.Value is string json
            ? JsonSerializer.Deserialize<UserTwoFactor>(json)
            : null;
    }

    public async Task SaveAsync(
        UserTwoFactor userTwoFactor,
        CancellationToken cancellationToken = default)
    {
        if (_database.Database.CurrentTransaction is null)
        {
            throw new InvalidOperationException("Two-factor updates require a transaction.");
        }

        var token = await UserTokens(userTwoFactor.UserId)
            .SingleOrDefaultAsync(cancellationToken);

        if (token is null)
        {
            token = new IdentityUserToken<Guid>
            {
                UserId = userTwoFactor.UserId,
                LoginProvider = LoginProvider,
                Name = TokenName
            };

            _database.Add(token);
        }

        token.Value = JsonSerializer.Serialize(userTwoFactor);
        await _database.SaveChangesAsync(cancellationToken);
    }

    public async Task<bool> TryConsumeRecoveryCodeAsync(
        Guid userId,
        string recoveryCodeHash,
        CancellationToken cancellationToken = default)
    {
        var state = await GetByUserIdAsync(userId, cancellationToken);

        if (state is null || !state.RecoveryCodeHashes.Remove(recoveryCodeHash))
        {
            return false;
        }

        // The serializable transaction prevents concurrent requests from both succeeding.
        await SaveAsync(state, cancellationToken);
        return true;
    }
}
