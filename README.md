# SOC3 — SOC-casemanagementplatform

![.NET 10](https://img.shields.io/badge/.NET-10-512BD4?logo=dotnet&logoColor=white)
![React 19 en TypeScript](https://img.shields.io/badge/Frontend-React%2019%20%2B%20TypeScript-149ECA?logo=react&logoColor=white)
![SQL Server 2022](https://img.shields.io/badge/Database-SQL%20Server%202022-CC2927)

**De Haagse Hogeschool · HBO-ICT Software Engineering · Semester 3 · Projectgroep 3**

SOC3 is een casemanagementplatform voor een Security Operations Centre (SOC). Het beoogde platform ontvangt beveiligingsmeldingen, ondersteunt de beoordeling en afhandeling daarvan en legt onderzoeken centraal vast, met strikte scheiding van klantgegevens.

De huidige versie bevat het technische fundament van Sprint 1: authenticatie, tweestapsverificatie, gebruikers- en klantenbeheer, navigatie, de geïntegreerde databasebasis en platformaudit. De operationele alert- en ticketworkflow volgt in volgende sprints.

[Trello — projectbord](https://trello.com/b/wobeDwUi/soc3) · [Pull requests](https://github.com/TeunHSytrius/SOC3-Project/pulls?q=is%3Apr) · [GitHub Actions](https://github.com/TeunHSytrius/SOC3-Project/actions) · [Uitgebreide installatiehandleiding](docs/INSTALLATIE.md)

## Inhoudsopgave

1. [Snelstart](#1-snelstart)
2. [Inloggen en controleren](#2-inloggen-en-controleren)
3. [Database bekijken](#3-database-bekijken)
4. [Projectstructuur en architectuur](#4-projectstructuur-en-architectuur)
5. [Stand van Sprint 1](#5-stand-van-sprint-1)
6. [Samenwerken via GitHub en Trello](#6-samenwerken-via-github-en-trello)
7. [Codeafspraken en testen](#7-codeafspraken-en-testen)
8. [Problemen oplossen](#8-problemen-oplossen)
9. [Projectdocumentatie en bijdragen](#9-projectdocumentatie-en-bijdragen)

---

## 1. Snelstart

Kies één van de twee installatieroutes. Beide gebruiken dezelfde ASP.NET Core-backend, React-frontend en SQL Server-datalaag.

| | Met Docker | Zonder Docker |
| --- | --- | --- |
| Benodigd | Git, Docker Desktop of Docker Engine met Compose v2 | Git, .NET 10 SDK, Node.js 22.12+, npm, bereikbare SQL Server |
| Frontend | http://localhost:8081 | http://localhost:5173 |
| Backend | http://localhost:8081 | http://localhost:8081 |
| Database | SQL Server 2022 in container | Eigen lokale of externe SQL Server |
| Gebruik | Geïntegreerde demo, reproduceerbare testomgeving | Dagelijks ontwikkelen, debugging en Vite hot reload |

### 1.1 Repository ophalen

Open Terminal of PowerShell:

```bash
git clone https://github.com/TeunHSytrius/SOC3-Project.git
cd SOC3-Project
```

Heb je de repository al? Controleer je lokale wijzigingen voordat je wisselt van branch of nieuwe wijzigingen ophaalt:

```bash
git status
git switch main
git pull --ff-only origin main
```

De gezamenlijke integratiebranch in deze repository is `main`. Test een nog niet gemergede pull request op de bijbehorende werkbranch.

### 1.2 Met Docker starten

Installeer [Git](https://git-scm.com/downloads) en [Docker Desktop](https://www.docker.com/products/docker-desktop/) (of Docker Engine met Compose v2 op Linux). Start Docker met Linux-containers. Node.js, de .NET SDK en een losse SQL Server-installatie zijn voor deze route niet nodig.

Voer vanuit de hoofdmap uit:

```bash
docker compose up --build --wait --wait-timeout 360
docker compose ps
```

Compose start SQL Server, bouwt de applicatie en wacht op de healthchecks. Open **http://localhost:8081** wanneer de services healthy zijn.

Stoppen:

```bash
docker compose down
```

De database en Data Protection-sleutels blijven bewaard in Docker-volumes. Gebruik niet `docker compose down -v` tenzij je bewust alle lokale databasegegevens en sleutels wilt verwijderen.

De SQL Server-container gebruikt een x86-64-image. Op Apple Silicon of andere ARM-machines is emulatie mogelijk, maar niet officieel ondersteund door Microsoft. Zie [de installatiehandleiding](docs/INSTALLATIE.md) als SQL Server niet start.

### 1.3 Zonder Docker starten

Installeer:

- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0).
- [Node.js](https://nodejs.org/) 22.12 of hoger, bij voorkeur een ondersteunde LTS-versie, inclusief npm.
- SQL Server 2022 Developer op een ondersteunde machine, of toegang tot een bestaande SQL Server met een eigen ontwikkel-database.
- Een IDE naar keuze, bijvoorbeeld Rider, Visual Studio of VS Code.

Controleer de installaties:

```bash
git --version
dotnet --version
node --version
npm --version
```

Windows x64: SQL Server kan rechtstreeks geïnstalleerd worden. Op macOS en ARM kan de applicatie rechtstreeks draaien, maar SQL Server 2022 heeft geen native serverversie voor die systemen. Gebruik een bereikbare SQL Server op een ondersteunde host. DataGrip is een databaseclient, geen databaseserver.

**Stap 1 — Databaseverbinding instellen**

Maak op SQL Server een eigen lege database aan, bijvoorbeeld `Soc3Dev`, en regel een account met voldoende rechten voor de tabel- en schema-initialisatie in die database. Gebruik geen productiedatabase.

Voer vanuit de hoofdmap uit en vervang de voorbeeldwaarden door je eigen gegevens:

```bash
dotnet user-secrets set "ConnectionStrings:Soc" "Server=127.0.0.1,1433;Database=Soc3Dev;User Id=socdev;Password=VUL_EIGEN_WACHTWOORD_IN;Encrypt=True;TrustServerCertificate=True" --project backend/Soc.Api/Soc.Api.csproj
```

Dit voorbeeld is uitsluitend bedoeld voor een lokale testserver. Gebruik bij een externe server een vertrouwd certificaat en `TrustServerCertificate=False`. Windows-authenticatie en alternatieve configuratie worden uitgelegd in [INSTALLATIE.md](docs/INSTALLATIE.md#22-database-instellen).

User Secrets worden buiten Git opgeslagen, maar zijn niet versleuteld. Deel geen wachtwoorden of uitvoer van `dotnet user-secrets list`. De backend leest altijd de configuratiesleutel `ConnectionStrings:Soc`.

**Stap 2 — Backend starten (terminal 1)**

```bash
dotnet restore SOC3.slnx
dotnet run --project backend/Soc.Api/Soc.Api.csproj --launch-profile "Local Development"
```

Het ontwikkelprofiel start de API op http://localhost:8081 en activeert de demo-initialisatie. De backend maakt de benodigde tabellen, schema's en demoaccounts aan in de geconfigureerde database.

Controleer eerst http://localhost:8081/api/v1/health. Bij een geslaagde verbinding is het antwoord HTTP 200 met `{"status":"ok"}`.

**Stap 3 — Frontend starten (terminal 2)**

Open een tweede terminal vanuit de hoofdmap:

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. Vite stuurt verzoeken naar `/api` door naar de backend op http://127.0.0.1:8081. Houd beide processen actief.

De huidige repository bevat geen vastgelegde `package-lock.json`. Daarom gebruiken we nu `npm install` in plaats van `npm ci`. Het vastleggen van een lockfile is een vervolgafspraak voor reproduceerbare frontendbuilds.

Stop beide processen met Ctrl+C. Je database blijft behouden.

### 1.4 Poortconflicten

Gebruik niet beide applicatieroutes tegelijkertijd op poort 8081. Voor Docker kun je `.env.example` kopiëren naar `.env` en de hostpoorten aanpassen:

```dotenv
SOC_APP_PORT=8082
SOC_SQL_PORT=14334
```

Voor native ontwikkeling moet bij een afwijkende API-poort ook het Vite-target worden aangepast via `VITE_API_TARGET` in `frontend/.env.local`. Zie [de uitgebreide handleiding](docs/INSTALLATIE.md).

## 2. Inloggen en controleren

De demo-initialisatie maakt de volgende groepsaccounts aan. Het initiële wachtwoord is voor alle onderstaande lokale demoaccounts `Demo2026!`. Gewijzigde wachtwoorden blijven in de eigen database behouden.

| Groepslid | E-mailadres | Demorol |
| --- | --- | --- |
| Teun | teun@soc.demo | Beheerder |
| Dominique | dominique@soc.demo | Senior analist |
| Sergio | sergio@soc.demo | Analist |
| Hamza | hamza@soc.demo | Analist |
| Ruben | ruben@soc.demo | Accountmanager |
| Thijs | thijs@soc.demo | Klant |

Deze rollen zijn bedoeld om functionaliteit te demonstreren en geven niet de Scrum-taakverdeling weer. De demoaccounts zijn uitsluitend voor lokale ontwikkeling. Interne demoaccounts met een `@soc.demo`-adres hoeven 2FA niet verplicht in te stellen zolang de demo-modus actief is; zij kunnen de beschikbare 2FA-functionaliteit wel gebruiken.

| Controle | Adres of actie |
| --- | --- |
| Applicatie met Docker | http://localhost:8081 |
| Applicatie zonder Docker | http://localhost:5173 |
| Backend en SQL-bereikbaarheid | http://localhost:8081/api/v1/health |
| OpenAPI-document | http://localhost:8081/openapi/v1.json |
| Authenticated sessie | Inloggen en accountpagina openen |
| Autorisatie | Verschillende demorolaccounts gebruiken |
| Databaseopslag | Klant of testgebruiker aanmaken en terugvinden in SQL |

Gebruik voor handmatige 2FA-tests een eigen testaccount, niet de generieke accounts die in de automatische smoketest worden gebruikt.

## 3. Database bekijken

Gebruik [DataGrip](https://www.jetbrains.com/datagrip/) of [SQL Server Management Studio (SSMS)](https://learn.microsoft.com/en-us/ssms/install/install) op Windows. Beide tools verbinden met de daadwerkelijke SQL Server, onafhankelijk van de frontend.

| Instelling | Met Docker (standaard) | Zonder Docker |
| --- | --- | --- |
| Database type | Microsoft SQL Server | Microsoft SQL Server |
| Host | 127.0.0.1 | Eigen SQL-host |
| Poort | 14333 | Meestal 1433 |
| Database | Soc3Demo | Eigen database, bijvoorbeeld Soc3Dev |
| Gebruiker | sa | Eigen SQL-account of Windows-authenticatie |
| Wachtwoord | SocDemo!2026Local, tenzij lokaal aangepast | Eigen wachtwoord |
| Encrypt | true | true |
| Trust server certificate | true, alleen voor lokale demo | Afhankelijk van certificaat; false bij externe vertrouwde server |

**DataGrip:** maak een Microsoft SQL Server-data source aan, vul bovenstaande gegevens in, download de driver indien nodig en kies Test Connection. Selecteer de juiste database en schema's.

**SSMS:** kies Database Engine, vul de servernaam in (bij een afwijkende poort: host,poort), selecteer de juiste authenticatie en open Databases > gekozen database > Tables.

Controleer de beschikbare tabellen:

```sql
SELECT DB_NAME() AS CurrentDatabase;

SELECT TABLE_SCHEMA, TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_SCHEMA, TABLE_NAME;

SELECT Id, Name, SchemaName, IsActive
FROM platform.Tenants;
```

De applicatie gebruikt één SQL Server-database met meerdere schema's. Het is niet nodig om databasebestanden te downloaden of te committen.

| Schema | Inhoud |
| --- | --- |
| `platform` | Identity, gebruikers, klantorganisaties, scopes, rolkoppelingen en platformaudit |
| `domain` | Geïntegreerde domeinentiteiten voor alerts, tickets, onderzoeken, medewerkers, klanten, organisaties, contracten, notities en bewijs |
| `tenant_...` | Klantgebonden schema's uit de bestaande implementatie |

De beheerfunctionaliteit gebruikt de platformtabellen. De oorspronkelijke domeintabellen zijn geïntegreerd, maar nog niet gekoppeld aan de operationele API. De alertschermen werken met voorbeeldmeldingen. De database-initialisatie gebruikt EF Core `EnsureCreatedAsync` en aanvullende initialisatiecode; er is nog geen volledige EF Core-migratiestrategie. Gebruik een lege eigen database bij een eerste installatie.

## 4. Projectstructuur en architectuur

```text
SOC3-Project/
├── .github/workflows/       Automatische build en tests
├── backend/
│   ├── Soc.Api/            Controllers, beveiliging en applicatieconfiguratie
│   ├── Soc.Business/       Services, DTO's, bedrijfslogica en repositories
│   ├── Soc.Data/           EF Core-contexten en entiteiten
│   │   ├── Context/
│   │   ├── Entities/
│   │   └── Domain/        Geïntegreerd oorspronkelijk domeinmodel
│   └── Soc.Tests/          Backendtests
├── frontend/
│   ├── src/
│   │   ├── app/            Navigatie en werkruimte
│   │   ├── components/     Herbruikbare componenten
│   │   ├── features/       Schermen per functionaliteit
│   │   ├── hooks/          Herbruikbare React-logica
│   │   ├── services/       API- en sessieverzoeken
│   │   └── types/          TypeScript-types
│   └── package.json
├── docs/                   Installatiehandleiding
├── tests/smoke.mjs          API-smoketest
├── .editorconfig
├── .env.example
├── .gitignore
├── compose.yaml
├── compose.external.yaml
├── Dockerfile
├── SOC3.slnx
└── README.md
```

```text
React + TypeScript
        │ HTTP / JSON (/api/v1)
        ▼
ASP.NET Core Web API — Soc.Api
        │
        ▼
Bedrijfslogica — Soc.Business
        │
        ▼
Datalaag — Soc.Data (EF Core)
        │
        ▼
SQL Server 2022
```

De frontend communiceert via de API, niet rechtstreeks met SQL Server. De backend controleert authenticatie en toegangsrechten. ASP.NET Core Identity verzorgt wachtwoordhashing en sessies; de 2FA-implementatie gebruikt authenticatorcodes en herstelcodes. De browsermutaties gebruiken CSRF-bescherming. HTTP is alleen bedoeld voor de lokale demo; productiebeveiliging is vervolgwerk.

Belangrijke bronbestanden:

| Onderdeel | Bestand of map |
| --- | --- |
| API-configuratie | [Program.cs](backend/Soc.Api/Program.cs) |
| Authenticatie | [AuthController.cs](backend/Soc.Api/Controllers/AuthController.cs) |
| Gebruikersbeheer | [UsersController.cs](backend/Soc.Api/Controllers/UsersController.cs) |
| Klantenbeheer | [OrganizationsController.cs](backend/Soc.Api/Controllers/OrganizationsController.cs) |
| Datamodel | [SocDbContext.cs](backend/Soc.Data/Context/SocDbContext.cs) |
| Domeinmodel | [Soc.Data/Domain](backend/Soc.Data/Domain) |
| Native startprofiel | [launchSettings.json](backend/Soc.Api/Properties/launchSettings.json) |
| Frontendproxy | [vite.config.ts](frontend/vite.config.ts) |

## 5. Stand van Sprint 1

De eerste sprint levert het technische fundament op. De koppeling hieronder verwijst naar de betreffende Trello-stories. De kaartbeschrijvingen onderscheiden de opgeleverde basisscope van de uitgebreidere acceptatiecriteria.

| Story | Realisatie in de huidige code |
| --- | --- |
| [US-20](https://trello.com/c/BSQtfu7Y) | Klantorganisaties aanmaken, wijzigen en deactiveren |
| [US-21](https://trello.com/c/zhT2kzLv) | Klantgebonden toegang in het huidige beheerplatform |
| [US-22](https://trello.com/c/2vh9l00Z) | Bestaande rollen en backendautorisatie |
| [US-23](https://trello.com/c/dZ1i7Ude) | Gebruikersbeheer en rol-/organisatiekoppelingen |
| [US-24](https://trello.com/c/52SyyA0g) | Login, logout en sessiebeheer |
| [US-25](https://trello.com/c/DjqXj2BE) | TOTP-tweestapsverificatie en herstelcodes |
| [US-26](https://trello.com/c/hr4kbJRQ) | Platformaudit en auditoverzicht |
| [US-31](https://trello.com/c/xTqfEn7L) | Applicatiestructuur, navigatie en klantcontext |
| [US-36](https://trello.com/c/bdHC7c1e) | Geïntegreerde SQL Server-databasebasis |

Het dashboard bevat een alertoverzicht met zoeken, filters, paginering en detailweergave op voorbeeldgegevens uit `frontend/src/features/demo`. Echte ingest, triage, ticketafhandeling, onderzoeken en operationele SLA-bewaking zijn nog niet geïmplementeerd.

### 5.1 Afwijkingen en vervolgwerk

| Onderwerp | Actuele situatie en vervolg |
| --- | --- |
| Rollen | De bestaande rollen zijn Analist, Senior analist, Beheerder, Klant en Accountmanager. De nieuwe procesrollen en uitgebreide autorisatie volgen in [US-45](https://trello.com/c/4bK0Jydi). |
| Datamodel | `platform` en `domain` bestaan naast elkaar. De koppeling tussen AppUser/Employee en Tenant/Customer/Organization, de leidende alert-/ticketmodellen en migraties volgen in [US-46](https://trello.com/c/NrUO2Gjd). |
| Gebruikersbeheer | De uitgebreide rol- en organisatiekoppelingen en aanvullende beheercriteria volgen in [US-47](https://trello.com/c/Z3aV3yEd). |
| Audit en isolatie | Volledige operationele audit, integriteit en tenantisolatie van de domeingegevens volgen in [US-48](https://trello.com/c/oDklQQlg). |

De feedback van de opdrachtgever over het vijfstappenproces, SLA en bewaartermijnen is verwerkt in de vervolgstories op Trello. Werk de relevante requirements, het FO en TO bij wanneer afspraken of ontwerpkeuzes veranderen. De huidige versie is een sprintincrement, geen productieklare SOC-oplossing.

## 6. Samenwerken via GitHub en Trello

Trello bevat de Product Backlog, Sprint Backlog, acceptatiecriteria en checklists. GitHub bevat de implementatie, commits, pull requests, reviews en testresultaten. De integratiebranch `main` bevat de gezamenlijke code.

De volgende werkafspraken sluiten aan op de oorspronkelijke repository; pas ze in overleg met het team toe. Technische afdwinging via branchregels en verplichte statuschecks moet apart worden gecontroleerd.

### 6.1 Branches en commits

| Branch | Gebruik |
| --- | --- |
| `main` | Gezamenlijke geïntegreerde versie |
| `feature/*` | Nieuwe functionaliteit |
| `bugfix/*` | Bugfixes |
| `refactor/*` | Verbeteren van bestaande code |
| `chore/*` | Onderhoud en configuratie |
| `docs/*` | Documentatie |

Maak een werkbranch vanaf de actuele hoofdbranch:

```bash
git status
git switch main
git pull --ff-only origin main
git switch -c feature/us-45-process-roles
```

Gebruik het nummer van je eigen Trello-story. Houd commits logisch afgebakend, met een beschrijvend Engels bericht, bijvoorbeeld:

```text
feat: add process role validation (US-45)
fix: correct organization access checks (US-47)
test: add cross-tenant authorization tests (US-48)
docs: update local development instructions
```

Voeg alleen de bestanden toe die bij je wijziging horen, controleer de diff en push je branch:

```bash
git status
git diff
git add <bestanden>
git diff --cached
git commit -m "feat: add process role validation (US-45)"
git push -u origin feature/us-45-process-roles
```

Vervang `<bestanden>` door de daadwerkelijke bestandspaden. Werk niet rechtstreeks op main. Herschrijf geen gedeelde geschiedenis zonder teamafspraak.

### 6.2 Pull requests en Definition of Done

Open een pull request naar main en vermeld:

- Trello-story en link, relevante requirements en de wijziging.
- Wat daadwerkelijk is getest, inclusief resultaten en beperkingen.
- Eventuele afwijkingen van het FO/TO en gevolgen voor andere onderdelen.
- Hergebruik, samenwerking en AI-ondersteuning waar relevant.

Laat een ander groepslid de wijziging beoordelen. Verwerk reviewfeedback en controleer de actuele CI-status. Sluit de Trello-kaart pas wanneer de afgesproken acceptatiecriteria en Definition of Done aantoonbaar zijn behaald. Bewaar PR-links en testbewijs bij de kaart. Een groene build alleen is geen volledige acceptatietest.

## 7. Codeafspraken en testen

Code en commitberichten zijn bij voorkeur Engels; schermteksten en projectdocumentatie mogen Nederlands zijn. De bestaande `.editorconfig` en `frontend/.prettierrc.json` vormen de basis voor de opmaak.

| Onderdeel | Conventie |
| --- | --- |
| C#-klassen, methoden en properties | PascalCase, bijvoorbeeld UserManagementService |
| C#-interfaces | I + PascalCase, bijvoorbeeld ITwoFactorService |
| Lokale variabelen en parameters | camelCase met beschrijvende namen |
| Asynchrone methoden | Async-suffix waar passend |
| React-componenten en types | PascalCase |
| TypeScript-functies en variabelen | camelCase |

Houd controllers beperkt tot HTTP-verwerking, bedrijfsregels in Soc.Business en datamodellen/contexten in Soc.Data. Splits React-componenten naar verantwoordelijkheid en houd API-verzoeken uit presentatiecomponenten waar mogelijk. Plaats geen servergeheimen in frontendcode.

### 7.1 Backend

Voer vanuit de hoofdmap uit:

```bash
dotnet restore SOC3.slnx
dotnet build SOC3.slnx
dotnet test backend/Soc.Tests/Soc.Tests.csproj
dotnet format SOC3.slnx --verify-no-changes
```

De formatteringscontrole kan bestaande afwijkingen signaleren en is nog geen verplichte CI-gate.

### 7.2 Frontend

```bash
cd frontend
npm install
npm run build
npm run format:check
cd ..
```

De build voert TypeScript-controle en Vite-build uit. Voor opmaak is Prettier geconfigureerd; er bestaat momenteel geen npm-script voor linting. Gebruik `npm run format` alleen voor bewuste opmaakwijzigingen en controleer de diff.

### 7.3 Integratie- en smoketest

Met een draaiende Docker-demo:

```bash
docker compose --profile test run --rm smoke
```

Met een draaiende native backend:

```bash
node tests/smoke.mjs
```

De [smoketest](tests/smoke.mjs) controleert onder andere login/logout, gebruikersbeheer, klantenbeheer, geweigerde toegang, klantgebonden werkruimtes, CSRF, audit en de afwezigheid van nog niet opgeleverde operationele endpoints. De test maakt fictieve records aan; voer hem uit op een eigen demodatabase. Activeer geen 2FA op de generieke smoke-testaccounts.

### 7.4 GitHub Actions

De [CI-workflow](.github/workflows/docker.yml) voert backendtests, Compose-validatie, de Docker-build, HTTP-readiness, controles op SQL-tabellen en de API-smoketest uit. Raadpleeg [Actions](https://github.com/TeunHSytrius/SOC3-Project/actions) voor het resultaat van de betreffende commit.

De native startprocedure is toegevoegd in [PR #13](https://github.com/TeunHSytrius/SOC3-Project/pull/13). De Docker-CI op de eerdere PR-versie was geslaagd; de native installatie moet nog door het team worden uitgevoerd en vastgelegd. Een buildresultaat van een eerdere commit geldt niet automatisch voor iedere volgende commit.

## 8. Problemen oplossen

| Probleem | Controle |
| --- | --- |
| Repository niet toegankelijk | Controleer GitHub-toegang en authenticatie. |
| Docker niet bereikbaar | Start Docker en controleer docker version. |
| SQL Server unhealthy | Controleer processorarchitectuur, geheugen, logs en wachtwoord van het bestaande volume. |
| Poort 8081 bezet | Stop de andere applicatie of configureer een afwijkende poort. |
| ConnectionStrings:Soc ontbreekt | Stel User Secrets of de omgevingsvariabele ConnectionStrings__Soc in. |
| SQL Server niet bereikbaar | Controleer service, host, TCP/IP, poort, database, authenticatie en certificaat. |
| Frontend bereikt API niet | Controleer de health-URL, beide processen en het Vite API-target. |
| npm-installatie mislukt | Controleer Node.js-versie en de foutmelding. |
| Database niet zichtbaar | Controleer in DataGrip/SSMS of je met dezelfde server en database als de backend verbonden bent. |

Docker-diagnostiek:

```bash
docker compose ps -a
docker compose logs --tail=100 app sqlserver
```

Vermeld bij een probleem je besturingssysteem, softwareversies, branch, uitgevoerd commando en de foutmelding. Deel geen wachtwoorden, sleutels of connection strings met echte geheimen. Zie [INSTALLATIE.md](docs/INSTALLATIE.md) voor de uitgebreide stappen.

## 9. Projectdocumentatie en bijdragen

### 9.1 Projectartefacten

| Artefact | Locatie of werkwijze |
| --- | --- |
| Product Backlog en Sprint Backlog | [Trello](https://trello.com/b/wobeDwUi/soc3) |
| Historische planning | [Taiga](https://tree.taiga.io/project/djominique-soc-groep-3/kanban) |
| Increment Sprint 1 | [Geïntegreerde PR #12](https://github.com/TeunHSytrius/SOC3-Project/pull/12) en de gezamenlijke main-branch |
| Testbewijs Sprint 1 | [CI-run PR #12](https://github.com/TeunHSytrius/SOC3-Project/actions/runs/45782022014) |
| Functioneel ontwerp en technisch ontwerp | Actuele groepsdocumenten; voeg de vrijgegeven versies of toegankelijke links toe |
| Installatiehandleiding | [docs/INSTALLATIE.md](docs/INSTALLATIE.md) |

Het FO en TO beschrijven de afgesproken functionaliteit en technische keuzes. Koppel wijzigingen aan de relevante requirements, Trello-stories, PR's en testresultaten. Bewaar feedback en ontwerpwijzigingen bij de bijbehorende projectartefacten; deze README is geen vervanging van het FO/TO of individuele verantwoording.

### 9.2 Herkomst van groepsbijdragen

De oorspronkelijke groepsrepository is [soc3Managment](https://github.com/TeunHSytrius/soc3Managment). De oorspronkelijke branches en PR's blijven belangrijk voor de individuele traceerbaarheid. Niet iedere oorspronkelijke implementatie is ongewijzigd overgenomen.

| Groepslid | Bekende oorspronkelijke bijdrage | Bron en integratie |
| --- | --- | --- |
| Teun | Login | [PR #8](https://github.com/TeunHSytrius/soc3Managment/pull/8); geïntegreerde login verder aangepast |
| Thijs | Tweestapsverificatie | [2FA-branch](https://github.com/TeunHSytrius/soc3Managment/tree/feature/tg-39-two-factor-auth); service en tests hergebruikt, Identity-integratie aangepast |
| Hamza | Datamodel | [Databasecommit](https://github.com/TeunHSytrius/soc3Managment/tree/4550bc7a424b3815a2873882fda369f5bd8ce2a5); domeinentiteiten en relaties geïntegreerd via PR #12 |
| Sergio | Klantenbeheer | [Klantenbeheerbranch](https://github.com/TeunHSytrius/soc3Managment/tree/feature/tg-20-customer-management); huidige SQL-implementatie is niet de oorspronkelijke in-memory-implementatie |
| Ruben en Dominique | Navigatie | [Navigatiebranch](https://github.com/TeunHSytrius/soc3Managment/tree/feature/tg-us-31-frontend-navigatie); geïntegreerde navigatie verder aangepast |

Dit is een overzicht van bekende bijdragen, geen volledige individuele beoordeling. Ieder groepslid vult zijn eigen bewijs aan met commits, PR's, reviews, gemaakte keuzes en eigen testresultaten. Een commit op naam van een account is op zichzelf geen bewijs van zelfstandig uitgevoerd werk.

Het eerdere uitgebreide, met AI ondersteunde prototype blijft beschikbaar op [archive/full-mvp](https://github.com/TeunHSytrius/SOC3-Project/tree/archive/full-mvp), commit `6fca2626d56179029aa08dd9285639c92d7e62a0`. Dit archief is een referentie, geen opgeleverd bewijs van alle user stories.

### 9.3 AI-gebruik en eigen controle

Voor het opstellen en structureren van deze README en de installatie-instructies is ChatGPT gebruikt. De voorgestelde commando's en technische beschrijving zijn door de assistent vergeleken met de repositorybestanden. Dit is AI-ondersteunde conceptdocumentatie; de projectgroep moet de tekst, keuzes en commando's zelf controleren, zo nodig aanpassen en de uiteindelijke versie goedkeuren. De native installatie is nog niet door de assistent uitgevoerd.

Leg per relevant bewijsstuk vast welke AI-tool is gebruikt, waarvoor, welke onderdelen zijn overgenomen en welke eigen controles en aanpassingen daadwerkelijk zijn uitgevoerd. Volg de opleidingsafspraken voor AIAS-niveau 3. Rapporteer ook AI-gebruik bij de ontwikkeling en integratie van de code; deze algemene vermelding vervangt geen individuele rapportage.

---

**SOC3 — Projectgroep 3**
