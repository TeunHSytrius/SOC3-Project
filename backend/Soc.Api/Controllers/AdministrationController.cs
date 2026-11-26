using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Soc.Business.Services;
using Soc.Data.Entities;
namespace Soc.Api.Controllers;
// Route contract from feature/tg-20-customer-management. Real database storage replaces branch's in-memory repository.
[Authorize, ApiController, Route("api/v1")]
public sealed class AdministrationController(SocService service, AdministrationService administrationService, UserManagementService userManagement) : ControllerBase
{
    [HttpGet("ticket-register")]
    public async Task<IActionResult> Tickets() => Ok(await administrationService.TicketRegister(await service.UserAsync(User)));
    [HttpGet("audit")]
    public async Task<IActionResult> Audit() => Ok(await administrationService.Audit(await service.UserAsync(User)));
    [HttpGet("analysts")]
    public async Task<IActionResult> Analysts() => Ok(await userManagement.Analysts(await service.UserAsync(User)));
}
