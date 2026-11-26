import type { State, Alert, ResearchCase } from '../../types/soc';
import { Icon, Badge, Button, Field, Select, Table, Panel, PageHeader } from '../../components/Ui';
import {
  labels,
  priorities,
  states,
  caseStates,
  active,
  isClosed,
  fmt,
  sla,
  caseMatchesView,
  sortRecords,
  nextCaseStates,
  roles,
} from '../../types/domain';
import DashboardStats from './DashboardStats';
import DashboardAlerts from '../alerts/DashboardAlerts';
import AlertTrend from '../alerts/AlertTrend';
import TicketTable from '../cases/TicketTable';
type Navigate = (page: string, selected?: string | null) => void;
type UpdateState = (update: Partial<State>) => void;
type RunAction = (
  path: string,
  data: Record<string, unknown>,
  message: string,
  after?: (result: any) => void,
) => Promise<void>;
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
  const { org, user, orgs, users, keys, errors } = state;
  const alerts = state.alerts.filter((alert) => !org || alert.organizationId === org);
  const cases = state.cases.filter((ticket) => !org || ticket.organizationId === org);
  const openAlerts = alerts.filter(active);
  const unassigned = openAlerts.filter(
    (alert) => !alert.owner && ['New', 'PendingReview'].includes(alert.status),
  );
  const risk = openAlerts.filter((alert) => sla(alert).kind === 'warn');
  const overdue = openAlerts.filter((alert) => sla(alert).kind === 'danger');
  const handled = alerts.filter((alert) => alert.firstHandledAt);
  const onTime = handled.filter((alert) => sla(alert).kind === 'good').length;
  const percentage = handled.length ? Math.round((100 * onTime) / handled.length) : null;
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
      {admin && (
        <section className="dashboard-management" aria-label="Platformbeheer">
          <h2>Platformbeheer</h2>
          <div className="dashboard-management-grid">
            {[
              {
                page: 'customers',
                label: 'Klanten',
                value: orgs.filter((item) => item.isActive).length,
                detail: 'Actieve organisaties',
                icon: 'customers',
              },
              {
                page: 'users',
                label: 'Gebruikers',
                value: users.filter((item) => item.isActive).length,
                detail: 'Actieve accounts',
                icon: 'users',
              },
              {
                page: 'keys',
                label: 'API-sleutels',
                value: keys.filter((item) => item.isActive).length,
                detail: 'Actieve integraties',
                icon: 'keys',
              },
              {
                page: 'errors',
                label: 'Foutenlog',
                value: errors.length,
                detail: 'Sinds backendstart',
                icon: 'alerts',
              },
            ].map((item) => (
              <button
                type="button"
                className="dashboard-management-item"
                key={item.page}
                onClick={() => navigate(item.page)}
              >
                <Icon name={item.icon} />
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </span>
                <b>{item.value}</b>
              </button>
            ))}
          </div>
          <Button onClick={() => navigate('audit')}>
            Auditlog bekijken <Icon name="arrow" size={16} />
          </Button>
        </section>
      )}
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
              alerts={sortRecords(unassigned, 'oldest', true).slice(0, 5)}
              customerName={(id) => customerName(id)}
              open={(id) => navigate('alerts', id)}
            />
          </Panel>
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
              alerts={sortRecords(alerts, 'newest', false).slice(0, 5)}
              customerName={(id) => customerName(id)}
              open={(id) => navigate('alerts', id)}
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
        <Panel
          title={admin ? 'Actieve onderzoeken' : 'Mijn actieve onderzoeken'}
          sub="Meest recent aangemaakt"
          action={
            <Button onClick={() => showQueue('cases', 'all')}>
              Alle tickets <Icon name="arrow" size={16} />
            </Button>
          }
        >
          <TicketTable
            tickets={sortRecords(workCases, 'newest', false).slice(0, 5)}
            customerName={customerName}
            onOpen={(id) => navigate('cases', id)}
          />
        </Panel>
      </section>
      <section aria-label="Rapportage">
        <h2 className="dashboard-section-title">Rapportage</h2>
        <AlertTrend alerts={alerts} />
        <Panel title="SLA-prestaties" sub="Op basis van de eerste behandeling">
          <div className="slaoverview">
            <div
              className="donut"
              style={{ background: `conic-gradient(#14836c ${percentage || 0}%, #e6edf1 0)` }}
            >
              <div>
                <strong>{percentage === null ? '—' : percentage + '%'}</strong>
                <small>op tijd</small>
              </div>
            </div>
            <div>
              <p>
                <span className="dot green" /> Binnen SLA <b>{onTime}</b>
              </p>
              <p>
                <span className="dot red" /> Te laat behandeld{' '}
                <b>{handled.filter((alert) => sla(alert).kind === 'danger').length}</b>
              </p>
              <p>
                <span className="dot orange" /> Open met SLA-risico <b>{risk.length}</b>
              </p>
            </div>
          </div>
        </Panel>
      </section>
    </div>
  );
}
