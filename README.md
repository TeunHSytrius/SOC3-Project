# SOC3 Management – presentatie-MVP en ontwikkelbasis

**Demonstratieversie voor 26 november 2026 in de afzonderlijke repository `SOC3-Project`.** De oorspronkelijke groepsrepository `soc3Managment` is ongewijzigd; dit is geen letterlijke merge van alle branches. Gebruik uitsluitend fictieve data. De runtime is nog niet gevalideerd met .NET en SQL Server.

## 1. Starten (Docker Desktop)

Vereisten: Docker Desktop met Compose en internet voor het ophalen van de images en NuGet/npm-packages. Open Docker Desktop, wacht tot Docker draait, en voer in een terminal uit:

```bash
git clone https://github.com/TeunHSytrius/SOC3-Project.git
cd SOC3-Project
docker compose up --build
```

Open daarna <http://localhost:8081>. Als je de repository al lokaal hebt, gebruik dan `git pull --ff-only` in de map `SOC3-Project` in plaats van opnieuw te clonen. De backend wacht op SQL Server en maakt de lege demonstratiedatabase, de drie klantschema's en fictieve gebruikers/meldingen aan. OpenAPI staat op <http://localhost:8081/openapi/v1.json>.

Controle:

```bash
curl http://localhost:8081/api/v1/health
```

Stop met Ctrl+C en daarna `docker compose down`. Data blijft behouden. **Alleen bij het resetten van deze lokale demonstratie**: `docker compose down -v` verwijdert de SQL-data en Data Protection-sleutels van deze Compose-map. Start daarna opnieuw. Gebruik dit nooit op productie of de projectdatabase.

### MacBook met Apple Silicon

SQL Server Linux-images zijn voor x86-64. Compose specificeert `linux/amd64`; op Apple Silicon is emulatie nodig en SQL Server kan alsnog niet betrouwbaar werken. Gebruik Docker Desktop met x86-64-emulatie, of bij problemen een echte SQL Server op een x64-machine/VM of een bestaande afzonderlijke testdatabase. Er is bewust geen SQLite/Python-fallback. Test dit vóór de presentatie.

## 2. Accounts

Wachtwoord voor de **fictieve demoaccounts**: `Demo2026!`.

| Account | Rol | Toegang |
| --- | --- | --- |
| analist@soc.demo | Analist | Dashboard, alerts en cases |
| senior@soc.demo | Senior analist | Zelfde plus heropenen |
| beheerder@soc.demo | Beheerder | Klanten, gebruikers, API-sleutels, auditlog |
| klant@soc.demo | Klant | Vrijgegeven cases van Northstar Finance |
| accountmanager@soc.demo | Accountmanager | Vrijgegeven cases van toegewezen klanten |

De demoaccounts mogen zonder vooraf ingestelde 2FA inloggen voor de presentatie. In Account kan 2FA echt worden geactiveerd met een authenticator-app. Voor andere gebruikers vereisen de analist-, senior- en beheerrol 2FA voordat klantdata toegankelijk is. De keuze welke rollen dit precies vereisen moet nog met de opdrachtgever worden gevalideerd. Demo draait alleen op loopback via HTTP; normale configuratie gebruikt Secure-cookies via HTTPS. Gebruik deze demo niet op een openbaar netwerk.

## 3. Presentatieroute (circa 5 minuten)

1. Log in als analist. Toon de dashboardcijfers, prioriteiten, de FIFO-wachtrij, klantfilter en SLA-risico.
2. Open een nieuwe alert. Klik **Oppakken**, leg een triage `True positive` met reden vast. Maak een case of koppel aan een bestaande case binnen dezelfde klant en scope.
3. Voeg een interne notitie, observable en uitgevoerde actie toe. Maak de actie klantzichtbaar en geef de case vrij. Laat de tijdlijn en gekoppelde alert zien.
4. Log uit. Log in als klant. Toon dat alleen vrijgegeven cases en klantzichtbare berichten worden getoond. Interne observables/notities ontbreken in de API-respons.
5. Log in als beheerder. Toon klantenbeheer, gebruikers/rollen, API-sleutels en de auditlog. Maak desgewenst een nieuwe klant aan; daarmee wordt automatisch een afzonderlijk SQL-schema ingericht.
6. Log weer in als analist. Sluit de case af met een verplichte conclusie. De gekoppelde alerts worden opgelost.

