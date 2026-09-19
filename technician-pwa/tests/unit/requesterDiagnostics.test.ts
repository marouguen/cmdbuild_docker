import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readRequesterDiagnostics, recordRequesterDiagnostic, recordRequesterStage, requesterDiagnosticsStorageKey } from '../../src/api/requesterDiagnostics';

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {get length(){return values.size;}, clear:()=>values.clear(), getItem:key=>values.get(key)??null, key:index=>[...values.keys()][index]??null, removeItem:key=>{values.delete(key);}, setItem:(key,value)=>values.set(key,String(value))};
}

let storage: Storage;
beforeEach(() => { storage = memoryStorage(); vi.stubGlobal('sessionStorage', storage); });
afterEach(() => vi.unstubAllGlobals());

describe('Requester diagnostics', () => {
  it('records submission stages in order with timestamps', () => {
    for (const stage of ['idle','creating_draft','draft_created','uploading_attachment','attachment_uploaded','refreshing_activity','advancing_opening','completed'] as const) recordRequesterStage(stage);
    const events = readRequesterDiagnostics();
    expect(events.map(item => item.event)).toEqual(['idle','creating_draft','draft_created','uploading_attachment','attachment_uploaded','refreshing_activity','advancing_opening','completed']);
    expect(events.every(item => !Number.isNaN(Date.parse(item.timestamp)))).toBe(true);
  });

  it('records failures and lifecycle events in a bounded session-only history', () => {
    recordRequesterStage('failed');
    for (let index = 0; index < 35; index++) recordRequesterDiagnostic('pagehide');
    const events = readRequesterDiagnostics();
    expect(events).toHaveLength(30);
    expect(events.every(item => item.event === 'pagehide')).toBe(true);
    expect(storage.length).toBe(1);
  });

  it('contains only diagnostic metadata and no sensitive values', () => {
    recordRequesterStage('creating_draft');
    const serialized = storage.getItem(requesterDiagnosticsStorageKey) ?? '';
    expect(serialized).not.toMatch(/auth-token|password|sensitive request/);
    expect(JSON.parse(serialized)[0]).toEqual({timestamp: expect.any(String), event:'creating_draft'});
  });
});
