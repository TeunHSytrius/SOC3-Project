import type { State, User } from '../types/soc';

export function initialFilters(): Pick<State,
  'archiveFilter' | 'listSort' | 'ownerFilter' | 'slaFilter' | 'sourceFilter' |
  'search' | 'filter' | 'priority' | 'category' | 'fromDate' | 'toDate' | 'mine'
> {
  return {
    archiveFilter: 'open',
    listSort: 'default',
    ownerFilter: '',
    slaFilter: '',
    sourceFilter: '',
    search: '',
    filter: '',
    priority: '',
    category: '',
    fromDate: '',
    toDate: '',
    mine: false,
  };
}

export function emptyWorkspaceData() {
  return {
    alerts: [],
    alertNotifications: [],
    cases: [],
    users: [],
    keys: [],
    audit: [],
    errors: [],
    ticketRegister: [],
    orgs: [],
    analysts: [],
    secret: null,
    setup: null,
  };
}

export function initialState(): State {
  return {
    ...initialFilters(),
    ...emptyWorkspaceData(),
    user: null,
    loading: true,
    page: 'dashboard',
    org: '',
    selected: null,
    modal: null,
    error: '',
    notice: '',
    busy: false,
  };
}

export function startPage(user: User): string {
  if (user.requiresTwoFactorSetup) return 'account';
  if (user.role === 'Klant' || user.role === 'Accountmanager') return 'cases';
  return 'dashboard';
}

export function roleAccess(user: User | null) {
  const isAnalyst = user?.role === 'Analist' || user?.role === 'Senior analist';
  const isAdmin = user?.role === 'Beheerder';

  return {
    isAnalyst,
    isAdmin,
    canReadInternal: isAnalyst || isAdmin,
  };
}
