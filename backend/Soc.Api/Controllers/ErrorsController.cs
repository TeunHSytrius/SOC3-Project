using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Soc.Api.Diagnostics;
using Soc.Business.Services;

namespace Soc.Api.Controllers;

[Authorize, ApiController, Route("api/v1/errors")]
public sealed class ErrorsController(SocService service, ApiErrorLog log) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get()
    {
        SocService.Admin(await service.UserAsync(User));
        return Ok(log.Recent());
    }
}
