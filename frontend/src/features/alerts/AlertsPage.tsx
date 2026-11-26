import type { State } from '../../types/soc';
import type { WorkspaceActions } from '../../types/workspace';

import { Button, Panel, PageHeader } from '../../components/Ui';
import { alertGroup, sortRecords } from '../../types/domain';
import { AlertCards } from './AlertCards';
import AlertDetailPage from './AlertDetailPage';
import QueueFilters from '../shared/QueueFilters';
import { filterRecords } from '../shared/filterRecords';

interface PageProps extends WorkspaceActions {
  state: State;
}

export default function AlertsPage({ state, update, navigate, customerName, run, isAnalyst, canReadInternal, isAdmin }: PageProps) {
  const currentState = state;
  const selected = currentState.alerts.find((alert) => alert.id === currentState.selected);
  if (selected) {
    return <AlertDetailPage alert={selected} state={state} isAdmin={isAdmin} isAnalyst={isAnalyst} customerName={customerName} navigate={navigate} run={run} update={update} />;
  }
  const scoped = currentState.alerts.filter((alert) => !currentState.org || alert.organizationId === currentState.org);
  const list = sortRecords(
    filterRecords(scoped, state, customerName).filter(
      (alert) => currentState.archiveFilter === 'all' || alertGroup(alert) === currentState.archiveFilter,
    ),
    currentState.listSort,
    currentState.archiveFilter === 'open',
  );
  const tabs = [
    ['open', 'Openstaand', scoped.filter((alert) => alertGroup(alert) === 'open').length],
    ['linked', 'Gekoppeld aan case', scoped.filter((alert) => alertGroup(alert) === 'linked').length],
    ['closed', 'Afgehandeld', scoped.filter((alert) => alertGroup(alert) === 'closed').length],
    ['all', 'Alle alerts', scoped.length],
  ] as const;
  return (
    <div className="wire-screen">
      <PageHeader
        title="Alerts"
        sub="Nieuwe, lopende en afgehandelde beveiligingsmeldingen."
        action={
          isAnalyst && (
            <Button primary onClick={() => update({ modal: 'newAlert' })}>
              Alert toevoegen
            </Button>
          )
        }
      />
      <div className="archive-tabs" role="group" aria-label="Alertstatus">
        {tabs.map(([mode, label, count]) => (
          <button
            key={mode}
            aria-pressed={currentState.archiveFilter === mode}
            onClick={() =>
              update({ archiveFilter: mode, filter: '', listSort: 'default' })
            }
          >
            {label} ({count})
          </button>
        ))}
      </div>
      <Panel title="Filters"><QueueFilters type="alerts" state={state} canReadInternal={canReadInternal} isAnalyst={isAnalyst} update={update} /></Panel>
      <p className="wire-count">
        {list.length} van {scoped.length} meldingen ·{' '}
        {currentState.listSort === 'priority'
          ? 'hoogste prioriteit eerst'
          : currentState.listSort === 'oldest' || (currentState.listSort === 'default' && currentState.archiveFilter === 'open')
            ? 'oudste eerst'
            : 'nieuwste eerst'}
      </p>
      <AlertCards
        key={[
          currentState.org,
          currentState.archiveFilter,
          currentState.search,
          currentState.filter,
          currentState.priority,
          currentState.category,
          currentState.fromDate,
          currentState.toDate,
          currentState.mine,
          currentState.ownerFilter,
          currentState.slaFilter,
          currentState.sourceFilter,
          currentState.listSort,
        ].join('|')}
        alerts={list}
        customerName={(id) => customerName(id)}
        open={(id) => navigate('alerts', id)}
        busy={currentState.busy}
      />
    </div>
  );
  
}
