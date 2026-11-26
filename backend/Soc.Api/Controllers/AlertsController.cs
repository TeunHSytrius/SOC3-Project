using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Soc.Business.Services;
namespace Soc.Api.Controllers;

[Authorize, ApiController, Route("api/v1/alerts")]
public sealed class AlertsController(SocService service, AlertService alertService) : ControllerBase
{
    Guid? Workspace => Header("X-Workspace-Id");
    Guid? Scope => Header("X-Scope-Id");
    Guid? Header(string key)
    {
        if (!Request.Headers.TryGetValue(key, out var value) || string.IsNullOrEmpty(value))
            return null;
        if (Guid.TryParse(value, out var id))
            return id;
        throw new SocException(400, "Ongeldige context.");
    }
    [HttpGet]
    public async Task<IActionResult> GetAll() => Ok(await alertService.Alerts(await service.UserAsync(User), Workspace, Scope));
    [HttpPost]
    public async Task<IActionResult> Add(CreateAlertRequest input) => Ok(await alertService.AddAlert(await service.UserAsync(User), input));
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id) => Ok(await alertService.AlertAction(await service.UserAsync(User), id, "get", new(), Workspace, Scope));
    [HttpPost("{id:guid}/claim")]
    public Task<IActionResult> Claim(Guid id, AlertActionRequest input) => Action(id, "claim", input);
    [HttpPost("{id:guid}/triage")]
    public Task<IActionResult> Triage(Guid id, AlertActionRequest input) => Action(id, "triage", input);
    [HttpPost("{id:guid}/promote")]
    public Task<IActionResult> Promote(Guid id, AlertActionRequest input) => Action(id, "promote", input);
    [HttpPost("{id:guid}/reopen")]
    public Task<IActionResult> Reopen(Guid id, AlertActionRequest input) => Action(id, "reopen", input);
    private async Task<IActionResult> Action(Guid id, string action, AlertActionRequest input) => Ok(await alertService.AlertAction(await service.UserAsync(User), id, action, input, Workspace, Scope));
}
