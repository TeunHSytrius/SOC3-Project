# Installatie en probleemoplossing

[Terug naar README](../README.md)

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
git pull --ff-only origin main
docker compose up --build --wait --wait-timeout 360
```

Het commando bouwt de frontend en backend, wacht op de SQL Server-healthcheck en controleert daarna de API. Bij een succesvolle start staan app en sqlserver op healthy. Open [http://localhost:8081](http://localhost:8081). Log in met een groepsaccount bovenaan deze README en het initiële wachtwoord `Demo2026!`.

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

