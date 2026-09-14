import { readonly, ref } from 'vue';
import { api } from '../api/client';
import { currentSession, signIn, signOut } from '../api/auth';
import type { Session } from '../types/api';
export function createAuthStore() {
  const session = ref<Session | null>(null);
  const notice = ref('');
  const reset = () => { session.value = null; api.setSession(null); };
  api.onExpired = () => { reset(); notice.value = 'Your session expired. Sign in to continue.'; };
  async function login(username: string, password: string) {
    reset(); notice.value = '';
    const result = await signIn(username.trim(), password);
    if (!result._id) throw new Error('openMAINT did not return a usable session.');
    api.setSession(result._id);
    try { session.value = {...await currentSession(), _id: result._id}; }
    catch (error) { await signOut(result._id).catch(() => {}); reset(); throw error; }
  }
  async function logout() {
    const id = session.value?._id;
    try { if (id) await signOut(id); }
    catch { notice.value = 'Signed out on this device. The server could not confirm session revocation.'; }
    finally { reset(); }
  }
  return {session: readonly(session), notice: readonly(notice), login, logout};
}
export const auth = createAuthStore();
