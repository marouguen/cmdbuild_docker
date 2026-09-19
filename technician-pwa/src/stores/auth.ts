import { readonly, ref } from 'vue';
import { api } from '../api/client';
import { currentSession, signIn, signOut } from '../api/auth';
import type { Session } from '../types/api';
export function createAuthStore() {
  const storageKey = 'field-technician-cmms.openmaint-session';
  const storage = () => typeof sessionStorage === 'undefined' ? null : sessionStorage;
  const storedToken = () => { try { return storage()?.getItem(storageKey) ?? null; } catch { return null; } };
  const session = ref<Session | null>(null);
  const notice = ref('');
  const restoring = ref(Boolean(storedToken()));
  const storeToken = (token: string) => { try { storage()?.setItem(storageKey, token); } catch { /* The in-memory session still remains usable. */ } };
  const clearStoredToken = () => { try { storage()?.removeItem(storageKey); } catch { /* Best effort when browser storage is unavailable. */ } };
  const reset = (clearStorage = true) => { session.value = null; api.setSession(null); if (clearStorage) clearStoredToken(); };
  api.onExpired = () => { reset(); notice.value = 'Your session expired. Sign in to continue.'; };
  async function login(username: string, password: string) {
    reset(); notice.value = '';
    const result = await signIn(username.trim(), password);
    if (!result._id) throw new Error('openMAINT did not return a usable session.');
    api.setSession(result._id);
    storeToken(result._id);
    try { session.value = {...await currentSession(), _id: result._id}; }
    catch (error) { await signOut(result._id).catch(() => {}); reset(); throw error; }
  }
  async function restore() {
    const token = storedToken();
    if (!token) { restoring.value = false; return false; }
    restoring.value = true;
    api.setSession(token);
    try { session.value = {...await currentSession(), _id: token}; notice.value = ''; return true; }
    catch (error) {
      if ((error as {status?: number}).status === 401) reset();
      else {
        notice.value = 'Unable to validate the saved session. Sign in to continue.';
        session.value = null;
      }
      return false;
    } finally { restoring.value = false; }
  }
  async function logout() {
    const id = session.value?._id;
    try { if (id) await signOut(id); }
    catch { notice.value = 'Signed out on this device. The server could not confirm session revocation.'; }
    finally { reset(); }
  }
  return {session: readonly(session), notice: readonly(notice), restoring: readonly(restoring), login, restore, logout, storageKey};
}
export const auth = createAuthStore();
