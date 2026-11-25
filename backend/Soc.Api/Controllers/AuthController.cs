using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Soc.Business.Services;
using Soc.Data.Entities;
namespace Soc.Api.Controllers;
[ApiController,Route("api/v1/auth")]
public sealed class AuthController(UserManager<AppUser> users,SignInManager<AppUser> signIn,SocService service):ControllerBase
{
    [AllowAnonymous,HttpGet("csrf")] public IActionResult Csrf([FromServices] IAntiforgery antiforgery){var tokens=antiforgery.GetAndStoreTokens(HttpContext);return Ok(new{token=tokens.RequestToken});}
    [EnableRateLimiting("login"),AllowAnonymous,HttpPost("login")]
    public async Task<IActionResult> Login(Input i){var email=SocService.Required(i.Username,120);var password=SocService.Required(i.Password,200);var user=await users.FindByNameAsync(email);if(user is not {IsActive:true})return Unauthorized(new{message="Onjuiste inloggegevens."});var result=await signIn.PasswordSignInAsync(user,password,false,true);if(result.RequiresTwoFactor){if(string.IsNullOrWhiteSpace(i.Code))return Unauthorized(new{message="Tweestapsverificatie vereist. Vul je code in.",requiresTwoFactor=true});return await Complete(i);}if(!result.Succeeded)return Unauthorized(new{message="Onjuiste inloggegevens of tijdelijk geblokkeerd."});await service.Log(user,"Ingelogd");return Ok(await service.PublicUser(user));}
    [EnableRateLimiting("login"),AllowAnonymous,HttpPost("2fa")]
    public async Task<IActionResult> Complete(Input i){var user=await signIn.GetTwoFactorAuthenticationUserAsync();if(user is not {IsActive:true})return Unauthorized(new{message="Start opnieuw met inloggen."});var code=SocService.Required(i.Code,50).Replace(" ","");var result=code.Length==6&&code.All(char.IsDigit)?await signIn.TwoFactorAuthenticatorSignInAsync(code,false,false):await signIn.TwoFactorRecoveryCodeSignInAsync(code);if(!result.Succeeded)return Unauthorized(new{message="Ongeldige verificatiecode."});await service.Log(user,"Ingelogd met 2FA");return Ok(await service.PublicUser(user));}
    [Authorize,HttpGet("me")]
    public async Task<IActionResult> Me()=>Ok(await service.PublicUser(await service.UserAsync(User,true)));
    [Authorize,HttpPost("logout")]
    public async Task<IActionResult> Logout(){await signIn.SignOutAsync();return Ok(new{ok=true});}
    [Authorize,HttpPost("2fa/setup")]
    public async Task<IActionResult> Setup(){var u=await service.UserAsync(User,true);SocService.Require(!u.TwoFactorEnabled,"2FA is al actief.",409);var key=await users.GetAuthenticatorKeyAsync(u);if(string.IsNullOrEmpty(key)){await users.ResetAuthenticatorKeyAsync(u);key=await users.GetAuthenticatorKeyAsync(u);}return Ok(new{secret=key,manualEntryKey=key,account=u.Email,authenticatorUri=$"otpauth://totp/SOC3:{Uri.EscapeDataString(u.Email!)}?secret={key}&issuer=SOC3"});}
    [Authorize,HttpPost("2fa/enable")]
    public async Task<IActionResult> Enable(Input i){var u=await service.UserAsync(User,true);SocService.Require(!u.TwoFactorEnabled,"2FA is al actief.",409);SocService.Require(!string.IsNullOrEmpty(await users.GetAuthenticatorKeyAsync(u)),"Start eerst de setup.",400);var valid=await users.VerifyTwoFactorTokenAsync(u,users.Options.Tokens.AuthenticatorTokenProvider,SocService.Required(i.Code,12));SocService.Require(valid,"Ongeldige code.",400);var result=await users.SetTwoFactorEnabledAsync(u,true);SocService.Require(result.Succeeded,"2FA activeren mislukt.",500);var codes=await users.GenerateNewTwoFactorRecoveryCodesAsync(u,8);await signIn.RefreshSignInAsync(u);await service.Log(u,"2FA geactiveerd");return Ok(new{recoveryCodes=codes});}
}
[Authorize,ApiController,Route("api/v1/me")]
public sealed class MeController(SocService service):ControllerBase { [HttpGet("access")] public async Task<IActionResult> Access()=>Ok(await service.Access(await service.UserAsync(User))); }
