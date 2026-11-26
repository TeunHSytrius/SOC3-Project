import type { State } from '../../types/soc';
import type { WorkspaceActions } from '../../types/workspace';

import { Badge, Button, Icon, Panel, PageHeader, Table } from '../../components/Ui';
import { fmt } from '../../types/domain';

interface PageProps extends WorkspaceActions {
  state: State;
}

export default function CustomersPage({ state, update, run }: PageProps) {
  return (
    <div className="fragment">
      <PageHeader
        title="Klantenbeheer"
        sub="Beheer organisaties en hun actieve status."
        action={
          <Button primary onClick={() => update({ modal: 'customer' })}>
            <Icon name="plus" /> Klant toevoegen
          </Button>
        }
      />
      <Panel title="Organisaties" sub={state.orgs.length + ' geregistreerde organisaties'}>
        <Table head={['Organisatie', 'Status', 'Aangemaakt', 'Actie']}>
          {state.orgs.map((organization) => (
            <tr key={organization.id}>
              <td>
                <b>{organization.name}</b>
              </td>
              <td>
                <Badge
                  value={organization.isActive ? 'Actief' : 'Inactief'}
                  kind={organization.isActive ? 'good' : 'neutral'}
                />
              </td>
              <td>{fmt(organization.createdAt)}</td>
              <td>
                <div className="actions">
                  <Button
                    onClick={() => update({ modal: 'customerEdit', selected: organization.id })}
                  >
                    Bewerken
                  </Button>
                  <Button
                    onClick={() => {
                      if (
                        window.confirm(
                          organization.isActive
                            ? 'Klant deactiveren? Historische gegevens blijven behouden.'
                            : 'Klant activeren?',
                        )
                      )
                        run(
                          `organizations/${organization.id}/${organization.isActive ? 'deactivate' : 'activate'}`,
                          {},
                          'Klantstatus bijgewerkt.',
                        );
                    }}
                  >
                    {organization.isActive ? 'Deactiveren' : 'Activeren'}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}
