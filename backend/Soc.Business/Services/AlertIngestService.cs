using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Soc.Data.Context;
using Soc.Data.Entities;
using static Soc.Business.Services.SocService;
namespace Soc.Business.Services;

public sealed class AlertIngestService(SocDbContext db, TenantDbFactory factory, SocService platform)
{
    public async Task<(int Status, object Data)> Ingest(string? apiKey, byte[] body)
    {
        Require(!string.IsNullOrWhiteSpace(apiKey), "Ongeldige API-sleutel.", 401);
        var hash = Hash(apiKey!);
        var source = await db.Sources.SingleOrDefaultAsync(apiSource => apiSource.Hash == hash && apiSource.IsActive);
        Require(source != null, "Ongeldige API-sleutel.", 401);
        var tenant = await platform.Tenant(source!.TenantId);
        Require(tenant.IsActive, "Klant is inactief.");
        JsonDocument document;
        try
        {
            document = JsonDocument.Parse(body);
        }
        catch (JsonException)
        {
            throw new SocException(400, "Ongeldig JSON-bericht.");
        }
        using (document)
        {
            var message = document.RootElement;
            Require(message.ValueKind == JsonValueKind.Object, "JSON-object vereist.", 400);
            var allowedFields = new[] { "externalEventId", "title", "occurredAt", "severity", "payload" };
            var fieldNames = message.EnumerateObject().Select(property => property.Name).ToArray();
            bool knownFields = fieldNames.All(allowedFields.Contains);
            bool uniqueFields = fieldNames.Distinct().Count() == fieldNames.Length;
            Require(knownFields && uniqueFields, "Onbekend of dubbel veld in aanleverbericht.", 400);
            string? Read(string name) => message.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;
            var externalEventId = Required(Read("externalEventId"), 200);
            var title = Required(Read("title"), 120);
            Require(DateTimeOffset.TryParse(Read("occurredAt"), System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out var occurredAt), "Ongeldig gebeurtenistijdstip.", 400);
            Require(message.TryGetProperty("payload", out var payload) && payload.ValueKind == JsonValueKind.Object, "Payload-object vereist.", 400);
            var severity = Priority(Read("severity"));
            var payloadHash = Convert.ToHexString(SHA256.HashData(body));
            await using var tenantDb = factory.Open(tenant);
            var existing = await tenantDb.Alerts.Include(existingAlert => existingAlert.History).SingleOrDefaultAsync(existingAlert => existingAlert.SourceIntegrationId == source.Id && existingAlert.ExternalEventId == externalEventId);
            if (existing != null)
            {
                Require(existing.PayloadHash == payloadHash, "Event-ID bestaat met andere inhoud.", 409);
                return (200, AlertService.AlertDto(existing, tenant.Id));
            }
            var details = SecurityAlertDetails.Read(payload);
            var description = details.Description ?? title;
            if (description.Length > 2000)
                description = description[..2000];
            var request = new CreateAlertRequest
            {
                Title = title,
                Description = description,
                Priority = severity.ToString()
            };
            var alert = AlertService.NewAlert(
                source.ScopeId, request, source.Name, responseMinutes: tenant.ResponseMinutes);
            alert.SourceIntegrationId = source.Id;
            alert.ExternalEventId = externalEventId;
            alert.OccurredAt = occurredAt.ToUniversalTime();
            alert.PayloadHash = payloadHash;
            alert.RawPayload = Encoding.UTF8.GetString(body);
            alert.NormalizedPayload = SecurityAlertDetails.Normalize(alert, details);
            tenantDb.Alerts.Add(alert);
            LogTenant(tenantDb, alert.ScopeId, source.Name, "Alert ontvangen", alert.Number);
            try
            {
                await tenantDb.SaveChangesAsync();
            }
            catch (DbUpdateException ex) when (ex.InnerException is Microsoft.Data.SqlClient.SqlException sql && sql.Number is 2601 or 2627)
            {
                tenantDb.ChangeTracker.Clear();
                var duplicate = await tenantDb.Alerts.Include(existingAlert => existingAlert.History).SingleOrDefaultAsync(existingAlert => existingAlert.SourceIntegrationId == source.Id && existingAlert.ExternalEventId == externalEventId);
                if (duplicate == null)
                    throw;
                Require(duplicate.PayloadHash == payloadHash, "Event-ID bestaat met andere inhoud.", 409);
                return (200, AlertService.AlertDto(duplicate, tenant.Id));
            }
            return (201, AlertService.AlertDto(alert, tenant.Id));
        }
    }
}
