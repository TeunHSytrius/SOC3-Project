import type { Alert } from '../../types/soc';
import { active, fmt, sla } from '../../types/domain';
import { Badge } from '../../components/Ui';
import Pagination from '../../components/Pagination';
import { usePagination } from '../../hooks/usePagination';
import { priorityColor } from '../shared/priorityColor';

const ALERTS_PER_PAGE = 12;

interface AlertCardsProps {
  alerts: Alert[];
  customerName: (id: string) => string;
  open: (id: string) => void;
  busy: boolean;
}

export function AlertCards({ alerts, customerName, open, busy }: AlertCardsProps) {
  const pagination = usePagination(alerts, ALERTS_PER_PAGE);
  return (
    <>
      {!alerts.length && <p className="empty">Geen alerts gevonden.</p>}
      <div className="wire-card-grid">
        {pagination.visibleRecords.map((alert) => (
          <article key={alert.id} className={'wire-alert-card ' + priorityColor(alert.priority)}>
            <div className="wire-card-meta">
              <span>{customerName(alert.organizationId)} · {alert.number}</span>
              <Badge value={alert.priority} />
            </div>
            <button type="button" className="wire-card-main" onClick={() => open(alert.id)} disabled={busy}>
              <strong>{alert.title}</strong>
              <span>{alert.description}</span>
            </button>
            <div className="wire-card-meta">
              <span>
                {alert.source}
                {alert.security?.simulated ? ' · Simulatie' : ''}
              </span>
              <details className="wire-card-menu">
                <summary aria-label={'Acties voor ' + alert.number}>···</summary>
                <button type="button" onClick={() => open(alert.id)} disabled={busy}>
                  {active(alert) ? 'Openen / beoordelen' : 'Details bekijken'}
                </button>
              </details>
            </div>
            <div className="wire-card-meta">
              <span>{fmt(alert.createdAt)}</span>
              <div className="wire-card-priority">
                <Badge value={alert.status} />
                <Badge value={sla(alert).text} kind={sla(alert).kind} />
              </div>
            </div>
          </article>
        ))}
      </div>
      {pagination.pageCount > 1 && (
        <Pagination {...pagination} label="Alertpaginering" />
      )}
    </>
  );
}
