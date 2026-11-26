import { api } from './api';
import type { ApiErrorEntry, AuditRow, Organization, State, User } from '../types/soc';
import type { ActionResult } from '../types/workspace';

export async function loadWorkspace(user: User): Promise<Partial<State>> {
  if (user.role !== 'Beheerder') {
    return { orgs: await api<Organization[]>('organizations') };
  }

  const [orgs, users, audit, errors] = await Promise.all([
    api<Organization[]>('organizations'),
    api<User[]>('users'),
    api<AuditRow[]>('audit'),
    api<ApiErrorEntry[]>('errors'),
  ]);
  return { orgs, users, audit, errors };
}

export function submitWorkspaceAction(
  path: string,
  data: Record<string, unknown>,
): Promise<ActionResult> {
  return api<ActionResult>(path, data);
}
