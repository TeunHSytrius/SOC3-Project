using System.Text.Json;
using Soc.Data.Entities;
using Soc.Data.Entities.Enums;

namespace Soc.Business.Services;

// A small, readable mapping for the agreed ingestion contract.
// Unknown vendor fields remain available in RawPayload.
public sealed record SecurityAlertDetails(
    string? Category,
    string? Description,
    string? SourceIp,
    string? DestinationIp,
    string? Hostname,
    string? Username,
    string? DetectionRule,
    bool Simulated,
    string? Evidence=null,
    string? Investigation=null)
{
    public static SecurityAlertDetails Read(JsonElement payload)
    {
        string? Get(string name)
        {
            if (payload.ValueKind != JsonValueKind.Object ||
                !payload.TryGetProperty(name, out var value) ||
                value.ValueKind != JsonValueKind.String)
                return null;
            var text = value.GetString();
            return string.IsNullOrWhiteSpace(text) ? null : text;
        }

        var simulated = payload.ValueKind == JsonValueKind.Object &&
            payload.TryGetProperty("simulated", out var flag) &&
            flag.ValueKind == JsonValueKind.True;

        return new(Get("category"), Get("description"), Get("sourceIp"),
            Get("destinationIp"), Get("hostname"), Get("username"),
            Get("detectionRule"), simulated,Get("evidence"),Get("investigation"));
    }

    public static SecurityAlertDetails FromRaw(string raw)
    {
        try
        {
            using var json = JsonDocument.Parse(raw);
            var root = json.RootElement;
            return Read(root.ValueKind == JsonValueKind.Object &&
                root.TryGetProperty("payload", out var payload) ? payload : root);
        }
        catch (JsonException)
        {
            return new(null, null, null, null, null, null, null, false);
        }
    }

    // Partial OCSF 1.8 Detection Finding mapping, not a complete validated OCSF event.
    public static string Normalize(Alert alert, SecurityAlertDetails details)
    {
        var severity = alert.Priority switch
        {
            PriorityLevel.Low => 2,
            PriorityLevel.Moderate => 3,
            PriorityLevel.High or PriorityLevel.Urgent => 4,
            PriorityLevel.Immediate => 5,
            _ => 0
        };

        return JsonSerializer.Serialize(new
        {
            category_uid = 2,
            class_uid = 2004,
            activity_id = 1,
            type_uid = 200401,
            severity_id = severity,
            time = (alert.OccurredAt ?? alert.CreatedAt).ToUnixTimeMilliseconds(),
            metadata = new { version = "1.8.0", product = new { name = alert.Source } },
            finding_info = new
            {
                uid = alert.ExternalEventId,
                title = alert.Title,
                desc = details.Description
            }
        });
    }
}
