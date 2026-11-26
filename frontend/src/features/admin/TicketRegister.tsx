import { useState } from 'react';
import type { Organization, TicketRegisterRow } from '../../types/soc';
import { Badge, Button, PageHeader, Panel, Table } from '../../components/Ui';
import { fmt } from '../../types/domain';

export default function TicketRegister({
  tickets,
  organizations,
  organizationId,
  onOrganizationChange,
  reload,
}: {
  tickets: TicketRegisterRow[];
  organizations: Organization[];
  organizationId: string;
  onOrganizationChange: (id: string) => void;
  reload: () => void;
}) {
  const [mode, setMode] = useState<'all' | 'open' | 'closed'>('all');
  const [query, setQuery] = useState('');
  const scoped = tickets.filter((t) => !organizationId || t.organizationId === organizationId);
  const closed = scoped.filter((t) => t.status === 'Closed');
  const filtered = scoped
    .filter(
      (t) =>
        (mode === 'all' || (mode === 'closed') === (t.status === 'Closed')) &&
        (t.number + ' ' + (organizations.find((o) => o.id === t.organizationId)?.name || ''))
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) => Date.parse(b.closedAt || b.createdAt) - Date.parse(a.closedAt || a.createdAt));
  return (
    <>
      <PageHeader
        title="Ticketregister"
        sub="Actieve en historische tickets per klantorganisatie."
        action={<Button onClick={reload}>Vernieuwen</Button>}
      />
      <div className="archive-tabs" role="group" aria-label="Ticketstatus">
        <button aria-pressed={mode === 'all'} onClick={() => setMode('all')}>
          Alle tickets ({scoped.length})
        </button>
        <button aria-pressed={mode === 'open'} onClick={() => setMode('open')}>
          Lopend ({scoped.length - closed.length})
        </button>
        <button aria-pressed={mode === 'closed'} onClick={() => setMode('closed')}>
          Archief ({closed.length})
        </button>
      </div>
      <Panel
        title="Tickets per klant"
        sub="Administratieve metadata; geen interne onderzoeksgegevens."
      >
        <div className="filters">
          <select
            aria-label="Klantorganisatie"
            value={organizationId}
            onChange={(e) => onOrganizationChange(e.target.value)}
          >
            <option value="">Alle klanten</option>
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
                {!o.isActive ? ' (inactief)' : ''}
              </option>
            ))}
          </select>
          <input
            aria-label="Zoek ticket"
            placeholder="Zoek ticketnummer of klant"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Table
          head={['Ticketnummer', 'Klant', 'Status', 'Aangemaakt', 'Afgesloten']}
          empty={!filtered.length}
        >
          {filtered.map((t) => (
            <tr key={t.id}>
              <td>
                <b>{t.number}</b>
              </td>
              <td>{organizations.find((o) => o.id === t.organizationId)?.name || '—'}</td>
              <td>
                <Badge value={t.status} />
              </td>
              <td>{fmt(t.createdAt)}</td>
              <td>{fmt(t.closedAt)}</td>
            </tr>
          ))}
        </Table>
      </Panel>
      <p className="admin-access-note">
        Het register bevat ook tickets van inactieve klanten. Open Tickets in de navigatie om als
        beheerder de volledige dossiers te bekijken.
      </p>
    </>
  );
}
