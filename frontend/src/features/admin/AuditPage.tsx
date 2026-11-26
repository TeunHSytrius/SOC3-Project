import type { State } from '../../types/soc';
import type { WorkspaceActions } from '../../types/workspace';

import { Panel, PageHeader, Table } from '../../components/Ui';
import { fmt } from '../../types/domain';

interface PageProps extends WorkspaceActions {
  state: State;
}

export default function AuditPage({ state, update, navigate, customerName, run, isAnalyst, canReadInternal, isAdmin }: PageProps) {
  const q = state.search.toLowerCase(),
    list = state.audit.filter((auditEntry) =>
      [auditEntry.actor, auditEntry.action, auditEntry.target, customerName(auditEntry.organizationId)].some((x) =>
        String(x || '')
          .toLowerCase()
          .includes(q),
      ),
    );
  return (
    <div className="fragment">
      <PageHeader title="Auditlog" sub="Controleer geregistreerde acties in het SOC-platform." />
      <Panel title="Activiteit" sub={list.length + ' gebeurtenissen'}>
        <div className="filters">
          <input
            aria-label="Auditlog zoeken"
            placeholder="Zoek gebruiker, actie of klant"
            value={state.search}
            onChange={(e) => update({ search: e.target.value })}
          />
        </div>
        <Table head={['Tijd', 'Gebruiker', 'Actie', 'Klant', 'Object']} empty={!list.length}>
          {list.map((auditEntry) => (
            <tr key={auditEntry.id}>
              <td>{fmt(auditEntry.createdAt)}</td>
              <td>{auditEntry.actor}</td>
              <td>{auditEntry.action}</td>
              <td>{auditEntry.organizationId ? customerName(auditEntry.organizationId) : '—'}</td>
              <td>{auditEntry.target || '—'}</td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
  
}
