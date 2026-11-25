# Verantwoording – lokale MVP

## Gebruikte basis

Read-only branchinspectie van `TeunHSytrius/soc3Managment` op 25 november 2026:

| Branch | Gelezen HEAD | Toegepast |
| --- | --- | --- |
| develop | 9b03c4c | Loginformulier en API-patroon; de foutmock vervangen door een echte Identity-login. |
| feature/database | 4550bc7 | Alert-, Ticket-/Research-domein en status/prioriteitswaarden. TO vereist tenant-schema's en scopecontrole; de EF-mapping is hiervoor opnieuw opgezet. |
| feature/tg-20-customer-management | 9c74841 | Organisatie-API (`/api/v1/organizations`, aanmaken, lijst, ophalen, deactiveren); in-memory opslag vervangen door SQL Server. |
| feature/tg-39-two-factor-auth | 5f82ebd | Setup- en enable-endpoints; echte Identity-authenticator met QR en herstelcodes. |
| feature/tg-us-31-frontend-navigatie | bb81c5a | Rolafhankelijke navigatie, klantcontext, schermen, statusbadges, fout-/leegstatussen; visuele uitwerking aangepast voor dashboard. |

Het FO en TO v1.3 (klantschema's) hebben voorrang bij conflicten. De connector kon branchbestanden lezen; direct klonen of uitvoeren van `git fetch` mislukte door ontbrekende netwerktoegang in de container. De originele bestanden zijn dus niet integraal gekopieerd of automatisch gemerged. De lokale code hergebruikt contracten, statussen en ontwerpkeuzes; laat teamleden later verschillen reviewen.

## Gekozen architectuur

- .NET 10, ASP.NET Core controllers, Identity, EF Core 10, SQL Server, React en TypeScript.
- `platform` bevat tenants, scopes, gebruikers, roltoegang, bronnen en platformaudit. Een tenant heeft een servergegenereerde naam `tenant_<guid>`. Elke tenant heeft eigen tabellen voor alerts, cases, tijdlijn, observables en audit; geen TenantId in onderzoekstabellen. `ScopeId` is een extra server-side grens. De EF-modelcache bevat de schemannaam.
- API geeft alleen tenant-ID's/scope-ID's aan de frontend; schemannaam wordt server-side opgelost. Gegevenswijziging en tenant-audit zitten in dezelfde transactie; aanlevering gebruikt een brongebonden SHA-256-gehashte API-sleutel. Beheerders krijgen niet automatisch onderzoekstoegang.
- Password hashing, accountlockout, authenticator, herstelcodes, Data Protection voor authenticatorgeheim, CSRF-header, cookies, login-/ingestlimieten. Demo-instellingen zijn uitsluitend voor loopback. Beveiliging en scope-isolatie moeten door integratietests worden bewezen, niet alleen op basis van broncode.

## Functionele afbakening

De uitgewerkte MVP-stroom omvat alerts via een API, persistent opslaan, FIFO, filters, SLA, eerste behandeling, claim, triage, false-positive afsluiting, case aanmaken/koppelen, observables/notities/acties, eigenaar, status, conclusie, klantzichtbare informatie, klantreacties, organisaties, gebruikersrollen/klanttoegang, API-sleutels, audit en 2FA.

Nog niet af / niet als gereed presenteren:

- Volledige OCSF-normalisatie en opslag van alle originele broneigenschappen: de demo gebruikt een vereenvoudigd alertcontract met gereconstrueerde JSON, geen volledige willekeurige bronpayload.
- Bestandsupload, malwarecontrole, revisies van notities, uitgebreide rapportages, herstelprocedure bij verloren 2FA en uitgebreide route-/formulier-/toegankelijkheidstests. Bewijsreferentie is tekst; geen bestandsopslag. Playbooks vallen buiten MVP volgens het ontwerp.
- Scopecontrole zit in de backend en iedere tenant heeft een standaard-scope. UI voor het aanmaken en afzonderlijk beheren van meerdere scopes/roltoekenningen is niet uitgewerkt; gebruikers hebben één rol en krijgen toegang tot de scopes van geselecteerde klanten. Dit is dus nog niet de volledige per-scope rollenmatrix uit het TO.
- Demo SLA-tijden zijn hardgecodeerde voorbeeldwaarden. Geen instelscherm, geen definitieve afspraken met de opdrachtgever.
- EF-provisioning maakt tabellen bij aanmaak. Geen definitieve SQL-migraties, minimale databaseprincipal per schema, productieback-up/herstel of tenantmigratieprocedure. Het demo-SQL-account is een lokale beheeraccount. Dit moet worden vervangen voor productie en voldoet nog niet aan volledige productie-hardening uit het TO.
- Rollen voor verplichte 2FA zijn als voorlopig beleid ingevuld. Fictieve demoaccounts zijn hiervan vrijgesteld; echte gebruikers in analist-/senior-/beheerrol niet. HTTPS en veilige secret-/sleutelopslag moeten bij echte hosting ingericht worden. Geen publieke deployment.
- Frontend heeft een functionerende navigatie binnen één React-app, niet alle deep-linkroutes uit het ontwerp. De schermcode is voor de snelle demo nog grotendeels in App.tsx; verder componentiseren vóór een definitieve merge. TypeScript strict mode is niet ingeschakeld.

## Validatie en beperkingen van de oplevering

- TypeScript-bron syntactisch gecontroleerd en gecontroleerd met de beschikbare compiler en een tijdelijke minimale typeshim voor ontbrekende React-packages. Dit is geen echte `npm run build` met de echte package-types.
- .NET 10 SDK, SQL Server, Docker en internet voor package restore ontbreken in de maakomgeving. Daarom is geen `dotnet build`, EF-runtime, Docker-start, end-to-end test of visuele browsertest bevestigd. De code kan nog compileer- of runtimefouten bevatten. De smoketest is meegeleverd om de runtime te controleren op de eigen machine.
- Geen GitHub-write, commit, push, PR of merge uitgevoerd.

## Aanvulling — presentatie- en integratieversie

De branch-HEADs zijn opnieuw op 25 november gecontroleerd (inclusief main). PR #7 is open. De originele AlertStatus-, TicketStatus-, PriorityLevel- en SlaStatus-enums, OrganizationDtos en authErrors zijn meegenomen; PageHeader/PageStates zijn functioneel overgenomen met aangepaste opmaak. Het loginformulier, UI-primitieven, domeinhelpers, entiteiten en request-DTO zijn uit de grote bestanden gehaald. De resterende schermlogica en SocService zijn nog niet volledig per feature gesplitst. De branchvergelijkingsscript haalt de oorspronkelijke volledige broncode lokaal op zonder remote writes. De statische TypeScript-controle met tijdelijke typeshim, `bash -n` en `node --check` zijn geslaagd; runtime niet uitgevoerd. De eerdere lijst met inhoudelijke beperkingen blijft gelden.
