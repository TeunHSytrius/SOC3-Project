export type Role = 'Analist' | 'Senior analist' | 'Beheerder' | 'Klant' | 'Accountmanager';
export type Priority = 'Low' | 'Moderate' | 'High' | 'Urgent' | 'Immediate';
export type AlertStatus =
  | 'New'
  | 'PendingReview'
  | 'UnderReview'
  | 'Escalated'
  | 'Dismissed'
  | 'Resolved';
export type CaseStatus =
  | 'Open'
  | 'UnderInvestigation'
  | 'WaitingForCustomer'
  | 'UnderReview'
  | 'Resolved'
  | 'Closed';
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
  responseMinutes: number;
  name: string;
  isActive: boolean;
  createdAt: string;
  deactivatedAt: string | null;
}
export interface SecurityDetails {
  category: string | null;
  description: string | null;
  sourceIp: string | null;
  destinationIp: string | null;
  hostname: string | null;
  username: string | null;
  detectionRule: string | null;
  simulated: boolean;
  evidence?: string | null;
  investigation?: string | null;
}
export type SlaStatus = 'Pending' | 'Breached' | 'Met';
export interface Alert {
  id: string;
  slaStatus?: SlaStatus;
  security?: SecurityDetails;
  normalizedPayload?: string | null;
  rowVersion: string;
  externalEventId?: string;
  occurredAt?: string;
  organizationId: string;
  scopeId: string;
  number: string;
  title: string;
  description: string;
  source: string;
  rawPayload: string;
  priority: Priority;
  status: AlertStatus;
  createdAt: string;
  deadline: string;
  firstHandledAt: string | null;
  owner: string | null;
  ownerId: string | null;
  triage: string | null;
  caseId: string | null;
  history: { at: string; actor: string; text: string }[];
}
export interface Entry {
  id: string;
  at: string;
  actor: string;
  kind: string;
  text: string;
  visible: boolean;
}
export interface ResearchCase {
  id: string;
  ownerId?: string | null;
  rowVersion: string;
  summary?: string;
  organizationId: string;
  scopeId: string;
  number: string;
  title: string;
  priority: Priority;
  status: CaseStatus;
  owner: string;
  createdAt: string;
  closedAt: string | null;
  customerVisible: boolean;
  conclusion: string | null;
  alertIds: string[];
  entries: Entry[];
}
export interface ApiKey {
  id: string;
  name: string;
  organizationId: string;
  scopeId: string;
  createdAt: string;
  isActive: boolean;
  prefix: string;
}
export interface AuditRow {
  id: string;
  createdAt: string;
  actor: string;
  action: string;
  organizationId: string | null;
  target: string | null;
}
export interface Analyst {
  id: string;
  name: string;
  organizationIds: string[];
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
export interface TicketRegisterRow {
  id: string;
  number: string;
  status: CaseStatus;
  createdAt: string;
  closedAt: string | null;
  organizationId: string;
}
export interface State {
  user: User | null;
  loading: boolean;
  page: string;
  archiveFilter: 'all' | 'open' | 'linked' | 'resolved' | 'closed' | 'new' | 'working' | 'waiting';
  listSort: 'default' | 'oldest' | 'newest' | 'priority';
  ownerFilter: string;
  slaFilter: string;
  sourceFilter: string;
  orgs: Organization[];
  alerts: Alert[];
  alertNotifications: Alert[];
  cases: ResearchCase[];
  users: User[];
  keys: ApiKey[];
  audit: AuditRow[];
  errors: ApiErrorEntry[];
  ticketRegister: TicketRegisterRow[];
  analysts: Analyst[];
  org: string;
  search: string;
  filter: string;
  priority: string;
  category: string;
  fromDate: string;
  toDate: string;
  mine: boolean;
  selected: string | null;
  modal: string | null;
  error: string;
  notice: string;
  busy: boolean;
  secret: string | null;
  setup: string | null;
  setupUri?: string | null;
}
