import { Button } from './Ui';

interface PaginationProps {
  label: string;
  page: number;
  pageCount: number;
  firstRecord: number;
  lastRecord: number;
  totalRecords: number;
  setPage: (page: number) => void;
}

export default function Pagination({
  label,
  page,
  pageCount,
  firstRecord,
  lastRecord,
  totalRecords,
  setPage,
}: PaginationProps) {
  if (!totalRecords) return null;

  return (
    <nav className="wire-pagination" aria-label={label}>
      <Button disabled={page === 1} onClick={() => setPage(page - 1)}>
        Vorige
      </Button>
      <span aria-live="polite">
        Pagina {page} van {pageCount} · {firstRecord}–{lastRecord} van {totalRecords}
      </span>
      <Button disabled={page === pageCount} onClick={() => setPage(page + 1)}>
        Volgende
      </Button>
    </nav>
  );
}
