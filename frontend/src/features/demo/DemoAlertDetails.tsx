import { Badge, Button, PageHeader, Panel } from '../../components/Ui';
import { fmt } from '../../types/domain';
import { priorityKind, statusKind } from './demoAlertPresentation';
import type { DemoAlert } from './demoAlerts';

interface DemoAlertDetailsProps {
  alert: DemoAlert;
  onBack: () => void;
}

export default function DemoAlertDetails({ alert, onBack }: DemoAlertDetailsProps) {
  return (
    <div className="fragment">
      <PageHeader
        title={alert.title}
        sub={`${alert.number} · Voorbeeldmelding`}
        action={<Button onClick={onBack}>Terug naar alerts</Button>}
      />
      <Panel title="Melding" sub={alert.organizationName}>
        <div className="demo-detail">
          <div className="demo-detail-status">
            <Badge value={alert.priority} kind={priorityKind(alert.priority)} />
            <Badge value={alert.status} kind={statusKind(alert.status)} />
          </div>
          <p>{alert.description}</p>
          <dl>
            <dt>Bron</dt>
            <dd>{alert.source}</dd>
            <dt>Ontvangen</dt>
            <dd>{fmt(alert.receivedAt)}</dd>
            <dt>Voorbeeld-IP</dt>
            <dd>
              <code>{alert.sourceIp}</code>
            </dd>
            <dt>Organisatie</dt>
            <dd>{alert.organizationName}</dd>
          </dl>
        </div>
      </Panel>
    </div>
  );
}
