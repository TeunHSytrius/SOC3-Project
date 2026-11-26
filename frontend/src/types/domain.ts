import type { Alert, ResearchCase } from './soc';
export const labels = {
  New: 'Nieuw',
  PendingReview: 'Wacht op beoordeling',
  UnderReview: 'In beoordeling',
  Escalated: 'Geëscaleerd',
  Dismissed: 'Afgewezen',
  Resolved: 'Opgelost',
  Open: 'Open',
  UnderInvestigation: 'In onderzoek',
  WaitingForCustomer: 'Wacht op klant',
  Closed: 'Gesloten',
  Low: 'Laag',
  Moderate: 'Gemiddeld',
  High: 'Hoog',
  Urgent: 'Urgent',
  Immediate: 'Kritiek',
};
export const priorities = ['Low', 'Moderate', 'High', 'Urgent', 'Immediate'],
  roles = ['Analist', 'Senior analist', 'Beheerder', 'Klant', 'Accountmanager'];
export const states = ['New', 'PendingReview', 'UnderReview', 'Escalated', 'Dismissed', 'Resolved'],
  caseStates = [
    'Open',
    'UnderInvestigation',
    'WaitingForCustomer',
    'UnderReview',
    'Resolved',
    'Closed',
  ];
export const active = (alert: Alert) => !['Dismissed', 'Resolved', 'Escalated'].includes(alert.status);
export const isClosed = (ticket: ResearchCase) => ticket.status === 'Closed';
export const fmt = (date: string | null | undefined) =>
    date
      ? new Date(date).toLocaleString('nl-NL', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—';
export function sla(alert: Alert) {
  const responseTime = alert.firstHandledAt
    ? new Date(alert.firstHandledAt).getTime()
    : Date.now();
  const remainingMinutes = (new Date(alert.deadline).getTime() - responseTime) / 60000;

  if (alert.slaStatus === 'Breached' || remainingMinutes < 0) {
    return { kind: 'danger', text: 'Overschreden' };
  }

  if (alert.firstHandledAt) {
    return { kind: 'good', text: 'Binnen SLA' };
  }

  const hours = Math.floor(remainingMinutes / 60);
  const minutes = Math.floor(remainingMinutes % 60);
  return {
    kind: remainingMinutes <= 15 ? 'warn' : 'neutral',
    text: `${hours}u ${minutes}m`,
  };
}

// Mirrors the allowed case status transitions in SocService.
export function nextCaseStates(status: ResearchCase['status']): string[] {
  switch (status) {
    case 'UnderInvestigation':
      return ['WaitingForCustomer', 'Resolved'];
    case 'WaitingForCustomer':
      return ['UnderInvestigation'];
    case 'Resolved':
      return ['UnderReview', 'Closed', 'UnderInvestigation'];
    case 'UnderReview':
      return ['Closed', 'UnderInvestigation'];
    default:
      return [];
  }
}

export function alertGroup(alert: Alert) {
  if (alert.status === 'Escalated') return 'linked';
  if (alert.status === 'Dismissed' || alert.status === 'Resolved') return 'closed';
  return 'open';
}
export function caseGroup(ticket: ResearchCase) {
  if (ticket.status === 'Closed') return 'closed';
  if (ticket.status === 'Resolved') return 'resolved';
  return 'open';
}
// Ticket tabs represent workflow stages, not the age of a ticket.
export function caseMatchesView(ticket: Pick<ResearchCase, 'status'>, view: string): boolean {
  switch (view) {
    case 'all':
      return true;
    case 'new':
      return ticket.status === 'Open';
    case 'working':
      return ticket.status === 'UnderInvestigation';
    case 'waiting':
      return ticket.status === 'WaitingForCustomer';
    case 'resolved':
      return ticket.status === 'Resolved' || ticket.status === 'UnderReview';
    case 'closed':
      return ticket.status === 'Closed';
    default:
      return (
        ticket.status !== 'Closed' &&
        ticket.status !== 'Resolved' &&
        ticket.status !== 'UnderReview'
      );
  }
}
export function sortRecords<T extends Alert | ResearchCase>(
  records: T[],
  sort: string,
  oldestFirst: boolean,
): T[] {
  return records.slice().sort((first, second) => {
    if (sort === 'priority') {
      const difference = priorities.indexOf(second.priority) - priorities.indexOf(first.priority);
      if (difference) return difference;
    }
    const difference = Date.parse(first.createdAt) - Date.parse(second.createdAt);
    return sort === 'oldest' || sort === 'priority' || (sort === 'default' && oldestFirst)
      ? difference
      : -difference;
  });
}
