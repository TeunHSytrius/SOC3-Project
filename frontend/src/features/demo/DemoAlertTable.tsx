import { Badge, Table } from '../../components/Ui';
import { fmt } from '../../types/domain';
import type { DemoAlert } from './demoAlerts';

interface DemoAlertTableProps {
  alerts: DemoAlert[];
  onOpen: (alertId: string) => void;
}

export function priorityKind(priority: DemoAlert['priority']): string {
  switch (priority) {
    case 'Kritiek':
      return 'critical';
    case 'Hoog':
      return 'danger';
    case 'Gemiddeld':
      return 'warn';
    default:
      return 'neutral';
  }
}

export default function DemoAlertTable({ alerts, onOpen }: DemoAlertTableProps) {
  return (
    <Table head={['Melding', 'Klant', 'Bron', 'Prioriteit', 'Status', 'Ontvangen']} empty={!alerts.length}>
      {alerts.map((alert) => (
        <tr key={alert.id}>
          <td>
            <button type="button" className="rowlink" onClick={() => onOpen(alert.id)}>
              {alert.title}
            </button>
            <small>{alert.number}</small>
          </td>
          <td>{alert.organizationName}</td>
          <td>{alert.source}</td>
          <td><Badge value={alert.priority} kind={priorityKind(alert.priority)} /></td>
          <td><Badge value={alert.status} kind={alert.status === 'Nieuw' ? 'blue' : 'warn'} /></td>
          <td>{fmt(alert.receivedAt)}</td>
        </tr>
      ))}
    </Table>
  );
}
