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
export const active = (a: Alert) => !['Dismissed', 'Resolved', 'Escalated'].includes(a.status),
  isClosed = (c: ResearchCase) => c.status === 'Closed',
  fmt = (d) =>
    d
      ? new Date(d).toLocaleString('nl-NL', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—';
export const sla = (a: Alert) => {
  const diff =
    (new Date(a.deadline).getTime() - new Date(a.firstHandledAt || Date.now()).getTime()) / 60000;
  return {
    kind:
      a.slaStatus === 'Breached' || diff < 0
        ? 'danger'
        : a.firstHandledAt
          ? 'good'
          : diff <= 15
            ? 'warn'
            : 'neutral',
    text:
      a.slaStatus === 'Breached' || diff < 0
        ? 'Overschreden'
        : a.firstHandledAt
          ? 'Binnen SLA'
          : `${Math.floor(diff / 60)}u ${Math.floor(diff % 60)}m`,
  };
};

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

export function alertGroup(a: Alert) {
  if (a.status === 'Escalated') return 'linked';
  if (a.status === 'Dismissed' || a.status === 'Resolved') return 'closed';
  return 'open';
}
export function caseGroup(c: ResearchCase) {
  if (c.status === 'Closed') return 'closed';
  if (c.status === 'Resolved') return 'resolved';
  return 'open';
}
// Ticket tabs represent workflow stages, not the age of a ticket.
export function caseMatchesView(ticket: ResearchCase, view: string): boolean {
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
  return records.slice().sort((a, b) => {
    if (sort === 'priority') {
      const difference = priorities.indexOf(b.priority) - priorities.indexOf(a.priority);
      if (difference) return difference;
    }
    const difference = Date.parse(a.createdAt) - Date.parse(b.createdAt);
    return sort === 'oldest' || sort === 'priority' || (sort === 'default' && oldestFirst)
      ? difference
      : -difference;
  });
}
