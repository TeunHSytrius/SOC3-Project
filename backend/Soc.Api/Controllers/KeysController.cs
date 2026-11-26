using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Soc.Business.Services;
using Soc.Data.Entities;
namespace Soc.Api.Controllers;
// Route contract from feature/tg-20-customer-management. Real database storage replaces branch's in-memory repository.
[Authorize, ApiController, Route("api/v1/keys")]
public sealed class KeysController(SocService service) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List() => Ok(await service.Keys(await service.UserAsync(User)));
    [HttpPost]
    public async Task<IActionResult> Create(CreateApiKeyRequest input) => StatusCode(201, await service.CreateKey(await service.UserAsync(User), input));
    [HttpPost("{id:guid}/revoke")]
    public async Task<IActionResult> Revoke(Guid id) => Ok(await service.Revoke(await service.UserAsync(User), id));
}
