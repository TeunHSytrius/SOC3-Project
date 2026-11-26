import type { State } from '../../types/soc';
import type { WorkspaceActions } from '../../types/workspace';

import { Badge, Button, Icon, Panel, PageHeader, Table } from '../../components/Ui';

interface PageProps extends WorkspaceActions {
  state: State;
}

export default function ApiKeysPage({ state, update, navigate, customerName, run, isAnalyst, canReadInternal, isAdmin }: PageProps) {
  return (
    <div className="fragment">
      <PageHeader
        title="API-sleutels"
        sub="Beheer sleutels waarmee externe tools alerts kunnen aanleveren."
        action={
          <Button primary onClick={() => update({ modal: 'key' })}>
            <Icon name="plus" /> Sleutel maken
          </Button>
        }
      />
      {state.secret && (
        <Panel title="Nieuwe sleutel — eenmalig zichtbaar">
          <div className="bodypad">
            <code className="secret">{state.secret}</code>
            <p>
              Gebruik deze sleutel in de HTTP-header X-API-Key bij POST /api/v1/ingest/alerts.
            </p>
            <Button onClick={() => update({ secret: null })}>Verbergen</Button>
          </div>
        </Panel>
      )}
      <Panel title="Integraties">
        <Table head={['Tool', 'Klant', 'Sleutel', 'Status', '']} empty={!state.keys.length}>
          {state.keys.map((apiKey) => (
            <tr key={apiKey.id}>
              <td>{apiKey.name}</td>
              <td>{customerName(apiKey.organizationId)}</td>
              <td>
                <code>{apiKey.prefix}…</code>
              </td>
              <td>
                <Badge
                  value={apiKey.isActive ? 'Actief' : 'Ingetrokken'}
                  kind={apiKey.isActive ? 'good' : 'neutral'}
                />
              </td>
              <td>
                {apiKey.isActive && (
                  <Button
                    onClick={() => {
                      if (confirm('Sleutel definitief intrekken?'))
                        run(`keys/${apiKey.id}/revoke`, {}, 'Sleutel ingetrokken.');
                    }}
                  >
                    Intrekken
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
  
}
