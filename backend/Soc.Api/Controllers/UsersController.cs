using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Soc.Business.Services;

namespace Soc.Api.Controllers;

[Authorize, ApiController, Route("api/v1/users")]
public sealed class UsersController(SocService service, UserManagementService userManagement) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List()
    {
        var currentUser = await service.UserAsync(User);
        var accounts = await userManagement.ListUsers(currentUser);
        return Ok(accounts);
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateUserRequest input)
    {
        var currentUser = await service.UserAsync(User);
        var account = await userManagement.CreateUser(currentUser, input);
        return StatusCode(201, account);
    }

    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, UpdateUserRequest input)
    {
        var currentUser = await service.UserAsync(User);
        var account = await userManagement.UpdateUser(currentUser, id, input);
        return Ok(account);
    }

    [HttpPost("{id:guid}/remove")]
    public async Task<IActionResult> Remove(Guid id)
    {
        var currentUser = await service.UserAsync(User);
        var result = await userManagement.RemoveUser(currentUser, id);
        return Ok(result);
    }

    [HttpPost("{id:guid}/access")]
    public async Task<IActionResult> Access(Guid id, ChangeUserAccessRequest input)
    {
        var currentUser = await service.UserAsync(User);
        var account = await userManagement.ChangeAccess(currentUser, id, input);
        return Ok(account);
    }
}
