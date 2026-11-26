import React from 'react';
import DashboardPage from './features/dashboard/DashboardPage';
import QueueFilters from './features/shared/QueueFilters';
import TicketTable from './features/cases/TicketTable';
import AlertDetailPage from './features/alerts/AlertDetailPage';
import CaseDetailPage from './features/cases/CaseDetailPage';
import TwoFactorSetup from './features/auth/TwoFactorSetup';
import {api,sessionKey} from './services/api';
import type {State, User, Alert, ResearchCase} from './types/soc';
import {labels,priorities,roles,states,caseStates,active,isClosed,fmt,sla,nextCaseStates,alertGroup,caseGroup,caseMatchesView,sortRecords} from './types/domain';
import {Icon,Badge,Button,Field,Select,Table,Panel,PageHeader} from './components/Ui';
import {LoadingState} from './components/PageStates';
import LoginPage from './features/auth/LoginPage';
import { AppShell } from './components/AppShell';
import './features/FeatureStyles.css';
import {AlertSecurityDetails} from './features/alerts/SecurityDetails';
import CaseWorkflow from './features/cases/CaseWorkflow';
import DashboardAlerts from './features/alerts/DashboardAlerts';
import AlertTrend from './features/alerts/AlertTrend';
import AlertNotifications from './features/alerts/AlertNotifications';
import {AlertCards,CaseCards,priorityColor} from './features/alerts/AlertCards';
import ErrorLog from './features/admin/ErrorLog';
import TicketRegister from './features/admin/TicketRegister';
function formData(e):Record<string,any>{e.preventDefault();return Object.fromEntries(new FormData(e.currentTarget));}
class App extends React.Component<Record<string, never>,State> {
 constructor(p){super(p);this.state={user:null,loading:true,page:'dashboard',archiveFilter:'open',listSort:'default',ownerFilter:'',slaFilter:'',sourceFilter:'',orgs:[],alerts:[],alertNotifications:[],cases:[],users:[],keys:[],audit:[],errors:[],ticketRegister:[],analysts:[],org:'',search:'',filter:'',priority:'',category:'',fromDate:'',toDate:'',mine:false,selected:null,modal:null,error:'',notice:'',busy:false,secret:null,setup:null};}
 private refreshTimer?:number;
 private refreshing=false;
 private refreshVersion=0;
 private knownAlertIds=new Set<string>();
 private alertsInitialized=false;
 private resetAlertNotifications(){this.knownAlertIds.clear();this.alertsInitialized=false;}
 private findNewAlerts(alerts:Alert[]):Alert[]{
   const newAlerts=this.alertsInitialized?alerts.filter(alert=>!this.knownAlertIds.has(alert.id)&&active(alert)):[];
   for(const alert of alerts)this.knownAlertIds.add(alert.id);
   this.alertsInitialized=true;
   return sortRecords(newAlerts,'newest',false);
 }
 private dismissAlertNotification=(id:string)=>this.setState(s=>({alertNotifications:s.alertNotifications.filter(alert=>alert.id!==id)}));
 private openAlertNotification=async(alert:Alert)=>{
   const user=this.state.user;
   if(!user||this.state.busy||this.state.modal)return;
   if(!await this.refresh(user)||sessionStorage.getItem(sessionKey)!==user.id)return;
   this.go('alerts',alert.id);
   this.setState({org:alert.organizationId});
   this.dismissAlertNotification(alert.id);
 };
 private async pollAlertNotifications(user:User){
   const version=++this.refreshVersion;
   this.refreshing=true;
   try{
     const alerts=await api<Alert[]>('alerts');
     if(version!==this.refreshVersion||sessionStorage.getItem(sessionKey)!==user.id)return;
     const newAlerts=this.findNewAlerts(alerts);
     if(newAlerts.length)this.setState(s=>({alertNotifications:[...newAlerts,...s.alertNotifications].slice(0,3)}));
   }catch(e){if(version===this.refreshVersion&&sessionStorage.getItem(sessionKey)===user.id)this.fail(e);}
   finally{if(version===this.refreshVersion)this.refreshing=false;}
 }
 componentDidMount(){
   void this.restoreSession();
   this.refreshTimer=window.setInterval(()=>{
     const s=this.state;
     if(document.hidden||!this.canReadInternal||!s.user||s.user.requiresTwoFactorSetup||s.loading||s.busy||this.refreshing)return;
     if(!s.modal&&!s.selected&&['dashboard','alerts','cases','errors','ticket-register'].includes(s.page)){
       void this.refresh(s.user,true);
     }else{
       void this.pollAlertNotifications(s.user);
     }
   },15000);
 }
 componentWillUnmount(){window.clearInterval(this.refreshTimer);}
 async restoreSession(){
   const navigation=performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming|undefined;
   const previous=sessionStorage.getItem(sessionKey);
   try{
     // Only refreshes of a tab with an explicit login restore the current session.
     if(previous&&navigation?.type==='reload'){
       const user:User=await api('auth/me');
       if(user.id===previous){await this.enter(user);return;}
     }
     sessionStorage.removeItem(sessionKey);
     // Identity cookies are shared across tabs; end the old cookie session.
     try{await api('auth/logout',{});}catch(e){if(e.status!==401)throw e;}
   }catch(e){sessionStorage.removeItem(sessionKey);if(e.status!==401)this.fail(e);}
   finally{this.setState({loading:false});}
 }
 get canReadInternal(){return this.isAnalyst||this.isAdmin;}
 get isAnalyst(){return this.state.user&&['Analist','Senior analist'].includes(this.state.user.role)}
 get isAdmin(){return this.state.user&&this.state.user.role==='Beheerder'}
 async enter(user:User){this.resetAlertNotifications();this.setState({user,alertNotifications:[],loading:false,page:user.requiresTwoFactorSetup?'account':user.role==='Beheerder'?'dashboard':user.role==='Klant'||user.role==='Accountmanager'?'cases':'dashboard',org:'',selected:null,archiveFilter:'open',listSort:'default',ownerFilter:'',slaFilter:'',sourceFilter:'',search:'',filter:'',priority:'',category:'',fromDate:'',toDate:'',mine:false,error:'',notice:'',secret:null,setup:null});if(!user.requiresTwoFactorSetup)await this.refresh(user)}
 async refresh(u=this.state.user,automatic=false){
   if(!u||u.requiresTwoFactorSetup||(automatic&&this.refreshing))return;
   const version=++this.refreshVersion;
   this.refreshing=true;
   const analyst=['Analist','Senior analist'].includes(u.role),admin=u.role==='Beheerder';
   try{
     const paths=['organizations',...(analyst?['alerts','cases','analysts']:admin?['alerts','cases','users','keys','audit','errors','ticket-register']:['portal/cases'])];
     const data=await Promise.all(paths.map(x=>api(x)));
     if(version!==this.refreshVersion||sessionStorage.getItem(sessionKey)!==u.id)return;
     if(automatic&&(this.state.selected||this.state.modal||this.state.busy))return;
     const state:Partial<State>={};
     paths.forEach((p,i)=>state[p==='organizations'?'orgs':p==='portal/cases'?'cases':p==='ticket-register'?'ticketRegister':p]=data[i]);
     const newAlerts=state.alerts?this.findNewAlerts(state.alerts):[];
     this.setState(previous=>({...state,alertNotifications:[...newAlerts,...previous.alertNotifications].slice(0,3)}) as Pick<State,keyof State>);
     return true;
   }catch(e){if(version===this.refreshVersion&&sessionStorage.getItem(sessionKey)===u.id)this.fail(e);return false;}
   finally{if(version===this.refreshVersion)this.refreshing=false;}
 }
 fail(e){const message=e instanceof Error?e.message:'Onbekende fout. Probeer opnieuw.';if(e?.status===401&&this.state.user){sessionStorage.removeItem(sessionKey);this.resetAlertNotifications();this.setState({user:null,alerts:[],alertNotifications:[],cases:[],users:[],keys:[],audit:[],errors:[],ticketRegister:[],orgs:[],analysts:[],secret:null,setup:null,error:message});return;}this.setState({error:message,notice:''})}
 async run(path:string,data:Record<string,unknown>,message:string,after?:(result:any)=>void){if(this.state.busy)return;this.setState({busy:true,error:'',notice:''});try{const item=this.state.alerts.find(x=>x.id===this.state.selected)||this.state.cases.find(x=>x.id===this.state.selected);const payload=item&&/^(alerts|cases)\//.test(path)?{...data,rowVersion:item.rowVersion}:data;const r=await api(path,payload,item?{workspaceId:item.organizationId,scopeId:item.scopeId}:undefined);const refreshed=await this.refresh();if(!this.state.user||!sessionStorage.getItem(sessionKey))return;this.setState({notice:refreshed?message:message+' Gegevens vernieuwen is mislukt; klik op Vernieuwen.',modal:null});if(after)after(r);}catch(e){this.fail(e)}finally{this.setState({busy:false})}}
 go(page:string,selected:string|null=null){
   if(page===this.state.page&&(selected||this.state.selected)){
     this.setState({selected,error:'',notice:'',modal:null,secret:null});return;
   }
   this.setState({page,selected,archiveFilter:'open',listSort:'default',ownerFilter:'',slaFilter:'',sourceFilter:'',search:'',filter:'',priority:'',category:'',fromDate:'',toDate:'',mine:false,error:'',notice:'',modal:null,secret:null});
 }
 name(id){return this.state.orgs.find(o=>o.id===id)?.name||'Onbekende klant'}
 filtered<T extends Alert|ResearchCase>(items:T[]):T[]{
   const {org,search,filter,priority,category,fromDate,toDate,mine,user,ownerFilter,slaFilter,sourceFilter}=this.state;
   const q=search.trim().toLowerCase();
   return items.filter(x=>{
     const date=new Date(x.createdAt);
     if(org&&x.organizationId!==org||filter&&x.status!==filter||priority&&x.priority!==priority)return false;
     if(fromDate&&date<new Date(fromDate+'T00:00:00'))return false;
     if(toDate&&date>new Date(toDate+'T23:59:59.999'))return false;
     if(mine&&('source' in x?x.owner!==user?.name:x.ownerId!==user?.id))return false;
     if(ownerFilter==='unassigned'&&x.owner||ownerFilter&&ownerFilter!=='unassigned'&&x.owner!==ownerFilter)return false;
     if('source' in x&&((slaFilter&&sla(x).kind!==slaFilter)||(sourceFilter&&x.source!==sourceFilter)))return false;
     if(category&&'source' in x&&(x.security?.category||'Niet geclassificeerd')!==category)return false;
     const values=[x.title,x.number,x.owner,this.name(x.organizationId)];
     if('source' in x)values.push(x.source,x.description,x.externalEventId,...Object.values(x.security||{}).map(String));
     if('entries' in x)values.push(...x.entries.map(e=>e.text));
     return !q||values.some(v=>String(v||'').toLowerCase().includes(q));
   });
 }
 async login(e){const data=formData(e);this.setState({busy:true,error:''});try{const user:User=await api('auth/login',data);sessionStorage.setItem(sessionKey,user.id);await this.enter(user)}catch(err){this.fail(err)}finally{this.setState({busy:false})}}
 async logout(){this.refreshVersion++;this.refreshing=false;this.resetAlertNotifications();try{await api('auth/logout',{})}finally{sessionStorage.removeItem(sessionKey);this.setState({user:null,alerts:[],alertNotifications:[],cases:[],users:[],keys:[],audit:[],errors:[],ticketRegister:[],orgs:[],analysts:[],error:'',notice:'',secret:null,setup:null})}}
 renderLogin(){return <LoginPage error={this.state.error} busy={this.state.busy} onSubmit={e=>this.login(e)}/>;}
 nav(){if(this.state.user?.requiresTwoFactorSetup)return [['account','Account']];return this.isAdmin?[['dashboard','Dashboard'],['alerts','Alerts'],['cases','Tickets'],['customers','Klanten'],['users','Gebruikers & rollen'],['keys','API-sleutels'],['audit','Auditlog'],['errors','Foutenlog'],['account','Account']]:this.isAnalyst?[['dashboard','Dashboard'],['alerts','Alerts'],['cases','Cases'],['account','Account']]:[['cases','Cases'],['account','Account']]}
 render(){const s=this.state;if(s.loading)return <LoadingState label="SOC3 laden…"/>;if(!s.user)return this.renderLogin();const pages={dashboard:()=>this.dashboard(),alerts:()=>this.alerts(),cases:()=>this.cases(),customers:()=>this.customers(),'ticket-register':()=>this.isAdmin?<TicketRegister tickets={s.ticketRegister} organizations={s.orgs} organizationId={s.org} onOrganizationChange={id=>this.setState({org:id})} reload={()=>void this.refresh()}/>:null,users:()=>this.users(),keys:()=>this.keys(),audit:()=>this.audit(),errors:()=>this.isAdmin?<ErrorLog errors={s.errors} reload={()=>void this.refresh()}/>:null,account:()=>this.account()};const customerOptions=[{id:'',name:'Alle klanten'},...s.orgs.map(o=>({id:o.id,name:o.name}))];const customer=s.orgs.find(o=>o.id===s.org)||(s.orgs.length===1?s.orgs[0]:{id:'',name:'Alle klanten'});return <AppShell user={{displayName:s.user.name,role:s.user.role}} customer={customer} customerOptions={s.orgs.length>1?customerOptions:[]} onCustomerChange={id=>this.setState({org:id,selected:null,ownerFilter:'',sourceFilter:'',category:''})} navigationItems={this.nav().map(([id,label])=>({label,href:id==='dashboard'?'/':'/'+id}))} currentPath={s.page==='dashboard'?'/':'/'+s.page} onNavigate={href=>this.go(href==='/'?'dashboard':href.slice(1))} actions={<><Button onClick={()=>this.refresh()}><Icon name="refresh" size={16}/> Vernieuwen</Button><Button onClick={()=>this.logout()}><Icon name="logout" size={16}/> Uitloggen</Button></>}>
{s.error&&<div className="error" role="alert">{s.error}<button onClick={()=>this.setState({error:''})}>×</button></div>}{s.notice&&<div className="notice" role="status">{s.notice}<button onClick={()=>this.setState({notice:''})}>×</button></div>}{pages[s.page]&&pages[s.page]()} {s.modal&&this.modal()}
{this.canReadInternal&&!s.user.requiresTwoFactorSetup&&<AlertNotifications alerts={s.alertNotifications} customerName={id=>this.name(id)} onOpen={this.openAlertNotification} onDismiss={this.dismissAlertNotification} busy={s.busy||!!s.modal}/>}
</AppShell>}

 private showQueue(page:'alerts'|'cases',view:State['archiveFilter']='open',mine=false,ownerFilter=''){
   this.go(page);
   this.setState({archiveFilter:view,mine,ownerFilter,filter:'',listSort:'default'});
 }
 dashboard(){return <DashboardPage state={this.state} isAdmin={!!this.isAdmin} isAnalyst={!!this.isAnalyst} customerName={id=>this.name(id)} navigate={(page,id)=>this.go(page,id)} update={update=>this.setState(update as Pick<State,keyof State>)} showQueue={(page,view,mine,ownerFilter)=>this.showQueue(page,view,mine,ownerFilter)}/>;}
 filters(type:'alerts'|'cases'){return <QueueFilters type={type} state={this.state} canReadInternal={!!this.canReadInternal} isAnalyst={!!this.isAnalyst} update={update=>this.setState(update as Pick<State,keyof State>)}/>;}
 alertTable(list:Alert[]){return <Table head={['Alert','Klant','Prioriteit','Status','Ontvangen','SLA','']} empty={!list.length}>{list.map(a=><tr key={a.id}><td><button className="rowlink" onClick={()=>this.go('alerts',a.id)}>{a.title}</button><small>{a.number} · {a.source}{a.security?.category?' · '+a.security.category:''}{a.security?.simulated?' · Simulatie':''}</small></td><td>{this.name(a.organizationId)}</td><td><Badge value={a.priority}/></td><td><Badge value={a.status}/></td><td>{fmt(a.createdAt)}</td><td><Badge value={sla(a).text} kind={sla(a).kind}/></td><td><button className="arrowbtn" aria-label={'Open '+a.number} onClick={()=>this.go('alerts',a.id)}>→</button></td></tr>)}</Table>}
 alerts(){
   const s=this.state;
   const selected=s.alerts.find(x=>x.id===s.selected);
   if(selected)return this.alertDetail(selected);
   const scoped=s.alerts.filter(x=>!s.org||x.organizationId===s.org);
   const list=sortRecords(this.filtered(scoped).filter(x=>s.archiveFilter==='all'||alertGroup(x)===s.archiveFilter),s.listSort,s.archiveFilter==='open');
   const tabs=[['open','Openstaand',scoped.filter(x=>alertGroup(x)==='open').length],['linked','Gekoppeld aan case',scoped.filter(x=>alertGroup(x)==='linked').length],['closed','Afgehandeld',scoped.filter(x=>alertGroup(x)==='closed').length],['all','Alle alerts',scoped.length]] as const;
   return <div className="wire-screen">
     <PageHeader title="Alerts" sub="Nieuwe, lopende en afgehandelde beveiligingsmeldingen." action={this.isAnalyst&&<Button primary onClick={()=>this.setState({modal:'newAlert'})}>Alert toevoegen</Button>}/>
     <div className="archive-tabs" role="group" aria-label="Alertstatus">
       {tabs.map(([mode,label,count])=><button key={mode} aria-pressed={s.archiveFilter===mode} onClick={()=>this.setState({archiveFilter:mode,filter:'',listSort:'default'})}>{label} ({count})</button>)}
     </div>
     <Panel title="Filters">{this.filters('alerts')}</Panel>
     <p className="wire-count">{list.length} van {scoped.length} meldingen · {s.listSort==='priority'?'hoogste prioriteit eerst':s.listSort==='oldest'||s.listSort==='default'&&s.archiveFilter==='open'?'oudste eerst':'nieuwste eerst'}</p>
     <AlertCards key={[s.org,s.archiveFilter,s.search,s.filter,s.priority,s.category,s.fromDate,s.toDate,s.mine,s.ownerFilter,s.slaFilter,s.sourceFilter,s.listSort].join('|')} alerts={list} customerName={id=>this.name(id)} open={id=>this.go('alerts',id)} busy={s.busy}/>
   </div>;
 }
 alertDetail(alert:Alert){return <AlertDetailPage alert={alert} state={this.state} isAdmin={!!this.isAdmin} isAnalyst={!!this.isAnalyst} customerName={id=>this.name(id)} navigate={(page,id)=>this.go(page,id)} run={(...args)=>this.run(...args)} update={update=>this.setState(update as Pick<State,keyof State>)}/>;}
 caseTable(tickets:ResearchCase[]){return <TicketTable tickets={tickets} customerName={id=>this.name(id)} onOpen={id=>this.go('cases',id)}/>;}
 cases(){
   const s=this.state;
   const selected=s.cases.find(ticket=>ticket.id===s.selected);
   if(selected)return this.caseDetail(selected);
   const scoped=s.cases.filter(ticket=>!s.org||ticket.organizationId===s.org);
   const selectedTickets=scoped.filter(ticket=>caseMatchesView(ticket,s.archiveFilter));
   const filteredTickets=this.filtered(selectedTickets);
   const list=s.archiveFilter==='closed'&&s.listSort==='default'?
     filteredTickets.slice().sort((first,second)=>Date.parse(second.closedAt||second.createdAt)-Date.parse(first.closedAt||first.createdAt)):
     sortRecords(filteredTickets,s.listSort,false);
   const tabs=[
     ['open','Actief','Alle nieuwe, lopende en wachtende tickets'],
     ['new','Nieuw','Nog te prioriteren en toe te wijzen'],
     ['working','In onderzoek','Wordt actief onderzocht'],
     ['waiting','Wacht op klant','Wacht op een reactie van de klant'],
     ['resolved','Af te sluiten','Opgelost of in eindbeoordeling'],
     ['closed','Archief','Definitief afgesloten tickets'],
     ['all','Alle tickets','Alle statussen, inclusief archief']
   ] as const;
   const current=tabs.find(([mode])=>mode===s.archiveFilter)||tabs[0];
   return <div className="fragment">
     <PageHeader title={this.canReadInternal?'Tickets / onderzoeken':'Mijn tickets'} sub={this.canReadInternal?'Selecteer de fase van het onderzoek. Nieuw betekent nog te prioriteren, niet recent aangemaakt.':'Bekijk alle voor jou vrijgegeven onderzoeken.'}/>
     <div className="ticket-stage-tabs" role="group" aria-label="Ticketfase">
       {tabs.map(([mode,label,description])=><button key={mode} type="button" aria-pressed={s.archiveFilter===mode} title={description} onClick={()=>this.setState({archiveFilter:mode,filter:'',listSort:'default'})}><span>{label}</span><b>{scoped.filter(ticket=>caseMatchesView(ticket,mode)).length}</b></button>)}
     </div>
     <Panel title="Zoeken en filteren">{this.filters('cases')}</Panel>
     <Panel title={current[1]} sub={current[2]+' · '+list.length+' van '+selectedTickets.length+' tickets'}>
       {this.canReadInternal?this.caseTable(list):<div className="bodypad"><CaseCards cases={list} customerName={id=>this.name(id)} open={id=>this.go('cases',id)}/></div>}
     </Panel>
   </div>;
 }
 caseDetail(ticket:ResearchCase){return <CaseDetailPage ticket={ticket} state={this.state} isAdmin={!!this.isAdmin} isAnalyst={!!this.isAnalyst} canReadInternal={!!this.canReadInternal} customerName={id=>this.name(id)} navigate={(page,id)=>this.go(page,id)} run={(...args)=>this.run(...args)} update={update=>this.setState(update as Pick<State,keyof State>)}/>;}
 customers(){return <div className="fragment"><PageHeader title="Klantenbeheer" sub="Beheer organisaties en hun actieve status." action={<Button primary onClick={()=>this.setState({modal:'customer'})}><Icon name="plus"/> Klant toevoegen</Button>}/><Panel title="Organisaties" sub={this.state.orgs.length+' geregistreerde organisaties'}><Table head={['Organisatie','Status','Reactie-SLA','Aangemaakt','Actie']}>{this.state.orgs.map(o=><tr key={o.id}><td><b>{o.name}</b></td><td><Badge value={o.isActive?'Actief':'Inactief'} kind={o.isActive?'good':'neutral'}/></td><td>{o.responseMinutes} min</td><td>{fmt(o.createdAt)}</td><td><div className="actions"><Button onClick={()=>{this.go('cases');this.setState({org:o.id,archiveFilter:'all'});}}>Tickets ({this.state.ticketRegister.filter(t=>t.organizationId===o.id).length})</Button><Button onClick={()=>this.setState({modal:'customerEdit',selected:o.id})}>Bewerken</Button><Button onClick={()=>{if(window.confirm(o.isActive?'Klant deactiveren? Historische gegevens blijven behouden.':'Klant activeren?'))this.run(`organizations/${o.id}/${o.isActive?'deactivate':'activate'}`,{},'Klantstatus bijgewerkt.')}}>{o.isActive?'Deactiveren':'Activeren'}</Button></div></td></tr>)}</Table></Panel></div>}
 users(){return <div className="fragment"><PageHeader title="Gebruikers & rollen" sub="Beheer accounts en klanttoegang." action={<Button primary onClick={()=>this.setState({modal:'user',selected:null})}><Icon name="plus"/> Gebruiker toevoegen</Button>}/><Panel title="Gebruikers"><Table head={['Naam','E-mail','Rol','Klanttoegang','Status','2FA','']}>{this.state.users.map(u=><tr key={u.id}><td><b>{u.name}</b></td><td>{u.email}</td><td>{u.role}</td><td>{u.organizationIds.map(x=>this.name(x)).join(', ')||'—'}</td><td><Badge value={u.isActive?'Actief':'Inactief'} kind={u.isActive?'good':'neutral'}/></td><td><Badge value={u.twoFactorEnabled?'Actief':'Niet actief'} kind={u.twoFactorEnabled?'good':'neutral'}/></td><td>{u.id!==this.state.user.id?<div className="actions"><Button onClick={()=>this.setState({modal:'userAccess',selected:u.id})}>Bewerken</Button><button type="button" className="remove-user" disabled={this.state.busy} onClick={()=>{if(window.confirm('Gebruiker '+u.name+' verwijderen? Toegang wordt ingetrokken. Ticket- en audithistorie blijft behouden.'))void this.run('users/'+u.id+'/remove',{},'Gebruiker verwijderd.');}}>Verwijderen</button></div>:<small>Eigen account</small>}</td></tr>)}</Table></Panel></div>}
 keys(){return <div className="fragment"><PageHeader title="API-sleutels" sub="Beheer sleutels waarmee externe tools alerts kunnen aanleveren." action={<Button primary onClick={()=>this.setState({modal:'key'})}><Icon name="plus"/> Sleutel maken</Button>}/>{this.state.secret&&<Panel title="Nieuwe sleutel — eenmalig zichtbaar"><div className="bodypad"><code className="secret">{this.state.secret}</code><p>Gebruik deze sleutel in de HTTP-header X-API-Key bij POST /api/v1/ingest/alerts.</p><Button onClick={()=>this.setState({secret:null})}>Verbergen</Button></div></Panel>}<Panel title="Integraties"><Table head={['Tool','Klant','Sleutel','Status','']} empty={!this.state.keys.length}>{this.state.keys.map(k=><tr key={k.id}><td>{k.name}</td><td>{this.name(k.organizationId)}</td><td><code>{k.prefix}…</code></td><td><Badge value={k.isActive?'Actief':'Ingetrokken'} kind={k.isActive?'good':'neutral'}/></td><td>{k.isActive&&<Button onClick={()=>{if(confirm('Sleutel definitief intrekken?'))this.run(`keys/${k.id}/revoke`,{},'Sleutel ingetrokken.')}}>Intrekken</Button>}</td></tr>)}</Table></Panel></div>}
 audit(){const q=this.state.search.toLowerCase(),list=this.state.audit.filter(a=>[a.actor,a.action,a.target,this.name(a.organizationId)].some(x=>String(x||'').toLowerCase().includes(q)));return <div className="fragment"><PageHeader title="Auditlog" sub="Controleer geregistreerde acties in het SOC-platform."/><Panel title="Activiteit" sub={list.length+' gebeurtenissen'}><div className="filters"><input aria-label="Auditlog zoeken" placeholder="Zoek gebruiker, actie of klant" value={this.state.search} onChange={e=>this.setState({search:e.target.value})}/></div><Table head={['Tijd','Gebruiker','Actie','Klant','Object']} empty={!list.length}>{list.map(a=><tr key={a.id}><td>{fmt(a.createdAt)}</td><td>{a.actor}</td><td>{a.action}</td><td>{a.organizationId?this.name(a.organizationId):'—'}</td><td>{a.target||'—'}</td></tr>)}</Table></Panel></div>}
 account(){
   const s=this.state;
   return <div className="fragment">
     <PageHeader title="Mijn account" sub="Accountgegevens en tweestapsverificatie."/>
     <Panel title="Profiel"><div className="bodypad">
       {s.user.requiresTwoFactorSetup&&<p role="status">Deze rol vereist 2FA voordat klantgegevens toegankelijk zijn.</p>}
       <dl><dt>Naam</dt><dd>{s.user.name}</dd><dt>E-mail</dt><dd>{s.user.email}</dd><dt>Rol</dt><dd>{s.user.role}</dd><dt>2FA</dt><dd><Badge value={s.user.twoFactorEnabled?'Actief':'Niet actief'} kind={s.user.twoFactorEnabled?'good':'neutral'}/></dd></dl>
       <TwoFactorSetup key={s.user.id} email={s.user.email} initiallyEnabled={s.user.twoFactorEnabled} onEnabled={async()=>{
         const user=await api<User>('auth/me');
         this.setState({user});
         await this.refresh(user);
       }} onSessionExpired={error=>this.fail(error)}/>
     </div></Panel>
   </div>;
 }
 modal(){const s=this.state,a=s.alerts.find(x=>x.id===s.selected),r=s.cases.find(x=>x.id===s.selected),u=s.users.find(x=>x.id===s.selected);let title,fields,submit;const text=(name,label,required=true,value?)=> <Field label={label}><input name={name} required={required} defaultValue={value}/></Field>;const area=(name,label,required=true)=><Field label={label}><textarea name={name} required={required} rows={4}/></Field>;const choose=(name,label,options,placeholder='Maak een keuze')=><Field label={label}><Select name={name} options={options} placeholder={placeholder} required/></Field>;const check=(name,label)=><label className="check"><input name={name} type="checkbox"/>{label}</label>;switch(s.modal){case 'newAlert':title='Nieuwe alert';fields=<div className="fragment">{choose('organizationId','Klant',s.orgs.filter(o=>o.isActive))}{text('title','Titel')}{text('source','Bron / securitytool')}{choose('priority','Prioriteit',priorities)}{area('description','Beschrijving')}</div>;submit=b=>this.run('alerts',b,'Alert ontvangen.',x=>this.go('alerts',x.id));break;case 'triage':title='Triage vastleggen';fields=<div className="fragment">{choose('outcome','Uitkomst',['False positive','Verwacht gedrag','Nader onderzoek','Bevestigd incident'])}{area('reason','Motivatie')}</div>;submit=b=>this.run(`alerts/${a.id}/triage`,b,'Triage opgeslagen.');break;case 'caseFromAlert':title='Case maken of koppelen';fields=<div className="fragment">{text('title','Titel voor een nieuwe case',false,a.title)}<Field label="Of koppel aan een bestaande case"><Select name="caseId" options={s.cases.filter(c=>c.organizationId===a.organizationId&&c.scopeId===a.scopeId&&!isClosed(c)).map(c=>({id:c.id,name:c.number+' · '+c.title}))} placeholder="Nieuwe case maken"/></Field></div>;submit=b=>this.run(`alerts/${a.id}/case`,b,'Alert gekoppeld.',x=>this.go('cases',x.caseId));break;case 'reopen':title='Alert heropenen';fields=area('reason','Reden');submit=b=>this.run(`alerts/${a.id}/reopen`,b,'Alert heropend.');break;case 'entry':title='Klantreactie toevoegen — '+r.number;fields=area('text','Reactie');submit=b=>this.run(`cases/${r.id}/entry`,b,'Reactie opgeslagen.');break;
case 'note':case 'actionEntry':case 'evidenceRef':{
  const kind=s.modal==='note'?'Notitie':s.modal==='actionEntry'?'Actie':'Bewijsreferentie';
  title=kind+' toevoegen — '+r.number;
  fields=<div className="fragment">
    <Field label={kind==='Bewijsreferentie'?'Referentie naar logbestand, bewijs-ID of locatie':'Inhoud'}>
      <textarea name="text" rows={5} maxLength={2000} required/>
    </Field>
    {kind==='Bewijsreferentie'?<p>Voeg een referentie toe, geen geheim of bestand. Bestandsupload is nog niet geïmplementeerd.</p>:check('visible','Vrijgeven aan klant (standaard intern)')}
  </div>;
  submit=b=>this.run(`cases/${r.id}/entry`,{kind,text:b.text,visible:kind!=='Bewijsreferentie'&&b.visible==='on'},kind+' opgeslagen.');
  break;
}
case 'observable':title='Observable toevoegen — '+r.number;fields=<div className="fragment">
  {choose('type','Type',['IP','Domain','URL','Email','Hash'])}
  {text('text','Waarde')}
  {choose('assessment','Beoordeling',['Verdacht','Kwaadaardig','Onschuldig'])}
  <p>Observables zijn altijd intern.</p>
</div>;submit=b=>this.run(`cases/${r.id}/entry`,{...b,kind:'Observable',visible:false},'Observable opgeslagen.');break;
case 'caseReopen':title='Case heropenen';fields=area('reason','Reden');submit=b=>this.run(`cases/${r.id}/status`,{...b,status:'UnderInvestigation'},'Case heropend.');break;case 'caseStatus':title='Casestatus wijzigen';fields=<div className="fragment">{choose('status','Nieuwe status',nextCaseStates(r.status))}{area('summary','Samenvatting (verplicht bij afsluiten)',false)}{area('conclusion','Conclusie (verplicht bij afsluiten)',false)}</div>;submit=b=>this.run(`cases/${r.id}/status`,b,'Casestatus gewijzigd.');break;case 'owner':title=r.status==='Open'?'Prioriteren en toewijzen':'Case overdragen';fields=<div className="fragment">{choose('userId','Nieuwe eigenaar',s.analysts.filter(x=>x.organizationIds.includes(r.organizationId)&&(r.status==='Open'||x.id!==r.ownerId)))}{s.user.role==='Senior analist'&&<Field label="Prioriteit"><select name="priority" defaultValue={r.priority}>{priorities.map(p=><option key={p} value={p}>{labels[p]}</option>)}</select></Field>}{area('reason','Toelichting en aandachtspunten')}{area('nextAction','Volgende actie')}</div>;submit=b=>this.run(`cases/${r.id}/owner`,b,r.status==='Open'?'Case toegewezen.':'Case overgedragen.');break;case 'customer':case 'customerEdit':{
 const editing=s.modal==='customerEdit';
 const org=s.orgs.find(o=>o.id===s.selected);
 if(editing&&!org)return null;
 title=editing?'Klant bewerken':'Klant toevoegen';
 fields=<div className="fragment">{text('name','Organisatienaam',true,editing?org.name:'')}<Field label="Reactie-SLA (minuten)"><input type="number" name="responseMinutes" min={1} max={10080} step={1} required defaultValue={editing?org.responseMinutes:60}/></Field><small>Geldt voor nieuwe alerts. Bestaande deadlines blijven behouden.</small></div>;
 submit=b=>this.run(editing?`organizations/${org.id}`:'organizations',{...b,responseMinutes:Number(b.responseMinutes)},editing?'Klantinstellingen gewijzigd.':'Klant aangemaakt.');
 break;
}case 'user':case 'userAccess':{
  const editing=s.modal==='userAccess';
  if(editing&&!u)return null;
  title=editing?'Gebruiker bewerken':'Gebruiker toevoegen';
  fields=<div className="fragment">
    {text('name','Volledige naam',true,editing?u.name:'')}
    <Field label="E-mailadres"><input name="email" type="email" required defaultValue={editing?u.email:''}/></Field>
    <Field label={editing?'Nieuw wachtwoord (optioneel)':'Wachtwoord (minimaal 8 tekens)'}>
      <input name="password" type="password" minLength={8} required={!editing} autoComplete="new-password"/>
    </Field>
    {editing&&<small>Laat leeg om het bestaande wachtwoord te behouden. Een nieuw wachtwoord vereist hoofdletter, kleine letter, cijfer en speciaal teken.</small>}
    <Field label="Rol"><select name="role" defaultValue={editing?u.role:'Analist'}>{roles.map(x=><option key={x}>{x}</option>)}</select></Field>
    {editing&&<Field label="Accountstatus"><select name="isActive" defaultValue={u.isActive?'true':'false'}><option value="true">Actief</option><option value="false">Inactief</option></select></Field>}
    <fieldset><legend>Klanttoegang</legend>{s.orgs.map(o=><label className="check" key={o.id}><input type="checkbox" name={'org_'+o.id} defaultChecked={editing&&u.organizationIds.includes(o.id)}/>{o.name}</label>)}</fieldset>
    {editing&&<small>Een inactief account kan niet inloggen. Historische gegevens blijven behouden.</small>}
  </div>;
  submit=b=>{
    const payload:Record<string,unknown>={...b,organizationIds:Object.keys(b).filter(k=>k.startsWith('org_')).map(k=>k.slice(4))};
    Object.keys(payload).filter(k=>k.startsWith('org_')).forEach(k=>delete payload[k]);
    if(editing)payload.isActive=b.isActive==='true';
    this.run(editing?`users/${u.id}`:'users',payload,'Gebruikersgegevens opgeslagen.');
  };
  break;
}case 'key':title='API-sleutel genereren';fields=<div className="fragment">{choose('organizationId','Klant',s.orgs.filter(o=>o.isActive))}{text('name','Naam van securitytool')}</div>;submit=b=>this.run('keys',b,'API-sleutel aangemaakt.',x=>this.setState({secret:x.secret}));break;default:return null;}return <div className="overlay" onClick={e=>{if(e.target===e.currentTarget&&!s.busy)this.setState({modal:null})}}><section className="dialog" role="dialog" aria-modal="true" aria-label={title}><div className="dialoghead"><h2>{title}</h2><button aria-label="Sluiten" onClick={()=>this.setState({modal:null})}>×</button></div>{s.error&&<div className="error" role="alert">{s.error}</div>}<form onSubmit={e=>submit(formData(e))}>{fields}<div className="actions"><Button onClick={()=>this.setState({modal:null,error:''})}>Annuleren</Button><Button primary type="submit" disabled={s.busy}>{s.busy?'Opslaan…':'Opslaan'}</Button></div></form></section></div>}
}
export default App;
