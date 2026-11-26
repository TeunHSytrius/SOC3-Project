import type {Alert} from '../../types/soc';
import {Badge,Icon} from '../../components/Ui';
import './AlertNotifications.css';

interface AlertNotificationsProps {
  alerts: Alert[];
  customerName: (id: string) => string;
  onOpen: (alert: Alert) => void;
  onDismiss: (id: string) => void;
  busy: boolean;
}

export default function AlertNotifications({alerts,customerName,onOpen,onDismiss,busy}:AlertNotificationsProps){
  return (
    <aside className="alert-notifications" aria-label="Nieuwe alertmeldingen" aria-live="polite" aria-relevant="additions">
      {alerts.map(alert=>(
        <article key={alert.id} className={'alert-notification alert-notification--'+alert.priority}>
          <div className="alert-notification__header">
            <Icon name="alerts" size={18}/>
            <strong>Nieuwe alert ontvangen</strong>
            <button type="button" className="alert-notification__close" aria-label={'Melding sluiten: '+alert.number} onClick={()=>onDismiss(alert.id)}>×</button>
          </div>
          <div className="alert-notification__meta">
            <span>{alert.number} · {customerName(alert.organizationId)}</span>
            <Badge value={alert.priority}/>
          </div>
          <p className="alert-notification__title">{alert.title}</p>
          <p className="alert-notification__source">{alert.source}{alert.security?.simulated?' · Simulatie':''}</p>
          <button type="button" className="alert-notification__open" disabled={busy} onClick={()=>onOpen(alert)}>
            Alert bekijken <span aria-hidden="true">→</span>
          </button>
        </article>
      ))}
    </aside>
  );
}
