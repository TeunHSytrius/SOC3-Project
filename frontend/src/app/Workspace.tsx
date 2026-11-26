import type { Alert, State } from '../types/soc';
import type { WorkspaceActions } from '../types/workspace';
import { AppShell } from '../components/AppShell';
import { Button, Icon } from '../components/Ui';
import AlertsPage from '../features/alerts/AlertsPage';
import TicketsPage from '../features/cases/TicketsPage';
import CustomersPage from '../features/admin/CustomersPage';
import UsersPage from '../features/admin/UsersPage';
import ApiKeysPage from '../features/admin/ApiKeysPage';
import AuditPage from '../features/admin/AuditPage';
import ErrorLog from '../features/admin/ErrorLog';
import TicketRegister from '../features/admin/TicketRegister';
import DashboardPage from '../features/dashboard/DashboardPage';
import ReportsPage from '../features/dashboard/ReportsPage';
import AccountPage from '../features/auth/AccountPage';
import ActionDialog from '../features/shared/ActionDialog';
import AlertNotifications from '../features/alerts/AlertNotifications';
import { getNavigation } from './navigation';

interface WorkspaceProps {
  state: State;
  actions: WorkspaceActions;
  refresh: () => Promise<boolean | undefined>;
  logout: () => Promise<void>;
  onTwoFactorEnabled: () => Promise<void>;
  onError: (error: unknown) => void;
  showQueue: (page: 'alerts' | 'cases', view?: State['archiveFilter'], mine?: boolean, ownerFilter?: string) => void;
  openNotification: (alert: Alert) => Promise<void>;
  dismissNotification: (id: string) => void;
}

function WorkspacePage({ state, actions, refresh, showQueue, onTwoFactorEnabled, onError }: WorkspaceProps) {
  const pageProps = { state, ...actions };

  // Navigation is a UI convenience; the API enforces authorization independently.
  switch (state.page) {
    case 'dashboard':
      return <DashboardPage {...pageProps} showQueue={showQueue} />;
    case 'reports':
      return actions.canReadInternal ? <ReportsPage state={state} /> : null;
    case 'alerts':
      return <AlertsPage {...pageProps} />;
    case 'cases':
      return <TicketsPage {...pageProps} />;
    case 'customers':
      return <CustomersPage {...pageProps} />;
    case 'users':
      return <UsersPage {...pageProps} />;
    case 'keys':
      return <ApiKeysPage {...pageProps} />;
    case 'audit':
      return <AuditPage {...pageProps} />;
    case 'errors':
      return actions.isAdmin ? <ErrorLog errors={state.errors} reload={() => void refresh()} /> : null;
    case 'ticket-register':
      return actions.isAdmin ? (
        <TicketRegister
          tickets={state.ticketRegister}
          organizations={state.orgs}
          organizationId={state.org}
          onOrganizationChange={(id) => actions.update({ org: id })}
          reload={() => void refresh()}
        />
      ) : null;
    case 'account':
      return state.user ? (
        <AccountPage user={state.user} onTwoFactorEnabled={onTwoFactorEnabled} onSessionExpired={onError} />
      ) : null;
    default:
      return null;
  }
}

export default function Workspace(props: WorkspaceProps) {
  const { state, actions, refresh, logout, openNotification, dismissNotification } = props;
  const { user, orgs, org } = state;
  if (!user) return null;

  const customerOptions = [
    { id: '', name: 'Alle klanten' },
    ...orgs.map((organization) => ({ id: organization.id, name: organization.name })),
  ];
  const customer = orgs.find((organization) => organization.id === org) ||
    (orgs.length === 1 ? orgs[0] : customerOptions[0]);

  return (
    <AppShell
      user={{ displayName: user.name, role: user.role }}
      customer={customer}
      customerOptions={orgs.length > 1 ? customerOptions : []}
      onCustomerChange={(id) =>
        actions.update({
          org: id,
          selected: null,
          ownerFilter: '',
          sourceFilter: '',
          category: '',
        })
      }
      navigationItems={getNavigation(user)}
      currentPath={state.page === 'dashboard' ? '/' : '/' + state.page}
      onNavigate={(href) => actions.navigate(href === '/' ? 'dashboard' : href.slice(1))}
      actions={
        <>
          <Button onClick={() => refresh()}>
            <Icon name="refresh" size={16} /> Vernieuwen
          </Button>
          <Button onClick={() => logout()}>
            <Icon name="logout" size={16} /> Uitloggen
          </Button>
        </>
      }
    >
      {state.error && (
        <div className="error" role="alert">
          {state.error}
          <button onClick={() => actions.update({ error: '' })}>×</button>
        </div>
      )}
      {state.notice && (
        <div className="notice" role="status">
          {state.notice}
          <button onClick={() => actions.update({ notice: '' })}>×</button>
        </div>
      )}
      <WorkspacePage {...props} />
      {state.modal && <ActionDialog state={state} {...actions} />}
      {actions.canReadInternal && !user.requiresTwoFactorSetup && (
        <AlertNotifications
          alerts={state.alertNotifications}
          customerName={actions.customerName}
          onOpen={openNotification}
          onDismiss={dismissNotification}
          busy={state.busy || !!state.modal}
        />
      )}
    </AppShell>
  );
}
