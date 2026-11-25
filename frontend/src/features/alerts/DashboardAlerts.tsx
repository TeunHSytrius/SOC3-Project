import type {Alert} from '../../types/soc';
import {Badge} from '../../components/Ui';
import {fmt,sla} from '../../types/domain';

export default function DashboardAlerts({alerts,customerName,open}:{alerts:Alert[];customerName:(id:string)=>string;open:(id:string)=>void}){
  if(!alerts.length)return <p className="bodypad">Geen openstaande meldingen.</p>;
  return <ul className="dashboard-alert-list">{alerts.map(alert=>{
    const service=sla(alert);
    return <li key={alert.id}><button type="button" className="dashboard-alert-row" onClick={()=>open(alert.id)}>
      <span className={'dashboard-severity severity-'+alert.priority.toLowerCase()} aria-hidden="true"/>
      <span className="dashboard-alert-main"><strong>{alert.title}</strong>
      <small>{alert.number} · {customerName(alert.organizationId)} · {alert.source}</small>
      <small>{alert.owner?'Eigenaar: '+alert.owner:'Niet toegewezen'} · {fmt(alert.createdAt)}</small></span>
      <span className="dashboard-alert-badges"><Badge value={alert.priority}/><Badge value={alert.status}/><Badge value={service.text} kind={service.kind}/></span>
      <span aria-hidden="true">→</span>
    </button></li>;
  })}</ul>;
}
