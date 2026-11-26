import type { State } from '../../types/soc';
import { Icon, Button, Panel, PageHeader } from '../../components/Ui';
import { getDashboardOverview } from './dashboardOverview';
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
  const { metrics, ticketCounts, alertQueue, ticketQueue, recentAlerts } = getDashboardOverview(state, isAdmin);

  return (
    <div className="fragment soc-dashboard">
      <PageHeader
        title={isAdmin ? 'Beheerdersdashboard' : 'Werkoverzicht'}
        sub={
          isAdmin
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
      {isAdmin && <PlatformManagement state={state} navigate={navigate} />}
      <section aria-label="Werkvoorraad">
        {isAdmin && <h2 className="dashboard-section-title">SOC-overzicht</h2>}
        <DashboardStats items={metrics} />
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
              alerts={alertQueue}
              customerName={customerName}
              open={(id) => navigate('alerts', id)}
            />
          </Panel>
          <Panel
            title={isAdmin ? 'Actieve tickets' : 'Mijn actieve tickets'}
            sub="Meest recent aangemaakt"
            action={<Button onClick={() => showQueue('cases', 'open', !isAdmin)}>Bekijk tickets <Icon name="arrow" size={16} /></Button>}
          >
            <DashboardTickets
              tickets={ticketQueue}
              customerName={customerName}
              navigate={navigate}
            />
            <div className="dashboard-ticket-links" aria-label="Ticketfasen">
              <Button onClick={() => showQueue('cases', 'new')}>Nieuw ({ticketCounts.new})</Button>
              <Button onClick={() => showQueue('cases', 'waiting')}>
                Wacht op klant ({ticketCounts.waiting})
              </Button>
              <Button onClick={() => showQueue('cases', 'resolved')}>
                Af te sluiten ({ticketCounts.resolved})
              </Button>
              <Button onClick={() => showQueue('cases', 'closed')}>Archief ({ticketCounts.closed})</Button>
            </div>
          </Panel>
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
              alerts={recentAlerts}
              customerName={(id) => customerName(id)}
              open={(id) => navigate('alerts', id)}
            />
        </Panel>
      </section>
    </div>
  );
}
