export type Role = 'Analist' | 'Senior analist' | 'Beheerder' | 'Klant' | 'Accountmanager';
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  organizationIds: string[];
  isActive: boolean;
  twoFactorEnabled: boolean;
  requiresTwoFactorSetup: boolean;
}
export interface Organization {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  deactivatedAt: string | null;
}
export interface AuditRow {
  id: string;
  createdAt: string;
  actor: string;
  action: string;
  organizationId: string | null;
  target: string | null;
}
export interface ApiErrorEntry {
  at: string;
  status: number;
  method: string;
  route: string;
  reason: string;
  traceId: string;
  exceptionType: string | null;
}
export interface State {
  user: User | null;
  loading: boolean;
  page: string;
  orgs: Organization[];
  users: User[];
  audit: AuditRow[];
  errors: ApiErrorEntry[];
  org: string;
  search: string;
  selected: string | null;
  modal: string | null;
  error: string;
  notice: string;
  busy: boolean;
}
