import React from 'react';
import AlertsPage from './features/alerts/AlertsPage';
import TicketsPage from './features/cases/TicketsPage';
import CustomersPage from './features/admin/CustomersPage';
import UsersPage from './features/admin/UsersPage';
import ApiKeysPage from './features/admin/ApiKeysPage';
import AuditPage from './features/admin/AuditPage';
import ActionDialog from './features/shared/ActionDialog';
import { formData } from './features/shared/formData';
import type { WorkspaceActions, ActionResult } from './types/workspace';
import DashboardPage from './features/dashboard/DashboardPage';
import TwoFactorSetup from './features/auth/TwoFactorSetup';
import { api, sessionKey } from './services/api';
import type { State, User, Alert, ResearchCase } from './types/soc';
import {
  labels,
  priorities,
  roles,
  states,
  caseStates,
  active,
  isClosed,
  fmt,
  sla,
  nextCaseStates,
  alertGroup,
  caseGroup,
  caseMatchesView,
  sortRecords,
} from './types/domain';
import { Icon, Badge, Button, Field, Select, Table, Panel, PageHeader } from './components/Ui';
import { LoadingState } from './components/PageStates';
import LoginPage from './features/auth/LoginPage';
import { AppShell } from './components/AppShell';
import './features/FeatureStyles.css';
import AlertNotifications from './features/alerts/AlertNotifications';
import ErrorLog from './features/admin/ErrorLog';
import TicketRegister from './features/admin/TicketRegister';
class App extends React.Component<Record<string, never>, State> {
  constructor(props: Record<string, never>) {
    super(props);
    this.state = {
      user: null,
      loading: true,
      page: 'dashboard',
      archiveFilter: 'open',
      listSort: 'default',
      ownerFilter: '',
      slaFilter: '',
      sourceFilter: '',
      orgs: [],
      alerts: [],
      alertNotifications: [],
      cases: [],
      users: [],
      keys: [],
      audit: [],
      errors: [],
      ticketRegister: [],
      analysts: [],
      org: '',
      search: '',
      filter: '',
      priority: '',
      category: '',
      fromDate: '',
      toDate: '',
      mine: false,
      selected: null,
      modal: null,
      error: '',
      notice: '',
      busy: false,
      secret: null,
      setup: null,
    };
  }
  private get workspaceActions(): WorkspaceActions {
    return {
      navigate: (page, selected) => this.go(page, selected),
      update: (update) => this.setState(update as Pick<State, keyof State>),
      run: (path, data, message, after) => this.run(path, data, message, after),
      customerName: (id) => this.name(id),
      isAdmin: !!this.isAdmin,
      isAnalyst: !!this.isAnalyst,
      canReadInternal: !!this.canReadInternal,
    };
  }

