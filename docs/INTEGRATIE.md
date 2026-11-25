# Integratie en verder ontwikkelen

## Stand van GitHub op 25 november 2026

| Branch | HEAD | Rol in de integratie |
|---|---|---|
| main | 057a4dd | Stabiele scaffolding; bestaande conventies en structuur |
| develop | 9b03c4c | Gemeenschappelijke basis; login en foutteksten |
| feature/database | 4550bc7 | Alert/Ticket/Research-domein; originele enums hergebruikt, entiteiten aangepast aan TO schema-per-tenant |
| feature/tg-20-customer-management | 9c74841 | Organisatie-DTO en API-contract overgenomen; SQL-opslag i.p.v. in-memory |
| feature/tg-39-two-factor-auth | 5f82ebd | 2FA setup/enable contract als uitgangspunt; Identity vervangt losstaand in-memory model |
| feature/tg-us-31-frontend-navigatie | bb81c5a | PageHeader/PageStates-contracten hergebruikt met aangepaste opmaak; navigatie en klantcontext aangesloten op backend |

Open PR: #7 WIP homepage, RubenAbr, van feature/tg-us-31-frontend-navigatie naar develop. Dit is geen bewijs dat andere features gemerged zijn; controleer status live vóór de presentatie.

## Originele broncode veilig ophalen en vergelijken

Vanuit de uitgepakte ZIP, met internet en Git:

```bash
bash scripts/compare-branches.sh
```

Dit kloont in een nieuwe lokale map `branch-review`, blokkeert de normale push-URL in die clone en archiveert alle zes gelezen HEADs. Per branch ontstaan een snapshot van alle originele bestanden en een patch ten opzichte van de vastgelegde develop-HEAD. `refs.tsv` geeft zowel de gelezen als actuele HEAD. De ZIP zelf bevat niet alle originele branchbestanden: de maakomgeving kan geen GitHub-host resolven. Het script voert geen merge, commit of push uit. Bij een gewijzigde remote HEAD eerst de extra wijzigingen reviewen. Niet kopiëren over bestaande werkmappen.

## Beslispunten bij review

- Database: behoud TO-klantschema's, aparte centrale platformtabellen en ScopeId. Bespreek verschillen met de eigenaar van de databasebranch, inclusief int versus Guid en Ticket/Research versus ResearchCase. Niet blind beide modellen naast elkaar registreren.
- Klantenbeheer: behoud routes en DTO; valideer opnieuw de bestaande servicetests en deactivering tegen SQL Server. Geen tweede organisatie-entiteit of in-memory opslag in productie.
- 2FA: behoud setup-/enable-flow; pas de UI aan op Identity-accountcontext en CSRF. Review verificatie, herstelcodes en verplichte rollen met de eigenaar; geen tweede losstaande authenticatieprovider.
- Navigatie: behoud de componentafspraken en werk de bestaande AppShell/AppMenu-inrichting verder uit. De lokale MVP heeft gedeelde UI-componenten en login losgetrokken maar een deel van de featurelogica blijft in App.tsx. Bouw verder in de bestaande featuremappen.

## Voorgestelde werkvolgorde (nog niet toegewezen in Taiga)

| Prioriteit | Werkpakket | Controle / Definition of Done |
|---|---|---|
| P0 | Branchintegratie, SQL/EF-schema-POC | Build groen, twee schema's, modelcache gecontroleerd, tenant/scope-isolatie getest. |
| P0 | Identity, login, sessie, 2FA en CSRF | Onbevoegde requests geweigerd; 2FA/recovery/lockout getest; demo-vrijstelling niet in productie. |
| P0 | Ingest, alertwachtrij en triage | API-key binding, FIFO, statusovergang, gelijktijdig claimen en audit getest. |
| P1 | Caseworkflow en onderzoek | Koppelen binnen dezelfde scope, tijdlijn, afsluiting en klantzichtbaarheid getest. |
| P1 | Dashboard, navigatie en schermen | Functionele componenten, fout-/leeg-/laadstatus, toetsenbord en API-koppeling; FO-wireframes gecontroleerd. |
| P1 | Klanten-/gebruikersbeheer | Tenant lifecycle, scopebeheer, deactiveren, rollen en key-intrekking getest. |
| P2 | Productiehardening en resterende stories | Migraties, SQL least privilege, configurabele SLA, OCSF, bestanden en regressietests. |

Splits elk pakket in echte Taiga-tickets, wijs eigenaar toe in sprintplanning en maak PR's per onderwerp na teamreview. Gebruik bestaande README-conventies (feature/tg-nummer-omschrijving, Engelse commits, PR naar develop). Laat CI slagen, koppel bewijs aan de ticketacceptatiecriteria en laat een ander groepslid reviewen. Pas na expliciete toestemming van het team wijzigingen naar de gedeelde repository brengen.

## Validatiegrenzen

`docs/VERANTWOORDING.md` bevat de beperkingen van de oorspronkelijke lokale uitwerking; deze zijn niet opgelost door alleen code te herschikken. Er is geen werkende .NET/SQL-runtime in deze container. De daadwerkelijke branchsnapshots moeten nog lokaal worden opgehaald en de verschillen samen beoordeeld. Geen Taiga-tickets zijn gewijzigd, toegewezen of als voltooid gemarkeerd.