**Let op:** de SLA-waarden (48/24/8/4/1 uur naar prioriteit) zijn demonstratieafspraken, niet door de opdrachtgever bevestigde SLA's. De dashboardberekening gebruikt de eerste behandeling.

## 4. Echte API-aanlevering demonstreren

Maak als beheerder in API-sleutels een bron voor Northstar Finance. Kopieer de eenmalig getoonde sleutel. Gebruik in een terminal:

```bash
read -rs 'SOC_KEY?API-sleutel: ' # zsh, standaard op macOS
curl -X POST http://localhost:8081/api/v1/ingest/alerts \
  -H "X-API-Key: $SOC_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Testmelding uit securitytool","description":"Fictieve aanlevering tijdens de presentatie","priority":"High"}'
unset SOC_KEY
```

Vernieuw daarna het dashboard. De tenant en scope worden uit de geregistreerde bron bepaald, niet uit de aanvraag. Dit is een echte JSON-ingest, geen live integratie met Sentinel of Defender.

## 5. Zonder Docker voor de applicatie

Vereisten: .NET 10 SDK, Node 22.12+ (24 aanbevolen), een **afzonderlijke** beschikbare SQL Server met rechten om een testdatabase en schema's te maken. Geen echte projectdatabase gebruiken.

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

Tijdens ontwikkeling kun je in een tweede terminal `cd frontend && npm run dev` gebruiken. De Vite-proxy stuurt `/api` door naar poort 8080. Bij deze startmethode zonder Docker gebruik je `SOC_URL=http://localhost:8080` voor de smoketest; met Docker is de standaardpoort 8081. Voor de presentatie is de same-origin Docker-versie aanbevolen.

## 6. Tests

```bash
node tests/smoke.mjs
```

Het script maakt enkele fictieve records aan en controleert de complete API-keten, CSRF, tenantgrenzen, klantzichtbaarheid, audit en API-key-intrekking. Het vereist een actieve verse demo met ongewijzigde demo-inloggegevens en Node 22+. Het script is **niet tegen een draaiende .NET/SQL Server-runtime uitgevoerd in de maakomgeving**. Als de tests falen: gebruik `docker compose logs app sqlserver` en los dit op voordat je zegt dat de demo werkt.

## 7. Structuur

```text
SOC3.slnx
backend/
  Soc.Api/          Controllers, Identity, configuratie, HTTP-beveiliging
  Soc.Business/     Domein-/applicatieregels, DTO-invoer
  Soc.Data/         EF Core-entiteiten, centraal en tenantgebonden DbContext
frontend/
  src/              React / TypeScript dashboard, features en componenten
  src/services/     Same-origin API-client
  src/types/        Domeintypen
compose.yaml         SQL Server + applicatie
Dockerfile           Frontend-build + ASP.NET publicatie
tests/              Lokale smoketest
```

De lokale code is een integratie-uitwerking van gelezen branchcontracten en TO, geen letterlijke merge of kopie van de branches.

## 8. Verder ontwikkelen

- `bash scripts/compare-branches.sh`: haalt de originele branchsnapshots en patches read-only op in een nieuwe lokale map. Geen merges of pushes.
- `bash scripts/check-demo.sh`: wacht op de health-endpoint en draait de smoketest.
- De oorspronkelijke database-enums, het organisatie-DTO-contract, auth-foutteksten en aangepaste gedeelde UI-componenten zijn meegenomen. De broncode is geen letterlijke branchmerge.
- Valideer de .NET-build, SQL Server-integratie en tenantisolatie voordat je deze demonstratie als afgerond increment beschouwt.
