import type { Session } from '../types/api';

export type Workspace = 'technician' | 'requester' | 'manager';

export interface WorkspaceDefinition { id: Workspace; role: string }

// These are openMAINT group codes, not application permissions. Deployments may
// override them when their openMAINT groups use different codes. MaintOffice is
// the current pilot's provisional Manager mapping and needs live-account confirmation.
export const WORKSPACES: readonly WorkspaceDefinition[] = [
  {id: 'technician', role: import.meta.env.VITE_TECHNICIAN_ROLE || 'Team'},
  {id: 'requester', role: import.meta.env.VITE_REQUESTER_ROLE || 'Requester'},
  {id: 'manager', role: import.meta.env.VITE_MANAGER_ROLE || 'MaintOffice'}
];

export function resolveWorkspace(activeRole: string | null | undefined): Workspace | null {
  return WORKSPACES.find(workspace => workspace.role === activeRole)?.id ?? null;
}

export function workspaceForSession(session: Pick<Session, 'role'>): Workspace | null {
  return resolveWorkspace(session.role);
}
