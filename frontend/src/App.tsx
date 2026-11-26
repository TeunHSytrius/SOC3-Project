import React from 'react';
import Workspace from './app/Workspace';
import { emptyWorkspaceData, initialFilters, initialState, roleAccess, startPage } from './app/workspaceState';
import LoginPage from './features/auth/LoginPage';
import { LoadingState } from './components/PageStates';
import { formData } from './features/shared/formData';
import { AlertTracker, mergeNotifications } from './features/alerts/AlertTracker';
import { clearSession, currentUser, isCurrentSession, isUnauthorized, loginUser, logoutUser, restoreUser } from './services/sessionService';
import { loadAlerts, loadLiveWorkspace, loadWorkspace, submitWorkspaceAction } from './services/workspaceService';
import type { Alert, State, User } from './types/soc';
import type { ActionResult, WorkspaceActions } from './types/workspace';
import './features/FeatureStyles.css';

const REFRESH_INTERVAL = 15000;
const AUTO_REFRESH_PAGES = new Set(['dashboard', 'alerts', 'cases', 'errors', 'ticket-register', 'reports']);

export default class App extends React.Component<Record<string, never>, State> {
  state: State = initialState();

  private refreshTimer?: number;
  private refreshing = false;
  private refreshVersion = 0;
  private alertTracker = new AlertTracker();

  private update = (update: Partial<State>) => {
    this.setState(update as Pick<State, keyof State>);
  };

  private get workspaceActions(): WorkspaceActions {
    return {
      ...roleAccess(this.state.user),
      navigate: this.navigate,
      update: this.update,
      run: this.run,
      customerName: (id) =>
        this.state.orgs.find((organization) => organization.id === id)?.name || 'Onbekende klant',
    };
  }

  componentDidMount() {
    void this.restoreSession();
    this.refreshTimer = window.setInterval(this.autoRefresh, REFRESH_INTERVAL);
  }

  componentWillUnmount() {
    window.clearInterval(this.refreshTimer);
    this.invalidateRefresh();
  }

  private invalidateRefresh() {
    this.refreshVersion++;
    this.refreshing = false;
  }

  private autoRefresh = () => {
    const { user, loading, busy, modal, selected, page } = this.state;
    if (
      document.hidden || !roleAccess(user).canReadInternal || !user ||
      user.requiresTwoFactorSetup || loading || busy || this.refreshing
    ) return;

    if (!modal && !selected && AUTO_REFRESH_PAGES.has(page)) {
      void this.refresh(user, true);
    } else {
      void this.pollNotifications(user);
    }
  };

  private async restoreSession() {
    try {
      const user = await restoreUser();
      if (user) await this.enter(user);
    } catch (error) {
      clearSession();
      if (!isUnauthorized(error)) this.fail(error);
    } finally {
      this.setState({ loading: false });
    }
  }

  private async enter(user: User) {
    this.alertTracker.reset();
    this.setState({
      ...initialFilters(),
      user,
      loading: false,
      page: startPage(user),
      org: '',
      selected: null,
      alertNotifications: [],
      error: '',
      notice: '',
      secret: null,
      setup: null,
    });

    if (!user.requiresTwoFactorSetup) await this.refresh(user);
  }

  private login = async (event: React.FormEvent<HTMLFormElement>) => {
    const credentials = formData(event);
    this.setState({ busy: true, error: '' });
    try {
      const user = await loginUser(credentials);
      await this.enter(user);
    } catch (error) {
      this.fail(error);
    } finally {
      this.setState({ busy: false });
    }
  };

  private logout = async () => {
    this.invalidateRefresh();
    this.alertTracker.reset();
    try {
      await logoutUser();
    } finally {
      this.setState({ ...emptyWorkspaceData(), user: null, error: '', notice: '', busy: false });
    }
  };

  private fail = (error: unknown) => {
    const message = error instanceof Error ? error.message : 'Onbekende fout. Probeer opnieuw.';
    if (isUnauthorized(error) && this.state.user) {
      clearSession();
      this.invalidateRefresh();
      this.alertTracker.reset();
      this.setState({ ...emptyWorkspaceData(), user: null, error: message, busy: false });
      return;
    }
    this.setState({ error: message, notice: '' });
  };

  private isCurrentRefresh(version: number, user: User): boolean {
    return version === this.refreshVersion && isCurrentSession(user.id);
  }

