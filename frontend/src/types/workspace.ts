import type { State } from './soc';

export interface ActionResult {
  id?: string;
  caseId?: string;
  secret?: string;
}

export type Navigate = (page: string, selected?: string | null) => void;
export type UpdateState = (update: Partial<State>) => void;
export type RunAction = (
  path: string,
  data: Record<string, unknown>,
  message: string,
  after?: (result: ActionResult) => void,
) => Promise<void>;

export interface WorkspaceActions {
  navigate: Navigate;
  update: UpdateState;
  run: RunAction;
  customerName: (id: string) => string;
  isAnalyst: boolean;
  isAdmin: boolean;
  canReadInternal: boolean;
}
