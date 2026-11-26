using System.Text.Json;
using Soc.Data.Entities;

namespace Soc.Business.Services;

// Fictional data for the eight original seed alerts, never for ingested customer events.
internal static class DemoAlertContext
{
    private sealed record Sample(string Category, string SourceIp, string? DestinationIp, string Host, string? User, string Rule, string Description, string Evidence, string Investigation);

    private static readonly Dictionary<string, Sample> Samples = new()
    {
        ["ALT-1001"] = new("Authenticatie", "192.0.2.31", null, "DEMO-DC01", "svc.backup", "AUTH-001",
            "47 mislukte aanmeldingen voor svc.backup in 5 minuten, gevolgd door één succesvolle aanmelding. Het normale patroon is maximaal 2 mislukte pogingen.",
            "47 x Windows event 4625; 1 x event 4624. Bron: gesimuleerde authenticatielog.",
            "Controleer of de succesvolle sessie legitiem is en vergelijk bron-IP en tijdstip met eerdere aanmeldingen."),
        ["ALT-1002"] = new("Malware", "192.0.2.52", null, "DEMO-WS014", "demo.employee", "EDR-002",
            "Endpointdetectie op een nieuw uitvoerbaar bestand in de downloadmap. Het bestand is in quarantaine geplaatst; uitvoering is niet bevestigd.",
            "Bestand: invoice-demo.exe; actie: quarantine; execution: unknown.",
            "Controleer de bestandshash in de EDR, proceshistorie en eventuele andere betrokken werkstations."),
        ["ALT-1003"] = new("Netwerk", "192.0.2.45", "198.51.100.87", "DEMO-FIN-APP02", "svc.reporting", "NET-003",
            "Een applicatieserver heeft in 12 minuten 2,4 GB uitgaand HTTPS-verkeer verstuurd naar een bestemming die de afgelopen 30 dagen niet is waargenomen. Normaal is dit ongeveer 80 MB per vergelijkbaar tijdvenster. Mogelijke ongeautoriseerde dataoverdracht; geen bevestigd incident.",
            "Netflow: 192.0.2.45 → 198.51.100.87:443; protocol TCP; 2.400.000.000 bytes uitgaand; 12 minuten; gebruikelijke hoeveelheid 80.000.000 bytes.",
            "Vergelijk de verbinding met geplande back-ups en exports. Vraag proxy- en endpointlogs op. Controleer welk proces de verbinding opende en of de bestemming is toegestaan."),
        ["ALT-1004"] = new("Phishing", "192.0.2.73", null, "DEMO-MAIL01", "demo.employee", "MAIL-004",
            "Een medewerker meldt een e-mail met een afwijkend afzenderdomein en een link naar een fictieve inlogpagina.",
            "Afzender: billing@example.org; link: https://login.example.net/demo; SPF: fail.",
            "Controleer de mailheaders, zoek naar andere ontvangers en bepaal of iemand op de link heeft geklikt."),
        ["ALT-1005"] = new("Authenticatie", "198.51.100.24", "192.0.2.19", "DEMO-VPN01", "demo.vpnuser", "VPN-005",
            "Succesvolle VPN-aanmelding vanaf een niet eerder waargenomen bron-IP kort na een andere aanmelding.",
            "VPN login success; nieuwe bron; MFA-resultaat: success.",
            "Verifieer de aanmelding met de klant en vergelijk sessies en apparaatinformatie."),
        ["ALT-1006"] = new("Netwerk", "192.0.2.60", "198.51.100.60", "DEMO-SCAN01", null, "NET-006",
            "Netwerkmonitoring registreert 65 verbindingspogingen naar verschillende poorten in één minuut.",
            "65 verbindingen; bron: DEMO-SCAN01; meeste verbindingen geweigerd.",
            "Controleer of de bron een geautoriseerde kwetsbaarheidsscanner is."),
        ["ALT-1007"] = new("Endpoint", "192.0.2.74", null, "DEMO-WS021", "demo.user", "EDR-007",
            "Endpointdetectie meldt een ongebruikelijk PowerShell-proces gestart vanuit een kantoorapplicatie.",
            "Parent: office-demo.exe; child: powershell.exe; resultaat: detectie; uitvoering niet bevestigd.",
            "Controleer de procesboom, herkomst van het document en endpointlogs."),
        ["ALT-1008"] = new("Netwerk", "192.0.2.81", "198.51.100.81", "DEMO-FW01", null, "FW-008",
            "Firewall blokkeert een verbinding naar een bestemming buiten het toegestane netwerkprofiel.",
            "Firewall action: deny; protocol TCP; destination port: 443.",
            "Controleer de firewallregel en of het verkeer overeenkomt met verwachte applicatieactiviteit.")
    };

    public static bool Enrich(Alert alert)
    {
        if (alert.SourceIntegrationId.HasValue || alert.PayloadHash != null ||
           alert.ExternalEventId != null || !Samples.TryGetValue(alert.Number, out var sample))
            return false;

        // Only original seed records have these simple ALT-1001..1008 numbers.
        // Preserve ownership, workflow, original receipt, deadlines and history.
        alert.OccurredAt = alert.CreatedAt.AddSeconds(-30);
        alert.ExternalEventId = "demo-" + alert.Number.ToLowerInvariant();
        alert.Description = sample.Description;
        alert.RawPayload = JsonSerializer.Serialize(new
        {
            externalEventId = alert.ExternalEventId,
            title = alert.Title,
            occurredAt = alert.OccurredAt,
            severity = alert.Priority.ToString(),
            payload = new
            {
                simulated = true,
                category = sample.Category,
                description = sample.Description,
                sourceIp = sample.SourceIp,
                destinationIp = sample.DestinationIp,
                hostname = sample.Host,
                username = sample.User,
                detectionRule = sample.Rule,
                evidence = sample.Evidence,
                investigation = sample.Investigation
            }
        });
        alert.NormalizedPayload = SecurityAlertDetails.Normalize(alert, SecurityAlertDetails.FromRaw(alert.RawPayload));
        return true;
    }
}
