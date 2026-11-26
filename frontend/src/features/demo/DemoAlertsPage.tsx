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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');
  const alerts = getDemoAlerts(state.orgs, state.org);
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const matchingAlerts = alerts.filter((alert) => {
    const searchableValues = [alert.number, alert.title, alert.organizationName, alert.source];
    const matchesQuery = searchableValues.some((value) =>
      value.toLowerCase().includes(normalizedQuery),
    );
    const matchesPriority = !selectedPriority || alert.priority === selectedPriority;

    return matchesQuery && matchesPriority;
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
          <input
            aria-label="Zoek meldingen"
            placeholder="Zoek titel, klant of bron"
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              pagination.setPage(1);
            }}
          />
          <select
            aria-label="Prioriteit"
            value={selectedPriority}
            onChange={(event) => {
              setSelectedPriority(event.target.value);
              pagination.setPage(1);
            }}
          >
            <option value="">Alle prioriteiten</option>
            <option>Kritiek</option>
            <option>Hoog</option>
            <option>Gemiddeld</option>
            <option>Laag</option>
          </select>
        </div>
        <DemoAlertTable
          alerts={pagination.visibleRecords}
          onOpen={(alertId) => navigate('alerts', alertId)}
        />
        {pagination.pageCount > 1 && (
          <Pagination {...pagination} label="Voorbeeldmeldingen paginering" />
        )}
      </Panel>
    </div>
  );
}
