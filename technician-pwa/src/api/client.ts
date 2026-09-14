import type { Envelope } from '../types/api';
export class ApiError extends Error {
  constructor(message: string, public status = 0, public uncertain = false) { super(message); this.name = 'ApiError'; }
}
export class ApiClient {
  private token: string | null = null;
  private epoch = 0;
  onExpired: () => void = () => {};
  constructor(public base: string, private transport: typeof fetch = (...args) => fetch(...args)) {
    this.base = base.replace(/\/?$/, '/');
  }
  setSession(token: string | null) { this.token = token; this.epoch++; }
  async raw(path: string, init: RequestInit = {}): Promise<Response> {
    if (/^(https?:|\/\/)/i.test(path) || path.startsWith('/')) throw new ApiError('Invalid API path');
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    if (this.token) headers.set('Cmdbuild-Authorization', this.token);
    const epoch = this.epoch;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    let response: Response;
    try {
      response = await this.transport(this.base + path, {...init, headers, credentials: 'omit', cache: 'no-store', redirect: 'error', signal: init.signal ?? controller.signal});
    } catch {
      const uncertain = !!init.method && init.method !== 'GET';
      throw new ApiError(uncertain ? 'Connection interrupted. The server may have saved this change. Refresh and check before retrying.' : 'Cannot reach openMAINT. Check your connection and retry.', 0, uncertain);
    } finally {
      clearTimeout(timeout);
    }
    if (epoch !== this.epoch) throw new ApiError('Session changed. Please reload your jobs.');
    if (response.status === 401 && this.token) { this.setSession(null); this.onExpired(); }
    if (!response.ok) {
      const message = response.status === 401 ? 'Your session has ended. Please sign in again.' : response.status === 403 ? 'openMAINT has not granted permission for this operation.' : `openMAINT could not complete this request (${response.status}).`;
      throw new ApiError(message, response.status, response.status >= 500 && !!init.method && init.method !== 'GET');
    }
    return response;
  }
  async request<T>(path: string, method = 'GET', body?: unknown): Promise<Envelope<T>> {
    const response = await this.raw(path, {method, ...(body === undefined ? {} : {headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)})});
    return this.parse<T>(response, method);
  }
  async parse<T>(response: Response, method = 'GET'): Promise<Envelope<T>> {
    if (response.status === 204) return {success: true, data: undefined as T};
    let result: Envelope<T>;
    try { result = await response.json(); } catch { throw new ApiError('Unexpected response from openMAINT.', response.status, method !== 'GET'); }
    if (result.success !== true) throw new ApiError(result.messages?.map(x => x.message).filter(Boolean).join(' · ') || 'openMAINT rejected this request.', response.status);
    return result;
  }
  async data<T>(path: string, method = 'GET', body?: unknown): Promise<T> { return (await this.request<T>(path, method, body)).data; }
}
export const api = new ApiClient(import.meta.env.VITE_API_BASE || '/cmdbuild/services/rest/v3/');
export const encode = encodeURIComponent;
export function filterQuery(filter: unknown) { return 'filter=' + encode(JSON.stringify(filter)); }
export function equalFilter(attribute: string, value: unknown) { return {attribute: {simple: {attribute, operator: 'equal', value: [value]}}}; }
