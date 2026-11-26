import { useState } from 'react';
import type { Alert, ResearchCase } from '../../types/soc';
import { active, fmt, sla } from '../../types/domain';
import { Badge, Button } from '../../components/Ui';

export function priorityColor(priority: Alert['priority']) {
  return 'severity-' + priority.toLowerCase();
}

interface AlertCardsProps {
  alerts: Alert[];
  customerName: (id: string) => string;
  open: (id: string) => void;
  busy: boolean;
}

export function AlertCards({ alerts, customerName, open, busy }: AlertCardsProps) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(alerts.length / 12));
  const current = Math.min(page, pageCount - 1);
  return (
    <>
      {!alerts.length && <p className="empty">Geen alerts gevonden.</p>}
      <div className="wire-card-grid">
        {alerts.slice(current * 12, (current + 1) * 12).map((alert) => (
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
      {pageCount > 1 && (
        <nav className="wire-pagination" aria-label="Alertpaginering">
          <Button disabled={current === 0} onClick={() => setPage(current - 1)}>
            Vorige
          </Button>
          <span aria-live="polite">
            Pagina {current + 1} van {pageCount} · {current * 12 + 1}–{Math.min((current + 1) * 12, alerts.length)} van {alerts.length}
          </span>
          <Button disabled={current === pageCount - 1} onClick={() => setPage(current + 1)}>
            Volgende
          </Button>
        </nav>
      )}
    </>
  );
}

export function CaseCards({
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
        {cases.map((research) => (
          <article
            key={research.id}
            className={'wire-alert-card ' + priorityColor(research.priority)}
          >
            <div className="wire-card-meta">
              <span>{customerName(research.organizationId)}</span>
              <Badge value={research.status} />
            </div>
            <button className="wire-card-main" onClick={() => open(research.id)}>
              <strong>{research.number}</strong>
              <span>{research.title}</span>
              <Badge value={research.priority} />
            </button>
            <div className="wire-card-meta">
              <span>
                {research.status === 'Closed'
                  ? 'Afgesloten ' + fmt(research.closedAt)
                  : research.status === 'Resolved'
                    ? 'Opgelost · wacht op afsluiting'
                    : 'Voortgang bekijken'}
              </span>
              <Button onClick={() => open(research.id)}>···</Button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
