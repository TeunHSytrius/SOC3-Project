import React from 'react';
import Workspace from './app/Workspace';
import { emptyWorkspaceData, initialState, roleAccess, startPage } from './app/workspaceState';
import LoginPage from './features/auth/LoginPage';
import { LoadingState } from './components/PageStates';
import { formData } from './features/shared/formData';
import {
  clearSession,
  currentUser,
  isCurrentSession,
  isUnauthorized,
  loginUser,
  logoutUser,
  restoreUser,
} from './services/sessionService';
import { loadWorkspace, submitWorkspaceAction } from './services/workspaceService';
import type { State, User } from './types/soc';
import type { ActionResult, WorkspaceActions } from './types/workspace';
import './features/FeatureStyles.css';

export default class App extends React.Component<Record<string, never>, State> {
  state: State = initialState();

  private refreshVersion = 0;

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
  }

  componentWillUnmount() {
    this.invalidateRefresh();
  }

  private invalidateRefresh() {
    this.refreshVersion++;
  }

  private async restoreSession() {
    try {
      const user = await restoreUser();
      if (user) {
        await this.enter(user);
      }
    } catch (error) {
      clearSession();
      if (!isUnauthorized(error)) {
        this.fail(error);
      }
    } finally {
      this.setState({ loading: false });
    }
  }

  private async enter(user: User) {
    this.setState({
      search: '',
      user,
      loading: false,
      page: startPage(user),
      org: '',
      selected: null,
      modal: null,
      error: '',
      notice: '',
    });

    if (!user.requiresTwoFactorSetup) {
      await this.refresh(user);
    }
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
    try {
      await logoutUser();
    } finally {
      this.setState({
        ...emptyWorkspaceData(),
        user: null,
        selected: null,
        modal: null,
        error: '',
        notice: '',
        busy: false,
      });
    }
  };

  private fail = (error: unknown) => {
    const message = error instanceof Error ? error.message : 'Onbekende fout. Probeer opnieuw.';
    if (isUnauthorized(error) && this.state.user) {
      clearSession();
      this.invalidateRefresh();
      this.setState({
        ...emptyWorkspaceData(),
        user: null,
        selected: null,
        modal: null,
        error: message,
        busy: false,
      });
      return;
    }
    this.setState({ error: message, notice: '' });
  };

  private isCurrentRefresh(version: number, user: User): boolean {
    return version === this.refreshVersion && isCurrentSession(user.id);
  }

  private refresh = async (user = this.state.user): Promise<boolean | undefined> => {
    if (!user || user.requiresTwoFactorSetup) {
      return;
    }
    const version = ++this.refreshVersion;

    try {
      const data = await loadWorkspace(user);
      if (!this.isCurrentRefresh(version, user)) {
        return;
      }
      this.update(data);
      return true;
    } catch (error) {
      if (this.isCurrentRefresh(version, user)) {
        this.fail(error);
      }
      return false;
    }
  };

  private run = async (
    path: string,
    data: Record<string, unknown>,
    message: string,
    after?: (result: ActionResult) => void,
  ) => {
    const { user, busy } = this.state;
    if (!user || busy) {
      return;
    }
    this.setState({ busy: true, error: '', notice: '' });

    try {
      const result = await submitWorkspaceAction(path, data);
      if (!isCurrentSession(user.id) || this.state.user?.id !== user.id) {
        return;
      }

      const refreshed = await this.refresh(user);
      if (!isCurrentSession(user.id) || this.state.user?.id !== user.id) {
        return;
      }

      this.setState({
        notice: refreshed
          ? message
          : message + ' Gegevens vernieuwen is mislukt; klik op Vernieuwen.',
        modal: null,
      });
      after?.(result);
    } catch (error) {
      if (isCurrentSession(user.id)) {
        this.fail(error);
      }
    } finally {
      if (this.state.user?.id === user.id) {
        this.setState({ busy: false });
      }
    }
  };

  private navigate = (page: string, selected: string | null = null) => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    const clearMessages = { selected, error: '', notice: '', modal: null };
    if (page === this.state.page && (selected || this.state.selected)) {
      this.setState(clearMessages);
      return;
    }

    const pageChanged = page !== this.state.page;
    this.setState({ search: '', ...clearMessages, page });

    if (pageChanged && !this.state.busy) {
      void this.refresh();
    }
  };

  private onTwoFactorEnabled = async () => {
    const user = await currentUser();
    this.setState({ user });
    await this.refresh(user);
  };

  render() {
    const { user, loading, error, busy } = this.state;
    if (loading) {
      return <LoadingState label="SOC3 laden…" />;
    }
    if (!user) {
      return <LoginPage error={error} busy={busy} onSubmit={this.login} />;
    }

    return (
      <Workspace
        state={this.state}
        actions={this.workspaceActions}
        refresh={() => this.refresh()}
        logout={this.logout}
        onTwoFactorEnabled={this.onTwoFactorEnabled}
        onError={this.fail}
      />
    );
  }
}
