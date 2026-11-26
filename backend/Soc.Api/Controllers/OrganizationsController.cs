using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Soc.Business.Services;
using Soc.Data.Entities;
namespace Soc.Api.Controllers;
// Route contract from feature/tg-20-customer-management. Real database storage replaces branch's in-memory repository.
[Authorize, ApiController, Route("api/v1/organizations")]
public sealed class OrganizationsController(SocService service) : ControllerBase
{
    static OrganizationResponse Dto(Tenant t) => new() { Id = t.Id, Name = t.Name, ResponseMinutes = t.ResponseMinutes, IsActive = t.IsActive, CreatedAt = t.CreatedAt, DeactivatedAt = t.DeactivatedAt };
    [HttpGet] public async Task<IActionResult> GetAll() => Ok((await service.Organizations(await service.UserAsync(User))).Select(Dto));
    [HttpGet("{id:guid}")] public async Task<IActionResult> GetById(Guid id) => Ok(Dto(await service.Organization(await service.UserAsync(User), id)));
    [HttpPost]
    public async Task<IActionResult> Create(CreateOrganizationRequest input)
    {
        var t = await service.CreateOrganization(await service.UserAsync(User), input);
        return CreatedAtAction(nameof(GetById), new
        {
            id = t.Id
        }, Dto(t));
    }
    [HttpPatch("{id:guid}")] public async Task<IActionResult> Update(Guid id, CreateOrganizationRequest input) => Ok(Dto(await service.RenameOrganization(await service.UserAsync(User), id, input.Name, input.ResponseMinutes)));
    [HttpPost("{id:guid}/deactivate")] public async Task<IActionResult> Deactivate(Guid id) => Ok(Dto(await service.SetOrganization(await service.UserAsync(User), id, false)));
    [HttpPost("{id:guid}/activate")] public async Task<IActionResult> Activate(Guid id) => Ok(Dto(await service.SetOrganization(await service.UserAsync(User), id, true)));
}
[Authorize, ApiController, Route("api/v1/users")]
public sealed class UsersController(SocService service) : ControllerBase
{
    [HttpGet] public async Task<IActionResult> List() => Ok(await service.ListUsers(await service.UserAsync(User)));
    [HttpPost] public async Task<IActionResult> Create(CreateUserRequest input) => StatusCode(201, await service.CreateUser(await service.UserAsync(User), input));
    [HttpPatch("{id:guid}")] public async Task<IActionResult> Update(Guid id, UpdateUserRequest input) => Ok(await service.UpdateUser(await service.UserAsync(User), id, input));
    [HttpPost("{id:guid}/remove")] public async Task<IActionResult> Remove(Guid id) => Ok(await service.RemoveUser(await service.UserAsync(User), id));
    [HttpPost("{id:guid}/access")] public async Task<IActionResult> Access(Guid id, ChangeUserAccessRequest input) => Ok(await service.ChangeAccess(await service.UserAsync(User), id, input));
}
[Authorize, ApiController, Route("api/v1/keys")]
public sealed class KeysController(SocService service) : ControllerBase
{
    [HttpGet] public async Task<IActionResult> List() => Ok(await service.Keys(await service.UserAsync(User)));
    [HttpPost] public async Task<IActionResult> Create(CreateApiKeyRequest input) => StatusCode(201, await service.CreateKey(await service.UserAsync(User), input));
    [HttpPost("{id:guid}/revoke")] public async Task<IActionResult> Revoke(Guid id) => Ok(await service.Revoke(await service.UserAsync(User), id));
}
[Authorize, ApiController, Route("api/v1")]
public sealed class AdministrationController(SocService service) : ControllerBase
{
    [HttpGet("ticket-register")] public async Task<IActionResult> Tickets() => Ok(await service.TicketRegister(await service.UserAsync(User)));
    [HttpGet("audit")] public async Task<IActionResult> Audit() => Ok(await service.Audit(await service.UserAsync(User)));
    [HttpGet("analysts")] public async Task<IActionResult> Analysts() => Ok(await service.Analysts(await service.UserAsync(User)));
}
