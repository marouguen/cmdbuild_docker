export type RequesterSubmissionStage =
  | 'idle'
  | 'creating_draft'
  | 'draft_created'
  | 'uploading_attachment'
  | 'attachment_uploaded'
  | 'refreshing_activity'
  | 'advancing_opening'
  | 'completed'
  | 'failed';

export interface RequesterDiagnosticEvent {
  timestamp: string;
  event: RequesterSubmissionStage | 'pagehide' | 'pageshow' | 'beforeunload' | 'visibilitychange';
  visibility?: DocumentVisibilityState;
}

const key = 'field-technician-cmms.requester-diagnostics';
const maxEvents = 30;
let lifecycleInstalled = false;

function storage() { return typeof sessionStorage === 'undefined' ? null : sessionStorage; }

export function readRequesterDiagnostics(): RequesterDiagnosticEvent[] {
  try {
    const parsed = JSON.parse(storage()?.getItem(key) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(item => item && typeof item.timestamp === 'string' && typeof item.event === 'string') : [];
  } catch { return []; }
}

export function recordRequesterDiagnostic(event: RequesterDiagnosticEvent['event']) {
  const visibility = event === 'visibilitychange' && typeof document !== 'undefined' ? document.visibilityState : undefined;
  const next = [...readRequesterDiagnostics(), {timestamp: new Date().toISOString(), event, ...(visibility ? {visibility} : {})}].slice(-maxEvents);
  try { storage()?.setItem(key, JSON.stringify(next)); } catch { /* Diagnostics must never affect workflow behavior. */ }
}

export function recordRequesterStage(stage: RequesterSubmissionStage) { recordRequesterDiagnostic(stage); }

export function installLifecycleDiagnostics() {
  if (lifecycleInstalled || typeof window === 'undefined' || typeof document === 'undefined') return;
  lifecycleInstalled = true;
  window.addEventListener('pagehide', () => recordRequesterDiagnostic('pagehide'));
  window.addEventListener('pageshow', () => recordRequesterDiagnostic('pageshow'));
  window.addEventListener('beforeunload', () => recordRequesterDiagnostic('beforeunload'));
  document.addEventListener('visibilitychange', () => recordRequesterDiagnostic('visibilitychange'));
}

export const requesterDiagnosticsStorageKey = key;
