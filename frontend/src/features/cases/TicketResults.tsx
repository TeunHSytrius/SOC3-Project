import type { ResearchCase } from '../../types/soc';
import Pagination from '../../components/Pagination';
import { usePagination } from '../../hooks/usePagination';
import TicketCards from './TicketCards';
import TicketTable from './TicketTable';

const PAGE_SIZE = 15;

interface TicketResultsProps {
  tickets: ResearchCase[];
  canReadInternal: boolean;
  customerName: (id: string) => string;
  onOpen: (id: string) => void;
}

export default function TicketResults({ tickets, canReadInternal, customerName, onOpen }: TicketResultsProps) {
  const pagination = usePagination(tickets, PAGE_SIZE);

  return (
    <>
      {canReadInternal ? (
        <TicketTable tickets={pagination.visibleRecords} customerName={customerName} onOpen={onOpen} />
      ) : (
        <div className="bodypad">
          <TicketCards cases={pagination.visibleRecords} customerName={customerName} open={onOpen} />
        </div>
      )}
      <Pagination {...pagination} label="Ticketpaginering" />
    </>
  );
}
