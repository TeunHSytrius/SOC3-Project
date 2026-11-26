import type { State } from '../../types/soc';
import type { WorkspaceActions } from '../../types/workspace';

import { Badge, Button, Icon, Panel, PageHeader, Table } from '../../components/Ui';

interface PageProps extends WorkspaceActions {
  state: State;
}

export default function UsersPage({
  state,
  update,
  navigate,
  customerName,
  run,
  isAnalyst,
  canReadInternal,
  isAdmin,
}: PageProps) {
  return (
    <div className="fragment">
      <PageHeader
        title="Gebruikers & rollen"
        sub="Beheer accounts en klanttoegang."
        action={
          <Button primary onClick={() => update({ modal: 'user', selected: null })}>
            <Icon name="plus" /> Gebruiker toevoegen
          </Button>
        }
      />
      <Panel title="Gebruikers">
        <Table head={['Naam', 'E-mail', 'Rol', 'Klanttoegang', 'Status', '2FA', '']}>
          {state.users.map((account) => (
            <tr key={account.id}>
              <td>
                <b>{account.name}</b>
              </td>
              <td>{account.email}</td>
              <td>{account.role}</td>
              <td>
                {account.organizationIds
                  .map((organizationId) => customerName(organizationId))
                  .join(', ') || '—'}
              </td>
              <td>
                <Badge
                  value={account.isActive ? 'Actief' : 'Inactief'}
                  kind={account.isActive ? 'good' : 'neutral'}
                />
              </td>
              <td>
                <Badge
                  value={account.twoFactorEnabled ? 'Actief' : 'Niet actief'}
                  kind={account.twoFactorEnabled ? 'good' : 'neutral'}
                />
              </td>
              <td>
                {account.id !== state.user.id ? (
                  <div className="actions">
                    <Button onClick={() => update({ modal: 'userAccess', selected: account.id })}>
                      Bewerken
                    </Button>
                    <button
                      type="button"
                      className="remove-user"
                      disabled={state.busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            'Gebruiker ' +
                              account.name +
                              ' verwijderen? Toegang wordt ingetrokken. Ticket- en audithistorie blijft behouden.',
                          )
                        )
                          void run('users/' + account.id + '/remove', {}, 'Gebruiker verwijderd.');
                      }}
                    >
                      Verwijderen
                    </button>
                  </div>
                ) : (
                  <small>Eigen account</small>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}
