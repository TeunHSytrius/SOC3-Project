using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Soc.Business.Services;

namespace Soc.Api.Controllers;

[Authorize, ApiController, Route("api/v1")]
public sealed class AdministrationController(SocService service, AdministrationService administrationService) : ControllerBase
{
    [HttpGet("audit")]
    public async Task<IActionResult> Audit() =>
        Ok(await administrationService.Audit(await service.UserAsync(User)));
}
