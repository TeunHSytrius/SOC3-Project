import type { State } from '../../types/soc';
import { active, caseMatchesView, isClosed, sla, sortRecords } from '../../types/domain';
import type { DashboardMetric } from './DashboardStats';

type OverviewState = Pick<State, 'org' | 'user' | 'alerts' | 'cases'>;
const QUEUE_PREVIEW_SIZE = 3;
const RECENT_PREVIEW_SIZE = 2;

export function getDashboardOverview(state: OverviewState, isAdmin: boolean) {
  const { org: organizationId, user } = state;
  const alerts = state.alerts.filter((alert) => !organizationId || alert.organizationId === organizationId);
  const tickets = state.cases.filter((ticket) => !organizationId || ticket.organizationId === organizationId);
  const openAlerts = alerts.filter(active);
  const unassignedAlerts = openAlerts.filter(
    (alert) => !alert.ownerId && ['New', 'PendingReview'].includes(alert.status),
  );

  const activeTickets = tickets.filter((ticket) => caseMatchesView(ticket, 'open'));
  const myTickets = activeTickets.filter((ticket) => ticket.ownerId === user?.id);
  const workTickets = isAdmin ? activeTickets : myTickets;
  const isSenior = user?.role === 'Senior analist';
  const ticketCounts = {
    new: tickets.filter((ticket) => caseMatchesView(ticket, 'new')).length,
    waiting: tickets.filter((ticket) => caseMatchesView(ticket, 'waiting')).length,
    resolved: tickets.filter((ticket) => caseMatchesView(ticket, 'resolved')).length,
    closed: tickets.filter(isClosed).length,
  };

  const metrics: DashboardMetric[] = [
    {
      label: 'Wachtrij',
      value: unassignedAlerts.length,
      description: isAdmin ? 'Onbeheerde alerts' : 'Beschikbaar in de wachtrij',
      icon: 'alerts',
      tone: 'blue',
    },
    {
      label: isAdmin ? 'Actieve tickets' : isSenior ? 'Te prioriteren' : 'Mijn tickets',
      value: isAdmin ? activeTickets.length : isSenior ? ticketCounts.new : myTickets.length,
      description: isAdmin ? 'Nieuw, in onderzoek of wachtend' : isSenior ? 'Nieuwe onderzoeken' : 'Aan mij toegewezen',
      icon: 'cases',
      tone: 'purple',
    },
    {
      label: 'SLA-risico',
      value: openAlerts.filter((alert) => sla(alert).kind === 'warn').length,
      description: 'Minder dan 15 minuten',
      icon: 'clock',
      tone: 'warn',
    },
    {
      label: 'SLA te laat',
      value: openAlerts.filter((alert) => sla(alert).kind === 'danger').length,
      description: 'Open alerts buiten SLA',
      icon: 'alerts',
      tone: 'danger',
    },
  ];

  return {
    metrics,
    ticketCounts,
    alertQueue: sortRecords(unassignedAlerts, 'oldest', true).slice(0, QUEUE_PREVIEW_SIZE),
    ticketQueue: sortRecords(workTickets, 'newest', false).slice(0, QUEUE_PREVIEW_SIZE),
    recentAlerts: sortRecords(alerts, 'newest', false).slice(0, RECENT_PREVIEW_SIZE),
  };
}
