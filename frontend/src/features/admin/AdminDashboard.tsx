import type {AuditRow,Organization,User,ApiKey,TicketRegisterRow} from '../../types/soc';
import {Button,Panel,PageHeader,Table} from '../../components/Ui';
import {fmt} from '../../types/domain';

interface Props {
  organizations:Organization[];
  users:User[];
  keys:ApiKey[];
  audit:AuditRow[];
  tickets:TicketRegisterRow[];
  navigate:(page:string)=>void;
  onCustomerTickets:(id:string)=>void;
}

export default function AdminDashboard({organizations,users,keys,audit,tickets,navigate,onCustomerTickets}:Props){
  // Use the audit data the administrator is already authorized to read.
  // No alert payloads, case details or internal investigation notes are loaded here.
  const received=audit.filter(row=>row.action==='Alert ontvangen'||row.action==='Alert handmatig ontvangen');
  const since=Date.now()-24*60*60*1000;
  const today=received.filter(row=>Date.parse(row.createdAt)>=since);
  const activeCustomers=organizations.filter(org=>org.isActive);
  const cards=[
    ['Ontvangen alerts (24 uur)',today.length,'Geregistreerde ontvangsten','audit'],
    ['Actieve klanten',activeCustomers.length,'Klantorganisaties','customers'],
    ['Actieve gebruikers',users.filter(user=>user.isActive).length,'Accounts','users'],
    ['Actieve API-sleutels',keys.filter(key=>key.isActive).length,'Bronintegraties','keys'],
    ['Lopende tickets',tickets.filter(t=>t.status!=='Closed').length,'Alle klanten','ticket-register'],
    ['Afgesloten tickets',tickets.filter(t=>t.status==='Closed').length,'Historisch register','ticket-register']
  ];
  return <>
    <PageHeader title="Beheerdashboard" sub="Overzicht van platform, aangesloten klanten en alertontvangst."/>
    <div className="stats">
      {cards.map(([label,count,description,page])=><button type="button" className="stat admin-stat" key={label} onClick={()=>navigate(String(page))}>
        <div className="statline">{label}</div><strong>{count}</strong><small>{description}</small>
      </button>)}
    </div>
    <Panel title="Alertontvangst per klant" sub="Aantallen uit het auditlog, niet het aantal openstaande onderzoeken.">
      <Table head={['Klant','Ontvangen in 24 uur','Geregistreerd totaal','Laatste ontvangst','Actieve bronnen','Tickets']} empty={!activeCustomers.length}>
        {activeCustomers.map(org=>{
          const events=received.filter(row=>row.organizationId===org.id);
          const last=events.reduce<string|undefined>((latest,event)=>!latest||Date.parse(event.createdAt)>Date.parse(latest)?event.createdAt:latest,undefined);
          return <tr key={org.id}><td>{org.name}</td><td>{today.filter(row=>row.organizationId===org.id).length}</td><td>{events.length}</td><td>{fmt(last)}</td><td>{keys.filter(key=>key.organizationId===org.id&&key.isActive).length}</td><td><Button onClick={()=>onCustomerTickets(org.id)}>Tickets ({tickets.filter(t=>t.organizationId===org.id).length})</Button></td></tr>;
        })}
      </Table>
    </Panel>
    <Panel title="Recente alertontvangst" sub="Alleen auditmetadata, geen inhoud van alerts." action={<Button onClick={()=>navigate('audit')}>Auditlog openen</Button>}>
      <Table head={['Tijd','Klant','Bron / actor','Alertnummer']} empty={!received.length}>
        {received.slice(0,12).map(row=><tr key={row.id}><td>{fmt(row.createdAt)}</td><td>{organizations.find(org=>org.id===row.organizationId)?.name||'—'}</td><td>{row.actor}</td><td>{row.target||'—'}</td></tr>)}
      </Table>
    </Panel>
    <p className="admin-access-note">Voor het bekijken en behandelen van alerts en onderzoeken is een afzonderlijk analistenaccount met klant- en scopetoegang nodig.</p>
  </>;
}
