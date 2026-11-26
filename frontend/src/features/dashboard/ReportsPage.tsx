import { Panel, PageHeader } from '../../components/Ui';
import type { State } from '../../types/soc';
import { active, sla } from '../../types/domain';
import AlertTrend from '../alerts/AlertTrend';

export default function ReportsPage({ state }: { state: Pick<State, 'alerts' | 'org'> }) {
  const alerts = state.alerts.filter((alert) => !state.org || alert.organizationId === state.org);
  const handledAlerts = alerts.filter((alert) => alert.firstHandledAt);
  const onTime = handledAlerts.filter((alert) => sla(alert).kind === 'good').length;
  const late = handledAlerts.filter((alert) => sla(alert).kind === 'danger').length;
  const atRisk = alerts.filter((alert) => active(alert) && sla(alert).kind === 'warn').length;
  const percentage = handledAlerts.length ? Math.round(100 * onTime / handledAlerts.length) : null;
  const chartBackground = percentage === null
    ? 'var(--surface-hover)'
    : `conic-gradient(var(--sla-on-time) ${percentage}%, var(--sla-late) 0)`;

  return (
    <div className="fragment">
      <PageHeader title="Rapportages" sub="Alertvolume en SLA-prestaties voor de geselecteerde klantcontext." />
      <AlertTrend alerts={alerts} />
      <Panel title="SLA-prestaties" sub="Op basis van de eerste behandeling">
        <div className="slaoverview">
          <div className="donut" style={{ background: chartBackground }}>
            <div>
              <strong>{percentage === null ? '—' : percentage + '%'}</strong>
              <small>op tijd</small>
            </div>
          </div>
          <div>
            <p><span className="dot green" /> Binnen SLA <b>{onTime}</b></p>
            <p><span className="dot red" /> Te laat behandeld <b>{late}</b></p>
            <p><span className="dot orange" /> Open met SLA-risico <b>{atRisk}</b></p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
