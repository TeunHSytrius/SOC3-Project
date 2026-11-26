import { useState } from 'react';
import { PageHeader, Panel } from '../../components/Ui';
import Pagination from '../../components/Pagination';
import { usePagination } from '../../hooks/usePagination';
import type { State } from '../../types/soc';
import type { Navigate } from '../../types/workspace';
import DemoAlertDetails from './DemoAlertDetails';
import DemoAlertTable from './DemoAlertTable';
import DemoBanner from './DemoBanner';
import { getDemoAlerts } from './demoAlerts';
import './DemoAlerts.css';

interface DemoAlertsPageProps {
  state: Pick<State, 'orgs' | 'org' | 'selected'>;
  navigate: Navigate;
}

export default function DemoAlertsPage({ state, navigate }: DemoAlertsPageProps) {
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState('');
  const alerts = getDemoAlerts(state.orgs, state.org);
  const query = search.trim().toLowerCase();
  const matchingAlerts = alerts.filter((alert) => {
    const matchesQuery = [alert.number, alert.title, alert.organizationName, alert.source]
      .some((value) => value.toLowerCase().includes(query));
    return matchesQuery && (!priority || alert.priority === priority);
  });
  const pagination = usePagination(matchingAlerts, 12);
  const selectedAlert = alerts.find((alert) => alert.id === state.selected);

  if (selectedAlert) {
    return <DemoAlertDetails alert={selectedAlert} onBack={() => navigate('alerts')} />;
  }

  return (
    <div className="fragment">
      <PageHeader title="Alerts" sub="Voorbeeld van het SOC-alertoverzicht" />
      <DemoBanner />
      <Panel title="Meldingen" sub={matchingAlerts.length + ' voorbeeldmeldingen'}>
        <div className="filters">
          <input aria-label="Zoek meldingen" placeholder="Zoek titel, klant of bron" value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              pagination.setPage(1);
            }} />
          <select aria-label="Prioriteit" value={priority}
            onChange={(event) => {
              setPriority(event.target.value);
              pagination.setPage(1);
            }}>
            <option value="">Alle prioriteiten</option>
            <option>Kritiek</option>
            <option>Hoog</option>
            <option>Gemiddeld</option>
            <option>Laag</option>
          </select>
        </div>
        <DemoAlertTable alerts={pagination.visibleRecords} onOpen={(alertId) => navigate('alerts', alertId)} />
        {pagination.pageCount > 1 && <Pagination {...pagination} label="Voorbeeldmeldingen paginering" />}
      </Panel>
    </div>
  );
}
