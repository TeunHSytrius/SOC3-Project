import { useState } from 'react';
import { Badge, Button, PageHeader, Panel, Table } from '../../components/Ui';
import { fmt } from '../../types/domain';
import type { ApiErrorEntry } from '../../types/soc';

export default function ErrorLog({
  errors,
  reload,
}: {
  errors: ApiErrorEntry[];
  reload: () => void;
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const filtered = errors.filter(
    (entry) =>
      (!status || String(entry.status).startsWith(status)) &&
      [entry.traceId, entry.route, entry.reason, entry.exceptionType, entry.status].some((value) =>
        String(value || '')
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
  );
  return (
    <>
      <PageHeader
        title="Foutenlog"
        sub="Technische API-fouten en geweigerde verzoeken."
        action={<Button onClick={reload}>Vernieuwen</Button>}
      />
      <div className="bodypad">
        <p>
          De laatste 500 fouten sinds het starten van de backend. Dit is een technisch overzicht,
          geen auditlog of overzicht van security-alerts. Klantinhoud, wachtwoorden en sleutels
          worden hier niet getoond.
        </p>
      </div>
      <Panel title="Recente fouten" sub={filtered.length + ' resultaten'}>
        <div className="filters">
          <input
            aria-label="Zoek fout"
            placeholder="Zoek foutreferentie, route of reden"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select
            aria-label="HTTP-status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">Alle fouten</option>
            <option value="4">4xx – verzoeken</option>
            <option value="5">5xx – serverfouten</option>
          </select>
        </div>
        <Table
          head={['Tijd', 'HTTP', 'Route', 'Reden', 'Exception', 'Foutreferentie']}
          empty={!filtered.length}
        >
          {filtered.map((entry, index) => (
            <tr key={entry.traceId + '-' + index}>
              <td>{fmt(entry.at)}</td>
              <td>
                <Badge
                  value={String(entry.status)}
                  kind={entry.status >= 500 ? 'danger' : 'warn'}
                />
              </td>
              <td>
                {entry.method} {entry.route}
              </td>
              <td>{entry.reason}</td>
              <td>{entry.exceptionType || '—'}</td>
              <td>
                <code>{entry.traceId}</code>
              </td>
            </tr>
          ))}
        </Table>
      </Panel>
    </>
  );
}
