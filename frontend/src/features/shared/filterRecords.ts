import type { Alert, ResearchCase, State } from '../../types/soc';
import { sla } from '../../types/domain';

export function filterRecords<T extends Alert | ResearchCase>(
  items: T[],
  state: State,
  customerName: (id: string) => string,
): T[] {
    const {
      org,
      search,
      filter,
      priority,
      category,
      fromDate,
      toDate,
      mine,
      user,
      ownerFilter,
      slaFilter,
      sourceFilter,
    } = state;
    const searchQuery = search.trim().toLowerCase();
    return items.filter((record) => {
      const date = new Date(record.createdAt);
      if (
        (org && record.organizationId !== org) ||
        (filter && record.status !== filter) ||
        (priority && record.priority !== priority)
      )
        return false;
      if (fromDate && date < new Date(fromDate + 'T00:00:00')) return false;
      if (toDate && date > new Date(toDate + 'T23:59:59.999')) return false;
      if (mine && ('source' in record ? record.owner !== user?.name : record.ownerId !== user?.id)) return false;
      if (
        (ownerFilter === 'unassigned' && record.owner) ||
        (ownerFilter && ownerFilter !== 'unassigned' && record.owner !== ownerFilter)
      )
        return false;
      if (
        'source' in record &&
        ((slaFilter && sla(record).kind !== slaFilter) || (sourceFilter && record.source !== sourceFilter))
      )
        return false;
      if (
        category &&
        'source' in record &&
        (record.security?.category || 'Niet geclassificeerd') !== category
      )
        return false;
      const values = [record.title, record.number, record.owner, customerName(record.organizationId)];
      if ('source' in record)
        values.push(
          record.source,
          record.description,
          record.externalEventId,
          ...Object.values(record.security || {}).map(String),
        );
      if ('entries' in record) values.push(...record.entries.map((entry) => entry.text));
      return (
        !searchQuery ||
        values.some((value) =>
          String(value || '')
            .toLowerCase()
            .includes(searchQuery),
        )
      );
    });
  }
