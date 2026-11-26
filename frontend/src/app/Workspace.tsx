import type { State } from '../types/soc';
import type { WorkspaceActions } from '../types/workspace';
import { AppShell } from '../components/AppShell';
import { Button, Icon } from '../components/Ui';
import CustomersPage from '../features/admin/CustomersPage';
import UsersPage from '../features/admin/UsersPage';
import AuditPage from '../features/admin/AuditPage';
import ErrorLog from '../features/admin/ErrorLog';
import DashboardPage from '../features/dashboard/DashboardPage';
import DemoAlertsPage from '../features/demo/DemoAlertsPage';
import { canViewDemoAlerts } from '../features/demo/demoAlerts';
import AccountPage from '../features/auth/AccountPage';
import ActionDialog from '../features/shared/ActionDialog';
import { getNavigation } from './navigation';

interface WorkspaceProps {
  state: State;
  actions: WorkspaceActions;
  refresh: () => Promise<boolean | undefined>;
  logout: () => Promise<void>;
  onTwoFactorEnabled: () => Promise<void>;
  onError: (error: unknown) => void;
}

function WorkspacePage({ state, actions, refresh, onTwoFactorEnabled, onError }: WorkspaceProps) {
  const pageProps = { state, ...actions };

  // Navigation is a UI convenience; the API enforces authorization independently.
  switch (state.page) {
    case 'dashboard':
      return <DashboardPage {...pageProps} />;
    case 'alerts':
      return canViewDemoAlerts(state.user) ? <DemoAlertsPage state={state} navigate={actions.navigate} /> : null;
    case 'customers':
      return actions.isAdmin ? <CustomersPage {...pageProps} /> : null;
    case 'users':
      return actions.isAdmin ? <UsersPage {...pageProps} /> : null;
    case 'audit':
      return actions.isAdmin ? <AuditPage {...pageProps} /> : null;
    case 'errors':
      return actions.isAdmin ? <ErrorLog errors={state.errors} reload={() => void refresh()} /> : null;
    case 'account':
      return state.user ? (
        <AccountPage user={state.user} onTwoFactorEnabled={onTwoFactorEnabled} onSessionExpired={onError} />
      ) : null;
    default:
      return null;
  }
}

export default function Workspace(props: WorkspaceProps) {
  const { state, actions, refresh, logout } = props;
  const { user, orgs, org } = state;
  if (!user) {
    return null;
  }

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
    </AppShell>
  );
}
