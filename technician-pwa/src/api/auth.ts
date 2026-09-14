import { api, encode } from './client';
import type { Session } from '../types/api';
export const signIn = (username: string, password: string) => api.data<Session>('sessions?scope=service&returnId=true', 'POST', {username, password});
export const currentSession = () => api.data<Session>('sessions/current');
export const signOut = (id: string) => api.data('sessions/' + encode(id), 'DELETE');
