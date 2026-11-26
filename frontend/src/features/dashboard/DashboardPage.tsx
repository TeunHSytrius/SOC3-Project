import type { State } from '../../types/soc';
import { Icon, Button, Panel, PageHeader } from '../../components/Ui';
import { active, isClosed, sla, caseMatchesView, sortRecords } from '../../types/domain';
import DashboardStats from './DashboardStats';
import DashboardAlerts from '../alerts/DashboardAlerts';
import DashboardTickets from './DashboardTickets';
import PlatformManagement from './PlatformManagement';
import type { Navigate, UpdateState } from '../../types/workspace';
interface DashboardPageProps {
  state: Pick<State, 'org' | 'user' | 'orgs' | 'users' | 'keys' | 'errors' | 'alerts' | 'cases'>;
  isAdmin: boolean;
  isAnalyst: boolean;
  customerName: (id: string) => string;
  navigate: Navigate;
  update: UpdateState;
  showQueue: (
    page: 'alerts' | 'cases',
    view?: State['archiveFilter'],
    mine?: boolean,
    ownerFilter?: string,
  ) => void;
}

export default function DashboardPage({
  state,
  isAdmin,
  isAnalyst,
  customerName,
  navigate,
  update,
  showQueue,
}: DashboardPageProps) {
  const { org, user } = state;
  const alerts = state.alerts.filter((alert) => !org || alert.organizationId === org);
  const cases = state.cases.filter((ticket) => !org || ticket.organizationId === org);
  const openAlerts = alerts.filter(active);
  const unassigned = openAlerts.filter(
    (alert) => !alert.owner && ['New', 'PendingReview'].includes(alert.status),
  );
  const risk = openAlerts.filter((alert) => sla(alert).kind === 'warn');
  const overdue = openAlerts.filter((alert) => sla(alert).kind === 'danger');
  const activeCases = cases.filter((ticket) => caseMatchesView(ticket, 'open'));
  const myCases = activeCases.filter((ticket) => ticket.ownerId === user?.id);
  const reviewCases = cases.filter((ticket) => caseMatchesView(ticket, 'resolved'));
  const newCases = cases.filter((ticket) => caseMatchesView(ticket, 'new'));
  const senior = user?.role === 'Senior analist';
  const admin = isAdmin;
  const workCases = admin ? activeCases : myCases;
  const summary: [string, number, string, string, string][] = admin
    ? [
        ['Nog op te pakken', unassigned.length, 'Onbeheerde alerts', 'alerts', 'blue'],
        [
          'Actieve tickets',
          activeCases.length,
          'Nieuw, in onderzoek of wachtend',
          'cases',
          'purple',
        ],
        ['SLA-risico', risk.length, 'Minder dan 15 minuten', 'clock', 'warn'],
        ['SLA te laat', overdue.length, 'Open alerts buiten SLA', 'alerts', 'danger'],
      ]
    : [
        ['Nog op te pakken', unassigned.length, 'Beschikbaar in de wachtrij', 'alerts', 'blue'],
        [
          senior ? 'Te prioriteren' : 'Mijn actieve tickets',
          senior ? newCases.length : myCases.length,
          senior ? 'Nieuwe onderzoeken' : 'Aan mij toegewezen',
          'cases',
          'purple',
        ],
        ['SLA-risico', risk.length, 'Minder dan 15 minuten', 'clock', 'warn'],
        ['SLA te laat', overdue.length, 'Open alerts buiten SLA', 'alerts', 'danger'],
      ];
  return (
    <div className="fragment soc-dashboard">
      <PageHeader
        title={admin ? 'Beheerdersdashboard' : 'SOC dashboard'}
        sub={
          admin
            ? 'Platformbeheer en toezicht op de beveiligingsmeldingen.'
            : 'Je werkvoorraad, nieuwe meldingen en lopende onderzoeken.'
        }
        action={
          isAnalyst && (
            <Button primary onClick={() => update({ modal: 'newAlert' })}>
              <Icon name="plus" /> Alert toevoegen
            </Button>
          )
        }
      />
      {admin && <PlatformManagement state={state} navigate={navigate} />}
      <section aria-label="Werkvoorraad">
        <h2 className="dashboard-section-title">{admin ? 'SOC-overzicht' : 'Werkvoorraad'}</h2>
        <DashboardStats items={summary} />
        <div className="dashboard-queues">
          <Panel
            title="Alertwachtrij"
            sub="Nog niet toegewezen · oudste eerst (FIFO)"
            action={
              <Button onClick={() => showQueue('alerts', 'open', false, 'unassigned')}>
                Wachtrij openen <Icon name="arrow" size={16} />
              </Button>
            }
          >
            <DashboardAlerts
              alerts={sortRecords(unassigned, 'oldest', true).slice(0, 3)}
              customerName={(id) => customerName(id)}
              open={(id) => navigate('alerts', id)}
            />
          </Panel>
          <Panel
            title={admin ? 'Actieve tickets' : 'Mijn actieve tickets'}
            sub="Meest recent aangemaakt"
            action={<Button onClick={() => showQueue('cases', 'open', !admin)}>Bekijk tickets <Icon name="arrow" size={16} /></Button>}
          >
            <DashboardTickets
              tickets={sortRecords(workCases, 'newest', false).slice(0, 3)}
              customerName={customerName}
              navigate={navigate}
            />
          </Panel>
        </div>
      </section>
      <section aria-label="Ticketwerkvoorraad">
        <h2 className="dashboard-section-title">Tickets</h2>
        <div className="dashboard-ticket-links">
          <Button onClick={() => showQueue('cases', 'new')}>Nieuw ({newCases.length})</Button>
          <Button onClick={() => showQueue('cases', 'open', !admin)}>
            {admin ? 'Actieve tickets' : 'Mijn actieve tickets'} ({workCases.length})
          </Button>
          <Button onClick={() => showQueue('cases', 'waiting')}>
            Wacht op klant ({cases.filter((ticket) => caseMatchesView(ticket, 'waiting')).length})
          </Button>
          <Button onClick={() => showQueue('cases', 'resolved')}>
            Af te sluiten ({reviewCases.length})
          </Button>
          <Button onClick={() => showQueue('cases', 'closed')}>
            Archief ({cases.filter(isClosed).length})
          </Button>
        </div>
      </section>
      <section aria-label="Recente meldingen">
        <Panel
            title="Recent ontvangen meldingen"
            sub="Alle statussen · nieuwste eerst"
            action={
              <Button
                onClick={() => {
                  showQueue('alerts', 'all');
                  update({ listSort: 'newest' });
                }}
              >
                Alle alerts <Icon name="arrow" size={16} />
              </Button>
            }
          >
            <DashboardAlerts
              alerts={sortRecords(alerts, 'newest', false).slice(0, 3)}
              customerName={(id) => customerName(id)}
              open={(id) => navigate('alerts', id)}
            />
        </Panel>
      </section>
      <div className="dashboard-report-link">
        <Button onClick={() => navigate('reports')}>Rapportages bekijken <Icon name="arrow" size={16} /></Button>
      </div>
    </div>
  );
}
