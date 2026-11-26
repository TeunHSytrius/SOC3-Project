# Installatie en probleemoplossing

[Terug naar README](../README.md)

## 0. Lokale installatie om te programmeren

Wil je zelf programmeren? Installeer ook de lokale SDK en packages, zelfs als je de applicatie via Docker start. Docker installeert dependencies in containers, niet in je lokale IDE.

1. Installeer [Git](https://git-scm.com/downloads), [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0) (niet alleen de runtime), [Node.js 24 LTS](https://nodejs.org/) inclusief npm en een recente IDE met .NET 10- en `.slnx`-ondersteuning, bijvoorbeeld Rider of Visual Studio. Voor VS Code: gebruik C# Dev Kit.
2. Clone de repository en open `SOC3.slnx` in Rider/Visual Studio (in VS Code: open de hoofdmap).

```bash
git clone https://github.com/TeunHSytrius/SOC3-Project.git
cd SOC3-Project
git switch develop
```

3. Installeer de backend- en frontenddependencies lokaal. Voer dit uit vanuit de hoofdmap:

```bash
dotnet restore SOC3.slnx
dotnet build SOC3.slnx --no-restore
cd frontend
npm ci
npm run build
cd ..
```

Na `dotnet restore` zijn de NuGet-packages beschikbaar voor C#. Na `npm ci` bevat `frontend/node_modules` de React-, TypeScript- en overige frontendpackages. Beide buildcommando's moeten slagen. Je hebt hiervoor geen draaiende SQL Server nodig. Wacht tot de IDE klaar is met indexeren. Ontbrekende referenties en imports horen nu opgelost te zijn, tenzij er een echte code-, SDK- of IDE-fout is.

Controleer bij problemen `dotnet --list-sdks`, `node --version` en `npm --version` in de IDE-terminal. Herhaal restore/install wanneer dependencies wijzigen. Gebruik `npm ci` om de vastgelegde dependencyversies te installeren. De databaseverbinding en het daadwerkelijk opstarten zijn aparte stappen hieronder. Gebruik Node 24 zoals vastgelegd in `frontend/.nvmrc`; wijzig de lockfile alleen bij bewuste dependencywijzigingen en commit deze samen met `package.json`.

## 1. Installatie — Windows, macOS en Linux

### 1.1 Wat heb je nodig?

- Toegang tot de private GitHub-repository SOC3-Project.
- [Git](https://git-scm.com/downloads) en [Docker Desktop](https://www.docker.com/products/docker-desktop/) op Windows/macOS. Op Linux kan ook Docker Engine met de Compose v2-plugin.
- Internet om de images en dependencies op te halen.
- Bij voorkeur 16 GB RAM, met circa 6–8 GB beschikbaar voor Docker, en voldoende vrije schijfruimte (richtwaarde 15 GB).
- Voor de gewone demo hoef je geen Node.js, .NET SDK, SQL Server of DataGrip apart te installeren.

| Laptop | Route |
| --- | --- |
| Windows Intel/AMD | Docker Desktop met WSL 2 en Linux-containers |
| Mac Intel | Docker Desktop voor Intel |
| Mac Apple Silicon (M1 en nieuwer) | Docker Desktop voor Apple Silicon, amd64-emulatie voor SQL Server |
| Windows ARM/Snapdragon of Linux ARM | Probeer amd64-emulatie; gebruik anders de externe SQL-route hieronder |
| Linux Intel/AMD | Docker Engine + Compose v2 of Docker Desktop |

Windows: schakel hardwarevirtualisatie in indien nodig, gebruik WSL 2 en start Docker Desktop. Controleer met `wsl --status` in PowerShell. Gebruik Linux-containers, geen Windows-containers. Op Mac: installeer de juiste Docker Desktop-versie; op Apple Silicon kan Rosetta-emulatie helpen als de optie beschikbaar is. Microsoft ondersteunt SQL Server Linux-containers officieel uitsluitend op x86-64; Rosetta/QEMU/Prism-emulatie is niet ondersteund. Zie [Microsoft-documentatie](https://learn.microsoft.com/en-us/sql/linux/containers/deploy?view=sql-server-ver16). Er is daarom geen garantie dat SQL Server lokaal op iedere ARM-laptop draait.

### 1.2 Eerste keer starten

Open Docker Desktop en wacht tot de engine actief is. Open PowerShell, Terminal of een Linux-shell:

```bash
git --version
docker version
docker compose version
git clone https://github.com/TeunHSytrius/SOC3-Project.git
cd SOC3-Project
docker compose up --build --wait --wait-timeout 360
```

Gebruik bij een bestaande kopie vanuit de hoofdmap:

```bash
git status
git switch develop
git pull --ff-only origin develop
docker compose up --build --wait --wait-timeout 360
```

Het commando bouwt de frontend en backend, wacht op de SQL Server-healthcheck en controleert daarna de API. Bij een succesvolle start staan app en sqlserver op healthy. Open [http://localhost:8081](http://localhost:8081). Log in met een groepsaccount uit de [README](../README.md) en het initiële wachtwoord `Demo2026!`.

```bash
docker compose ps
```

Healthcheck in de browser: [http://localhost:8081/api/v1/health](http://localhost:8081/api/v1/health). Verwacht `{"status":"ok"}`. In Windows PowerShell kan ook `curl.exe http://localhost:8081/api/v1/health`; in macOS/Linux `curl -fsS http://localhost:8081/api/v1/health`.

### 1.3 Problemen oplossen

Voer eerst vanuit de hoofdmap uit (op alle platforms):

```bash
docker compose ps -a
docker compose logs --tail=100 app sqlserver
```

Als de build faalt: `docker compose --progress plain build`. Deel de foutmelding vanaf de eerste echte error, plus je besturingssysteem en processor. Deel geen wachtwoorden of API-sleutels.

| Probleem | Wat te doen |
| --- | --- |
| git clone geeft 403/404 | Controleer of je toegang tot de private repo hebt en of Git is ingelogd. |
| Docker daemon niet bereikbaar | Start Docker Desktop en controleer docker version. |
| compose onbekend | Installeer/actualiseer Compose v2; gebruik docker compose met spatie. |
| Windows-containerimage fout | Schakel naar Linux-containers. |
| Exited 137 / out of memory | Geef Docker meer geheugen of sluit zware programma's. |
| SQL Server unhealthy | Controleer sqlserver-logs, processor, geheugen en wachtwoord van het bestaande volume. |
| Exec format error / emulatiecrash | Controleer ARM-emulatie; gebruik de externe SQL-route indien nodig. |
| Port already allocated | Wijzig alleen de conflicterende hostpoort in .env (zie 1.4). |
| npm- of C#-buildfout | Deel de buildlog; dit is mogelijk een code-/dependencyprobleem en niet je laptop. |
| Init mislukt / onvolledige demo | Deel de app-logs. Wis geen database om de fout te verbergen. |
| Website niet bereikbaar | Wacht op healthy, controleer de gekozen poort en gebruik localhost. |
| Smoketest health: HTTP 400 | De interne Compose-hostnaam app moet in AllowedHosts staan. Dit is ingesteld in compose.yaml; haal de nieuwste versie op en bouw opnieuw. |

Normaal stoppen: `docker compose down`. Het databasevolume en de 2FA-sleutels blijven behouden. Gebruik **geen** `docker compose down -v`: daarmee verwijder je de opgeslagen data.

### 1.4 Andere poorten gebruiken (alleen bij conflict)

Maak in de hoofdmap een bestand .env op basis van .env.example. Bijvoorbeeld:

```dotenv
SOC_APP_PORT=8082
SOC_SQL_PORT=14334
```

Start opnieuw met `docker compose up --build --wait --wait-timeout 360`. Open dan http://localhost:8082 en gebruik DataGrip-poort 14334. Pas ook het Vite API-target en eventuele handmatige API-verzoeken aan als je een andere app-poort gebruikt. De interne containerpoorten blijven 8080 en 1433. Wijzig SOC_SQL_PASSWORD niet bij een bestaand SQL-volume zonder het SQL-wachtwoord zelf te wijzigen.

### 1.5 Alternatief wanneer SQL Server niet lokaal draait

Gebruik bij voorkeur een groepslaptop met Intel/AMD waarop Docker werkt, of een beschikbare x86-64-VM. Er zijn twee mogelijkheden:

**A. Alleen de demo bekijken:** draai de volledige applicatie op die machine en gebruik de browser daar, een schermdeling of een beveiligde SSH-tunnel (alleen als een SSH-server en toegang al zijn geregeld):

```bash
ssh -N -L 8081:127.0.0.1:8081 gebruiker@adres-van-demo-host
```

Open op je eigen laptop http://localhost:8081. Deel de demo niet via een publiek geopende HTTP-poort.

**B. Zelf de app lokaal draaien met externe SQL Server:** de repository bevat compose.external.yaml. Regel eerst met de groep een bereikbare SQL Server 2022 op x86-64, een eigen lege demodatabase en een account met rechten om daarin tabellen/schema's aan te maken. Gebruik nooit de productiedatabase of een database die een andere onafhankelijke demo gebruikt. Configureer in je lokale .env de echte connectiestring, bijvoorbeeld (vervang alle voorbeeldwaarden):

```dotenv
SOC_EXTERNAL_SQL_CONNECTION=Server=sql-demo.example,1433;Database=Soc3DevHamza;User Id=socdev;Password=VUL_EIGEN_WACHTWOORD_IN;Encrypt=True;TrustServerCertificate=False
```

Gebruik een geldig vertrouwd SQL-certificaat. Bij een beveiligde tunnel naar een lokale poort kan de servernaam host.docker.internal zijn; stem de TLS-configuratie af met de beheerder. Start vervolgens:

```bash
docker compose stop app
docker compose -f compose.external.yaml up --build --wait --wait-timeout 360
```

Hierbij wordt alleen de app lokaal gebouwd (native architectuur); er start geen lokale SQL Server-container. De backend initialiseert de eigen demodatabase. Stop met `docker compose -f compose.external.yaml down`. Er is geen externe host voor jullie ingericht: deze route vereist een beschikbare SQL Server of VM. Geen SQLite-fallback; de SQL Server-architectuur blijft behouden.

### 1.6 DataGrip (optioneel)

| Instelling | Standaardwaarde |
| --- | --- |
| Type | Microsoft SQL Server |
| Host | 127.0.0.1 |
| Port | 14333 (of SOC_SQL_PORT) |
| User | sa |
| Password | SocDemo!2026Local (of bestaande SOC_SQL_PASSWORD) |
| Database | Soc3Demo |
| Encrypt | true |
| Trust server certificate | true, uitsluitend voor lokale demo |

De backend maakt de demo-database en de benodigde schema's automatisch aan. Download de JDBC-driver en klik Test Connection. Selecteer `platform`, `domain` en de bestaande `tenant_...`-schema's in het schema-overzicht. Het zijn schema's binnen één database, geen afzonderlijke databases.

```sql
SELECT Id, Name, SchemaName, IsActive, ResponseMinutes
FROM platform.Tenants;
```

### 1.7 Test zonder Node.js op je laptop

```bash
docker compose --profile test run --rm smoke
```

Deze test gebruikt de Node-container en maakt fictieve testrecords aan. Gebruik de standaard generieke testaccounts; activeer daarop geen 2FA. GitHub Actions bevat daarnaast een automatische Docker-build en smoketest op een schone x86-64-runner. Controleer [Actions](https://github.com/TeunHSytrius/SOC3-Project/actions) voor het werkelijke resultaat; een workflowbestand betekent niet dat de build is geslaagd.


## 2. Ontwikkelen zonder Docker

De backend en frontend kunnen rechtstreeks op je laptop draaien. Je hebt dan wel een bereikbare Microsoft SQL Server nodig. Docker is niet vereist voor de applicatie en er is geen SQLite-fallback.

### 2.1 Benodigdheden

- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0).
- [Node.js](https://nodejs.org/) 24 LTS (aanbevolen).
- [Git](https://git-scm.com/downloads).
- Microsoft SQL Server 2022 Developer voor lokale ontwikkeling, of een bestaande bereikbare SQL Server.
- Optioneel: [DataGrip](https://www.jetbrains.com/datagrip/) of [SQL Server Management Studio (SSMS)](https://learn.microsoft.com/en-us/ssms/install/install).

Windows x64: installeer SQL Server Developer, activeer indien nodig TCP/IP en configureer de gekozen authenticatie. Linux x64: gebruik een ondersteunde Linux-distributie voor SQL Server. macOS en ARM: de .NET- en Node-applicatie kunnen lokaal draaien, maar SQL Server 2022 heeft geen native macOS/ARM-serverversie. Gebruik een bereikbare SQL Server op een ondersteunde x64-host, bijvoorbeeld een eigen database op een afgesproken groepsserver. SSMS is een Windows-client; DataGrip kan op macOS, Windows en Linux worden gebruikt. DataGrip en SSMS installeren op zichzelf geen databaseserver.

### 2.2 Database instellen

Maak op de gekozen SQL Server een eigen lege ontwikkel-database aan, bijvoorbeeld `Soc3DevTeun`, en regel een account met voldoende rechten voor schema- en tabelinitialisatie in uitsluitend die database. Gebruik geen productiegegevens of gezamenlijke database zonder overleg. Controleer host, poort (vaak 1433), authenticatie en certificaat.

Voer vanuit de hoofdmap één van de onderstaande opdrachten uit. Vervang alle voorbeeldwaarden; bewaar geen echt wachtwoord in de repository.

**SQL-authenticatie, lokale testserver:**

```bash
dotnet user-secrets set "ConnectionStrings:Soc" "Server=127.0.0.1,1433;Database=Soc3DevTeun;User Id=socdev;Password=VUL_EIGEN_WACHTWOORD_IN;Encrypt=True;TrustServerCertificate=True" --project backend/Soc.Api/Soc.Api.csproj
```

**Windows-authenticatie, lokale SQL Server (alleen wanneer je Windows-account toegang heeft):**

```powershell
dotnet user-secrets set "ConnectionStrings:Soc" "Server=localhost;Database=Soc3DevTeun;Integrated Security=True;Encrypt=True;TrustServerCertificate=True" --project backend/Soc.Api/Soc.Api.csproj
```

Bij een externe SQL Server gebruik je de werkelijke host en poort en een geldig vertrouwd certificaat: `Encrypt=True;TrustServerCertificate=False`. Gebruik een beveiligd netwerk of VPN en open de SQL-poort niet publiek. User Secrets worden per gebruiker buiten Git opgeslagen; ze zijn bedoeld voor ontwikkeling en niet versleuteld. Deel de uitvoer van `dotnet user-secrets list` niet.

Je kunt ook de omgevingsvariabele `ConnectionStrings__Soc` gebruiken. De naam van de connection string blijft in alle omgevingen gelijk.

### 2.3 Backend starten

Open terminal 1 vanuit de hoofdmap:

```bash
dotnet restore SOC3.slnx
dotnet run --project backend/Soc.Api/Soc.Api.csproj --launch-profile "Local Development"
```

Het ontwikkelprofiel start uitsluitend op localhost:8081 en zet `Demo__Enabled=true` voor de lokale initialisatie van de demo-database, schema's en accounts. De productiestandaard in appsettings.json blijft uitgeschakeld. De lokale sleutels voor Data Protection blijven in de standaard gebruikersopslag van ASP.NET Core; verwijder ze niet als je 2FA wilt behouden.

Controleer [http://localhost:8081/api/v1/health](http://localhost:8081/api/v1/health): verwacht HTTP 200 met status ok. Als de database niet bereikbaar is, controleer eerst de SQL Server-service, TCP/IP, poort, account, database en certificaat.

### 2.4 Frontend starten

Open terminal 2 vanuit de hoofdmap:

```bash
cd frontend
npm ci
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Vite proxyt /api naar http://127.0.0.1:8081. Bij een afwijkende API-poort wijzig je de lokale `VITE_API_TARGET` in frontend/.env.local. Houd backend en frontend gelijktijdig actief. Gebruik de lokale demoaccounts uit de README.

Stop beide processen met Ctrl+C. De SQL Server-data blijft behouden.

### 2.5 Database bekijken in DataGrip of SSMS

Maak een Microsoft SQL Server-verbinding met dezelfde server, poort, database en authenticatie als je backend:

| Instelling | Native SQL Server | Docker SQL Server |
| --- | --- | --- |
| Host | localhost of afgesproken SQL-host | 127.0.0.1 |
| Poort | doorgaans 1433; controleer werkelijke poort | 14333, tenzij aangepast |
| Database | eigen gekozen database, bijv. Soc3DevTeun | Soc3Demo |
| Authenticatie | eigen SQL-account of Windows-authenticatie | sa |
| Encrypt | true | true |
| Trust server certificate | uitsluitend true bij bewust gekozen lokale demo | true voor lokale demo |

In DataGrip: New Data Source > Microsoft SQL Server > vul gegevens in > Download Driver indien nodig > Test Connection. Selecteer de juiste database en de schema's platform, domain en tenant_... in het schema-overzicht.

In SSMS: Connect > Database Engine > servernaam (bij een afwijkende poort: host,poort) > authenticatie > Connect. Open Databases > gekozen database > Tables. SSMS is alleen voor Windows.

Controleer de database bijvoorbeeld met:

```sql
SELECT DB_NAME() AS CurrentDatabase;

SELECT TABLE_SCHEMA, TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_SCHEMA, TABLE_NAME;

SELECT Id, Name, SchemaName, IsActive
FROM platform.Tenants;
```

De huidige beheerfunctionaliteit gebruikt platform-tabellen. De oorspronkelijke domeinentiteiten zijn toegevoegd in domain; de operationele alertschermen bevatten nog voorbeeldgegevens. Zie de README voor de actuele Sprint 1-scope.

### 2.6 Testen zonder Docker

Voer de backendtests uit vanuit de hoofdmap:

```bash
dotnet test backend/Soc.Tests/Soc.Tests.csproj
cd frontend
npm run build
cd ..
```

Start de backend met het ontwikkelprofiel en voer vervolgens vanuit de hoofdmap uit:

```bash
node tests/smoke.mjs
```

De smoketest gebruikt standaard http://localhost:8081 en maakt fictieve records aan. Gebruik een aparte demodatabase. Activeer geen 2FA op de generieke smoke-testaccounts. De route zonder Docker gebruikt hetzelfde SQL Server-datamodel als de Docker-route; de huidige database-initialisatie is nog geen volledige EF Core-migratiestrategie.