  private refreshTimer?: number;
  private refreshing = false;
  private refreshVersion = 0;
  private knownAlertIds = new Set<string>();
  private alertsInitialized = false;
  private resetAlertNotifications() {
    this.knownAlertIds.clear();
    this.alertsInitialized = false;
  }
  private findNewAlerts(alerts: Alert[]): Alert[] {
    const newAlerts = this.alertsInitialized
      ? alerts.filter((alert) => !this.knownAlertIds.has(alert.id) && active(alert))
      : [];
    for (const alert of alerts) this.knownAlertIds.add(alert.id);
    this.alertsInitialized = true;
    return sortRecords(newAlerts, 'newest', false);
  }
  private dismissAlertNotification = (id: string) =>
    this.setState((s) => ({
      alertNotifications: s.alertNotifications.filter((alert) => alert.id !== id),
    }));
  private openAlertNotification = async (alert: Alert) => {
    const user = this.state.user;
    if (!user || this.state.busy || this.state.modal) return;
    if (!(await this.refresh(user)) || sessionStorage.getItem(sessionKey) !== user.id) return;
    this.go('alerts', alert.id);
    this.setState({ org: alert.organizationId });
    this.dismissAlertNotification(alert.id);
  };
  private async pollAlertNotifications(user: User) {
    const version = ++this.refreshVersion;
    this.refreshing = true;
    try {
      const alerts = await api<Alert[]>('alerts');
      if (version !== this.refreshVersion || sessionStorage.getItem(sessionKey) !== user.id) return;
      const newAlerts = this.findNewAlerts(alerts);
      if (newAlerts.length)
        this.setState((s) => ({
          alertNotifications: [...newAlerts, ...s.alertNotifications].slice(0, 3),
        }));
    } catch (e) {
      if (version === this.refreshVersion && sessionStorage.getItem(sessionKey) === user.id)
        this.fail(e);
    } finally {
      if (version === this.refreshVersion) this.refreshing = false;
    }
  }
  componentDidMount() {
    void this.restoreSession();
    this.refreshTimer = window.setInterval(() => {
      const s = this.state;
      if (
        document.hidden ||
        !this.canReadInternal ||
        !s.user ||
        s.user.requiresTwoFactorSetup ||
        s.loading ||
        s.busy ||
        this.refreshing
      )
        return;
      if (
        !s.modal &&
        !s.selected &&
        ['dashboard', 'alerts', 'cases', 'errors', 'ticket-register'].includes(s.page)
      ) {
        void this.refresh(s.user, true);
      } else {
        void this.pollAlertNotifications(s.user);
      }
    }, 15000);
  }
  componentWillUnmount() {
    window.clearInterval(this.refreshTimer);
  }
  async restoreSession() {
    const navigation = performance.getEntriesByType('navigation')[0] as
      | PerformanceNavigationTiming
      | undefined;
    const previous = sessionStorage.getItem(sessionKey);
    try {
      // Only refreshes of a tab with an explicit login restore the current session.
      if (previous && navigation?.type === 'reload') {
        const user: User = await api('auth/me');
        if (user.id === previous) {
          await this.enter(user);
          return;
        }
      }
      sessionStorage.removeItem(sessionKey);
      // Identity cookies are shared across tabs; end the old cookie session.
      try {
        await api('auth/logout', {});
      } catch (e) {
        if (e.status !== 401) throw e;
      }
    } catch (e) {
      sessionStorage.removeItem(sessionKey);
      if (e.status !== 401) this.fail(e);
    } finally {
      this.setState({ loading: false });
    }
  }
  get canReadInternal() {
    return this.isAnalyst || this.isAdmin;
  }
  get isAnalyst() {
    return this.state.user && ['Analist', 'Senior analist'].includes(this.state.user.role);
  }
  get isAdmin() {
    return this.state.user && this.state.user.role === 'Beheerder';
  }
  async enter(user: User) {
    this.resetAlertNotifications();
    this.setState({
      user,
      alertNotifications: [],
      loading: false,
      page: user.requiresTwoFactorSetup
        ? 'account'
        : user.role === 'Beheerder'
          ? 'dashboard'
          : user.role === 'Klant' || user.role === 'Accountmanager'
            ? 'cases'
            : 'dashboard',
      org: '',
      selected: null,
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
      error: '',
      notice: '',
      secret: null,
      setup: null,
    });
    if (!user.requiresTwoFactorSetup) await this.refresh(user);
  }
  async refresh(u = this.state.user, automatic = false) {
    if (!u || u.requiresTwoFactorSetup || (automatic && this.refreshing)) return;
    const version = ++this.refreshVersion;
    this.refreshing = true;
    const analyst = ['Analist', 'Senior analist'].includes(u.role),
      admin = u.role === 'Beheerder';
    try {
      const paths = [
        'organizations',
        ...(analyst
          ? ['alerts', 'cases', 'analysts']
          : admin
            ? ['alerts', 'cases', 'users', 'keys', 'audit', 'errors', 'ticket-register']
            : ['portal/cases']),
      ];
      const data = await Promise.all(paths.map((x) => api(x)));
      if (version !== this.refreshVersion || sessionStorage.getItem(sessionKey) !== u.id) return;
      if (automatic && (this.state.selected || this.state.modal || this.state.busy)) return;
      const state: Partial<State> = {};
      paths.forEach(
        (p, i) =>
          (state[
            p === 'organizations'
              ? 'orgs'
              : p === 'portal/cases'
                ? 'cases'
                : p === 'ticket-register'
                  ? 'ticketRegister'
                  : p
          ] = data[i]),
      );
      const newAlerts = state.alerts ? this.findNewAlerts(state.alerts) : [];
      this.setState(
        (previous) =>
          ({
            ...state,
            alertNotifications: [...newAlerts, ...previous.alertNotifications].slice(0, 3),
          }) as Pick<State, keyof State>,
      );
      return true;
    } catch (e) {
      if (version === this.refreshVersion && sessionStorage.getItem(sessionKey) === u.id)
        this.fail(e);
      return false;
    } finally {
      if (version === this.refreshVersion) this.refreshing = false;
    }
  }
  fail(e) {
    const message = e instanceof Error ? e.message : 'Onbekende fout. Probeer opnieuw.';
    if (e?.status === 401 && this.state.user) {
      sessionStorage.removeItem(sessionKey);
      this.resetAlertNotifications();
      this.setState({
        user: null,
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
        error: message,
      });
      return;
    }
    this.setState({ error: message, notice: '' });
  }
  async run(
    path: string,
    data: Record<string, unknown>,
    message: string,
    after?: (result: ActionResult) => void,
  ) {
    if (this.state.busy) return;
    this.setState({ busy: true, error: '', notice: '' });
    try {
      const item =
        this.state.alerts.find((x) => x.id === this.state.selected) ||
        this.state.cases.find((x) => x.id === this.state.selected);
      const payload =
        item && /^(alerts|cases)\//.test(path) ? { ...data, rowVersion: item.rowVersion } : data;
      const result = await api<ActionResult>(
        path,
        payload,
        item ? { workspaceId: item.organizationId, scopeId: item.scopeId } : undefined,
      );
      const refreshed = await this.refresh();
      if (!this.state.user || !sessionStorage.getItem(sessionKey)) return;
      this.setState({
        notice: refreshed
          ? message
          : message + ' Gegevens vernieuwen is mislukt; klik op Vernieuwen.',
        modal: null,
      });
      if (after) after(result);
    } catch (e) {
      this.fail(e);
    } finally {
      this.setState({ busy: false });
    }
  }
  go(page: string, selected: string | null = null) {
    if (page === this.state.page && (selected || this.state.selected)) {
      this.setState({ selected, error: '', notice: '', modal: null, secret: null });
      return;
    }
    this.setState({
      page,
      selected,
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
      error: '',
      notice: '',
      modal: null,
      secret: null,
    });
  }
  name(id: string) {
    return this.state.orgs.find((o) => o.id === id)?.name || 'Onbekende klant';
  }
  async login(event: React.FormEvent<HTMLFormElement>) {
    const data = formData(event);
    this.setState({ busy: true, error: '' });
    try {
      const user: User = await api('auth/login', data);
      sessionStorage.setItem(sessionKey, user.id);
      await this.enter(user);
    } catch (err) {
      this.fail(err);
    } finally {
      this.setState({ busy: false });
    }
  }
  async logout() {
    this.refreshVersion++;
    this.refreshing = false;
    this.resetAlertNotifications();
    try {
      await api('auth/logout', {});
    } finally {
      sessionStorage.removeItem(sessionKey);
      this.setState({
        user: null,
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
        error: '',
        notice: '',
        secret: null,
        setup: null,
      });
    }
  }
  renderLogin() {
    return (
      <LoginPage error={this.state.error} busy={this.state.busy} onSubmit={(e) => this.login(e)} />
    );
  }
  nav() {
    if (this.state.user?.requiresTwoFactorSetup) return [['account', 'Account']];
    return this.isAdmin
      ? [
          ['dashboard', 'Dashboard'],
          ['alerts', 'Alerts'],
          ['cases', 'Tickets'],
          ['customers', 'Klanten'],
          ['users', 'Gebruikers & rollen'],
          ['keys', 'API-sleutels'],
          ['audit', 'Auditlog'],
          ['errors', 'Foutenlog'],
          ['account', 'Account'],
        ]
      : this.isAnalyst
        ? [
            ['dashboard', 'Dashboard'],
            ['alerts', 'Alerts'],
            ['cases', 'Cases'],
            ['account', 'Account'],
          ]
        : [
            ['cases', 'Cases'],
            ['account', 'Account'],
          ];
  }
  render() {
    const s = this.state;
    if (s.loading) return <LoadingState label="SOC3 laden…" />;
    if (!s.user) return this.renderLogin();
    const pages = {
      dashboard: () => this.dashboard(),
      alerts: () => this.alerts(),
      cases: () => this.cases(),
      customers: () => this.customers(),
      'ticket-register': () =>
        this.isAdmin ? (
          <TicketRegister
            tickets={s.ticketRegister}
            organizations={s.orgs}
            organizationId={s.org}
            onOrganizationChange={(id) => this.setState({ org: id })}
            reload={() => void this.refresh()}
          />
        ) : null,
      users: () => this.users(),
      keys: () => this.keys(),
      audit: () => this.audit(),
      errors: () =>
        this.isAdmin ? <ErrorLog errors={s.errors} reload={() => void this.refresh()} /> : null,
      account: () => this.account(),
    };
    const customerOptions = [
      { id: '', name: 'Alle klanten' },
      ...s.orgs.map((o) => ({ id: o.id, name: o.name })),
    ];
    const customer =
      s.orgs.find((o) => o.id === s.org) ||
      (s.orgs.length === 1 ? s.orgs[0] : { id: '', name: 'Alle klanten' });
    return (
      <AppShell
        user={{ displayName: s.user.name, role: s.user.role }}
        customer={customer}
        customerOptions={s.orgs.length > 1 ? customerOptions : []}
        onCustomerChange={(id) =>
          this.setState({
            org: id,
            selected: null,
            ownerFilter: '',
            sourceFilter: '',
            category: '',
          })
        }
        navigationItems={this.nav().map(([id, label]) => ({
          label,
          href: id === 'dashboard' ? '/' : '/' + id,
        }))}
        currentPath={s.page === 'dashboard' ? '/' : '/' + s.page}
        onNavigate={(href) => this.go(href === '/' ? 'dashboard' : href.slice(1))}
        actions={
          <>
            <Button onClick={() => this.refresh()}>
              <Icon name="refresh" size={16} /> Vernieuwen
            </Button>
            <Button onClick={() => this.logout()}>
              <Icon name="logout" size={16} /> Uitloggen
            </Button>
          </>
        }
      >
        {s.error && (
          <div className="error" role="alert">
            {s.error}
            <button onClick={() => this.setState({ error: '' })}>×</button>
          </div>
        )}
        {s.notice && (
          <div className="notice" role="status">
            {s.notice}
            <button onClick={() => this.setState({ notice: '' })}>×</button>
          </div>
        )}
        {pages[s.page] && pages[s.page]()} {s.modal && this.modal()}
        {this.canReadInternal && !s.user.requiresTwoFactorSetup && (
          <AlertNotifications
            alerts={s.alertNotifications}
            customerName={(id) => this.name(id)}
            onOpen={this.openAlertNotification}
            onDismiss={this.dismissAlertNotification}
            busy={s.busy || !!s.modal}
          />
        )}
      </AppShell>
    );
  }

