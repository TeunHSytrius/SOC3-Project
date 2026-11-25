# SOC3 Management

SOC3 Management is een webapplicatie voor een Security Operations Center (SOC) van een Managed Security Service Provider (MSSP). Het systeem ontvangt beveiligingsmeldingen, ondersteunt triage en onderzoek, schermt klantinformatie af en registreert relevante acties.

Dit is de demonstratie-MVP van het SE3-project: React, ASP.NET Core en een echte SQL Server-database. De oorspronkelijke groepsrepository blijft ongewijzigd. Deze versie is geen letterlijke merge van de oorspronkelijke branches.

## Inhoud

- [1. Installatie](#1-installatie)
- [2. Gebruikers en rollen](#2-gebruikers-en-rollen)
- [3. Functionele werking](#3-functionele-werking)
- [4. API-aanlevering](#4-api-aanlevering)
- [5. Technische architectuur](#5-technische-architectuur)
- [6. Database](#6-database)
- [7. API-contracten](#7-api-contracten)
- [8. Beveiliging](#8-beveiliging)
- [9. Ontwikkelen en testen](#9-ontwikkelen-en-testen)
- [10. Opdrachtgever en eisenmatrix](#10-opdrachtgever-en-eisenmatrix)
- [11. Demonstratie en vervolg](#11-demonstratie-en-vervolg)

## 1. Installatie

Vereisten: Git, toegang tot de private repository, Docker Desktop met Compose en internet voor dependencies. Node.js 22.12+ (24 aanbevolen) is nodig voor lokaal frontendwerk en de smoketest.

Open Docker Desktop en voer uit:

```bash
git clone https://github.com/TeunHSytrius/SOC3-Project.git
cd SOC3-Project
docker compose up --build -d
```

Open [http://localhost:8081](http://localhost:8081).

Bij een bestaande lokale kopie:

```bash
git pull --ff-only origin main
docker compose up --build -d
```

SQL Server moet eerst gereed zijn. De backend probeert opnieuw te verbinden en initialiseert bij een lege demodatabase het platform, de klantschema's en fictieve gegevens. De eerste start kan daardoor tijdelijk onbereikbaar zijn.

```bash
docker compose ps
curl http://localhost:8081/api/v1/health
```

Verwachte healthcheck: `{"status":"ok"}`.

| Onderdeel | Configuratie |
| --- | --- |
| Website en API op host | 127.0.0.1:8081 |
| ASP.NET Core in container | 8080 |
| SQL Server binnen Docker | 1433 |
| SQL Server vanaf DataGrip | 127.0.0.1:14333 |
| SQL-data | volume socsql |
| Data Protection-sleutels | volume sockeys |

SQL Server is uitsluitend via localhost gepubliceerd voor lokaal ontwikkelwerk. De app maakt de database Soc3Demo, het platform-schema en de klantschema's automatisch aan bij het opstarten. DataGrip is een SQL-client; het draait geen eigen database.

### DataGrip (Microsoft SQL Server)

Maak een nieuwe data source van het type Microsoft SQL Server en gebruik:

| Instelling | Waarde |
| --- | --- |
| Host | 127.0.0.1 |
| Port | 14333 |
| Authentication | User & Password |
| User | sa |
| Password | SocDemo!2026Local (of de ingestelde SOC_SQL_PASSWORD) |
| Database | Soc3Demo |
| Encrypt | true |
| Trust server certificate | true (alleen lokale demo) |

Download indien nodig de JDBC-driver en klik op Test Connection. Selecteer in het schema-overzicht platform en de tenant_...-schema's. Gebruik de console om de klantregistraties te koppelen aan de klantschema's:

```sql
SELECT Id, Name, SchemaName, IsActive, ResponseMinutes
FROM platform.Tenants;
```

De bestaande Docker-volume socsql bewaart de database. Het is niet nodig om de database handmatig aan te maken of te verwijderen. Het sa-account en het standaardwachtwoord zijn uitsluitend bedoeld voor deze lokale ontwikkelomgeving.

Stoppen en logs bekijken:

```bash
docker compose down
docker compose logs --tail=100 app sqlserver
```

Bekijk de logs vóór het verwijderen van de containers als er een opstartfout optreedt. Normaal stoppen bewaart de volumes. Alleen in een wegwerp-demoomgeving kan `docker compose down -v` worden gebruikt om alle demodata en sleutels te wissen. Dit is destructief en mag niet op echte data worden toegepast.

Op Apple Silicon draait het SQL Server-image via amd64-emulatie. Bij problemen: controleer Docker Desktop of gebruik een afzonderlijke x64 SQL Server-testomgeving. Er is geen SQLite-fallback.

## 2. Gebruikers en rollen

Initiële demoaccounts; wachtwoord voor alle accounts: `Demo2026!`.

### Projectgroep 3

De onderstaande rollen zijn gekozen voor het demonstreren van de applicatie, niet als officiële taakverdeling van de groep. De inlogadressen zijn fictief en alleen bedoeld voor lokaal gebruik.

| Naam | Inlogadres | Demo-rol |
| --- | --- | --- |
| Teun Hanssen | teun@soc.demo | Beheerder |
| Dominique Roosen | dominique@soc.demo | Senior analist |
| Sergio Mendez | sergio@soc.demo | Analist |
| Hamza Ben Ali | hamza@soc.demo | Analist |
| Ruben Abrahamse | ruben@soc.demo | Accountmanager |
| Thijs Dronkers | thijs@soc.demo | Klant |

De zes accounts worden eenmalig toegevoegd, ook aan een bestaande geïnitialiseerde demodatabase. Bestaande accounts en hun wijzigingen blijven behouden bij herstart. Analisten krijgen toegang tot de bestaande demoklanten, de klant tot één (bij voorkeur Northstar Finance), de accountmanager tot twee (bij voorkeur Northstar Finance en Delta Logistics). De beheerder krijgt platformbeheer, geen automatische onderzoekstoegang.

### Algemene testaccounts

De volgende accounts blijven beschikbaar voor de smoketest en generieke presentaties.

| Account | Rol | Initiële toegang |
| --- | --- | --- |
| analist@soc.demo | Analist | Alle drie demoklanten |
| senior@soc.demo | Senior analist | Alle drie demoklanten; heropenen van alerts |
| beheerder@soc.demo | Beheerder | Platformbeheer en audit |
| klant@soc.demo | Klant | Vrijgegeven cases van Northstar Finance |
| accountmanager@soc.demo | Accountmanager | Vrijgegeven cases van Northstar Finance en Delta Logistics |

| Functionaliteit | Analist | Senior | Beheerder | Klant | Accountmanager |
| --- | --- | --- | --- | --- | --- |
| SOC-dashboard en alerts | Ja | Ja | Nee | Nee | Nee |
| Alert oppakken, triage en escalatie | Ja | Ja | Nee | Nee | Nee |
| Afgewezen/opgeloste alert zonder case heropenen | Nee | Ja | Nee | Nee | Nee |
| Onderzoeken beheren | Ja | Ja | Nee | Nee | Nee |
| Vrijgegeven onderzoeken bekijken | Ja | Ja | Nee | Ja | Ja |
| Klantreactie toevoegen | Via onderzoek | Via onderzoek | Nee | Ja | Nee |
| Klanten, accounts en API-sleutels beheren | Nee | Nee | Ja | Nee | Nee |
| Auditlog bekijken | Nee | Nee | Ja | Nee | Nee |
| Eigen 2FA instellen | Ja | Ja | Ja | Ja | Ja |

Klant- en scopetoewijzingen begrenzen operationele toegang. Beheerders krijgen niet automatisch toegang tot onderzoeksinhoud. De voorgestelde procesrollen van de opdrachtgever zijn nog niet volledig geïmplementeerd; zie hoofdstuk 10.

### Gebruikersbeheer

Log in als beheerder en open **Gebruikers & rollen**. Maak een gebruiker aan of gebruik **Bewerken** bij een ander account. Naam, e-mailadres, rol, klanttoegang, actieve status en optioneel een nieuw wachtwoord kunnen worden gewijzigd.

Een leeg wachtwoordveld behoudt het huidige wachtwoord. Bij een reset gelden de Identity-regels: minimaal acht tekens, hoofdletter, kleine letter, cijfer en speciaal teken. Het e-mailadres is ook de gebruikersnaam. Dubbele e-mailadressen worden geweigerd. Een klantaccount moet precies één organisatie hebben. Een account heeft momenteel één applicatierol, maar kan aan meerdere klanten worden gekoppeld als die rol dit toestaat.

Deactivering blokkeert inloggen en API-toegang; historische gegevens blijven behouden. Heractivering is mogelijk. Het eigen beheerdersaccount kan via dit beheerformulier niet worden gewijzigd. De ingestelde 2FA blijft bij accountbewerking behouden. Er is geen hard-delete van accounts.

### Klantenbeheer

Een beheerder kan klanten aanmaken, hun naam wijzigen, deactiveren en heractiveren. Een nieuwe klant krijgt een eigen SQL-schema met standaard scope Algemeen. Hernoemen verandert de tenant-GUID en schemanaam niet. Deactivering blokkeert ingest en operationele toegang; historie blijft opgeslagen.

## 3. Functionele werking

### Dashboard

Het dashboard toont open alerts, actieve cases, SLA-risico's, overschrijdingen, prioriteitsverdeling, SLA-prestaties, FIFO-wachtrij en actieve onderzoeken. De klantfilter beperkt de getoonde resultaten. De actieve analistenoverzichten vernieuwen automatisch elke 15 seconden. Details, formulieren en verborgen tabbladen worden niet automatisch vernieuwd. Het dashboard toont ook dreigingscategorieën, betrokken systemen en recent ontvangen meldingen; dit is polling, geen realtime push.

### Alerts

- Handmatig toevoegen of ontvangen via de ingest-API.
- Zoeken op titel, nummer, bron, eigenaar, klant, IP-adres, hostname en overige aangeleverde securityvelden; filteren op klant, status, prioriteit, categorie en datum.
- Details bekijken: bron, omschrijving, ontvangst, deadline, eigenaar, triage en geschiedenis.
- Oppakken, triage vastleggen met motivatie, afwijzen of escaleren.
- Senior analist: afgewezen of opgeloste alert zonder case heropenen.

### Cases en klantportaal

- Case aanmaken vanuit een alert met nader onderzoek of bevestigd incident of koppelen aan een bestaande open case in dezelfde klant en scope.
- Status wijzigen volgens de workflow (inclusief Wacht op klant), eigenaar overdragen met toelichting en volgende actie, notities, acties, observables en bewijsreferenties toevoegen.
- Case vrijgeven aan de klant; geschikte tijdlijnitems klantzichtbaar maken.
- Klant kan reageren op een open vrijgegeven case; accountmanager kan deze lezen.
- Afsluiten vereist een samenvatting en conclusie en lost gekoppelde alerts op.

Bewijsreferenties zijn tekstueel; bestandsuploads ontbreken. Observables en bewijsreferenties zijn intern; notities en acties kunnen expliciet zichtbaar gemaakt worden. De server filtert externe case-responses.

```mermaid
flowchart TD
    A[Alert ontvangen] --> B[Oppakken en triage]
    B -->|False positive / verwacht gedrag| C[Afgewezen]
    B -->|Nader onderzoek| D[In beoordeling]
    D --> B
    B -->|Bevestigd incident| E[Case maken of koppelen]
    E --> F[Onderzoek en acties]
    F --> G[Afsluiten met conclusie]
    G --> H[Gekoppelde alerts opgelost]
```

Alertstatussen: New, PendingReview, UnderReview, Escalated, Dismissed en Resolved. Casestatussen: Open, UnderInvestigation, UnderReview, Resolved en Closed.

### SLA

Nieuwe alerts krijgen standaard 60 minuten tot eerste behandeling (TO §9.1). Bij maximaal 15 minuten resterend verschijnt een waarschuwing. Alleen oppakken vult FirstHandledAt eenmalig. Bestaande deadlines worden niet herschreven. Een beheerder kan de reactietermijn per klant instellen (1–10080 minuten). Bestaande deadlines blijven onveranderd. Case-SLA ontbreekt nog.

### Account, API-sleutels en audit

Mijn account toont profielgegevens en biedt TOTP-setup via QR-code, handmatige sleutel en acht herstelcodes. Een beheerder genereert en trekt API-sleutels in per bron en klant/scope. De volledige sleutel is alleen bij creatie zichtbaar. De auditlog combineert platform- en klantactiviteiten.

De seeddata bevat drie fictieve klanten (Northstar Finance, Delta Logistics, Atlas Health), acht alerts en één lopende case. De gegevens blijven bij een normale herstart behouden.

## 4. API-aanlevering

Er is een echte ingest-API, maar geen live koppeling met Sentinel, Defender of Splunk. Een optionele simulator stuurt fictieve beveiligingsmeldingen via diezelfde API. De namen van deze bronnen in de demodata zijn fictieve labels.

Maak als beheerder onder API-sleutels een sleutel voor Northstar Finance. Stuur daarna een fictieve melding via de terminal:

```bash
read -rs 'SOC_KEY?API-sleutel: ' # zsh op macOS
curl -X POST http://localhost:8081/api/v1/ingest/alerts \
  -H "X-API-Key: $SOC_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"externalEventId":"demo-001","title":"Testmelding","occurredAt":"2026-11-25T12:00:00Z","severity":"High","payload":{"description":"Fictieve melding voor de demo"}}'
unset SOC_KEY
```

Verwacht HTTP 201 bij een nieuw event-ID. Identieke herhaling geeft 200 met hetzelfde alert-ID; gewijzigde bytes onder hetzelfde event-ID geven 409. Gebruik een nieuw event-ID voor elke nieuwe melding. Klant-, scope- en andere niet-contractvelden worden geweigerd. Het oorspronkelijke JSON-bericht en de SHA-256-hash worden opgeslagen. De maximale berichtgrootte is 1 MiB. Vernieuw daarna het dashboard als analist. De API-key bepaalt server-side klant en scope; waarden uit de requestbody mogen dit niet overschrijven. Ongeldige of ingetrokken sleutels geven HTTP 401.

### Alertsimulator

Maak als beheerder een API-sleutel met bronnaam Demo securitytool voor een actieve klant. Kopieer de sleutel eenmalig. Start vervolgens vanuit de hoofdmap:

```bash
read -rs 'SOC_SIM_KEY?API-sleutel: '
export SOC_SIM_KEY
node scripts/simulate-alerts.mjs
```

Of voer na dezelfde export uit:

```bash
docker compose --profile simulator run --rm -e SOC_SIM_KEY simulator
```

De simulator stuurt iedere 30 seconden een fictieve alert naar de echte ingest-API. Stop met Ctrl+C en voer `unset SOC_SIM_KEY` uit. De simulator maakt geen netwerkverbindingen met de IP-adressen uit de voorbeelden en voert geen echte detectie uit. De API-sleutel bepaalt klant en scope. Start hem alleen voor de demo; hij is standaard uitgeschakeld. De voorbeeld-IP's zijn documentatieadressen.

## 5. Technische architectuur

| Laag | Technologie |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 7, CSS |
| API | ASP.NET Core 10, C#, REST |
| Business | C#-services, DTO's en bedrijfsregels |
| Data | Entity Framework Core 10, SQL Server 2022 |
| Authenticatie | ASP.NET Core Identity, cookies, TOTP |
| API-documentatie | OpenAPI |
| Uitvoering | Docker, Docker Compose |
| Integratietests | Node.js, fetch en assert |

```mermaid
flowchart LR
    Browser[React browser] -->|HTTP JSON| API[Soc.Api]
    Tool[Securitybron] -->|API-key JSON| API
    API --> Business[Soc.Business]
    Business --> Data[Soc.Data / EF Core]
    Data --> SQL[(SQL Server)]
```

De controllers handelen HTTP-verzoeken af. SocService voert bedrijfsregels en domeinautorisatie uit. Soc.Data beheert entiteiten, databasecontexten en schema's. De frontend gebruikt same-origin JSON-verzoeken en haalt voor schrijfacties een CSRF-token op.

```text
SOC3.slnx
backend/
  Soc.Api/
    Controllers/      REST-routes
    Security/         Beschermde Identity-opslag
    Program.cs        DI, middleware en initialisatie
  Soc.Business/
    DTOs/             Invoer- en antwoordcontracten
    Services/         Bedrijfsregels en autorisatie
  Soc.Data/
    Context/          DbContext en tenantfactory
    Entities/         Datamodel en enums
frontend/
  src/
    components/       AppShell, AppMenu, PageHeader en UI
    features/         Login en aanvullende CSS
    services/         API-client
    types/            Domeintypen en SLA-berekening
    App.tsx           Schermen, navigatie en applicatiestate
compose.yaml          Containerconfiguratie
Dockerfile            Multi-stage build
scripts/              Controle- en branchscripts
tests/smoke.mjs       API-integratietest
README.md             Functionele en technische handleiding
```

De multi-stage Dockerfile bouwt de React-app en ASP.NET Core-applicatie; de statische frontend wordt gepubliceerd in wwwroot. Styling is gebaseerd op develop (zonder paarse focusaccenten) en de horizontale navigatiebranch, met aanvullende CSS voor nieuwe schermen.

## 6. Database

Eén SQL Server-database, Soc3Demo, bevat een platform-schema en per klant een afzonderlijk schema. De klantschemanaam wordt server-side gegenereerd als tenant_ gevolgd door de klant-GUID zonder streepjes.

### Platform

| Entiteit | Doel |
| --- | --- |
| Tenant | Klantnaam, status en schemanaam |
| Scope | Werkruimte binnen een klant |
| AppUser / Identity-tabellen | Accounts, wachtwoordhashes, tokens |
| RoleAssignment | Gebruiker-, tenant- en scopetoewijzing |
| ApiSource | Bron, sleutelhash, prefix, tenant en scope |
| PlatformAudit | Centrale auditregels |

```mermaid
erDiagram
    Tenant ||--o{ Scope : bevat
    AppUser ||--o{ RoleAssignment : heeft
    Scope ||--o{ RoleAssignment : begrenst
    Scope ||--o{ ApiSource : ontvangt
```

### Per klantschema

| Entiteit | Doel |
| --- | --- |
| Alert | Beveiligingsmelding, prioriteit, status, deadline, eigenaar |
| AlertEvent | Status- en actiegeschiedenis |
| ResearchCase | Onderzoek, eigenaar, conclusie, klantzichtbaarheid |
| CaseEvent | Notities, acties, bewijsreferenties, klantreacties |
| Observable | Interne onderzoeksindicator |
| TenantAudit | Auditregels binnen klantcontext |

```mermaid
erDiagram
    ResearchCase o|--o{ Alert : groepeert
    Alert ||--o{ AlertEvent : heeft
    ResearchCase ||--o{ CaseEvent : bevat
    ResearchCase ||--o{ Observable : bevat
```

De diagrammen tonen de expliciet gemodelleerde kernrelaties, niet alle Identity-tabellen of logische GUID-verwijzingen. TenantAudit is zelfstandig. ScopeId begrenst operationele gegevens; eigenaar-ID's verwijzen logisch naar platformgebruikers.

SocDbContext beheert platformgegevens. TenantDbContext beheert operationele tabellen in het geselecteerde schema. TenantDbFactory selecteert het schema; SchemaModelCacheKeyFactory neemt de schemanaam op in de EF-modelcache. De demo gebruikt EnsureCreated en CreateTablesAsync voor provisioning, niet een formeel migratieproces. Alle schema's delen een databaseverbinding; isolatie is dus afhankelijk van de correcte server-side selectie en autorisatie.

## 7. API-contracten

Basis-URL: `http://localhost:8081/api/v1`. OpenAPI: [openapi/v1.json](http://localhost:8081/openapi/v1.json).

| Methode | Endpoint | Functie |
| --- | --- | --- |
| GET | /health | Healthcheck |
| GET | /auth/csrf | CSRF-token |
| POST | /auth/login | Inloggen |
| POST | /auth/2fa | Tweede factor afronden |
| GET | /auth/me | Eigen profiel |
| POST | /auth/logout | Uitloggen |
| POST | /auth/2fa/setup | Authenticator instellen |
| POST | /auth/2fa/enable | 2FA activeren |
| GET | /me/access | Klant- en scopetoegang |
| POST | /ingest/alerts | API-key ingest |
| GET, POST | /alerts | Lijst of handmatig aanmaken |
| GET | /alerts/{id} | Details |
| POST | /alerts/{id}/claim | Oppakken |
| POST | /alerts/{id}/triage | Triage |
| POST | /alerts/{id}/promote | Case maken/koppelen |
| POST | /alerts/{id}/reopen | Heropenen |
| GET | /cases | Onderzoeken |
| GET, PATCH | /cases/{id} | Details/status/eigenaar/zichtbaarheid |
| POST | /cases/{id}/events | Tijdlijnitem |
| POST | /cases/{id}/observables | Observable |
| POST | /cases/{id}/alerts | Alert koppelen |
| GET | /portal/cases | Vrijgegeven cases |
| GET | /portal/cases/{id} | Vrijgegeven details |
| GET, POST | /organizations | Klantenlijst/aanmaken |
| GET, PATCH | /organizations/{id} | Details/naam wijzigen |
| POST | /organizations/{id}/activate | Activeren |
| POST | /organizations/{id}/deactivate | Deactiveren |
| GET, POST | /users | Accounts bekijken/aanmaken |
| PATCH | /users/{id} | Account bewerken |
| POST | /users/{id}/access | Bestaand rol- en toegangcontract |
| GET, POST | /keys | Sleutels bekijken/aanmaken |
| POST | /keys/{id}/revoke | Sleutel intrekken |
| GET | /audit | Auditlog |
| GET | /analysts | Analisten voor overdracht |

PATCH /users/{id} verwacht name, email, role, organizationIds en isActive. password is optioneel. PATCH /organizations/{id} verwacht name. De klant-GUID blijft behouden.

X-Workspace-Id en X-Scope-Id beperken de context voor operationele endpoints. Deze headers verlenen geen rechten. De server controleert de toewijzingen. Schrijfacties gebruiken CSRF, behalve de API-key-ingest.

HTTP-statuscodes: 200 geslaagd, 201 aangemaakt, 400 ongeldige invoer/CSRF, 401 niet geauthenticeerd, 403 geen toegang, 404 niet gevonden, 409 conflict, 429 rate limit, 500 serverfout.

## 8. Beveiliging

- Identity verzorgt wachtwoordhashing, aanmeldcontrole en lockout na vijf mislukte wachtwoordpogingen.
- Cookies zijn HttpOnly en SameSite=Lax; buiten demo is Secure vereist.
- De website vraagt bij een nieuwe navigatie opnieuw om inloggen en beëindigt de vorige cookie-sessie. Bij een gewone refresh in een eerder ingelogd tabblad wordt de sessie hersteld zolang de server deze accepteert. De browser bewaart alleen de gebruikers-ID in sessionStorage; de authenticatiecookie blijft HttpOnly. Cookies worden gedeeld tussen tabbladen: een nieuw tabblad kan dus ook de sessie van het oude tabblad beëindigen. Een accountwisseling in een ander tabblad leidt tot HTTP 401 bij verzoeken vanuit het oude tabblad met een afwijkende X-SOC-User-header. Deze header is een aanvullende controle, geen authenticatiemiddel.
- POST/PATCH onder /api/v1 vereisen een CSRF-token, behalve ingest. Een aanwezige Origin-header wordt gecontroleerd.
- TOTP met authenticator, QR-code en herstelcodes; het authenticatorgeheim wordt via Data Protection beschermd.
- Analisten, senior analisten en beheerders moeten 2FA instellen, behalve lokale @soc.demo-accounts in demomodus.
- API-sleutels zijn willekeurig gegenereerd, worden als SHA-256-hash opgeslagen en kunnen worden ingetrokken.
- Rate limiting voor login en ingest.
- Server-side rol-, klant-, scope- en zichtbaarheidstoetsing.
- Accountbewerking is transactioneel, alleen voor beheerders en past de security stamp aan. Reguliere stampvalidatie beoordeelt bestaande sessies opnieuw; inactieve accounts worden bij API-aanroepen geweigerd.
- Auditregels registreren geselecteerde lees- en schrijfactiviteiten, inclusief accountwijzigingen en wachtwoordreset (zonder wachtwoord).

De demo draait lokaal via HTTP; de verbinding met SQL Server vraagt encryptie aan maar vertrouwt het servercertificaat. TLS 1.2+ voor browserverkeer is niet aangetoond. Data Protection-sleutels worden lokaal persistent maar niet apart versleuteld opgeslagen. Volledige encryptie-at-rest, volledige auditdekking, retentie, OWASP-toetsing en productiebeveiliging moeten nog worden gerealiseerd of bewezen.

## 9. Ontwikkelen en testen

### Zonder app-container

Vereisten: .NET 10 SDK, Node 22.12+ en een afzonderlijke SQL Server-testdatabase. Gebruik niet de echte projectdatabase.

```bash
cd frontend
npm install
npm run build
cd ..
mkdir -p backend/Soc.Api/wwwroot
cp -R frontend/dist/. backend/Soc.Api/wwwroot/
export ConnectionStrings__Soc='Server=localhost,1433;Database=Soc3Demo;User Id=sa;Password=VUL_TEST_WACHTWOORD_IN;Encrypt=True;TrustServerCertificate=True'
export Demo__Enabled=true
dotnet run --project backend/Soc.Api --urls http://localhost:8080
```

Frontendontwikkeling: `cd frontend && npm run dev` in een tweede terminal. Vite proxyt /api naar poort 8080. Gebruik Docker voor de presentatie.

### Smoketest

```bash
bash scripts/check-demo.sh
```

Voor de variant zonder Docker: `SOC_URL=http://localhost:8080 bash scripts/check-demo.sh`.

De test wacht op de healthcheck en controleert authenticatie, rollen, tenantgrenzen, accountbewerking, wachtwoordreset, deactivering/heractivering, klantnaamwijziging, ingest, CSRF, triage, casepromotie, zichtbaarheid, afsluiten, audit en sleutelintrekking. De test schrijft fictieve records. Gebruik oorspronkelijke demoaccounts met de initiële wachtwoorden en zonder geactiveerde 2FA.

De Docker-build, database-upgrade en volledige smoketest voor commit e470595 zijn door een groepslid op een MacBook succesvol uitgevoerd. Sindsdien zijn sessiegedrag, simulator, securitymapping en workflow gewijzigd; de uitgebreide smoketest en browsercontroles moeten opnieuw worden uitgevoerd. Een aanwezige test is geen bewijs dat deze slaagt.

## 10. Opdrachtgever en eisenmatrix

Bron: aangeleverde terugkoppeling van de opdrachtgever na het gesprek, inclusief de 28 aanvullende eisen. Onderstaande matrix beschrijft broncodefunctionaliteit, niet formele acceptatie of bewezen werking. De nummering is lokaal voor dit overzicht.

### Gewenst proces

De opdrachtgever beschrijft vijf stappen:

| Stap | Gewenste procesrol | Huidige MVP / verschil |
| --- | --- | --- |
| 1. Ontvangst en registratie | Ticket Intake Officer | API-ingest en handmatige invoer; geen aparte intake-rol |
| 2. Analyse en classificatie | Security Analyst | Analist claimt en triageert vóór casevorming |
| 3. Prioritering en toewijzing | Security Coordinator | Senior prioriteert en wijst open case toe; geen aparte coördinatorrol |
| 4. Beoordeling en uitvoering | System Owner | Toegewezen analist legt acties vast; geen afzonderlijke System Owner-rol |
| 5. Validatie en afsluiting | Security Analyst | Eerst opgelost, daarna afsluiten met samenvatting en conclusie; onafhankelijke validatie niet afgedwongen |

De FIFO-wachtrij en zelf oppakken blijven voor alertanalyse behouden; nieuwe cases vereisen senior-toewijzing voordat uitvoering kan starten. Casewijzigingen zijn voor de eigenaar of senior (klantreacties uitgezonderd). Leestoegang blijft scope-gebaseerd. De afzonderlijke opdrachtgeverrollen en exacte taakverdeling moeten nog met FO/TO worden afgestemd. ResearchCase vervult in de MVP de onderzoekstaak.

### Aanvullende eisen

Status: **Aanwezig** = functionaliteit in de broncode; **Deels** = onvolledig; **Open** = ontbreekt of niet bewezen.

| Nr. | Eis | Status | Toelichting |
| --- | --- | --- | --- |
| 01 | Overdracht met toelichting en aandachtspunten | Aanwezig | Verplichte toelichting en volgende actie in tijdlijn |
| 02 | Overdrager, ontvanger en moment vastleggen | Aanwezig | Tijdlijn met vorige en nieuwe eigenaar, ID's, actor en tijd |
| 03 | Eigen toegewezen onderzoeken bekijken | Aanwezig | Filter Mijn onderzoeken op ownerId |
| 04 | Dreigende SLA signaleren | Aanwezig | Dashboard en alertdeadline; geen pushmelding |
| 05 | Overschreden SLA's bij alerts en onderzoeken | Deels | Alert-SLA; geen aparte case-SLA |
| 06 | SLA-instellingen per klant beheren | Aanwezig | Reactietermijn per klant; standaard 60 minuten, alleen nieuwe alerts |
| 07 | Gebruikers koppelen aan klanten en/of rollen | Deels | Meerdere klanten/scopes mogelijk; één rol per account |
| 08 | Verschillende gebruikersrollen | Deels | Vijf huidige rollen; gewenste procesrollen ontbreken deels |
| 09 | Klanten aanmaken, wijzigen, deactiveren | Aanwezig | Inclusief heractiveren en naam wijzigen; nog testen |
| 10 | Gebruikers aanmaken, wijzigen, deactiveren | Aanwezig | Inclusief wachtwoordreset en heractiveren; nog testen |
| 11 | Functionaliteit bepalen via rollen | Aanwezig | Server-side rolcontroles en frontendnavigatie |
| 12 | Zoeken op alerts, onderzoeken en observables | Aanwezig | Zoeken op alerts/cases en observables binnen bevoegde cases; client-side |
| 13 | Filteren op klant, status, prioriteit en datum | Aanwezig | Client-side datumfilters en overige filters |
| 14 | Overzicht openstaande alerts en onderzoeken | Aanwezig | Dashboard en lijsten |
| 15 | Actuele status SLA-afspraken | Deels | Eerste behandeling en demo-deadlines; geen klantcontracten |
| 16 | Export onderzoeksinformatie PDF/CSV | Open | Geen exportfunctie |
| 17 | Authenticatie verplicht | Aanwezig | Identity, cookie en aparte ingest-key |
| 18 | Autorisatie op rollen en rechten | Aanwezig | Rol-, tenant- en scopecontroles; gewenste workflow nog afstemmen |
| 19 | TLS 1.2+ tijdens transport | Open | Lokale browserdemo gebruikt HTTP; productie-TLS niet bewezen |
| 20 | Gevoelige gegevens versleuteld opgeslagen | Deels | Wachtwoordhash, keyhash, beschermd TOTP-geheim; geen volledige encryptie-at-rest |
| 21 | Beveiligingsactiviteiten auditloggen | Deels | Geselecteerde acties en reads; niet alle gebruiker-/systeemacties |
| 22 | Bescherming OWASP Top 10 | Deels | CSRF, Identity, rate limiting, EF; geen volledige toetsing |
| 23 | Reguliere acties binnen 2 seconden | Open | Geen representatieve performancetest |
| 24 | Minimaal 50 gelijktijdige gebruikers | Open | Geen loadtest |
| 25 | Schaalbare architectuur | Deels | Meerlagen en klantschema's; schaalbaarheid niet gemeten |
| 26 | Zoeken op alerts en onderzoeken binnen 3 seconden | Open | Geen representatieve zoekperformancetest |
| 27 | Leesbare code en codeconventies | Deels | Projectlagen aanwezig; grote App.tsx/SocService en ontbrekende lint/CI |
| 28 | Geautomatiseerde unit- en integratietests | Deels | Smoketest aanwezig, volledige unit-testset ontbreekt |

### Overige aandachtspunten uit het gesprek

- Relevantie/classificatie van signalen: het systeem ontvangt alerts; het detecteert zelf geen aanvallen. Detectieregels, categorieën en normalisatie moeten nog worden uitgewerkt.
- Audit: opdrachtgever vraagt alle relevante handelingen van gebruiker en systeem. Definieer auditcatalogus, integriteitsbescherming, toegang, bewaartermijnen en toetsbare criteria.
- Bewaarbeleid: opdrachtgever wil hoge dreigingsklassen/escalaties niet verwijderen. De MVP kent geen alert-delete; formeel retentie- en privacybeleid is nog niet bepaald. Stem onbeperkte bewaring en uitzonderingen af met de opdrachtgever en toepasselijke privacyregels.
- Klantisolatie: scheiding per schema en scope is geïmplementeerd; negatieve autorisatie- en isolatietests zijn nodig.
- Overdracht, gestructureerde onderzoeksinformatie, toewijzing en afsluiting moeten de vijf processtappen aantoonbaar ondersteunen. Leg hiervoor acceptatiecriteria en workflowtransities vast.
- NFR-07: maak SLA's instelbaar per organisatie, definieer verschillende termijnsoorten, leg wijzigingen historisch vast en test waarschuwingen en overschrijdingen.

## 11. Demonstratie en vervolg

1. Log in als analist en toon dashboard, prioriteiten en SLA.
2. Log in als beheerder, maak een tijdelijk account aan, bewerk dit en deactiveer het. Toon klantbeheer en API-sleutels.
3. Stuur een fictieve alert via de ingest-API. Vernieuw het dashboard als analist.
4. Pak de alert op, triageer als bevestigd incident met motivatie en maak een case.
5. Log in als senior analist, prioriteer de case en wijs deze toe aan de gewenste analist. Log als die analist in, voeg interne en klantzichtbare informatie toe en geef de case vrij.
6. Log in als klant en toon de afgeschermde informatie. Zet de case daarna als toegewezen analist eerst op Opgelost en sluit af met samenvatting en conclusie.
7. Toon de auditlog als beheerder en trek de tijdelijke sleutel in.

Gebruik bij voorkeur niet de oorspronkelijke demoaccounts voor de accountbewerkingsdemo, zodat de smoketest bruikbaar blijft.

### Prioriteiten voor vervolgontwikkeling

1. Stem procesrollen, statussen, eigenaarschap en toegang af met het FO/TO en de opdrachtgever.
2. Werk de formele roltoewijzing, onafhankelijke validatie en case-SLA verder uit.
3. Voeg server-side zoeken/paginering en PDF/CSV-export toe.
4. Voeg echte bronadapters en volledige OCSF-validatie toe; de simulator en OCSF-basismapping zijn aanwezig.
5. Werk beveiliging, audit, retentie, TLS en databaseprovisioning uit; voer isolatie-, OWASP-, performance- en loadtests uit.
6. Splits grote componenten/services op, voeg unit tests, CI en dependency-locks toe.

De originele branches zijn geraadpleegd; delen zijn aangepast of opnieuw geïmplementeerd. `bash scripts/compare-branches.sh` haalt originele branchsnapshots read-only op in een nieuwe lokale map. De oorspronkelijke unit tests, alle oorspronkelijke entiteiten en alle componenten zijn niet letterlijk geïntegreerd. Deze demo mag niet worden gepresenteerd als volledig geaccepteerd eindproduct.

### FO v1.1 en TO v1.3: aanvullende correcties

De triage bevat vier uitkomsten, de claim is verplicht voor triage en FirstHandledAt wordt alleen bij oppakken gevuld. Een tweede claim wordt geweigerd. Een nieuwe case krijgt een eerste tijdlijnregel; herhaalde promotie geeft de bestaande koppeling terug. Cases kunnen wachten op een klant, worden pas definitief gesloten met samenvatting en conclusie en kunnen door een senior met reden worden heropend. Samenvatting en observablebeoordeling krijgen eigen velden; overdracht blijft een tijdlijnrecord. Bron-eventdeduplicatie met unieke index, oorspronkelijke JSON en SQL rowversion zijn toegevoegd. Een bestaande demodatabase krijgt bij opstart een additieve schema-update zonder verwijdering van data; productie-deployments vereisen apart beoordeelde scripts. Samengestelde scope-FK's zijn toegevoegd voor alert-case, case-events en observables. Gescheiden platform-/scoperollen, een afzonderlijke CaseObservable-koppeltabel, paginering en gecontroleerde productie-updates blijven open. Nieuwe wijzigingen zijn niet runtime-getest.

Voor alert- en casewijzigingen is de base64 rowVersion uit de meest recente response verplicht. De frontend stuurt deze mee. Verouderde versies geven HTTP 409. Bij opnieuw promoveren van een al gekoppelde alert blijft de bestaande case behouden. Historische handmatige alerts en oudere bronmeldingen krijgen geen verzonnen externe event-ID's.

De reactietermijn staat in platform.Tenants.ResponseMinutes en is via Klantenbeheer te wijzigen. Bij ontvangst wordt de deadline vastgelegd; wijzigingen in de instelling veranderen historische deadlines niet. De demo-update voegt de kolom toe met standaardwaarde 60. De waarschuwing blijft 15 minuten voor het verstrijken van de deadline.

### Traceerbaarheid FO en TO

| Ontwerponderdeel | Code / controle | Nog te valideren |
| --- | --- | --- |
| FO FR-01/02, AC-01; TO 4.1, 7.2, T01–T03 | IngestController, SocService.Ingest, unieke bron/event-index | Integratietest inclusief simultane herhaling |
| FO FR-03–08, AC-02–05; TO 4.2/5.1 | AlertAction, FIFO, claim, triage, promotie | Exacte enumnaamgeving wijkt af van TO; concurrentietest |
| FO FR-09–11/13, AC-06–08; TO 5.2/5.3 | CaseAction, samenvatting, conclusie, observables, overdracht | Gestructureerde acties, notitierevisies en aparte CaseObservable |
| FO FR-14/15, NFR-07; TO 9.1 | CreatedAt, FirstHandledAt, Deadline, ResponseMinutes | SLA-grenstesten; case-SLA aanvullend vereist |
| FO FR-16–18/20, NFR-01–03; TO 6.2/8.1 | TenantDbFactory, modelcache, scope-controles, samengestelde case-FK's | Afzonderlijke platformrollen, per-scope rollen, SQL-principals en volledige negatieve tests |
| FO FR-19, NFR-04–06/10; TO 8.3/8.4 | Identity, TOTP, CSRF, audit en API-key hashing | TLS-productie, auditintegriteit, complete auditdekking en 2FA-test |
| FO NFR-11; TO 4.3 | Origineel JSON, bronmetadata en beperkte OCSF-basismapping | Volledige bronadapters en schema-validatie (Should) |
| TO 7.3/10/11 | Trace-ID bij domeinfouten, demo schema-upgrade, smoketest | Serverpaginering, productie-migraties, backups, unit/load/securitytests |

De SQL-demo-upgrade voegt velden en constraints toe in een transactie. Bestaande childrecords krijgen de scope van hun case; een ongeldige alert-case-koppeling laat de upgrade falen in plaats van gegevens te verplaatsen. De wijziging is nog niet getest met SQL Server. Gebruik niet `docker compose down -v` om een fout te maskeren.

### Securityuitbreiding en eenvoudige incidentworkflow

De klasse SecurityAlertDetails leest vaste velden uit het bronbericht (categorie, IP-adressen, hostname, username, detectieregel en simulatie-indicator). De oorspronkelijke JSON blijft bewaard. Een afzonderlijk veld NormalizedPayload bevat een beperkte OCSF 1.8 Detection Finding-mapping (klasse 2004, activiteit Create, ernst, tijd en finding_info). Bron: https://github.com/ocsf/ocsf-schema/blob/main/events/findings/detection_finding.json. Dit is geen gevalideerde volledige OCSF-eventimplementatie; mapping per echte bron, schema-validatie en uitgebreidere observables ontbreken. Oudere records krijgen geen fictieve securityvelden of normalisatie.

Het dashboard toont dreigingscategorieën, betrokken systemen en recente alerts. Filter op datum, categorie en eigen onderzoeken; zoek in zichtbare alerts en case-observables. Alle filtering gebeurt momenteel op reeds door de backend geautoriseerde gegevens in de frontend.

De workflow gebruikt de bestaande rollen, niet de nog te bevestigen afzonderlijke opdrachtgeverrollen:

| Processtap | Uitvoering |
| --- | --- |
| Ontvangst | Ingest-API of handmatige alert |
| Analyse en classificatie | Analist claimt en triageert |
| Prioritering en toewijzing | Senior analist wijst de open case toe en stelt prioriteit vast |
| Uitvoering | Toegewezen analist of senior; notities, acties en observables, eventueel wachten op klant |
| Validatie en afsluiting | Eerst status Opgelost, dan beoordeling/afsluiting met samenvatting en conclusie |

Open cases gaan via de toewijzing naar In onderzoek. Vanuit In onderzoek kan de case wachten op de klant of opgelost worden. Vanuit Opgelost volgt beoordeling, terug naar onderzoek of definitieve afsluiting. Een senior kan een gesloten case met reden heropenen. Andere analisten kunnen alleen lezen binnen hun scope; mutaties zijn voor de eigenaar of senior. De aparte Ticket Intake Officer-, Security Coordinator- en System Owner-rollen, afzonderlijke onafhankelijke eindvalidatie en case-SLA's zijn nog niet geïmplementeerd. De bestaande basisrollen en FO blijven voorlopig behouden. Deze uitbreiding moet nog op een echte draaiende SQL Server en in de browser worden getest.
