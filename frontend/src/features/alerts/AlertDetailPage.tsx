import type {State, Alert, ResearchCase} from '../../types/soc';
import {Icon,Badge,Button,Field,Select,Table,Panel,PageHeader} from '../../components/Ui';
import {labels,priorities,states,caseStates,active,isClosed,fmt,sla,caseMatchesView,sortRecords,nextCaseStates,roles} from '../../types/domain';
import {priorityColor} from './AlertCards';
import {AlertSecurityDetails} from './SecurityDetails';
type Navigate = (page:string, selected?:string|null)=>void;
type UpdateState = (update:Partial<State>)=>void;
type RunAction = (path:string,data:Record<string,unknown>,message:string,after?:(result:any)=>void)=>Promise<void>;
interface AlertDetailProps {alert:Alert; state:Pick<State,'user'|'busy'>; isAdmin:boolean; isAnalyst:boolean; customerName:(id:string)=>string; navigate:Navigate; run:RunAction; update:UpdateState;}
function prettyJson(raw:string){try{return JSON.stringify(JSON.parse(raw),null,2)}catch{return raw;}}
function formData(event:React.FormEvent<HTMLFormElement>){event.preventDefault();return Object.fromEntries(new FormData(event.currentTarget));}
import type React from 'react';

export default function AlertDetailPage({alert,state,isAdmin,isAnalyst,customerName,navigate,run,update}:AlertDetailProps){
   const senior=state.user.role==='Senior analist';
   const canTriage=isAnalyst&&active(alert)&&!!alert.owner&&(senior||alert.owner===state.user.name);
   return <div className="wire-screen">
     <PageHeader title="Alertdetails" sub={isAdmin?'Beheerder · alleen lezen':'Beoordelen van binnengekomen melding'}/>
     <button className="back" onClick={()=>navigate('alerts')}>← Alerts</button>
     <div className="wire-detail-grid">
       <Panel title="Alertgegevens">
         <div className="bodypad">
           <div className={'wire-banner '+priorityColor(alert.priority)}>
             <small>{customerName(alert.organizationId)} · {fmt(alert.createdAt)} · {sla(alert).text}</small>
             <h2>{alert.title}</h2>
           </div>
           <dl className="wire-data">
             <dt>Alert-ID</dt><dd>{alert.number}</dd>
             <dt>Bron</dt><dd>{alert.source}</dd>
             <dt>Status</dt><dd><Badge value={alert.status}/></dd>
             <dt>Prioriteit</dt><dd>{labels[alert.priority]}</dd>
             <dt>Ontvangen</dt><dd>{fmt(alert.createdAt)}</dd>
             <dt>Deadline</dt><dd>{fmt(alert.deadline)}</dd>
             <dt>Eerste behandeling</dt><dd>{fmt(alert.firstHandledAt)}</dd>
             <dt>Eigenaar</dt><dd>{alert.owner||'Niet toegewezen'}</dd>
           </dl>
           {!alert.security?.description&&<p>{alert.description}</p>}
           <AlertSecurityDetails alert={alert}/>
           <details><summary>{alert.security?.simulated?'Fictieve bron-JSON':'Originele JSON'}</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{prettyJson(alert.rawPayload)}</pre></details>
         </div>
       </Panel>
       <Panel title="Triage">
         <div className="bodypad">
           <p>Huidige uitkomst: {alert.triage||'Nog niet beoordeeld'}</p>
           {isAnalyst&&active(alert)&&!alert.owner&&<Button primary disabled={state.busy} onClick={()=>run(`alerts/${alert.id}/claim`,{},'Alert opgepakt.')}>Oppakken</Button>}
           {canTriage&&<form onSubmit={e=>run(`alerts/${alert.id}/triage`,formData(e),'Triage opgeslagen.')}>
             <Field label="Triage-uitkomst"><Select name="outcome" options={['False positive','Verwacht gedrag','Nader onderzoek','Bevestigd incident']} placeholder="Kies uitkomst" required/></Field>
             <Field label="Toelichting (verplicht)"><textarea name="reason" rows={5} required placeholder="Beschrijf waarom de alert wordt afgesloten of onderzocht."/></Field>
             <Button type="submit" primary disabled={state.busy}>Beoordeling opslaan</Button>
           </form>}
           {isAnalyst&&active(alert)&&alert.owner&&!canTriage&&<p>Deze alert is toegewezen aan een andere analist.</p>}
           <div className="actions wire-next">
             {canTriage&&['Nader onderzoek','Bevestigd incident','True positive','Onbeslist'].includes(alert.triage)&&<Button onClick={()=>update({modal:'caseFromAlert'})}>Case maken / koppelen</Button>}
             {alert.caseId&&<Button onClick={()=>navigate('cases',alert.caseId)}>Open gekoppelde case</Button>}
             {senior&&['Dismissed','Resolved'].includes(alert.status)&&!alert.caseId&&<Button onClick={()=>update({modal:'reopen'})}>Heropenen</Button>}
           </div>
         </div>
       </Panel>
     </div>
     <div className="detailgrid">
       <Panel title="Statusgeschiedenis"><div className="timeline">{alert.history.slice().reverse().map((h,i)=><div key={i}><span className="timeline-dot"/><strong>{h.text}</strong><small>{h.actor} · {fmt(h.at)}</small></div>)}</div></Panel>
     </div>
   </div>;
 }

