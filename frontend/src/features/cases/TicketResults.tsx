import { useState } from 'react';
import type { ResearchCase } from '../../types/soc';
import { Button } from '../../components/Ui';
import { CaseCards } from '../alerts/AlertCards';
import TicketTable from './TicketTable';

const PAGE_SIZE = 15;

interface TicketResultsProps {
  tickets: ResearchCase[];
  canReadInternal: boolean;
  customerName: (id: string) => string;
  onOpen: (id: string) => void;
}

export default function TicketResults({ tickets, canReadInternal, customerName, onOpen }: TicketResultsProps) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(tickets.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const firstIndex = (currentPage - 1) * PAGE_SIZE;
  const visibleTickets = tickets.slice(firstIndex, firstIndex + PAGE_SIZE);

  return (
    <>
      {canReadInternal ? (
        <TicketTable tickets={visibleTickets} customerName={customerName} onOpen={onOpen} />
      ) : (
        <div className="bodypad">
          <CaseCards cases={visibleTickets} customerName={customerName} open={onOpen} />
        </div>
      )}
      {tickets.length > 0 && (
        <nav className="wire-pagination" aria-label="Ticketpaginering">
          <Button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Vorige</Button>
          <span aria-live="polite">
            Pagina {currentPage} van {pageCount} · {firstIndex + 1}–{firstIndex + visibleTickets.length} van {tickets.length}
          </span>
          <Button disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Volgende</Button>
        </nav>
      )}
    </>
  );
}
