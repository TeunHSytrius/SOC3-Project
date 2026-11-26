using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Soc.Business.Services;
namespace Soc.Api.Controllers;

[ApiController, Route("api/v1/ingest")]
public sealed class IngestController(AlertIngestService ingestService) : ControllerBase
{
    [EnableRateLimiting("ingest"), HttpPost("alerts"), Consumes("application/json"), RequestSizeLimit(1048576)]
    public async Task<IActionResult> Ingest()
    {
        if (Request.ContentLength > 1048576)
            return StatusCode(413);
        using var body = new MemoryStream();
        var buffer = new byte[8192];
        int read;
        while ((read = await Request.Body.ReadAsync(buffer.AsMemory(), HttpContext.RequestAborted)) > 0)
        {
            if (body.Length + read > 1048576)
                return StatusCode(413);
            body.Write(buffer, 0, read);
        }
        var result = await ingestService.Ingest(Request.Headers["X-API-Key"].FirstOrDefault(), body.ToArray());
        return StatusCode(result.Status, result.Data);
    }
}
