using Soc.Business.Models;
using Soc.Business.Repositories;

namespace Soc.Tests.Fakes;

/// <summary>
/// In-memory test double; never registered in the running application.
/// </summary>
public sealed class InMemoryTwoFactorRepository : ITwoFactorRepository
{
    private readonly Dictionary<Guid, UserTwoFactor> _items = new();
    private readonly object _lock = new();

    public Task<UserTwoFactor?> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        lock (_lock)
        {
            return Task.FromResult(_items.TryGetValue(userId, out var item) ? item : null);
        }
    }

    public Task SaveAsync(UserTwoFactor userTwoFactor, CancellationToken cancellationToken = default)
    {
        lock (_lock)
        {
            _items[userTwoFactor.UserId] = userTwoFactor;
        }

        return Task.CompletedTask;
    }

    public Task<bool> TryConsumeRecoveryCodeAsync(Guid userId, string recoveryCodeHash, CancellationToken cancellationToken = default)
    {
        lock (_lock)
        {
            bool removed = _items.TryGetValue(userId, out var item)
                && item.RecoveryCodeHashes.Remove(recoveryCodeHash);

            return Task.FromResult(removed);
        }
    }
}
