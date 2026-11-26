import { useState } from 'react';

export function usePagination<T>(records: T[], pageSize: number) {
  const [requestedPage, setRequestedPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(records.length / pageSize));
  const page = Math.min(requestedPage, pageCount);
  const startIndex = (page - 1) * pageSize;
  const visibleRecords = records.slice(startIndex, startIndex + pageSize);

  // A refresh can remove records from the last page. Do not jump back when new data arrives.
  if (requestedPage !== page) {
    setRequestedPage(page);
  }

  return {
    page,
    pageCount,
    firstRecord: records.length ? startIndex + 1 : 0,
    lastRecord: startIndex + visibleRecords.length,
    totalRecords: records.length,
    visibleRecords,
    setPage: setRequestedPage,
  };
}
