import type { State } from '../../types/soc';
import type { WorkspaceActions } from '../../types/workspace';
import { Badge, Button, PageHeader, Panel, Table } from '../../components/Ui';
import DemoAlertDashboard from '../demo/DemoAlertDashboard';
import { canViewDemoAlerts } from '../demo/demoAlerts';

interface DashboardProps extends WorkspaceActions {
  state: State;
}

export default function DashboardPage({ state, navigate, isAdmin }: DashboardProps) {
  const { user, orgs, users } = state;
  if (!user) {
    return null;
  }

  return (
    <div className="fragment">
      <PageHeader title="Dashboard" sub={'Welkom, ' + user.name} />
      {isAdmin ? (
        <div className="stats">
          <button type="button" className="stat admin-stat" onClick={() => navigate('customers')}>
            <div className="statline">Actieve klanten</div>
            <strong>{orgs.filter((organization) => organization.isActive).length}</strong>
            <small>Organisaties beheren</small>
          </button>
          <button type="button" className="stat admin-stat" onClick={() => navigate('users')}>
            <div className="statline">Actieve gebruikers</div>
            <strong>{users.filter((account) => account.isActive).length}</strong>
            <small>Accounts en rollen beheren</small>
          </button>
        </div>
      ) : (
        <Panel title="Mijn werkruimte" sub="Organisaties waartoe je toegang hebt">
          <Table head={['Organisatie', 'Status']} empty={!orgs.length}>
            {orgs.map((organization) => (
              <tr key={organization.id}>
                <td>{organization.name}</td>
                <td><Badge value="Actief" kind="good" /></td>
              </tr>
            ))}
          </Table>
        </Panel>
      )}
      {canViewDemoAlerts(user) && <DemoAlertDashboard state={state} navigate={navigate} />}
      <Panel title="Mijn account">
        <div className="bodypad">
          <p>Rol: {user.role}</p>
          <p>Tweestapsverificatie: {user.twoFactorEnabled ? 'Actief' : 'Niet actief'}</p>
          <Button onClick={() => navigate('account')}>Account bekijken</Button>
        </div>
      </Panel>
    </div>
  );
}
