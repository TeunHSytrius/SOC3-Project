import type { State, Alert, ResearchCase } from '../../types/soc';
import { Icon, Badge, Button, Field, Select, Table, Panel, PageHeader } from '../../components/Ui';
import {
  labels,
  priorities,
  states,
  caseStates,
  active,
  isClosed,
  fmt,
  sla,
  caseMatchesView,
  sortRecords,
  nextCaseStates,
  roles,
} from '../../types/domain';
interface TicketTableProps {
  tickets: ResearchCase[];
  customerName: (id: string) => string;
  onOpen: (id: string) => void;
}

export default function TicketTable({ tickets, customerName, onOpen }: TicketTableProps) {
  return (
    <Table
      head={['Case', 'Klant', 'Prioriteit', 'Status', 'Eigenaar', 'Aangemaakt', 'Afgesloten', '']}
      empty={!tickets.length}
    >
      {tickets.map((ticket) => (
        <tr key={ticket.id}>
          <td>
            <button className="rowlink" onClick={() => onOpen(ticket.id)}>
              {ticket.title}
            </button>
            <small>{ticket.number}</small>
          </td>
          <td>{customerName(ticket.organizationId)}</td>
          <td>
            <Badge value={ticket.priority} />
          </td>
          <td>
            <Badge value={ticket.status} />
          </td>
          <td>{ticket.owner}</td>
          <td>{fmt(ticket.createdAt)}</td>
          <td>{fmt(ticket.closedAt)}</td>
          <td>
            <button
              className="arrowbtn"
              onClick={() => onOpen(ticket.id)}
              aria-label={'Open ' + ticket.number}
            >
              →
            </button>
          </td>
        </tr>
      ))}
    </Table>
  );
}
