import { useState } from 'react';
import type { State } from '../../types/soc';
import type { WorkspaceActions } from '../../types/workspace';
import { Button, Panel, PageHeader, Table } from '../../components/Ui';
import { fmt } from '../../types/domain';

const PAGE_SIZE = 15;

interface AuditPageProps {
  state: Pick<State, 'audit' | 'search'>;
  update: WorkspaceActions['update'];
  customerName: WorkspaceActions['customerName'];
}

export default function AuditPage({ state, update, customerName }: AuditPageProps) {
  const [page, setPage] = useState(1);
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

  // Keep the current page valid if the audit log changes after a refresh.
  const pageCount = Math.max(1, Math.ceil(matchingEntries.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const visibleEntries = matchingEntries.slice(startIndex, startIndex + PAGE_SIZE);

  function handleSearchChange(value: string) {
    update({ search: value });
    setPage(1);
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
          empty={!visibleEntries.length}
        >
          {visibleEntries.map((entry) => (
            <tr key={entry.id}>
              <td>{fmt(entry.createdAt)}</td>
              <td>{entry.actor}</td>
              <td>{entry.action}</td>
              <td>{entry.organizationId ? customerName(entry.organizationId) : '—'}</td>
              <td>{entry.target || '—'}</td>
            </tr>
          ))}
        </Table>

        {matchingEntries.length > 0 && (
          <nav className="wire-pagination" aria-label="Auditlog paginering">
            <Button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
              Vorige
            </Button>

            <span aria-live="polite">
              Pagina {currentPage} van {pageCount} · {startIndex + 1}–{startIndex + visibleEntries.length} van {matchingEntries.length}
            </span>

            <Button
              disabled={currentPage === pageCount}
              onClick={() => setPage(currentPage + 1)}
            >
              Volgende
            </Button>
          </nav>
        )}
      </Panel>
    </div>
  );
}
