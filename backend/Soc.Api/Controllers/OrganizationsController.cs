using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Soc.Business.Services;
using Soc.Data.Entities;
namespace Soc.Api.Controllers;
// Route contract from feature/tg-20-customer-management. Real database storage replaces branch's in-memory repository.
[Authorize, ApiController, Route("api/v1/organizations")]
public sealed class OrganizationsController(SocService service) : ControllerBase
{
    static OrganizationResponse Dto(Tenant organization) => new() { Id = organization.Id, Name = organization.Name, ResponseMinutes = organization.ResponseMinutes, IsActive = organization.IsActive, CreatedAt = organization.CreatedAt, DeactivatedAt = organization.DeactivatedAt };
    [HttpGet]
    public async Task<IActionResult> GetAll() => Ok((await service.Organizations(await service.UserAsync(User))).Select(Dto));
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id) => Ok(Dto(await service.Organization(await service.UserAsync(User), id)));
    [HttpPost]
    public async Task<IActionResult> Create(CreateOrganizationRequest input)
    {
        var organization = await service.CreateOrganization(await service.UserAsync(User), input);
        return CreatedAtAction(nameof(GetById), new
        {
            id = organization.Id
        }, Dto(organization));
    }
    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, CreateOrganizationRequest input) => Ok(Dto(await service.RenameOrganization(await service.UserAsync(User), id, input.Name, input.ResponseMinutes)));
    [HttpPost("{id:guid}/deactivate")]
    public async Task<IActionResult> Deactivate(Guid id) => Ok(Dto(await service.SetOrganization(await service.UserAsync(User), id, false)));
    [HttpPost("{id:guid}/activate")]
    public async Task<IActionResult> Activate(Guid id) => Ok(Dto(await service.SetOrganization(await service.UserAsync(User), id, true)));
}
