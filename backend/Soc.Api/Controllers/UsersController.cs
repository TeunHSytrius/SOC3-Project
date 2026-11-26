using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Soc.Business.Services;
using Soc.Data.Entities;
namespace Soc.Api.Controllers;
// Route contract from feature/tg-20-customer-management. Real database storage replaces branch's in-memory repository.
[Authorize, ApiController, Route("api/v1/users")]
public sealed class UsersController(SocService service) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List() => Ok(await service.ListUsers(await service.UserAsync(User)));
    [HttpPost]
    public async Task<IActionResult> Create(CreateUserRequest input) => StatusCode(201, await service.CreateUser(await service.UserAsync(User), input));
    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, UpdateUserRequest input) => Ok(await service.UpdateUser(await service.UserAsync(User), id, input));
    [HttpPost("{id:guid}/remove")]
    public async Task<IActionResult> Remove(Guid id) => Ok(await service.RemoveUser(await service.UserAsync(User), id));
    [HttpPost("{id:guid}/access")]
    public async Task<IActionResult> Access(Guid id, ChangeUserAccessRequest input) => Ok(await service.ChangeAccess(await service.UserAsync(User), id, input));
}
