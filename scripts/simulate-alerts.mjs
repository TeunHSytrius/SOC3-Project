// Generates fictitious security alerts. No network scanning or real detections.
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

const baseUrl = process.env.SOC_URL || 'http://localhost:8081';
const apiKey = process.env.SOC_SIM_KEY;
const interval = 30_000;
if (!apiKey) {
  console.error('Stel SOC_SIM_KEY in met een API-sleutel uit Klantenbeheer / API-sleutels.');
  process.exit(1);
}

const examples = [
  { title: 'Meerdere mislukte aanmeldingen', severity: 'High', category: 'Authenticatie', rule: 'AUTH-001', host: 'DEMO-DC01', user: 'demo.user', description: 'Een reeks mislukte inlogpogingen is door de fictieve bron gedetecteerd.' },
  { title: 'Verdacht bestand geblokkeerd', severity: 'Urgent', category: 'Malware', rule: 'EDR-002', host: 'DEMO-WS014', user: 'demo.employee', description: 'De fictieve endpointbeveiliging heeft een bestand in quarantaine geplaatst.' },
  { title: 'Ongebruikelijke uitgaande verbinding', severity: 'High', category: 'Netwerk', rule: 'NET-003', host: 'DEMO-APP02', user: 'demo.service', description: 'Een verbinding wijkt af van het fictieve normale netwerkprofiel.' },
  { title: 'Verdachte e-mail gemeld', severity: 'Moderate', category: 'Phishing', rule: 'MAIL-004', host: 'DEMO-MAIL01', user: 'demo.employee', description: 'Een fictieve gebruiker heeft een verdachte e-mail gemeld.' },
  { title: 'Onverwachte wijziging van toegangsrechten', severity: 'Immediate', category: 'Toegangsbeheer', rule: 'IAM-005', host: 'DEMO-DC02', user: 'demo.admin', description: 'De fictieve bron meldt een onverwachte wijziging van een groepslidmaatschap.' },
  { title: 'Afwijkend proces op werkstation', severity: 'High', category: 'Endpoint', rule: 'EDR-006', host: 'DEMO-WS021', user: 'demo.user', description: 'De fictieve endpointbron heeft een afwijkend proces geregistreerd.' }
];

console.log('Simulator: wacht op de lokale SOC-API...');
let ready = false;
for (let attempt = 0; attempt < 90; attempt++) {
  try {
    const response = await fetch(baseUrl + '/api/v1/health', { signal: AbortSignal.timeout(3000) });
    if (response.ok) { ready = true; break; }
  } catch { /* API is still starting */ }
  await sleep(2000);
}
if (!ready) {
  console.error('SOC-API is niet bereikbaar.');
  process.exit(1);
}

console.log('Simulator gestart. Iedere 30 seconden een fictieve alert. Stop met Ctrl+C.');
let index = 0;
while (true) {
  const sample = examples[index++ % examples.length];
  const alert = {
    externalEventId: 'sim-' + randomUUID(),
    title: sample.title,
    occurredAt: new Date().toISOString(),
    severity: sample.severity,
    payload: {
      simulated: true,
      category: sample.category,
      description: sample.description,
      detectionRule: sample.rule,
      sourceIp: '192.0.2.' + (10 + index % 200),
      destinationIp: '198.51.100.' + (10 + index % 200),
      hostname: sample.host,
      username: sample.user
    }
  };
  try {
    const response = await fetch(baseUrl + '/api/v1/ingest/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify(alert),
      signal: AbortSignal.timeout(10000)
    });
    if (response.status === 401 || response.status === 403) {
      console.error('API-sleutel ongeldig, ingetrokken of klant inactief. Simulator stopt.');
      process.exit(1);
    }
    if (!response.ok) console.error('Aanlevering mislukt: HTTP ' + response.status);
    else console.log(new Date().toLocaleTimeString('nl-NL'), 'HTTP', response.status, sample.title);
  } catch (error) {
    console.error('Aanlevering mislukt:', error.message);
  }
  await sleep(interval);
}
