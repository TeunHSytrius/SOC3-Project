import type {Alert} from '../../types/soc';
import {Panel,Badge} from '../../components/Ui';
import {fmt} from '../../types/domain';

export function AlertSecurityDetails({alert}:{alert:Alert}){
  const info=alert.security;
  return <Panel title="Securityinformatie" sub="Detectiecontext, betrokken systemen en brongegevens">
    <div className="bodypad">
      {info?.simulated&&<p className="security-demo"><Badge value="Simulatie" kind="neutral"/> Fictieve gegevens voor onderzoeksoefening</p>}
      {info?.description&&<p className="security-description">{info.description}</p>}
      {!info?.category&&!info?.sourceIp&&!info?.hostname&&<p className="security-description">De bron heeft onvoldoende gestructureerde context aangeleverd. Bekijk de originele JSON en vraag indien nodig aanvullende logs op.</p>}
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
      {info?.evidence&&<section className="security-section"><h3>Detectiegegevens / bewijs uit de bron</h3><p>{info.evidence}</p></section>}
      {info?.simulated&&info.investigation&&<section className="security-section"><h3>Onderzoeksaandachtspunten</h3><p>{info.investigation}</p><small>Onderzoekshulp voor de fictieve melding, geen automatische triage-uitkomst.</small></section>}
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
