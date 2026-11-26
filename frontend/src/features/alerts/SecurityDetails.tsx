import type {Alert} from '../../types/soc';
import {Panel,Badge} from '../../components/Ui';
import {fmt} from '../../types/domain';

export function AlertSecurityDetails({alert}:{alert:Alert}){
  const info=alert.security;
  return <Panel title="Securityinformatie" sub="Gegevens uit de aangeleverde melding">
    <div className="bodypad">
      {info?.simulated&&<p><Badge value="Simulatie" kind="neutral"/> Fictieve securitymelding</p>}
      <dl>
        <dt>Categorie</dt><dd>{info?.category||'Niet aangeleverd'}</dd>
        <dt>Bron-IP</dt><dd>{info?.sourceIp||'—'}</dd>
        <dt>Doel-IP</dt><dd>{info?.destinationIp||'—'}</dd>
        <dt>Hostname</dt><dd>{info?.hostname||'—'}</dd>
        <dt>Gebruiker</dt><dd>{info?.username||'—'}</dd>
        <dt>Detectieregel</dt><dd>{info?.detectionRule||'—'}</dd>
        <dt>Extern event-ID</dt><dd>{alert.externalEventId||'—'}</dd>
        <dt>Gebeurtenistijd</dt><dd>{fmt(alert.occurredAt)}</dd>
      </dl>
      {alert.normalizedPayload&&<details>
        <summary>OCSF-basismapping (JSON)</summary>
        <pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{formatJson(alert.normalizedPayload)}</pre>
      </details>}
    </div>
  </Panel>;
}

function formatJson(raw:string){
  try{return JSON.stringify(JSON.parse(raw),null,2);}
  catch{return raw;}
}

export function SecurityOverview({alerts}:{alerts:Alert[]}){
  const categories=new Map<string,number>();
  const hosts=new Set<string>();
  for(const alert of alerts){
    const category=alert.security?.category||'Niet geclassificeerd';
    categories.set(category,(categories.get(category)||0)+1);
    if(alert.security?.hostname)hosts.add(alert.organizationId+':'+alert.security.hostname);
  }
  const sorted=[...categories].sort((a,b)=>b[1]-a[1]);
  return <Panel title="Dreigingen per categorie" sub={hosts.size+' betrokken systemen in de geselecteerde meldingen'}>
    <div className="bars">
      {sorted.map(([category,count])=><div className="barrow" key={category}>
        <span>{category}</span>
        <div className="track"><div className="bar High" style={{width:(count/Math.max(alerts.length,1)*100)+'%'}}/></div>
        <b>{count}</b>
      </div>)}
      {!sorted.length&&<p>Geen openstaande meldingen.</p>}
    </div>
  </Panel>;
}
