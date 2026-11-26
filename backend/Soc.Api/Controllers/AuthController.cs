using System.Data;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;
using Soc.Api.Security;
using Soc.Business.Exceptions;
using Soc.Data.Context;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Soc.Business.Services;
using Soc.Data.Entities;

namespace Soc.Api.Controllers;

[ApiController, Route("api/v1/auth")]
public sealed class AuthController(
    UserManager<AppUser> users,
    SignInManager<AppUser> signIn,
    SocService service,
    ITwoFactorService twoFactor,
    SocDbContext database) : ControllerBase
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
        // Accounts enrolled before this integration retain their Identity authenticator and recovery codes.
        // New enrollments use the original service through Identity's second-factor provider.
        Microsoft.AspNetCore.Identity.SignInResult result;
        if (await twoFactor.IsEnabledAsync(user.Id))
        {
            result = await signIn.TwoFactorSignInAsync(
                SocTwoFactorTokenProvider.ProviderName, code, false, false);
        }
        else
        {
            result = code.Length == 6 && code.All(char.IsDigit)
                ? await signIn.TwoFactorAuthenticatorSignInAsync(code, false, false)
                : await signIn.TwoFactorRecoveryCodeSignInAsync(code);
        }
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

        await using var transaction = await database.Database
            .BeginTransactionAsync(IsolationLevel.Serializable);

        var setup = await twoFactor.StartSetupAsync(
            new StartTwoFactorSetupRequest(currentUser.Id, currentUser.Email!));

        await transaction.CommitAsync();

        return Ok(new
        {
            secret = setup.ManualEntryKey.Replace(" ", ""),
            setup.ManualEntryKey,
            account = currentUser.Email,
            authenticatorUri = setup.OtpAuthUri,
            setup.OtpAuthUri
        });
    }

    [Authorize, EnableRateLimiting("login"), HttpPost("2fa/enable")]
    public async Task<IActionResult> Enable(TwoFactorRequest input)
    {
        var currentUser = await service.UserAsync(User, true);
        SocService.Require(!currentUser.TwoFactorEnabled, "2FA is al actief.", 409);

        await using var transaction = await database.Database
            .BeginTransactionAsync(IsolationLevel.Serializable);

        EnableTwoFactorResponse response;
        try
        {
            response = await twoFactor.EnableAsync(
                new EnableTwoFactorRequest(currentUser.Id, SocService.Required(input.Code, 50)));
        }
        catch (InvalidTwoFactorCodeException)
        {
            // Failed attempts must be persisted even when the verification is rejected.
            await transaction.CommitAsync();
            return BadRequest(new { message = "Ongeldige code. Start de setup opnieuw als deze is verlopen." });
        }
        catch (TwoFactorSetupNotStartedException)
        {
            await transaction.CommitAsync();
            return BadRequest(new { message = "Start de setup opnieuw; deze is niet gestart of verlopen." });
        }
        catch (TwoFactorAlreadyEnabledException)
        {
            return Conflict(new { message = "2FA is al actief." });
        }

        var result = await users.SetTwoFactorEnabledAsync(currentUser, true);
        SocService.Require(result.Succeeded, "2FA activeren mislukt.", 500);

        await service.Log(currentUser, "2FA geactiveerd");
        await transaction.CommitAsync();
        await signIn.RefreshSignInAsync(currentUser);

        return Ok(response);
    }
}
