using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Soc.Business.Services;
using Soc.Data.Entities;

namespace Soc.Api.Controllers;

// Route contract from feature/tg-20-customer-management.
[Authorize, ApiController, Route("api/v1/organizations")]
public sealed class OrganizationsController(SocService service, OrganizationService organizations) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var currentUser = await service.UserAsync(User);
        var customers = await organizations.Organizations(currentUser);
        return Ok(customers.Select(ToResponse));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var currentUser = await service.UserAsync(User);
        var organization = await organizations.Organization(currentUser, id);
        return Ok(ToResponse(organization));
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateOrganizationRequest input)
    {
        var currentUser = await service.UserAsync(User);
        var organization = await organizations.CreateOrganization(currentUser, input);
        return CreatedAtAction(nameof(GetById), new { id = organization.Id }, ToResponse(organization));
    }

    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, CreateOrganizationRequest input)
    {
        var currentUser = await service.UserAsync(User);
        var organization = await organizations.RenameOrganization(currentUser, id, input.Name);
        return Ok(ToResponse(organization));
    }

    [HttpPost("{id:guid}/deactivate")]
    public async Task<IActionResult> Deactivate(Guid id)
    {
        var currentUser = await service.UserAsync(User);
        var organization = await organizations.SetOrganization(currentUser, id, false);
        return Ok(ToResponse(organization));
    }

    [HttpPost("{id:guid}/activate")]
    public async Task<IActionResult> Activate(Guid id)
    {
        var currentUser = await service.UserAsync(User);
        var organization = await organizations.SetOrganization(currentUser, id, true);
        return Ok(ToResponse(organization));
    }

    private static OrganizationResponse ToResponse(Tenant organization)
    {
        return new OrganizationResponse
        {
            Id = organization.Id,
            Name = organization.Name,
            IsActive = organization.IsActive,
            CreatedAt = organization.CreatedAt,
            DeactivatedAt = organization.DeactivatedAt
        };
    }
}
