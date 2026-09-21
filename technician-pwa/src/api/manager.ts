import { api } from './client';
import { choices, getActivities, getActivity, getJob, processPath } from './processes';
import type { Activity, ActivityAttribute, Card, Lookup } from '../types/api';

export const ASSIGN_ACTION_CODE = 'CM-Assignment_Advance';

export interface AssignmentQueueItem { card: Card; activity: Activity }
export interface AssignmentDraft {
  Site?: number;
  Category?: number;
  Subcategory?: number;
  ExpExecStartDate?: string;
  Team?: number;
  Assignee?: number;
  ProcessNotes?: string;
}
export interface AssignmentResult { card: Card; activity: Activity | null }

const writableFields = new Set(['Site','Category','Subcategory','ExpExecStartDate','Team','Assignee','ProcessNotes']);
export const assignmentAttribute = (activity: Activity, id: string) => activity.attributes?.find(item => item._id === id);

export function actionableAssignments(cards: Card[], activities: Map<number, Activity[]>) {
  return cards.flatMap(card => {
    const current = activities.get(card._id)?.filter(item => item._definition === 'CM-Assignment' && item.writable === true) ?? [];
    return current.length === 1 ? [{card, activity: current[0]}] : [];
  });
}

async function listManagerCards() {
  const cards: Card[] = [];
  let start = 0;
  let total = 0;
  do {
    const response = await api.request<Card[]>(processPath() + `?limit=100&start=${start}`);
    if (!response.data.length && start < total) throw new Error('The queue changed while loading. Refresh it.');
    cards.push(...response.data);
    total = response.meta?.total ?? cards.length;
    start = cards.length;
  } while (start < total);
  if (new Set(cards.map(card => card._id)).size !== cards.length) throw new Error('The queue changed while loading. Refresh it.');
  return cards;
}

export async function listAssignmentQueue() {
  const cards = await listManagerCards();
  const pairs = await Promise.all(cards.map(async card => [card._id, await getActivities(card._id)] as const));
  return actionableAssignments(cards, new Map(pairs));
}

export function isWritableAccounting(activity: Activity | null | undefined) {
  return activity?._definition === 'CM-Accounting' && activity.performer === 'MaintOffice' && activity.writable === true;
}

export function actionableAccounting(cards: Card[], activities: Map<number, Activity[]>) {
  return cards.flatMap(card => {
    const current = activities.get(card._id) ?? [];
    return current.length === 1 && isWritableAccounting(current[0]) ? [{card, activity: current[0]}] : [];
  });
}

export async function listAccountingQueue() {
  const cards = await listManagerCards();
  const pairs = await Promise.all(cards.map(async card => [card._id, await getActivities(card._id)] as const));
  return actionableAccounting(cards, new Map(pairs));
}

export function assertWritableAssignment(activity: Activity) {
  if (!activity.writable || activity._definition !== 'CM-Assignment') throw new Error('This request is no longer available for assignment. Refresh it to see its current state.');
}

export function resolveAssignAction(activity: Activity, actions: Lookup[]) {
  if (!activity.writable || activity._definition !== 'CM-Assignment') return null;
  return actions.find(action => action.active && action.code === ASSIGN_ACTION_CODE) ?? null;
}

export async function assignmentChoices(activity: Activity, field: string, card: Card, draft: AssignmentDraft = {}) {
  const attribute = assignmentAttribute(activity, field);
  if (!attribute?.writable) return [];
  return choices(attribute, card, draft as Record<string, unknown>);
}

function required(draft: AssignmentDraft, key: keyof AssignmentDraft) {
  const value = draft[key];
  if (value === undefined || value === null || value === '') throw new Error(`${key} is required.`);
}

export function assignmentPayload(activity: Activity, action: Lookup, draft: AssignmentDraft) {
  assertWritableAssignment(activity);
  if (!action.active || action.code !== ASSIGN_ACTION_CODE) throw new Error('Assign to team is not currently allowed by openMAINT.');
  for (const key of ['Site','Category','Subcategory','Team'] as const) required(draft, key);
  const payload: Record<string, unknown> = {_activity: activity._id, _advance: true, Action: action._id};
  for (const [key, value] of Object.entries(draft)) {
    if (value === undefined || value === null || value === '') continue;
    if (!writableFields.has(key) || !assignmentAttribute(activity, key)?.writable) throw new Error(`${key} is not writable in this activity.`);
    payload[key] = typeof value === 'string' && key === 'ProcessNotes' ? value.trim() : value;
  }
  if (payload.ExpExecStartDate) {
    const date = new Date(String(payload.ExpExecStartDate));
    if (!Number.isFinite(date.getTime())) throw new Error('Enter a valid expected execution date.');
    payload.ExpExecStartDate = date.toISOString();
  }
  return payload;
}

async function validateReference(activity: Activity, field: keyof AssignmentDraft, card: Card, draft: AssignmentDraft) {
  const selected = draft[field];
  if (selected === undefined || selected === null) return;
  const attribute = assignmentAttribute(activity, field);
  if (!attribute || (!attribute.detail.targetClass && !attribute.detail.lookupType)) return;
  const allowed = await assignmentChoices(activity, field, card, draft);
  if (!allowed.some(item => item._id === selected)) throw new Error(`${field} is no longer an available choice. Refresh and select again.`);
}

export async function assignToTeam(card: Card, activity: Activity, draft: AssignmentDraft): Promise<AssignmentResult> {
  const currentCard = await getJob(card._id);
  const active = await getActivities(card._id);
  if (!active.some(item => item._id === activity._id)) throw new Error('This request changed. Refresh it before assigning.');
  const fresh = await getActivity(card._id, activity._id);
  assertWritableAssignment(fresh);
  const actionAttribute = assignmentAttribute(fresh, 'Action');
  if (!actionAttribute?.writable) throw new Error('Action metadata is unavailable.');
  const actions = await choices(actionAttribute, currentCard) as Lookup[];
  const action = resolveAssignAction(fresh, actions);
  if (!action) throw new Error('Assign to team is not currently allowed by openMAINT.');
  for (const field of ['Site','Category','Subcategory','Team','Assignee'] as const) await validateReference(fresh, field, currentCard, draft);
  const payload = assignmentPayload(fresh, action, draft);
  await api.data<Card>(processPath(card._id), 'PUT', payload);
  const [result, resultingActivities] = await Promise.all([getJob(card._id), getActivities(card._id)]);
  if (resultingActivities.some(item => item._definition === 'CM-Assignment')) throw new Error('openMAINT did not confirm that the request left Assignment. Refresh before taking any further action.');
  return {card: result, activity: resultingActivities.length === 1 ? await getActivity(card._id, resultingActivities[0]._id) : resultingActivities[0] ?? null};
}

export function isAssignmentReadOnly(activity: Activity | null | undefined, action: Lookup | null | undefined) {
  return activity?.writable !== true || activity._definition !== 'CM-Assignment' || !action;
}
