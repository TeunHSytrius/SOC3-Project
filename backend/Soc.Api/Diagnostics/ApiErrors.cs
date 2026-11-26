using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Soc.Business.Services;

namespace Soc.Api.Diagnostics;

public sealed record ApiErrorEntry(DateTimeOffset At, int Status, string Method, string Route, string Reason, string TraceId, string? ExceptionType);

// Technical diagnostics only. Never store request bodies, headers, usernames,
// raw exception messages or customer data in this overview.
public sealed class ApiErrorLog
{
    private readonly Queue<ApiErrorEntry> entries = new();
    private readonly object gate = new();
    public void Add(ApiErrorEntry entry)
    {
        lock (gate)
        {
            entries.Enqueue(entry);
            while (entries.Count > 500)
                entries.Dequeue();
        }
    }
    public ApiErrorEntry[] Recent()
    {
        lock (gate)
            return entries.Reverse().ToArray();
    }
}

public sealed class ApiErrorMiddleware(RequestDelegate next, ILogger<ApiErrorMiddleware> logger, ApiErrorLog log)
{
    public static string Reason(int status) => status switch
    {
        400 => "Ongeldige invoer of beveiligingstoken.",
        401 => "Authenticatie vereist of mislukt.",
        403 => "Onvoldoende rechten.",
        404 => "Onderdeel niet gevonden of niet toegankelijk.",
        405 => "HTTP-methode niet toegestaan.",
        409 => "Conflict of ongeldige statusovergang.",
        413 => "Bericht is te groot.",
        415 => "Bestandstype of berichtformaat niet ondersteund.",
        429 => "Te veel verzoeken. Probeer later opnieuw.",
        503 => "Dienst tijdelijk niet beschikbaar.",
        >= 500 => "Interne serverfout.",
        _ => "Verzoek mislukt."
    };

    public async Task InvokeAsync(HttpContext context)
    {
        if (!context.Request.Path.StartsWithSegments("/api"))
        {
            await next(context);
            return;
        }
        context.Response.Headers.CacheControl = "no-store";
        context.Response.Headers["X-Trace-Id"] = context.TraceIdentifier;
        string? exceptionType = null;
        string? reason = null;
        try
        {
            if ((HttpMethods.IsPost(context.Request.Method) || HttpMethods.IsPatch(context.Request.Method)) &&
                context.Request.Headers.TryGetValue("Origin", out var origin) &&
                (!Uri.TryCreate(origin.ToString(), UriKind.Absolute, out var uri) ||
                 !string.Equals(uri.Authority, context.Request.Host.Value, StringComparison.OrdinalIgnoreCase)))
                throw new SocException(403, "Ongeldige origin.");
            await next(context);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            return;
        }
        catch (Exception ex)
        {
            if (context.Response.HasStarted)
                throw;
            exceptionType = ex.GetType().Name;
            var status = 500;
            var message = Reason(status);
            if (ex is SocException business)
            {
                status = business.Status;
                message = status < 500 ? business.Message : Reason(status);
            }
            else if (ex is DbUpdateConcurrencyException)
            {
                status = 409;
                message = "Record is gewijzigd. Vernieuw de gegevens.";
                reason = "Gelijktijdige recordwijziging.";
            }
            else if (ex is Microsoft.Data.SqlClient.SqlException { Number: 1205 } ||
                     ex is DbUpdateException { InnerException: Microsoft.Data.SqlClient.SqlException { Number: 1205 } })
            {
                status = 409;
                message = "Gelijktijdige wijziging. Vernieuw de gegevens.";
                reason = "SQL Server deadlock.";
            }
            else if (ex is BadHttpRequestException bad)
            {
                status = bad.StatusCode;
                message = Reason(status);
            }
            else if (ex is Microsoft.Data.SqlClient.SqlException || ex is DbUpdateException)
            {
                reason = "Databasebewerking mislukt.";
            }
            context.Response.Clear();
            context.Response.Headers.CacheControl = "no-store";
            context.Response.Headers["X-Trace-Id"] = context.TraceIdentifier;
            context.Response.StatusCode = status;
            await context.Response.WriteAsJsonAsync(new
            {
                message,
                traceId = context.TraceIdentifier
            });
            // The server log contains the exception type and stack, not the exception message.
            if (status >= 500)
                logger.LogError("API exception {Type}; trace {TraceId}; stack {Stack}", exceptionType, context.TraceIdentifier, ex.StackTrace);
        }
        if (context.Response.StatusCode >= 400)
        {
            var route = (context.GetEndpoint() as RouteEndpoint)?.RoutePattern.RawText ?? "(onbekende API-route)";
            var status = context.Response.StatusCode;
            // The normal anonymous logout attempt on initial page load is not an error event.
            if (status == 401 && context.Request.Path == "/api/v1/auth/logout")
                return;
            var entry = new ApiErrorEntry(DateTimeOffset.UtcNow, status, context.Request.Method, route,
                reason ?? Reason(status), context.TraceIdentifier, exceptionType);
            log.Add(entry);
            logger.LogWarning("API {Status} {Method} {Route}; {Reason}; trace {TraceId}",
                entry.Status, entry.Method, entry.Route, entry.Reason, entry.TraceId);
        }
    }
}
