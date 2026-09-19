import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ApiError, api } from '../../src/api/client';
import { createAuthStore } from '../../src/stores/auth';

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {get length(){return values.size;}, clear:()=>values.clear(), getItem:key=>values.get(key)??null, key:index=>[...values.keys()][index]??null, removeItem:key=>{values.delete(key);}, setItem:(key,value)=>values.set(key,String(value))};
}

let storage: Storage;
beforeEach(() => { storage = memoryStorage(); vi.stubGlobal('sessionStorage', storage); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); api.setSession(null); });

it('stores only the returned session identifier after successful login', async () => {
  vi.spyOn(api, 'data').mockResolvedValueOnce({_id:'sid'}).mockResolvedValueOnce({username:'tech',role:'Team'});
  const store = createAuthStore();
  await store.login(' tech ', 'secret-password');
  expect(storage.length).toBe(1);
  expect(storage.getItem(store.storageKey)).toBe('sid');
  const serialized = JSON.stringify([...Array(storage.length)].map((_, index) => storage.getItem(storage.key(index)!)));
  expect(serialized).not.toMatch(/tech|secret-password/);
  expect(store.session.value).toMatchObject({_id:'sid', username:'tech', role:'Team'});
});

it('restores a valid stored session through sessions/current', async () => {
  const store = createAuthStore(); storage.setItem(store.storageKey, 'stored-sid');
  // A freshly-created application store detects persisted auth before its first render.
  const startupStore = createAuthStore();
  expect(startupStore.restoring.value).toBe(true);
  const data = vi.spyOn(api, 'data').mockResolvedValue({username:'requester', role:'Requester'});
  await expect(startupStore.restore()).resolves.toBe(true);
  expect(data).toHaveBeenCalledWith('sessions/current');
  expect(startupStore.session.value).toMatchObject({_id:'stored-sid', role:'Requester'});
});

it('clears an invalid stored session after a genuine 401', async () => {
  const store = createAuthStore(); storage.setItem(store.storageKey, 'expired-sid');
  vi.spyOn(api, 'data').mockRejectedValue(new ApiError('expired', 401));
  await expect(store.restore()).resolves.toBe(false);
  expect(storage.getItem(store.storageKey)).toBeNull();
  expect(store.session.value).toBeNull();
});

it('preserves a potentially valid stored session on an ordinary network failure', async () => {
  const store = createAuthStore(); storage.setItem(store.storageKey, 'possibly-valid-sid');
  vi.spyOn(api, 'data').mockRejectedValue(new ApiError('offline', 0));
  await expect(store.restore()).resolves.toBe(false);
  expect(storage.getItem(store.storageKey)).toBe('possibly-valid-sid');
  expect(store.session.value).toBeNull();
});

it('logout clears storage and local state even if server revocation fails', async () => {
  const data = vi.spyOn(api, 'data').mockResolvedValueOnce({_id:'sid'}).mockResolvedValueOnce({username:'tech',role:'Team'}).mockRejectedValueOnce(Error('offline'));
  const store = createAuthStore(); await store.login('tech', 'secret'); await store.logout();
  expect(data).toHaveBeenLastCalledWith('sessions/sid', 'DELETE');
  expect(storage.getItem(store.storageKey)).toBeNull();
  expect(store.session.value).toBeNull();
  expect(store.notice.value).toContain('could not confirm');
});

it('authenticated API expiry clears storage and in-memory state', async () => {
  vi.spyOn(api, 'data').mockResolvedValueOnce({_id:'sid'}).mockResolvedValueOnce({username:'tech',role:'Team'});
  const store = createAuthStore(); await store.login('tech', 'secret'); api.onExpired();
  expect(storage.getItem(store.storageKey)).toBeNull();
  expect(store.session.value).toBeNull();
  expect(store.notice.value).toContain('expired');
});
