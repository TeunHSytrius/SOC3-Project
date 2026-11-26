import type { ReactNode } from 'react';
import type { State } from '../../types/soc';
import type { WorkspaceActions } from '../../types/workspace';

export interface DialogProps extends WorkspaceActions {
  state: State;
}

export interface DialogDefinition {
  title: string;
  fields: ReactNode;
  submit: (values: Record<string, string>) => void;
}
