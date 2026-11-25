using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Soc.Business.Services;
namespace Soc.Api.Controllers;
[Authorize,ApiController,Route("api/v1/alerts")]
public sealed class AlertsController(SocService service):ControllerBase
{
    Guid? Workspace=>Header("X-Workspace-Id");Guid? Scope=>Header("X-Scope-Id");
    Guid? Header(string key){if(!Request.Headers.TryGetValue(key,out var value)||string.IsNullOrEmpty(value))return null;if(Guid.TryParse(value,out var id))return id;throw new SocException(400,"Ongeldige context.");}
    [HttpGet] public async Task<IActionResult> GetAll()=>Ok(await service.Alerts(await service.UserAsync(User),Workspace,Scope));
    [HttpPost] public async Task<IActionResult> Add(Input input)=>Ok(await service.AddAlert(await service.UserAsync(User),input));
    [HttpGet("{id:guid}")] public async Task<IActionResult> Get(Guid id)=>Ok(await service.AlertAction(await service.UserAsync(User),id,"get",new(),Workspace,Scope));
    [HttpPost("{id:guid}/claim")] public Task<IActionResult> Claim(Guid id,Input i)=>Action(id,"claim",i);
    [HttpPost("{id:guid}/triage")] public Task<IActionResult> Triage(Guid id,Input i)=>Action(id,"triage",i);
    [HttpPost("{id:guid}/promote")] public Task<IActionResult> Promote(Guid id,Input i)=>Action(id,"promote",i);
    [HttpPost("{id:guid}/reopen")] public Task<IActionResult> Reopen(Guid id,Input i)=>Action(id,"reopen",i);
    private async Task<IActionResult> Action(Guid id,string action,Input input)=>Ok(await service.AlertAction(await service.UserAsync(User),id,action,input,Workspace,Scope));
}
[ApiController,Route("api/v1/ingest")]
public sealed class IngestController(SocService service):ControllerBase { [EnableRateLimiting("ingest"),HttpPost("alerts")] public async Task<IActionResult> Ingest(Input input)=>StatusCode(201,await service.Ingest(Request.Headers["X-API-Key"].FirstOrDefault(),input)); }
