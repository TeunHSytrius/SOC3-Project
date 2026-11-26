import type {State, Alert, ResearchCase} from '../../types/soc';
import {Icon,Badge,Button,Field,Select,Table,Panel,PageHeader} from '../../components/Ui';
import {labels,priorities,states,caseStates,active,isClosed,fmt,sla,caseMatchesView,sortRecords,nextCaseStates,roles} from '../../types/domain';
type Navigate = (page:string, selected?:string|null)=>void;
type UpdateState = (update:Partial<State>)=>void;
type RunAction = (path:string,data:Record<string,unknown>,message:string,after?:(result:any)=>void)=>Promise<void>;
interface QueueFiltersProps { type:'alerts'|'cases'; state:State; canReadInternal:boolean; isAnalyst:boolean; update:UpdateState; }

export default function QueueFilters({type,state,canReadInternal,isAnalyst,update}:QueueFiltersProps){
   const s=state;
   const isAlerts=type==='alerts';
   const items=(isAlerts?s.alerts:s.cases).filter(item=>!s.org||item.organizationId===s.org);
   const visibleStatuses=isAlerts?
     states.filter(status=>s.archiveFilter==='all'||(s.archiveFilter==='open'?['New','PendingReview','UnderReview'].includes(status):s.archiveFilter==='linked'?status==='Escalated':['Dismissed','Resolved'].includes(status))):
     caseStates.filter(status=>caseMatchesView({status} as ResearchCase,s.archiveFilter));
   const alerts=s.alerts.filter(alert=>!s.org||alert.organizationId===s.org);
   const categories=[...new Set(alerts.map(alert=>alert.security?.category||'Niet geclassificeerd'))].sort();
   const sources=[...new Set(alerts.map(alert=>alert.source))].sort();
   const owners=[...new Set(items.map(item=>item.owner).filter(Boolean))].sort();
   const advancedActive=!!(s.filter||s.ownerFilter||s.slaFilter||s.category||s.sourceFilter||s.fromDate||s.toDate);
   return <div className="queue-filters compact-filters">
     <div className="compact-filter-main">
       <Field label="Zoeken"><input placeholder={isAlerts?'Alertnummer, titel, IP of hostname':'Ticketnummer, titel, notitie of observable'} value={s.search} onChange={e=>update({search:e.target.value})}/></Field>
       <Field label="Prioriteit"><Select options={priorities} value={s.priority} placeholder="Alle prioriteiten" onChange={e=>update({priority:e.target.value})}/></Field>
       <Field label="Sorteren"><Select options={[{id:'default',name:isAlerts&&s.archiveFilter==='open'?'Oudste eerst (FIFO)':s.archiveFilter==='closed'&&!isAlerts?'Laatst afgesloten eerst':'Nieuwste eerst'},{id:'oldest',name:'Oudste aangemaakt eerst'},{id:'newest',name:'Nieuwste aangemaakt eerst'},{id:'priority',name:'Hoogste prioriteit eerst'}]} value={s.listSort} onChange={e=>update({listSort:e.target.value as State['listSort']})}/></Field>
       <Button onClick={()=>update({search:'',filter:'',priority:'',category:'',fromDate:'',toDate:'',mine:false,listSort:'default',ownerFilter:'',slaFilter:'',sourceFilter:''})}>Filters wissen</Button>
     </div>
     {isAnalyst&&<label className="check"><input type="checkbox" checked={s.mine} onChange={e=>update({mine:e.target.checked})}/> Alleen mijn {isAlerts?'alerts':'tickets'}</label>}
     <details className="advanced-filters" key={type}>
       <summary>Meer filters{advancedActive?' (actief)':''}</summary>
       <div className="queue-filter-grid">
         <Field label="Klantorganisatie"><Select options={s.orgs.map(o=>({id:o.id,name:o.name+(o.isActive?'':' (inactief)')}))} value={s.org} placeholder="Alle klanten" onChange={e=>update({org:e.target.value,ownerFilter:'',sourceFilter:'',category:''})}/></Field>
         <Field label="Status"><Select options={visibleStatuses} value={s.filter} placeholder="Alle statussen in deze selectie" onChange={e=>update({filter:e.target.value})}/></Field>
         {canReadInternal&&<Field label="Eigenaar"><Select options={[{id:'unassigned',name:'Niet toegewezen'},...owners.map(owner=>({id:owner,name:owner}))]} value={s.ownerFilter} placeholder="Alle eigenaren" onChange={e=>update({ownerFilter:e.target.value})}/></Field>}
         {isAlerts&&<>
           <Field label="SLA"><Select options={[{id:'neutral',name:'Nog niet behandeld'},{id:'warn',name:'Bijna overschreden'},{id:'danger',name:'Overschreden'},{id:'good',name:'Binnen SLA'}]} value={s.slaFilter} placeholder="Alle SLA-statussen" onChange={e=>update({slaFilter:e.target.value})}/></Field>
           <Field label="Categorie"><Select options={categories} value={s.category} placeholder="Alle categorieën" onChange={e=>update({category:e.target.value})}/></Field>
           <Field label="Securitytool"><Select options={sources} value={s.sourceFilter} placeholder="Alle bronnen" onChange={e=>update({sourceFilter:e.target.value})}/></Field>
         </>}
         <Field label="Aangemaakt vanaf"><input type="date" value={s.fromDate} onChange={e=>update({fromDate:e.target.value})}/></Field>
         <Field label="Aangemaakt t/m"><input type="date" value={s.toDate} onChange={e=>update({toDate:e.target.value})}/></Field>
       </div>
     </details>
   </div>;
 }

