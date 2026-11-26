import type { ResearchCase } from '../../types/soc';
import { fmt } from '../../types/domain';
import { Badge, Button } from '../../components/Ui';
import { priorityColor } from '../shared/priorityColor';

export default function TicketCards({
  cases,
  customerName,
  open,
}: {
  cases: ResearchCase[];
  customerName: (id: string) => string;
  open: (id: string) => void;
}) {
  return (
    <>
      {!cases.length && <p className="empty">Geen tickets gevonden.</p>}
      <div className="wire-card-grid">
        {cases.map((ticket) => (
          <article
            key={ticket.id}
            className={'wire-alert-card ' + priorityColor(ticket.priority)}
          >
            <div className="wire-card-meta">
              <span>{customerName(ticket.organizationId)}</span>
              <Badge value={ticket.status} />
            </div>
            <button type="button" className="wire-card-main" onClick={() => open(ticket.id)}>
              <strong>{ticket.number}</strong>
              <span>{ticket.title}</span>
              <Badge value={ticket.priority} />
            </button>
            <div className="wire-card-meta">
              <span>
                {ticket.status === 'Closed'
                  ? 'Afgesloten ' + fmt(ticket.closedAt)
                  : ticket.status === 'Resolved'
                    ? 'Opgelost · wacht op afsluiting'
                    : 'Voortgang bekijken'}
              </span>
              <Button onClick={() => open(ticket.id)}>···</Button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
