using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Soc.Business.Services;
namespace Soc.Api.Controllers;

[Authorize, ApiController, Route("api/v1/cases")]
public sealed class CasesController(SocService service, CaseService caseService) : ControllerBase
{
    Guid? Header(string key)
    {
        if (!Request.Headers.TryGetValue(key, out var value) || string.IsNullOrEmpty(value))
            return null;
        if (Guid.TryParse(value, out var id))
            return id;
        throw new SocException(400, "Ongeldige context.");
    }
    Guid? Workspace => Header("X-Workspace-Id"); Guid? Scope => Header("X-Scope-Id");
    [HttpGet] public async Task<IActionResult> GetAll() => Ok(await caseService.Cases(await service.UserAsync(User), Workspace, Scope));
    [HttpGet("{id:guid}")] public Task<IActionResult> Get(Guid id) => Act(id, "get", new());
    [HttpPatch("{id:guid}")] public Task<IActionResult> Update(Guid id, CaseActionRequest input) => Act(id, input.Status != null ? "status" : input.UserId != null ? "owner" : "visibility", input);
    [HttpPost("{id:guid}/events")] public Task<IActionResult> Event(Guid id, CaseActionRequest input) => Act(id, "entry", input);
    [HttpPost("{id:guid}/observables")] public Task<IActionResult> Observable(Guid id, CaseActionRequest input) => Act(id, "entry", input with { Kind = "Observable", Text = input.Value ?? input.Text });
    [HttpPost("{id:guid}/alerts")] public Task<IActionResult> Link(Guid id, CaseActionRequest input) => Act(id, "link", input);
    private async Task<IActionResult> Act(Guid id, string action, CaseActionRequest input) => Ok(await caseService.CaseAction(await service.UserAsync(User), id, action, input, Workspace, Scope));
}
[Authorize, ApiController, Route("api/v1/portal/cases")]
public sealed class PortalController(SocService service, CaseService caseService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List()
    {
        var u = await service.UserAsync(User);
        SocService.Require(u.Role is "Klant" or "Accountmanager");
        return Ok(await caseService.Cases(u, null, null));
    }
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        var u = await service.UserAsync(User);
        SocService.Require(u.Role is "Klant" or "Accountmanager");
        return Ok(await caseService.CaseAction(u, id, "get", new(), null, null));
    }
}
