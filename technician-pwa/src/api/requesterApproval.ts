import { api, encode, filterQuery } from './client';
import { metadataFilter, processPath } from './processes';
import { getRequest, getRequestActivities, getRequestActivity, listRequests, selectListedRequest } from './requester';
import type { Activity, Card, Lookup } from '../types/api';
import verifiedRules from '../config/execution-rules.json';

export const ISSUE_SOLVED_CODE = 'CM-Approval_Advance';
export const APPROVAL_UNAVAILABLE = 'This request is no longer awaiting your approval. Refresh it to see its current state.';
const notAllowed = 'Issue solved is not currently allowed by openMAINT.';
const pending = new Set<number>();
export const approvalAttribute = (activity: Activity, id: string) => activity.attributes?.find(item => item._id === id);
export const isWritableApproval = (activity: Activity | null | undefined) => activity?._definition === 'CM-Approval' && activity.performer === 'Requester' && activity.writable === true;
export const approvalActivity = (activities: Activity[]) => activities.length === 1 && isWritableApproval(activities[0]) ? activities[0] : null;

// Membership is checked against the active session's complete server-filtered collection.
// No status filter: completed requests must remain reachable through My Requests.
export async function findVisibleRequest(id: number) {
  const cards: Card[] = [];
  let total: number | undefined;
  do {
    const response = await listRequests(cards.length);
    const count = response.meta?.total;
    if (!Number.isInteger(count) || count! < 0 || (total !== undefined && total !== count)) throw new Error('The request list changed or could not be verified. Refresh My Requests.');
    total = count!;
    if (!response.data.length && cards.length < total) throw new Error('The request list changed or could not be verified. Refresh My Requests.');
    cards.push(...response.data);
  } while (cards.length < total);
  if (cards.length !== total || new Set(cards.map(card => card._id)).size !== total) throw new Error('The request list changed or could not be verified. Refresh My Requests.');
  return selectListedRequest(cards, id);
}

export function resolveIssueSolved(activity: Activity, actions: Lookup[]) {
  if (!isWritableApproval(activity) || !approvalAttribute(activity, 'Action')?.writable) return null;
  const matches = actions.filter(action => action.active && action.code === ISSUE_SOLVED_CODE);
  return matches.length === 1 ? matches[0] : null;
}

export async function approvalActions(activity: Activity, card: Card) {
  const attribute = approvalAttribute(activity, 'Action');
  if (!isWritableApproval(activity) || !attribute?.writable || !attribute.detail.lookupType) return [];
  const filter = metadataFilter(attribute, card);
  const path = `lookup_types/${encode(attribute.detail.lookupType)}/values`;
  const result: Lookup[] = [];
  let total: number | undefined;
  do {
    const response = await api.request<Lookup[]>(path + `?limit=100&start=${result.length}` + (filter ? '&' + filterQuery(filter) : ''));
    const count = response.meta?.total;
    if (!Number.isInteger(count) || count! < 0 || (total !== undefined && count !== total)) throw new Error(notAllowed);
    total = count!;
    if (!response.data.length && result.length < total) throw new Error(notAllowed);
    result.push(...response.data);
  } while (result.length < total);
  if (result.length !== total || new Set(result.map(action => action._id)).size !== total) throw new Error(notAllowed);
  return result;
}

export function approvalPayload(activity: Activity, card: Card, action: Lookup, notes = '') {
  if (!isWritableApproval(activity)) throw new Error(APPROVAL_UNAVAILABLE);
  if (!resolveIssueSolved(activity, [action])) throw new Error(notAllowed);
  const payload: Record<string, unknown> = {_activity: activity._id, _advance: true, Action: action._id};
  if (notes.trim()) {
    if (!approvalAttribute(activity, 'ProcessNotes')?.writable) throw new Error('ProcessNotes is not writable in this activity.');
    payload.ProcessNotes = notes.trim();
  }
  for (const field of activity.attributes ?? []) {
    if (!field.writable) continue;
    const rule = (field.detail.validationRules ?? '').replace(/\r\n/g, '\n').trim();
    const known = field._id === 'ProcessNotes' ? verifiedRules.ProcessNotes.trim() : '';
    if (rule && rule !== known) throw new Error(`openMAINT validation for ${field.detail.description || field._id} changed. This activity needs integration review before editing.`);
    const value = payload[field._id] ?? card[field._id];
    if (field.mandatory && (value == null || (typeof value === 'string' && !value.trim()) || (Array.isArray(value) && !value.length))) throw new Error(`${field.detail.description || field._id} is required.`);
  }
  if (activity.widgets?.some(widget => widget._active && widget._required)) throw new Error('This activity requires a widget submission that this PWA has not verified.');
  return payload;
}

export async function issueSolved(card: Card, activity: Activity, intendedAction: Lookup, notes = '') {
  if (pending.has(card._id)) throw new Error('Request approval is already in progress.');
  pending.add(card._id);
  try {
    const current = await getRequest(card._id);
    const listed = await findVisibleRequest(card._id);
    if (!listed) throw new Error('This request is no longer available in My Requests.');
    const activities = await getRequestActivities(card._id);
    const eligible = approvalActivity(activities);
    if (current._beginDate !== card._beginDate || listed._beginDate !== current._beginDate || !eligible || eligible._id !== activity._id) throw new Error(APPROVAL_UNAVAILABLE);
    const fresh = await getRequestActivity(card._id, eligible._id);
    if (fresh._id !== activity._id || !isWritableApproval(fresh)) throw new Error(APPROVAL_UNAVAILABLE);
    const action = resolveIssueSolved(fresh, await approvalActions(fresh, current));
    if (!action || intendedAction.code !== ISSUE_SOLVED_CODE || action._id !== intendedAction._id) throw new Error(notAllowed);
    const payload = approvalPayload(fresh, current, action, notes);
    await api.data<Card>(processPath(card._id), 'PUT', payload);
    // Neither an uncertain PUT nor a failed verification read is automatically retried.
    const result = await getRequest(card._id);
    const resultingActivities = await getRequestActivities(card._id);
    if (result._ProcessStatus_code !== 'CM-Completed' || result._FlowStatus_code !== 'closed.completed' || resultingActivities.length !== 0) throw new Error('openMAINT did not confirm that the request completed. Refresh before taking any further action.');
    return result;
  } finally { pending.delete(card._id); }
}
