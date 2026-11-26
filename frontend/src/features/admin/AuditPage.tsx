import Pagination from '../../components/Pagination';
import { usePagination } from '../../hooks/usePagination';
import type { State } from '../../types/soc';
import type { WorkspaceActions } from '../../types/workspace';
import { Panel, PageHeader, Table } from '../../components/Ui';
import { fmt } from '../../types/domain';

const PAGE_SIZE = 15;

interface AuditPageProps {
  state: Pick<State, 'audit' | 'search'>;
  update: WorkspaceActions['update'];
  customerName: WorkspaceActions['customerName'];
}

export default function AuditPage({ state, update, customerName }: AuditPageProps) {
  const searchQuery = state.search.trim().toLowerCase();

  const matchingEntries = state.audit.filter((entry) => {
    const searchableValues = [
      entry.actor,
      entry.action,
      entry.target,
      entry.organizationId ? customerName(entry.organizationId) : '',
    ];

    return searchableValues.some((value) =>
      String(value || '').toLowerCase().includes(searchQuery),
    );
  });

  const pagination = usePagination(matchingEntries, PAGE_SIZE);

  function handleSearchChange(value: string) {
    update({ search: value });
    pagination.setPage(1);
  }

  return (
    <div className="fragment">
      <PageHeader title="Auditlog" sub="Controleer geregistreerde acties in het SOC-platform." />

      <Panel title="Activiteit" sub={matchingEntries.length + ' gebeurtenissen'}>
        <div className="filters">
          <input
            aria-label="Auditlog zoeken"
            placeholder="Zoek gebruiker, actie of klant"
            value={state.search}
            onChange={(event) => handleSearchChange(event.target.value)}
          />
        </div>

        <Table
          head={['Tijd', 'Gebruiker', 'Actie', 'Klant', 'Object']}
          empty={!pagination.visibleRecords.length}
        >
          {pagination.visibleRecords.map((entry) => (
            <tr key={entry.id}>
              <td>{fmt(entry.createdAt)}</td>
              <td>{entry.actor}</td>
              <td>{entry.action}</td>
              <td>{entry.organizationId ? customerName(entry.organizationId) : '—'}</td>
              <td>{entry.target || '—'}</td>
            </tr>
          ))}
        </Table>

        <Pagination {...pagination} label="Auditlog paginering" />
      </Panel>
    </div>
  );
}
