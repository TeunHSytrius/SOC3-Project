import { Button, Panel } from '../../components/Ui';
import type { State } from '../../types/soc';
import type { Navigate } from '../../types/workspace';
import DemoAlertTable from './DemoAlertTable';
import DemoBanner from './DemoBanner';
import { getDemoAlerts } from './demoAlerts';
import './DemoAlerts.css';

interface DemoAlertDashboardProps {
  state: Pick<State, 'orgs' | 'org'>;
  navigate: Navigate;
}

export default function DemoAlertDashboard({ state, navigate }: DemoAlertDashboardProps) {
  const alerts = getDemoAlerts(state.orgs, state.org);
  const metrics = [
    { label: 'Voorbeeldmeldingen', value: alerts.length },
    { label: 'Nieuw', value: alerts.filter((alert) => alert.status === 'Nieuw').length },
    {
      label: 'In beoordeling',
      value: alerts.filter((alert) => alert.status === 'In beoordeling').length,
    },
    {
      label: 'Kritiek / hoog',
      value: alerts.filter((alert) => alert.priority === 'Kritiek' || alert.priority === 'Hoog')
        .length,
    },
  ];

  return (
    <section className="demo-alert-dashboard" aria-label="SOC-werkoverzicht">
      <DemoBanner />
      <div className="demo-metrics">
        {metrics.map((metric) => (
          <div key={metric.label} className="demo-metric">
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </div>
        ))}
      </div>
      <Panel
        title="Alertwachtrij"
        sub="Voorbeeld van de toekomstige alertverwerking"
        action={<Button onClick={() => navigate('alerts')}>Alle alerts</Button>}
      >
        <DemoAlertTable
          alerts={alerts.slice(0, 5)}
          onOpen={(alertId) => navigate('alerts', alertId)}
        />
      </Panel>
    </section>
  );
}
