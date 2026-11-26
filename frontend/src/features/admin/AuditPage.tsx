import type { State } from '../../types/soc';
import type { WorkspaceActions } from '../../types/workspace';

interface PageProps extends WorkspaceActions {
  state: State;
}
import { Badge, Button, Field, Icon, Panel, PageHeader, Select, Table } from '../../components/Ui';
import { active, alertGroup, caseMatchesView, fmt, isClosed, labels, nextCaseStates, priorities, roles, sla, sortRecords } from '../../types/domain';

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
