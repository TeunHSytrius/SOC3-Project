import type { State, User } from '../types/soc';

export function emptyWorkspaceData() {
  return { orgs: [], users: [], audit: [], errors: [] };
}

export function initialState(): State {
  return {
    ...emptyWorkspaceData(),
    user: null,
    loading: true,
    page: 'dashboard',
    org: '',
    search: '',
    selected: null,
    modal: null,
    error: '',
    notice: '',
    busy: false,
  };
}

export function startPage(user: User): string {
  return user.requiresTwoFactorSetup ? 'account' : 'dashboard';
}

export function roleAccess(user: User | null) {
  const isAnalyst = user?.role === 'Analist' || user?.role === 'Senior analist';
  const isAdmin = user?.role === 'Beheerder';
  return { isAnalyst, isAdmin, canReadInternal: isAnalyst };
}
