import type { State } from '../../types/soc';
import type { WorkspaceActions } from '../../types/workspace';

interface PageProps extends WorkspaceActions {
  state: State;
}
import { Badge, Button, Field, Icon, Panel, PageHeader, Select, Table } from '../../components/Ui';
import { active, alertGroup, caseMatchesView, fmt, isClosed, labels, nextCaseStates, priorities, roles, sla, sortRecords } from '../../types/domain';

export default function CustomersPage({ state, update, navigate, customerName, run, isAnalyst, canReadInternal, isAdmin }: PageProps) {
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
          <Table head={['Organisatie', 'Status', 'Reactie-SLA', 'Aangemaakt', 'Actie']}>
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
                <td>{organization.responseMinutes} min</td>
                <td>{fmt(organization.createdAt)}</td>
                <td>
                  <div className="actions">
                    <Button
                      onClick={() => {
                        navigate('cases');
                        update({ org: organization.id, archiveFilter: 'all' });
                      }}
                    >
                      Tickets (
                      {state.ticketRegister.filter((t) => t.organizationId === organization.id).length})
                    </Button>
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
