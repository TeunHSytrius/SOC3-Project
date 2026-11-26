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
  const scoped = tickets.filter((ticket) => !organizationId || ticket.organizationId === organizationId);
  const closed = scoped.filter((ticket) => ticket.status === 'Closed');
  const filtered = scoped
    .filter(
      (ticket) =>
        (mode === 'all' || (mode === 'closed') === (ticket.status === 'Closed')) &&
        (ticket.number + ' ' + (organizations.find((organization) => organization.id === ticket.organizationId)?.name || ''))
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((first, second) => Date.parse(second.closedAt || second.createdAt) - Date.parse(first.closedAt || first.createdAt));
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
            onChange={(event) => onOrganizationChange(event.target.value)}
          >
            <option value="">Alle klanten</option>
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
                {!organization.isActive ? ' (inactief)' : ''}
              </option>
            ))}
          </select>
          <input
            aria-label="Zoek ticket"
            placeholder="Zoek ticketnummer of klant"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Table
          head={['Ticketnummer', 'Klant', 'Status', 'Aangemaakt', 'Afgesloten']}
          empty={!filtered.length}
        >
          {filtered.map((ticket) => (
            <tr key={ticket.id}>
              <td>
                <b>{ticket.number}</b>
              </td>
              <td>{organizations.find((organization) => organization.id === ticket.organizationId)?.name || '—'}</td>
              <td>
                <Badge value={ticket.status} />
              </td>
              <td>{fmt(ticket.createdAt)}</td>
              <td>{fmt(ticket.closedAt)}</td>
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
