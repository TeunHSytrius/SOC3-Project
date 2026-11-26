import type { Alert, ResearchCase, State } from '../../types/soc';
import { sla } from '../../types/domain';

function searchableValues(record: Alert | ResearchCase, customerName: (id: string) => string) {
  const values = [record.title, record.number, record.owner, customerName(record.organizationId)];

  if ('source' in record) {
    values.push(
      record.source,
      record.description,
      record.externalEventId,
      ...Object.values(record.security || {}).map(String),
    );
  } else {
    values.push(...record.entries.map((entry) => entry.text));
  }

  return values;
}

export function filterRecords<T extends Alert | ResearchCase>(
  records: T[],
  state: State,
  customerName: (id: string) => string,
): T[] {
  const searchQuery = state.search.trim().toLowerCase();
  const startDate = state.fromDate ? new Date(state.fromDate + 'T00:00:00') : null;
  const endDate = state.toDate ? new Date(state.toDate + 'T23:59:59.999') : null;

  return records.filter((record) => {
    const createdAt = new Date(record.createdAt);

    if (state.org && record.organizationId !== state.org) return false;
    if (state.filter && record.status !== state.filter) return false;
    if (state.priority && record.priority !== state.priority) return false;
    if (startDate && createdAt < startDate) return false;
    if (endDate && createdAt > endDate) return false;
    if (state.mine && (!state.user || record.ownerId !== state.user.id)) return false;

    if (state.ownerFilter === 'unassigned' && record.ownerId) return false;
    if (state.ownerFilter && state.ownerFilter !== 'unassigned' &&
        record.owner !== state.ownerFilter) return false;

    if ('source' in record) {
      if (state.slaFilter && sla(record).kind !== state.slaFilter) return false;
      if (state.sourceFilter && record.source !== state.sourceFilter) return false;

      const category = record.security?.category || 'Niet geclassificeerd';
      if (state.category && category !== state.category) return false;
    }

    return !searchQuery || searchableValues(record, customerName).some((value) =>
      String(value || '').toLowerCase().includes(searchQuery),
    );
  });
}
