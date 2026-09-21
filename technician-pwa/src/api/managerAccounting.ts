import { api } from './client';
import { getActivities, getActivity, getJob, metadataFilter, processPath } from './processes';
import { assignmentAttribute, isWritableAccounting } from './manager';
import type { Activity, Card, Lookup } from '../types/api';
import verifiedRules from '../config/execution-rules.json';

export const APPROVE_ACTION_CODE = 'CM-Accounting_Advance';
const unavailable = 'This request is no longer available for Accounting. Refresh it to see its current state.';
const notAllowed = 'Approve is not currently allowed by openMAINT.';
const pending = new Set<number>();

export function resolveApproveAction(activity: Activity, actions: Lookup[]) {
  if (!isWritableAccounting(activity) || !assignmentAttribute(activity, 'Action')?.writable) return null;
  const matches = actions.filter(action => action.active && action.code === APPROVE_ACTION_CODE);
  return matches.length === 1 ? matches[0] : null;
}

export async function accountingActions(activity: Activity, card: Card) {
  const attribute = assignmentAttribute(activity, 'Action');
  if (!isWritableAccounting(activity) || !attribute?.writable || !attribute.detail.lookupType) return [];
  const filter = metadataFilter(attribute, card);
  const path = `lookup_types/${encodeURIComponent(attribute.detail.lookupType)}/values`;
  const result: Lookup[] = [];
  let total = 0;
  do {
    const response = await api.request<Lookup[]>(path + `?limit=100&start=${result.length}` + (filter ? '&filter=' + encodeURIComponent(JSON.stringify(filter)) : ''));
    if (!response.data.length && result.length < total) throw new Error('The queue changed while loading. Refresh it.');
    result.push(...response.data);
    total = response.meta?.total ?? result.length;
  } while (result.length < total);
  return result;
}

export function accountingPayload(activity: Activity, card: Card, action: Lookup, notes: string) {
  if (!isWritableAccounting(activity)) throw new Error(unavailable);
  if (!resolveApproveAction(activity, [action])) throw new Error(notAllowed);
  const payload: Record<string, unknown> = {_activity: activity._id, _advance: true, Action: action._id};
  if (notes.trim()) {
    if (!assignmentAttribute(activity, 'ProcessNotes')?.writable) throw new Error('ProcessNotes is not writable in this activity.');
    payload.ProcessNotes = notes.trim();
  }
  for (const attribute of activity.attributes ?? []) {
    if (!attribute.writable) continue;
    const rule = (attribute.detail.validationRules ?? '').replace(/\r\n/g, '\n').trim();
    const known = attribute._id === 'ProcessNotes' ? verifiedRules.ProcessNotes.trim() : '';
    if (rule && rule !== known) throw new Error(`openMAINT validation for ${attribute.detail.description || attribute._id} changed. This activity needs integration review before editing.`);
    const value = payload[attribute._id] ?? card[attribute._id];
    if (attribute.mandatory && (value == null || (typeof value === 'string' && !value.trim()) || (Array.isArray(value) && !value.length))) throw new Error(`${attribute.detail.description || attribute._id} is required.`);
  }
  if (activity.widgets?.some(widget => widget._active && widget._required)) throw new Error('This activity requires a widget submission that this PWA has not verified.');
  return payload;
}

export async function approveAccounting(card: Card, activity: Activity, intendedAction: Lookup, notes = '') {
  if (pending.has(card._id)) throw new Error('Accounting approval is already in progress.');
  pending.add(card._id);
  try {
    const current = await getJob(card._id);
    const activities = await getActivities(card._id);
    if (current._beginDate !== card._beginDate || activities.length !== 1 || activities[0]._id !== activity._id || !isWritableAccounting(activities[0])) throw new Error(unavailable);
    const fresh = await getActivity(card._id, activities[0]._id);
    if (fresh._id !== activity._id || !isWritableAccounting(fresh)) throw new Error(unavailable);
    const action = resolveApproveAction(fresh, await accountingActions(fresh, current));
    if (!action || intendedAction.code !== APPROVE_ACTION_CODE || action._id !== intendedAction._id) throw new Error(notAllowed);
    const payload = accountingPayload(fresh, current, action, notes);
    await api.data<Card>(processPath(card._id), 'PUT', payload);
    // No retries: a failed read after PUT leaves the outcome unconfirmed in the UI.
    const result = await getJob(card._id);
    const resulting = await getActivities(card._id);
    if (result._ProcessStatus_code !== 'CM-Approval' || resulting.length !== 1 || resulting[0]._definition !== 'CM-Approval' || resulting[0].performer !== 'Requester') throw new Error('openMAINT did not confirm Approval for Requester. Refresh before taking any further action.');
    const detail = await getActivity(card._id, resulting[0]._id);
    if (detail._id !== resulting[0]._id || detail._definition !== 'CM-Approval' || detail.performer !== 'Requester') throw new Error('openMAINT did not confirm Approval for Requester. Refresh before taking any further action.');
    return {card: result, activity: detail};
  } finally { pending.delete(card._id); }
}
