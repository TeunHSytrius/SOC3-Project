using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Soc.Business.Services;
using Soc.Data.Entities;
namespace Soc.Api.Controllers;

[Authorize, ApiController, Route("api/v1/me")]
public sealed class MeController(SocService service) : ControllerBase
{
    [HttpGet("access")]
    public async Task<IActionResult> Access() => Ok(await service.Access(await service.UserAsync(User)));
}