  private refresh = async (user = this.state.user, automatic = false): Promise<boolean | undefined> => {
    if (!user || user.requiresTwoFactorSetup || (automatic && this.refreshing)) return;
    const version = ++this.refreshVersion;
    this.refreshing = true;

    try {
      const data = automatic
        ? await loadLiveWorkspace(user, this.state.page)
        : await loadWorkspace(user);
      if (!this.isCurrentRefresh(version, user)) return;
      if (automatic && (this.state.selected || this.state.modal || this.state.busy)) return;

      const newAlerts = data.alerts ? this.alertTracker.findNewAlerts(data.alerts) : [];
      this.setState((previous) => ({
        ...data,
        alertNotifications: mergeNotifications(newAlerts, previous.alertNotifications),
      }) as Pick<State, keyof State>);
      return true;
    } catch (error) {
      if (this.isCurrentRefresh(version, user)) this.fail(error);
      return false;
    } finally {
      if (version === this.refreshVersion) this.refreshing = false;
    }
  };

  private async pollNotifications(user: User) {
    const version = ++this.refreshVersion;
    this.refreshing = true;
    try {
      const alerts = await loadAlerts();
      if (!this.isCurrentRefresh(version, user)) return;

      const newAlerts = this.alertTracker.findNewAlerts(alerts);
      if (newAlerts.length) {
        this.setState((previous) => ({
          alertNotifications: mergeNotifications(newAlerts, previous.alertNotifications),
        }));
      }
    } catch (error) {
      if (this.isCurrentRefresh(version, user)) this.fail(error);
    } finally {
      if (version === this.refreshVersion) this.refreshing = false;
    }
  }

  private dismissNotification = (id: string) => {
    this.setState((previous) => ({
      alertNotifications: previous.alertNotifications.filter((alert) => alert.id !== id),
    }));
  };

  private openNotification = async (alert: Alert) => {
    const { user, busy, modal } = this.state;
    if (!user || busy || modal) return;
    if (!(await this.refresh(user)) || !isCurrentSession(user.id)) return;

    this.navigate('alerts', alert.id);
    this.setState({ org: alert.organizationId });
    this.dismissNotification(alert.id);
  };

  private run = async (
    path: string,
    data: Record<string, unknown>,
    message: string,
    after?: (result: ActionResult) => void,
  ) => {
    const { user, busy } = this.state;
    if (!user || busy) return;
    this.setState({ busy: true, error: '', notice: '' });

    try {
      const result = await submitWorkspaceAction(this.state, path, data);
      if (!isCurrentSession(user.id) || this.state.user?.id !== user.id) return;

      const refreshed = await this.refresh(user);
      if (!isCurrentSession(user.id) || this.state.user?.id !== user.id) return;

      this.setState({
        notice: refreshed ? message : message + ' Gegevens vernieuwen is mislukt; klik op Vernieuwen.',
        modal: null,
      });
      after?.(result);
    } catch (error) {
      if (isCurrentSession(user.id)) this.fail(error);
    } finally {
      if (this.state.user?.id === user.id) this.setState({ busy: false });
    }
  };

  private navigate = (page: string, selected: string | null = null) => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    const clearMessages = { selected, error: '', notice: '', modal: null, secret: null };
    if (page === this.state.page && (selected || this.state.selected)) {
      this.setState(clearMessages);
      return;
    }

    const pageChanged = page !== this.state.page;
    this.setState({ ...initialFilters(), ...clearMessages, page });

    if (pageChanged && !this.state.busy) {
      void this.refresh();
    }
  };

  private showQueue = (
    page: 'alerts' | 'cases',
    view: State['archiveFilter'] = 'open',
    mine = false,
    ownerFilter = '',
  ) => {
    this.navigate(page);
    this.setState({ archiveFilter: view, mine, ownerFilter, filter: '', listSort: 'default' });
  };

  private onTwoFactorEnabled = async () => {
    const user = await currentUser();
    this.setState({ user });
    await this.refresh(user);
  };

  render() {
    const { user, loading, error, busy } = this.state;
    if (loading) return <LoadingState label="SOC3 laden…" />;
    if (!user) return <LoginPage error={error} busy={busy} onSubmit={this.login} />;

    return (
      <Workspace
        state={this.state}
        actions={this.workspaceActions}
        refresh={() => this.refresh()}
        logout={this.logout}
        showQueue={this.showQueue}
        onTwoFactorEnabled={this.onTwoFactorEnabled}
        onError={this.fail}
        openNotification={this.openNotification}
        dismissNotification={this.dismissNotification}
      />
    );
  }
}