  private showQueue(
    page: 'alerts' | 'cases',
    view: State['archiveFilter'] = 'open',
    mine = false,
    ownerFilter = '',
  ) {
    this.go(page);
    this.setState({ archiveFilter: view, mine, ownerFilter, filter: '', listSort: 'default' });
  }
  dashboard() {
    return (
      <DashboardPage
        state={this.state}
        isAdmin={!!this.isAdmin}
        isAnalyst={!!this.isAnalyst}
        customerName={(id) => this.name(id)}
        navigate={(page, id) => this.go(page, id)}
        update={(update) => this.setState(update as Pick<State, keyof State>)}
        showQueue={(page, view, mine, ownerFilter) => this.showQueue(page, view, mine, ownerFilter)}
      />
    );
  }
  alerts() {
    return <AlertsPage state={this.state} {...this.workspaceActions} />;
  }
  cases() {
    return <TicketsPage state={this.state} {...this.workspaceActions} />;
  }
  customers() {
    return <CustomersPage state={this.state} {...this.workspaceActions} />;
  }
  users() {
    return <UsersPage state={this.state} {...this.workspaceActions} />;
  }
  keys() {
    return <ApiKeysPage state={this.state} {...this.workspaceActions} />;
  }
  audit() {
    return <AuditPage state={this.state} {...this.workspaceActions} />;
  }
  account() {
    const s = this.state;
    return (
      <div className="fragment">
        <PageHeader title="Mijn account" sub="Accountgegevens en tweestapsverificatie." />
        <Panel title="Profiel">
          <div className="bodypad">
            {s.user.requiresTwoFactorSetup && (
              <p role="status">Deze rol vereist 2FA voordat klantgegevens toegankelijk zijn.</p>
            )}
            <dl>
              <dt>Naam</dt>
              <dd>{s.user.name}</dd>
              <dt>E-mail</dt>
              <dd>{s.user.email}</dd>
              <dt>Rol</dt>
              <dd>{s.user.role}</dd>
              <dt>2FA</dt>
              <dd>
                <Badge
                  value={s.user.twoFactorEnabled ? 'Actief' : 'Niet actief'}
                  kind={s.user.twoFactorEnabled ? 'good' : 'neutral'}
                />
              </dd>
            </dl>
            <TwoFactorSetup
              key={s.user.id}
              email={s.user.email}
              initiallyEnabled={s.user.twoFactorEnabled}
              onEnabled={async () => {
                const user = await api<User>('auth/me');
                this.setState({ user });
                await this.refresh(user);
              }}
              onSessionExpired={(error) => this.fail(error)}
            />
          </div>
        </Panel>
      </div>
    );
  }
  modal() {
    return <ActionDialog state={this.state} {...this.workspaceActions} />;
  }
}
export default App;
