using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Soc.Data.Context;
using Soc.Data.Entities;
namespace Soc.Api.Security;
// Identity continues to verify TOTP; only the persisted authenticator secret is encrypted.
public sealed class ProtectedUserStore(SocDbContext context, IDataProtectionProvider protection, IdentityErrorDescriber errors) : UserStore<AppUser, IdentityRole<Guid>, SocDbContext, Guid>(context, errors)
{
    private readonly IDataProtector protector = protection.CreateProtector("SOC3.Identity.AuthenticatorKey.v1");
    public override Task SetAuthenticatorKeyAsync(AppUser user, string key, CancellationToken cancellationToken = default) => base.SetAuthenticatorKeyAsync(user, protector.Protect(key), cancellationToken);
    public override async Task<string?> GetAuthenticatorKeyAsync(AppUser user, CancellationToken cancellationToken = default)
    {
        var encrypted = await base.GetAuthenticatorKeyAsync(user, cancellationToken);
        return encrypted == null ? null : protector.Unprotect(encrypted);
    }
}
