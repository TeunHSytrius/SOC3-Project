import {useState} from 'react';
import {Badge,Button,PageHeader,Panel,Table} from '../../components/Ui';
import {fmt} from '../../types/domain';
import type {ApiErrorEntry} from '../../types/soc';

export default function ErrorLog({errors,reload}:{errors:ApiErrorEntry[];reload:()=>void}){
  const [query,setQuery]=useState('');
  const [status,setStatus]=useState('');
  const filtered=errors.filter(e=>(!status||String(e.status).startsWith(status))&&
    [e.traceId,e.route,e.reason,e.exceptionType,e.status].some(v=>String(v||'').toLowerCase().includes(query.toLowerCase())));
  return <>
    <PageHeader title="Foutenlog" sub="Technische API-fouten en geweigerde verzoeken." action={<Button onClick={reload}>Vernieuwen</Button>}/>
    <div className="bodypad"><p>De laatste 500 fouten sinds het starten van de backend. Dit is een technisch overzicht, geen auditlog of overzicht van security-alerts. Klantinhoud, wachtwoorden en sleutels worden hier niet getoond.</p></div>
    <Panel title="Recente fouten" sub={filtered.length+' resultaten'}>
      <div className="filters">
        <input aria-label="Zoek fout" placeholder="Zoek foutreferentie, route of reden" value={query} onChange={e=>setQuery(e.target.value)}/>
        <select aria-label="HTTP-status" value={status} onChange={e=>setStatus(e.target.value)}>
          <option value="">Alle fouten</option><option value="4">4xx – verzoeken</option><option value="5">5xx – serverfouten</option>
        </select>
      </div>
      <Table head={['Tijd','HTTP','Route','Reden','Exception','Foutreferentie']} empty={!filtered.length}>
        {filtered.map((e,i)=><tr key={e.traceId+'-'+i}>
          <td>{fmt(e.at)}</td><td><Badge value={String(e.status)} kind={e.status>=500?'danger':'warn'}/></td>
          <td>{e.method} {e.route}</td><td>{e.reason}</td><td>{e.exceptionType||'—'}</td><td><code>{e.traceId}</code></td>
        </tr>)}
      </Table>
    </Panel>
  </>;
}
