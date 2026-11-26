import { Badge } from '../../components/Ui';
import type { ResearchCase } from '../../types/soc';
import type { Navigate } from '../../types/workspace';
import { fmt } from '../../types/domain';

interface DashboardTicketsProps {
  tickets: ResearchCase[];
  customerName: (id: string) => string;
  navigate: Navigate;
}

export default function DashboardTickets({ tickets, customerName, navigate }: DashboardTicketsProps) {
  if (!tickets.length) {
    return <p className="dashboard-empty">Geen actieve tickets in dit overzicht.</p>;
  }

  return (
    <ul className="dashboard-alert-list">
      {tickets.map((ticket) => (
        <li key={ticket.id}>
          <button type="button" className="dashboard-alert-row" onClick={() => navigate('cases', ticket.id)}>
            <span className={'dashboard-severity severity-' + ticket.priority.toLowerCase()} aria-hidden="true" />
            <span className="dashboard-alert-main">
              <strong>{ticket.title}</strong>
              <small>{ticket.number} · {customerName(ticket.organizationId)}</small>
              <small>{ticket.owner || 'Niet toegewezen'} · {fmt(ticket.createdAt)}</small>
            </span>
            <span className="dashboard-alert-badges">
              <Badge value={ticket.priority} />
              <Badge value={ticket.status} />
            </span>
            <span aria-hidden="true">→</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
