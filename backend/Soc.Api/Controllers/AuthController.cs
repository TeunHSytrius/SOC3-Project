using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Soc.Business.Services;
using Soc.Data.Entities;

namespace Soc.Api.Controllers;

[ApiController, Route("api/v1/auth")]
public sealed class AuthController(UserManager<AppUser> users, SignInManager<AppUser> signIn, SocService service) : ControllerBase
{
    [AllowAnonymous, HttpGet("csrf")]
    public IActionResult Csrf([FromServices] IAntiforgery antiforgery)
    {
        var tokens = antiforgery.GetAndStoreTokens(HttpContext);
        return Ok(new
        {
            token = tokens.RequestToken
        });
    }

    [EnableRateLimiting("login"), AllowAnonymous, HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest input)
    {
        var email = SocService.Required(input.Username, 120);
        var password = SocService.RequiredPassword(input.Password);
        var user = await users.FindByNameAsync(email);
        if (user is not { IsActive: true })
            return Unauthorized(new
            {
                message = "Onjuiste inloggegevens."
            });
        var result = await signIn.PasswordSignInAsync(user, password, false, true);
        if (result.RequiresTwoFactor)
        {
            if (string.IsNullOrWhiteSpace(input.Code))
                return Unauthorized(new
                {
                    message = "Tweestapsverificatie vereist. Vul je code in.",
                    requiresTwoFactor = true
                });
            return await Complete(new TwoFactorRequest { Code = input.Code });
        }
        if (!result.Succeeded)
            return Unauthorized(new
            {
                message = "Onjuiste inloggegevens of tijdelijk geblokkeerd."
            });
        await service.Log(user, "Ingelogd");
        return Ok(await service.PublicUser(user));
    }

    [EnableRateLimiting("login"), AllowAnonymous, HttpPost("2fa")]
    public async Task<IActionResult> Complete(TwoFactorRequest input)
    {
        var user = await signIn.GetTwoFactorAuthenticationUserAsync();
        if (user is not { IsActive: true })
            return Unauthorized(new
            {
                message = "Start opnieuw met inloggen."
            });
        var code = SocService.Required(input.Code, 50).Replace(" ", "");
        var result = code.Length == 6 && code.All(char.IsDigit) ? await signIn.TwoFactorAuthenticatorSignInAsync(code, false, false) : await signIn.TwoFactorRecoveryCodeSignInAsync(code);
        if (!result.Succeeded)
            return Unauthorized(new
            {
                message = "Ongeldige verificatiecode."
            });
        await service.Log(user, "Ingelogd met 2FA");
        return Ok(await service.PublicUser(user));
    }

    [Authorize, HttpGet("me")]
    public async Task<IActionResult> Me() => Ok(await service.PublicUser(await service.UserAsync(User, true)));
    [Authorize, HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await signIn.SignOutAsync();
        return Ok(new
        {
            ok = true
        });
    }

    [Authorize, EnableRateLimiting("login"), HttpPost("2fa/setup")]
    public async Task<IActionResult> Setup()
    {
        var currentUser = await service.UserAsync(User, true);
        SocService.Require(!currentUser.TwoFactorEnabled, "2FA is al actief.", 409);
        var key = await users.GetAuthenticatorKeyAsync(currentUser);
        if (string.IsNullOrEmpty(key))
        {
            await users.ResetAuthenticatorKeyAsync(currentUser);
            key = await users.GetAuthenticatorKeyAsync(currentUser);
        }
        var uri = $"otpauth://totp/SOC3:{Uri.EscapeDataString(currentUser.Email!)}?secret={key}&issuer=SOC3&algorithm=SHA1&digits=6&period=30";
        var manualEntryKey = string.Join(' ', key!.Chunk(4).Select(chunk => new string(chunk)));
        return Ok(new
        {
            secret = key,
            manualEntryKey,
            account = currentUser.Email,
            authenticatorUri = uri,
            otpAuthUri = uri
        });
    }

    [Authorize, EnableRateLimiting("login"), HttpPost("2fa/enable")]
    public async Task<IActionResult> Enable(TwoFactorRequest input)
    {
        var currentUser = await service.UserAsync(User, true);
        SocService.Require(!currentUser.TwoFactorEnabled, "2FA is al actief.", 409);
        SocService.Require(!string.IsNullOrEmpty(await users.GetAuthenticatorKeyAsync(currentUser)), "Start eerst de setup.", 400);
        var valid = await users.VerifyTwoFactorTokenAsync(currentUser, users.Options.Tokens.AuthenticatorTokenProvider, SocService.Required(input.Code, 12));
        SocService.Require(valid, "Ongeldige code.", 400);
        var result = await users.SetTwoFactorEnabledAsync(currentUser, true);
        SocService.Require(result.Succeeded, "2FA activeren mislukt.", 500);
        var codes = await users.GenerateNewTwoFactorRecoveryCodesAsync(currentUser, 8);
        await signIn.RefreshSignInAsync(currentUser);
        await service.Log(currentUser, "2FA geactiveerd");
        return Ok(new
        {
            recoveryCodes = codes
        });
    }
}
