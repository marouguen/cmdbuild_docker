import { api, encode, filterQuery } from './client';
import type { Activity, ActivityAttribute, Card, Lookup } from '../types/api';
import verifiedRules from '../config/execution-rules.json';
export const processPath = (id?: number) => 'processes/CorrectiveMaint/instances' + (id === undefined ? '' : '/' + id);
export const listJobs = (start = 0) => api.request<Card[]>(processPath() + `?limit=25&start=${start}`);
export const getJob = (id: number) => api.data<Card>(processPath(id));
export const getActivities = (id: number) => api.data<Activity[]>(processPath(id) + '/activities');
export const getActivity = (id: number, activityId: string) => api.data<Activity>(processPath(id) + '/activities/' + encode(activityId));
export const lookups = (type: string) => api.data<Lookup[]>('lookup_types/' + encode(type) + '/values');
export function metadataFilter(attribute: ActivityAttribute, job: Card, values: Record<string, unknown> = {}) {
  const ecql = attribute.detail.ecqlFilter;
  if (!ecql) return undefined;
  const record = {...job, ...values};
  const client: Record<string, unknown> = {};
  for (const key of ecql.bindings?.client ?? []) {
    const [name, property] = key.split('.');
    client[key] = property === 'Code' ? record[`_${name}_code`] : record[name] ?? null;
  }
  const server: Record<string, unknown> = {};
  for (const key of ecql.bindings?.server ?? []) {
    if (key !== 'Id') throw new Error(`Unsupported server filter binding: ${key}`);
    server[key] = job._id;
  }
  return {ecql: {id: ecql.id, context: {server, client}}};
}
export async function choices(attribute: ActivityAttribute, job: Card, values: Record<string, unknown> = {}) {
  const filter = metadataFilter(attribute, job, values);
  const path = attribute.detail.lookupType ? `lookup_types/${encode(attribute.detail.lookupType)}/values` : attribute.detail.targetClass ? `classes/${encode(attribute.detail.targetClass)}/cards` : null;
  if (!path) return [];
  return api.data<(Lookup | Card)[]>(path + '?limit=100&' + (filter ? filterQuery(filter) : ''));
}
export function mapActions(activity: Activity, values: Lookup[]) {
  if (!activity.writable || activity._definition !== 'CM-Execution') return [];
  return values.filter(v => v.active && ['CM-Execution_Advance','CM-Execution_Return','CM-Execution_Back'].includes(v.code));
}
export function mapJob(card: Card) {
  const text = (key: string) => String(card[key] ?? '');
  const label = (key: string) => text(`_${key}_description_translation`) || text(`_${key}_description`) || text(`_${key}_code`);
  return {id: card._id, number: text('Number') || String(card._id), subject: text('ShortDescr') || text('Description'), status: label('ProcessStatus'), statusCode: text('_ProcessStatus_code'), priority: label('Priority'), equipment: label('CI'), location: [label('Site'),label('Floor'),label('Room')].filter(Boolean).join(' · '), category: label('Category'), subcategory: label('Subcategory'), team: label('Team'), assignee: label('Assignee')};
}
export function visibleJobs(cards: Card[], query = '', activeOnly = true) {
  // Presentation narrowing only. All input cards must come from this user's REST session.
  const term = query.trim().toLocaleLowerCase();
  return cards.filter(card => (!activeOnly || String(card._FlowStatus_code ?? '').startsWith('open.')) && (!term || Object.values(mapJob(card)).join(' ').toLocaleLowerCase().includes(term)));
}
export interface ExecutionDraft { Action?: number; Outcome?: number; ExecStartDate?: string; ExecEndDate?: string; ProcessNotes?: string; Assignee?: number }
const editable = ['Action','Outcome','ExecStartDate','ExecEndDate','ProcessNotes','Assignee'];
export function assertExecutionMetadata(activity: Activity) {
  for (const attribute of activity.attributes?.filter(a=>a.writable) ?? []) {
    const current = (attribute.detail.validationRules || '').replace(/\r\n/g,'\n').trim();
    const known = (verifiedRules as Record<string,string>)[attribute._id] || '';
    if (current !== known) throw new Error(`openMAINT validation for ${attribute._id} changed. This activity needs integration review before editing.`);
  }
  if (activity.widgets?.some(w=>w._active&&w._required)) throw new Error('This activity requires a widget submission that this PWA has not verified.');
}
export function executionPayload(activity: Activity, draft: ExecutionDraft, actions: Lookup[], advance: boolean) {
  if (!activity.writable || activity._definition !== 'CM-Execution') throw new Error('This activity is not available for technician execution.');
  assertExecutionMetadata(activity);
  const attrs = activity.attributes ?? [];
  const payload: Record<string, unknown> = {_activity: activity._id, _advance: advance};
  for (const [key, value] of Object.entries(draft)) {
    if (value === undefined || (value === '' && key !== 'ProcessNotes')) continue;
    if (!editable.includes(key) || !attrs.some(a => a._id === key && a.writable)) throw new Error(`${key} is not writable in this activity.`);
    payload[key] = value;
  }
  for (const key of ['ExecStartDate','ExecEndDate']) {
    if (payload[key]) {
      const date = new Date(String(payload[key]));
      if (!Number.isFinite(date.getTime())) throw new Error('Enter valid execution dates.');
      payload[key] = date.toISOString();
    }
  }
  if (payload.ExecStartDate && payload.ExecEndDate && String(payload.ExecEndDate) < String(payload.ExecStartDate)) throw new Error('End time must be after start time.');
  if (advance) {
    for (const attr of attrs.filter(a => a.writable && a.mandatory)) if (payload[attr._id] === undefined || payload[attr._id] === null) throw new Error(`${attr.detail.description || attr._id} is required.`);
    const action = mapActions(activity, actions).find(a => a._id === draft.Action);
    if (!action) throw new Error('Select an action currently allowed by openMAINT.');
    if (action.code === 'CM-Execution_Advance' && !draft.Outcome) throw new Error('Outcome is required to conclude activity.');
    if (action.code === 'CM-Execution_Return' && !draft.Assignee) throw new Error('Assignee is required to change assignee.');
  }
  return payload;
}
export async function saveExecution(job: Card, activity: Activity, draft: ExecutionDraft, advance: boolean) {
  const current = await getJob(job._id);
  const active = await getActivities(job._id);
  if (current._beginDate !== job._beginDate || !active.some(a => a._id === activity._id)) throw new Error('This job changed. Refresh it before saving.');
  const fresh = await getActivity(job._id, activity._id);
  const actionAttr = fresh.attributes?.find(a => a._id === 'Action');
  if (!actionAttr) throw new Error('Action metadata is unavailable.');
  const allowed = await choices(actionAttr, current) as Lookup[];
  const payload = executionPayload(fresh, draft, allowed, advance);
  return api.data<Card>(processPath(job._id), 'PUT', payload);
}
