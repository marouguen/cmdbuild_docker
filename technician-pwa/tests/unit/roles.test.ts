import { describe, expect, it } from 'vitest';
import { resolveWorkspace, workspaceForSession } from '../../src/auth/roles';

describe('role-aware application shell', () => {
  it.each([
    ['Team', 'technician'],
    ['Requester', 'requester'],
    ['MaintOffice', 'manager']
  ] as const)('maps active openMAINT role %s to the %s workspace', (role, workspace) => {
    expect(resolveWorkspace(role)).toBe(workspace);
  });

  it('does not silently map unsupported active groups', () => {
    expect(resolveWorkspace('SuperUser')).toBeNull();
    expect(resolveWorkspace('AdminOffice')).toBeNull();
    expect(resolveWorkspace(undefined)).toBeNull();
  });

  it('uses only the active session role, not available group membership', () => {
    expect(workspaceForSession({role: 'Guest'})).toBeNull();
  });
});
