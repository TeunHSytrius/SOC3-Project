using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Soc.Business.Services;
namespace Soc.Api.Controllers;

[Authorize, ApiController, Route("api/v1/portal/cases")]
public sealed class PortalController(SocService service, CaseService caseService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List()
    {
        var currentUser = await service.UserAsync(User);
        SocService.Require(currentUser.Role is "Klant" or "Accountmanager");
        return Ok(await caseService.Cases(currentUser, null, null));
    }
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        var currentUser = await service.UserAsync(User);
        SocService.Require(currentUser.Role is "Klant" or "Accountmanager");
        return Ok(await caseService.CaseAction(currentUser, id, "get", new(), null, null));
    }
}
