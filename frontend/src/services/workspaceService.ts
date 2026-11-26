import { api } from './api';
import type {
  Alert, Analyst, ApiErrorEntry, ApiKey, AuditRow, Organization,
  ResearchCase, State, TicketRegisterRow, User,
} from '../types/soc';
import type { ActionResult } from '../types/workspace';

export async function loadWorkspace(user: User): Promise<Partial<State>> {
  const organizations = api<Organization[]>('organizations');

  if (user.role === 'Analist' || user.role === 'Senior analist') {
    const [orgs, alerts, cases, analysts] = await Promise.all([
      organizations,
      api<Alert[]>('alerts'),
      api<ResearchCase[]>('cases'),
      api<Analyst[]>('analysts'),
    ]);
    return { orgs, alerts, cases, analysts };
  }

  if (user.role === 'Beheerder') {
    const [orgs, alerts, cases, users, keys, audit, errors, ticketRegister] = await Promise.all([
      organizations,
      api<Alert[]>('alerts'),
      api<ResearchCase[]>('cases'),
      api<User[]>('users'),
      api<ApiKey[]>('keys'),
      api<AuditRow[]>('audit'),
      api<ApiErrorEntry[]>('errors'),
      api<TicketRegisterRow[]>('ticket-register'),
    ]);
    return { orgs, alerts, cases, users, keys, audit, errors, ticketRegister };
  }

  const [orgs, cases] = await Promise.all([
    organizations,
    api<ResearchCase[]>('portal/cases'),
  ]);
  return { orgs, cases };
}

// Background refresh retrieves live information only. Full refresh remains available
// after mutations, sign-in and the explicit Refresh button.
export async function loadLiveWorkspace(user: User, page: string): Promise<Partial<State>> {
  if (page === 'dashboard') {
    // Platform counters and operational queues are both visible on the admin dashboard.
    if (user.role === 'Beheerder') {
      const [orgs, alerts, cases, users, keys, errors] = await Promise.all([
        api<Organization[]>('organizations'),
        loadAlerts(),
        api<ResearchCase[]>('cases'),
        api<User[]>('users'),
        api<ApiKey[]>('keys'),
        api<ApiErrorEntry[]>('errors'),
      ]);
      return { orgs, alerts, cases, users, keys, errors };
    }

    const [alerts, cases, analysts] = await Promise.all([
      loadAlerts(),
      api<ResearchCase[]>('cases'),
      api<Analyst[]>('analysts'),
    ]);
    return { alerts, cases, analysts };
  }

  const alerts = loadAlerts();

  if (page === 'cases') {
    const [updatedAlerts, cases] = await Promise.all([alerts, api<ResearchCase[]>('cases')]);
    return { alerts: updatedAlerts, cases };
  }

  if (user.role === 'Beheerder' && page === 'errors') {
    const [updatedAlerts, errors] = await Promise.all([alerts, api<ApiErrorEntry[]>('errors')]);
    return { alerts: updatedAlerts, errors };
  }

  if (user.role === 'Beheerder' && page === 'ticket-register') {
    const [updatedAlerts, ticketRegister] = await Promise.all([alerts, api<TicketRegisterRow[]>('ticket-register')]);
    return { alerts: updatedAlerts, ticketRegister };
  }

  return { alerts: await alerts };
}

export function loadAlerts(): Promise<Alert[]> {
  return api<Alert[]>('alerts');
}

export function submitWorkspaceAction(
  state: State,
  path: string,
  data: Record<string, unknown>,
): Promise<ActionResult> {
  const selectedItem = state.alerts.find((alert) => alert.id === state.selected) ||
    state.cases.find((ticket) => ticket.id === state.selected);

  // Send the current version and tenant context for scoped changes.
  const payload = selectedItem && /^(alerts|cases)\//.test(path)
    ? { ...data, rowVersion: selectedItem.rowVersion }
    : data;
  const context = selectedItem
    ? { workspaceId: selectedItem.organizationId, scopeId: selectedItem.scopeId }
    : undefined;

  return api<ActionResult>(path, payload, context);
}
