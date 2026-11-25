# Feedbackpresentatie — SOC3, 26 november 2026

Doel: de opdracht, werkende onderdelen, gemaakte keuzes, huidige voortgang en samenwerking aantoonbaar maken. De aankondiging vraagt 15–20 minuten inclusief vragen en feedback; onderstaande planning is een voorstel, geen vastgestelde taakverdeling. Reserveer 5 minuten voor vragen.

| Onderdeel | Tijd | Te tonen / vertellen |
|---|---:|---|
| 1. Opdracht | 1 min | MSSP/SOC krijgt alerts uit externe securitytools; centraliseer beoordeling, onderzoek en klantcommunicatie. Geen eigen monitoring of containment. |
| 2. Heel korte demo | 3 min | Login, dashboard, één alert oppakken en triageren, case aanmaken, notitie toevoegen. Alleen demonstreren na geslaagde runtimecontrole. |
| 3. Scrumproces | 2 min | Taiga voor stories/taken, GitHub featurebranches, PR en review naar develop. Laat het echte actuele bord zien en bespreek hoe afspraken in de praktijk verlopen. |
| 4. Deze sprint | 2 min | Open Sprint Backlog; ieder lid noemt eigen actuele taak, doel, afhankelijkheid en eerstvolgende test. Geen namen/tickets verzinnen. |
| 5. Samenwerking | 2 min | Leg uit welke branch van welk teamlid komt, hoe review plaatsvindt en waar integratie nog botst. Benoem concrete verbetering: API-contract en gedeelde data-/auth-laag vóór schermintegratie. |
| 6. Requirements, wireframes, applicatie | 3 min | Laat originele wireframes uit FO naast de betreffende schermen zien. Gebruik de traceability-tabel hieronder en toon concrete API/controller. |
| 7. Realisatie / artifacts | 2 min | Product Backlog (Taiga), Sprint Backlog (sprint), Increment (alleen geteste en DoD-conforme geïntegreerde code). Lokale integratie is apart en niet automatisch Increment. |
| 8. Vragen en feedback | 5 min | Vraag gericht feedback over klantschema's, rollen, SLA en prioriteit voor volgende sprint. |
| **Totaal** | **20 min** | Bij uitloop de technische uitleg inkorten, niet de vragen schrappen. |

## Demo-route (3 minuten)

- 0:00–0:30: log in als analist, toon de KPI's, FIFO en SLA op het dashboard.
- 0:30–1:20: open een nieuwe alert; claim, kies True positive, noteer een reden.
- 1:20–2:15: maak een case aan en voeg een interne notitie of observable toe.
- 2:15–3:00: laat de gekoppelde alert en tijdlijn zien. Vertel dat de gegevens via controllers en EF Core in het klantschema worden opgeslagen; toon OpenAPI of een query alleen als die van tevoren is getest.

Optionele extra demo na vragen: beheerder/API-sleutel, aanlevering via POST /ingest/alerts en klantportal. Geen 2FA-setup of Docker-build tijdens de drie minuten. Bewaar een lokaal schermbeeld of schermopname van een daadwerkelijk geslaagde demo als noodplan.

## Traceability (FO → ontwerp → code)

| FO | Beoogd wireframe/scherm | API / code |
|---|---|---|
| FR-01/02 | Ingest via externe tool, zichtbaar in alertwachtrij | `IngestController`, `SocService.Ingest`, tenant `Alerts` |
| FR-03/04/05/06/12/14/15 | Alertoverzicht, alertdetail, triage | `AlertsController`, `AlertAction`, `Alert`, `AlertEvent` |
| FR-07/08/13 | Caseoverzicht en -detail | `POST /alerts/{id}/promote`, `POST /cases/{id}/alerts`, `PATCH /cases/{id}` |
| FR-09/10/11 | Onderzoekstijdlijn, notitie, observable, actie | `POST /cases/{id}/events`, `POST /cases/{id}/observables`, `CaseEvent`, `Observable` |
| FR-16/17/18/20 | Klantenbeheer, gebruikers, klantportal | `OrganizationsController`, `UsersController`, `PortalController`, platform `RoleAssignment` |
| FR-19 | Auditoverzicht | `PlatformAudit`, `TenantAudit`, `GET /api/v1/audit` |
| NFR-01 | Klantcontext / afgeschermde data | `TenantDbFactory`, `SchemaModelCacheKeyFactory`, server-side `Workspaces` |
| NFR-07 | SLA-waarschuwing, KPI | `Deadline`, `FirstHandledAt`, SLA-weergave; demotijden nog niet bevestigd |

De tabel koppelt de benoemde functionele eisen aan de lokale implementatie. De originele wireframes zijn niet in deze ZIP opgenomen of pixel voor pixel gecontroleerd. Open het eigen FO en controleer de visuele aansluiting. Niet alle eisen zijn voltooid of geverifieerd.

## Voor de presentatie

1. Start `docker compose up --build` op de presentatiemachine.
2. In tweede terminal `bash scripts/check-demo.sh`. Bewaar werkelijke testuitvoer.
3. Oefen de demo met een vrije alert (de smoketest maakt eigen records).
4. Open Taiga en actualiseer de echte sprintstatus; leg open PR #7 uit als werk in uitvoering indien nog open.
5. Maak duidelijk onderscheid tussen de bestaande branchcode, lokale integratie en nog niet geteste features. Alleen bewezen werk als gerealiseerd presenteren. Verzin geen afgeronde taken of individuele bijdragen.
