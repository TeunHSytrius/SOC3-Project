# SOC3 Management

**SE3 — Multilayer Webapplications | Projectgroep 3 | Sprint 1**

Laatste actualisatie: 26 november 2026.

SOC3 is een webapplicatie voor het registreren, beoordelen en afhandelen van beveiligingsmeldingen binnen een Security Operations Centre (SOC). In Sprint 1 ligt de nadruk op het technische fundament: authenticatie, gebruikers- en klantenbeheer, navigatie, de database en de eerste schermen. De operationele verwerking van beveiligingsmeldingen wordt verder ontwikkeld in volgende sprints.

[Taiga — sprintbord](https://tree.taiga.io/project/djominique-soc-groep-3/kanban) · [GitHub Actions](https://github.com/TeunHSytrius/SOC3-Project/actions) · [Installatie en problemen oplossen](docs/INSTALLATIE.md)

## Inhoud

- [1. Snel starten](#1-snel-starten)
- [2. Huidige stand — Sprint 1](#2-huidige-stand--sprint-1)
- [3. Architectuur en database](#3-architectuur-en-database)
- [4. Bestaande bijdragen en herkomst](#4-bestaande-bijdragen-en-herkomst)
- [5. Samen verder ontwikkelen](#5-samen-verder-ontwikkelen)
- [6. Codeconventies en controles](#6-codeconventies-en-controles)
- [7. Openstaande keuzes en vervolg](#7-openstaande-keuzes-en-vervolg)

## 1. Snel starten

Installeer [Git](https://git-scm.com/downloads) en [Docker Desktop](https://www.docker.com/products/docker-desktop/). Start Docker Desktop met Linux-containers. Voor de demo zijn Node.js, de .NET SDK en een losse SQL Server-installatie niet nodig.

**Eerste keer:** open PowerShell of Terminal.

```bash
git clone https://github.com/TeunHSytrius/SOC3-Project.git
cd SOC3-Project
docker compose up --build --wait --wait-timeout 360
```

**Al een lokale kopie?** Controleer eerst of je eigen werk veilig is gecommit of gestasht. Wissel alleen van branch als je lokale wijzigingen veilig zijn.

```bash
git status
git switch main
git pull --ff-only origin main
docker compose up --build --wait --wait-timeout 360
```

Open **[http://localhost:8081](http://localhost:8081)**. Met `docker compose ps` controleer je of de services healthy zijn.

### Lokale demoaccounts

Het initiële wachtwoord voor deze accounts is `Demo2026!`. De rollen zijn gekozen voor demonstratiedoeleinden, niet als taakverdeling van het project.

| Groepslid | E-mailadres | Demorol |
| --- | --- | --- |
| Teun | teun@soc.demo | Beheerder |
| Dominique | dominique@soc.demo | Senior analist |
| Sergio | sergio@soc.demo | Analist |
| Hamza | hamza@soc.demo | Analist |
| Ruben | ruben@soc.demo | Accountmanager |
| Thijs | thijs@soc.demo | Klant |

Iedereen heeft lokaal zijn eigen SQL Server-container en databasevolume. Gegevens en gewijzigde wachtwoorden worden niet gedeeld via GitHub. Demoaccounts en wachtwoorden zijn uitsluitend bedoeld voor lokale ontwikkeling.

Stoppen: `docker compose down`. Gebruik **geen** `docker compose down -v`: daarmee verwijder je de database en de sleutels voor 2FA.

Werkt Docker niet op jouw laptop? Zie [de installatiehandleiding](docs/INSTALLATIE.md), ook voor Apple Silicon, een externe SQL Server en DataGrip.

## 2. Huidige stand — Sprint 1

De geïntegreerde database, login, 2FA en het vernieuwde alertoverzicht staan op `main`. [PR #12](https://github.com/TeunHSytrius/SOC3-Project/pull/12) is gemerged na een geslaagde [CI-run](https://github.com/TeunHSytrius/SOC3-Project/actions/runs/45782022014). De tabel hieronder beschrijft de technische voortgang; de actuele taakstatus en formele acceptatie staan in [Taiga](https://tree.taiga.io/project/djominique-soc-groep-3/kanban).

| Onderdeel | Stand | Toelichting |
| --- | --- | --- |
| Login en logout | Geïntegreerd | Werkende backend-authenticatie en sessies |
| 2FA | Geïntegreerd | Oorspronkelijke service van Thijs, aangesloten op Identity |
| Gebruikers- en klantenbeheer | Basis beschikbaar | Bestaande beheer-API gebruikt platformmodellen |
| Rollen en klanttoegang | Basis beschikbaar | Autorisatie in de backend; verdere validatie tegen FO/TO nodig |
| Database | Geïntegreerde basis | Hamza's domeinentiteiten en relaties zijn toegevoegd aan `SocDbContext`; koppeling met beheerdata nog open |
| Dashboard en alertoverzicht | Prototype beschikbaar | Overzicht, zoekfunctie, filters, paginering en detailpagina met voorbeeldmeldingen |
| Auditlog | Basis beschikbaar | Platformactiviteiten en paginering; geen volledige operationele audit |
| Ingest, triage, tickets, SLA, onderzoeken en rapportages | Nog te realiseren | Operationele API's en workflows ontbreken |

De alertschermen gebruiken herkenbaar gelabelde voorbeeldgegevens uit `frontend/src/features/demo`. De meldingen worden niet in SQL opgeslagen en zijn niet afkomstig uit securitytooling. De groep bepaalt aan de hand van het FO, TO en Taiga welke onderdelen aan de acceptatiecriteria voldoen.

### Scrum-artifacts

| Artifact | Waar te vinden |
| --- | --- |
| Product Backlog | Taiga: geprioriteerde user stories en acceptatiecriteria |
| Sprint Backlog | Taiga: geselecteerde user stories, taken en actuele taakverdeling voor Sprint 1 |
| Increment | `main`: geïntegreerde en technisch geteste onderdelen; acceptatie aan de hand van de Definition of Done |

Gebruik het actuele sprintbord tijdens het overleg en de Sprint Review. De README is geen tweede takenadministratie.

## 3. Architectuur en database

React 19 / TypeScript → ASP.NET Core (.NET 10) → businesslaag → EF Core 10 → SQL Server 2022.

```text
SOC3-Project/
├── backend/
│   ├── Soc.Api/        Controllers, authenticatie en API-configuratie
│   ├── Soc.Business/   Services, DTO's en bedrijfslogica
│   ├── Soc.Data/       EF Core-contexten en entiteiten
│   │   └── Domain/     Oorspronkelijk domeinmodel van Hamza
│   └── Soc.Tests/      2FA- en datamodeltests
├── frontend/
│   └── src/
│       ├── app/        Navigatie en werkruimte
│       ├── components/ Herbruikbare UI-componenten
│       ├── features/   Schermen per functionaliteit
│       ├── hooks/      Herbruikbare React-logica
│       ├── services/   API- en sessieverzoeken
│       └── types/      TypeScript-types
├── tests/              API-smoketest
├── docs/               Installatiehandleiding
├── .github/workflows/  CI
├── SOC3.slnx
└── compose.yaml
```

### Eén SQL Server-database

| Schema binnen `Soc3Demo` | Doel |
| --- | --- |
| `platform` | Identity, gebruikers, rollen, scopes, klantenbeheer en platformaudit |
| `domain` | Hamza's oorspronkelijke Alerts, Tickets, Researches, Customers, Organizations, Employees, Contracts, Notes en Evidences |
| `tenant_...` | Bestaande klantschema's, behouden voor compatibiliteit |

De oorspronkelijke domeinentiteiten zijn toegevoegd aan `SocDbContext` met behoud van integer-ID's en de oorspronkelijke relaties. De namespaces en schematoewijzing zijn aangepast om conflicten met de bestaande implementatie te voorkomen. Nieuwe demo's krijgen de tabellen bij initialisatie; voor bestaande demo's is een additieve initializer toegevoegd. Er is geen tweede database en geen automatische migratie van bestaande records.

**Nog te besluiten:** hoe `AppUser` en `Employee`, `Tenant` en `Customer/Organization` aan elkaar worden gekoppeld; welke alert- en ticketmodellen uiteindelijk leidend zijn; hoe klantisolatie binnen het domeinmodel wordt afgedwongen. De bestaande schermen gebruiken nog de platformmodellen. Er zijn nog geen publieke API's voor de oorspronkelijke domeintabellen. De huidige oplossing is een integratiestap. Wijzigingen in de gedeelde modellen worden met het team afgestemd.

## 4. Bestaande bijdragen en herkomst

De oorspronkelijke groepsrepository is [soc3Managment](https://github.com/TeunHSytrius/soc3Managment). Deze geïntegreerde repository vervangt die niet automatisch. De oorspronkelijke branches blijven als bron beschikbaar.

| Bijdrage | Bron en stand |
| --- | --- |
| Teun — login | [Oorspronkelijke login-PR #8](https://github.com/TeunHSytrius/soc3Managment/pull/8); geïntegreerde login is verder aangepast |
| Thijs — 2FA | [feature/tg-39-two-factor-auth](https://github.com/TeunHSytrius/soc3Managment/tree/feature/tg-39-two-factor-auth); service en tests hergebruikt, opslag en Identity-integratie aangepast |
| Hamza — database | [Oorspronkelijke databasecommit](https://github.com/TeunHSytrius/soc3Managment/tree/4550bc7a424b3815a2873882fda369f5bd8ce2a5); entiteiten en relaties opgenomen in het gecombineerde model |
| Sergio — klantenbeheer | [Oorspronkelijke branch](https://github.com/TeunHSytrius/soc3Managment/tree/feature/tg-20-customer-management); huidige SQL-implementatie is niet zijn oorspronkelijke in-memory-implementatie |
| Ruben en Dominique — navigatie | [Oorspronkelijke branch](https://github.com/TeunHSytrius/soc3Managment/tree/feature/tg-us-31-frontend-navigatie); geïntegreerde navigatie is aangepast |

De tabel is een overzicht van bekende oorspronkelijke bijdragen, geen complete individuele beoordeling. Vul tijdens het overleg ontbrekende bijdragen aan en bespreek welke implementaties behouden of opnieuw geïntegreerd moeten worden.

Het eerdere uitgebreide prototype is met AI-ondersteuning ontwikkeld en bewaard op [archive/full-mvp](https://github.com/TeunHSytrius/SOC3-Project/tree/archive/full-mvp), commit `6fca2626d56179029aa08dd9285639c92d7e62a0`. Dat archief is een referentie, geen bewijs dat alle tickets of individuele leeruitkomsten zijn afgerond. Gebruik de actieve codebase als uitgangspunt voor gezamenlijk werk nadat het team daarover overeenstemming heeft.

## 5. Samen verder ontwikkelen

**Voorstel voor werkafspraken — gezamenlijk vaststellen tijdens het overleg.** Taiga bepaalt de sprintplanning; GitHub bevat de implementatie en reviews.

1. Kies met het team een ticket en bespreek de acceptatiecriteria.
2. Maak vanuit de actuele `main` een eigen featurebranch.
3. Implementeer en test de afgesproken scope. Bespreek wijzigingen in gedeelde interfaces en datamodellen vooraf.
4. Open een pull request naar `main`, met het Taiga-ticket, de wijziging, testresultaten en eventuele beperkingen.
5. Laat een ander groepslid reviewen. De auteur verwerkt feedback.
6. Merge pas wanneer de review, relevante tests en CI akkoord zijn. Sluit het Taiga-ticket volgens de teamafspraken.

```bash
git switch main
git pull --ff-only origin main
git switch -c feature/tg-123-korte-omschrijving
```

Vervang het voorbeeldnummer door je eigen ticket. Werk niet rechtstreeks op `main` en voeg geen werk van anderen aan je branch toe zonder afstemming. Vermeld hergebruik en AI-ondersteuning eerlijk; ieder groepslid moet zijn eigen werk kunnen toelichten.

### Definition of Done — voorstel

- Acceptatiecriteria aantoonbaar gecontroleerd.
- Code leesbaar en opgemaakt volgens de conventies.
- Relevante unit-, integratie- en handmatige tests uitgevoerd.
- Autorisatie, klantisolatie en foutafhandeling gecontroleerd waar relevant.
- PR gereviewd, CI groen, documentatie bijgewerkt.

## 6. Codeconventies en controles

Gebruik de bestaande `.editorconfig` en `frontend/.prettierrc.json`. Schrijf code met betekenisvolle Engelse namen, kleine functies, expliciete accolades en duidelijke verantwoordelijkheden. Houd UI, API-verzoeken, businesslogica en opslag gescheiden. C# gebruikt vier spaties; TypeScript, JSX en CSS twee. Gebruik PascalCase voor publieke C#-types en React-componenten, camelCase voor lokale variabelen. Vermijd onnodige abstracties en compacte geneste conditionals.

Voor lokaal ontwikkelen heb je de .NET 10 SDK en Node.js >=22.12 nodig. Controleer voordat je een PR opent:

```bash
dotnet test backend/Soc.Tests/Soc.Tests.csproj
dotnet format SOC3.slnx --verify-no-changes
```

```bash
cd frontend
npm install
npm run format:check
npm run build
cd ..
```

Gebruik `npm run format` voor de frontend en `dotnet format SOC3.slnx` voor de backend wanneer formattering nodig is. Controleer de diff; meng grootschalige formattering niet met een functionele wijziging. De formatteringscommando's kunnen bestaande afwijkingen signaleren; volledige formatteringscontrole is nog geen verplichte CI-gate. De lockfile-afspraak moet nog worden vastgelegd.

Test de draaiende demo met:

```bash
docker compose --profile test run --rm smoke
```

CI controleert de backendtests, Docker-build, HTTP-readiness, SQL-tabellen en API-smoketest. Zie [Actions](https://github.com/TeunHSytrius/SOC3-Project/actions) voor de werkelijke resultaten per commit. Een groene CI-run bewijst niet dat alle acceptatiecriteria zijn behaald. Test 2FA-setup en aanmelding ook handmatig met een eigen testaccount; gebruik daarvoor niet de generieke smoke-testaccounts.

## 7. Openstaande keuzes en vervolg

De volgende punten zijn nog niet definitief vastgesteld. Bespreek ze gezamenlijk en leg de uitkomsten vast in Taiga en het FO/TO.

| Onderwerp | Te bespreken besluit |
| --- | --- |
| Repository | Welke repository en branch zijn vanaf nu gezamenlijk leidend? |
| Database | Welke modellen behouden we, hoe koppelen we Identity aan medewerkers en klanten, en hoe borgen we tenantisolatie? |
| Bestaande bijdragen | Welke oorspronkelijke implementaties moeten worden behouden, hersteld of gezamenlijk aangepast? |
| Sprint 1 | Welke tickets voldoen daadwerkelijk aan de acceptatiecriteria en welke zijn nog open? |
| Vervolgplanning | Wie pakt welk ticket op, welke afhankelijkheden zijn er en wat doen we eerst? |
| Kwaliteit | Welke review-, test- en formatteringsregels spreken we af? |
| Individueel bewijs | Hoe leggen we eigen werk, feedback, keuzes en AI-ondersteuning vast? |

Leg de gemaakte afspraken vast in Taiga en werk FO/TO en README bij wanneer de gezamenlijke keuzes daarom vragen.

### Bekende beperkingen

De actieve versie is nog geen productieklare SOC-applicatie. Domein-API's, samenvoeging van overlappende modellen, volledige tenantisolatie van de oorspronkelijke domeinentiteiten, EF Core-migraties en productieconfiguratie zijn nog niet afgerond. Het team moet deze punten gezamenlijk valideren voordat de oplossing als definitief wordt gepresenteerd.
