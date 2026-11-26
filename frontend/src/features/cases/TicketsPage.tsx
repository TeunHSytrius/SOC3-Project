import type { State } from '../../types/soc';
import type { WorkspaceActions } from '../../types/workspace';

interface PageProps extends WorkspaceActions {
  state: State;
}
import { Badge, Button, Field, Icon, Panel, PageHeader, Select, Table } from '../../components/Ui';
import { active, alertGroup, caseMatchesView, fmt, isClosed, labels, nextCaseStates, priorities, roles, sla, sortRecords } from '../../types/domain';
import { CaseCards } from '../alerts/AlertCards';
import CaseDetailPage from './CaseDetailPage';
import TicketTable from './TicketTable';
import QueueFilters from '../shared/QueueFilters';
import { filterRecords } from '../shared/filterRecords';

export default function TicketsPage({ state, update, navigate, customerName, run, isAnalyst, canReadInternal, isAdmin }: PageProps) {
    const currentState = state;
    const selected = currentState.cases.find((ticket) => ticket.id === currentState.selected);
    if (selected) {
      return <CaseDetailPage ticket={selected} state={state} isAdmin={isAdmin} isAnalyst={isAnalyst} canReadInternal={canReadInternal} customerName={customerName} navigate={navigate} run={run} update={update} />;
    }
    const scoped = currentState.cases.filter((ticket) => !currentState.org || ticket.organizationId === currentState.org);
    const selectedTickets = scoped.filter((ticket) => caseMatchesView(ticket, currentState.archiveFilter));
    const filteredTickets = filterRecords(selectedTickets, state, customerName);
    const list =
      currentState.archiveFilter === 'closed' && currentState.listSort === 'default'
        ? filteredTickets
            .slice()
            .sort(
              (first, second) =>
                Date.parse(second.closedAt || second.createdAt) -
                Date.parse(first.closedAt || first.createdAt),
            )
        : sortRecords(filteredTickets, currentState.listSort, false);
    const tabs = [
      ['open', 'Actief', 'Alle nieuwe, lopende en wachtende tickets'],
      ['new', 'Nieuw', 'Nog te prioriteren en toe te wijzen'],
      ['working', 'In onderzoek', 'Wordt actief onderzocht'],
      ['waiting', 'Wacht op klant', 'Wacht op een reactie van de klant'],
      ['resolved', 'Af te sluiten', 'Opgelost of in eindbeoordeling'],
      ['closed', 'Archief', 'Definitief afgesloten tickets'],
      ['all', 'Alle tickets', 'Alle statussen, inclusief archief'],
    ] as const;
    const current = tabs.find(([mode]) => mode === currentState.archiveFilter) || tabs[0];
    return (
      <div className="fragment">
        <PageHeader
          title={canReadInternal ? 'Tickets / onderzoeken' : 'Mijn tickets'}
          sub={
            canReadInternal
              ? 'Selecteer de fase van het onderzoek. Nieuw betekent nog te prioriteren, niet recent aangemaakt.'
              : 'Bekijk alle voor jou vrijgegeven onderzoeken.'
          }
        />
        <div className="ticket-stage-tabs" role="group" aria-label="Ticketfase">
          {tabs.map(([mode, label, description]) => (
            <button
              key={mode}
              type="button"
              aria-pressed={currentState.archiveFilter === mode}
              title={description}
              onClick={() =>
                update({ archiveFilter: mode, filter: '', listSort: 'default' })
              }
            >
              <span>{label}</span>
              <b>{scoped.filter((ticket) => caseMatchesView(ticket, mode)).length}</b>
            </button>
          ))}
        </div>
        <Panel title="Zoeken en filteren"><QueueFilters type="cases" state={state} canReadInternal={canReadInternal} isAnalyst={isAnalyst} update={update} /></Panel>
        <Panel
          title={current[1]}
          sub={current[2] + ' · ' + list.length + ' van ' + selectedTickets.length + ' tickets'}
        >
          {canReadInternal ? (
            <TicketTable tickets={list} customerName={customerName} onOpen={id => navigate('cases', id)} />
          ) : (
            <div className="bodypad">
              <CaseCards
                cases={list}
                customerName={(id) => customerName(id)}
                open={(id) => navigate('cases', id)}
              />
            </div>
          )}
        </Panel>
      </div>
    );
  
}
