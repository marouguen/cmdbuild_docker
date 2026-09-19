import { api, encode, filterQuery } from './client';
import { metadataFilter, processPath } from './processes';
import type { Activity, ActivityAttribute, Attachment, Card, Envelope, Lookup } from '../types/api';
import type { DmsCategory } from './attachments';
import { recordRequesterStage } from './requesterDiagnostics';

export interface ProcessAccess {
  _can_start?: boolean;
  _attachment_access_write?: boolean;
  dmsCategory?: string;
  dmsCategories?: {category: string; _can_create: boolean}[];
}

export interface RequestDraft {
  Requester?: number;
  ShortDescr: string;
  Type?: number;
  Priority?: number;
  Site?: number;
  Floor?: number;
  Room?: number;
  CI?: number;
  Category?: number;
  Subcategory?: number;
  ProcessNotes: string;
}

export type SubmissionStage = 'creation' | 'attachment' | 'advance';

export class RequestSubmissionError extends Error {
  constructor(message: string, public stage: SubmissionStage, public request?: Card, public uncertain = false) {
    super(message);
    this.name = 'RequestSubmissionError';
  }
}

const supportedFields = new Set(['Requester','ShortDescr','Type','Priority','Site','Floor','Room','CI','Category','Subcategory','ProcessNotes']);

export const listRequests = (start = 0) => api.request<Card[]>(processPath() + `?limit=25&start=${start}`);
export const getRequest = (id: number) => api.data<Card>(processPath(id));
export const getRequestActivities = (id: number) => api.data<Activity[]>(processPath(id) + '/activities');
export const getRequestActivity = (id: number, activityId: string) => api.data<Activity>(processPath(id) + '/activities/' + encode(activityId));
export const getRequestHistory = (id: number) => api.data<Card[]>(processPath(id) + '/history?limit=100');
export const getRequestHistorySnapshot = (id: number, historyId: number) => api.data<Card>(processPath(id) + '/history/' + historyId);
export const getRequestAttachments = (id: number) => api.data<Attachment[]>(processPath(id) + '/attachments');

export function selectOpeningHistory(history: Card[]) {
  const openings = history.filter(row => row._activity_code === 'CM-Opening' || row._activity === 'CM-Opening');
  return openings.sort((left, right) => String(right._endDate ?? right._beginDate ?? '').localeCompare(String(left._endDate ?? left._beginDate ?? '')))[0] ?? null;
}

export async function getOriginalRequestNotes(id: number, history: Card[]) {
  const opening = selectOpeningHistory(history);
  if (!opening) return null;
  const snapshot = await getRequestHistorySnapshot(id, opening._id);
  return typeof snapshot.ProcessNotes === 'string' && snapshot.ProcessNotes.trim() ? snapshot.ProcessNotes : null;
}

export async function getOpeningContract() {
  const [process, raw] = await Promise.all([
    api.data<ProcessAccess>('processes/CorrectiveMaint'),
    api.data<Activity | Activity[]>('processes/CorrectiveMaint/start_activities')
  ]);
  if (process._can_start !== true) throw new Error('openMAINT does not allow this account to start corrective maintenance.');
  const activities = Array.isArray(raw) ? raw : [raw];
  const opening = activities.find(activity => activity._definition === 'CM-Opening');
  if (!opening) throw new Error('openMAINT did not return the corrective maintenance Opening activity.');
  assertOpeningContract(opening);
  return {process, opening};
}

export function assertOpeningContract(activity: Activity) {
  if (activity._definition !== 'CM-Opening' || activity.writable !== true) throw new Error('The corrective maintenance Opening activity is not writable.');
  const attributes = activity.attributes ?? [];
  for (const name of ['Requester','ShortDescr','Type','Priority','Site']) {
    const attribute = attributes.find(item => item._id === name);
    if (!attribute?.writable || !attribute.mandatory) throw new Error(`openMAINT Opening metadata for ${name} is incompatible.`);
  }
  const unknownRequired = attributes.find(item => item.writable && item.mandatory && !supportedFields.has(item._id));
  if (unknownRequired) throw new Error(`openMAINT requires unsupported Opening field ${unknownRequired._id}.`);
  if (activity.widgets?.some(widget => widget._active && widget._required)) throw new Error('openMAINT requires an unsupported Opening widget.');
}

export function openingAttribute(activity: Activity, id: string) {
  return activity.attributes?.find(attribute => attribute._id === id);
}

export function openingPayload(activity: Activity, draft: RequestDraft) {
  assertOpeningContract(activity);
  const payload: Record<string, unknown> = {_activity: activity._id, _advance: false};
  for (const [key, value] of Object.entries(draft)) {
    if (!supportedFields.has(key) || value === undefined || value === null || value === '') continue;
    if (!openingAttribute(activity, key)?.writable) throw new Error(`${key} is not writable in the Opening activity.`);
    payload[key] = typeof value === 'string' ? value.trim() : value;
  }
  for (const attribute of activity.attributes?.filter(item => item.writable && item.mandatory) ?? []) {
    if (payload[attribute._id] === undefined || payload[attribute._id] === '') throw new Error(`${attribute.detail.description || attribute._id} is required.`);
  }
  return payload;
}

export function choiceFilter(attribute: ActivityAttribute, draft: Partial<RequestDraft>) {
  return metadataFilter(attribute, {_id: 0, _type: 'CorrectiveMaint'}, draft as Record<string, unknown>);
}

export async function openingChoices(attribute: ActivityAttribute, draft: Partial<RequestDraft> = {}) {
  const path = attribute.detail.lookupType
    ? `lookup_types/${encode(attribute.detail.lookupType)}/values`
    : attribute.detail.targetClass
      ? `classes/${encode(attribute.detail.targetClass)}/cards`
      : null;
  if (!path) return [];
  const filter = choiceFilter(attribute, draft);
  return api.data<(Lookup | Card)[]>(path + '?limit=100&' + (filter ? filterQuery(filter) : ''));
}

export function isRequesterDetailReadOnly(activity: Activity | null | undefined) {
  return activity?.writable !== true;
}

export function selectListedRequest(cards: Card[], id: number) {
  return cards.find(card => card._id === id) ?? null;
}

export async function requestAttachmentCategories(process: ProcessAccess) {
  if (!process._attachment_access_write) return [];
  const categories = await api.data<DmsCategory[]>('dms/categories/_ALL/values');
  const type = process.dmsCategory || import.meta.env.VITE_DMS_CATEGORY_TYPE || 'AlfrescoCategory';
  return categories.filter(category => category._type === type && category.active && category.modelClass === 'BaseDocument' && process.dmsCategories?.some(item => item.category === category.code && item._can_create));
}

function validateFile(file: File, category: DmsCategory) {
  if (file.size <= 0 || file.size > 10 * 1024 * 1024) throw new Error('Choose an attachment smaller than 10 MB.');
  const extensions = category.allowedExtensions?.split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extensions?.length && (!extension || !extensions.includes(extension))) throw new Error('This category does not accept that file extension.');
}

export async function uploadOpeningAttachment(id: number, file: File, category: DmsCategory) {
  validateFile(file, category);
  const activities = await getRequestActivities(id);
  if (!activities.some(activity => activity._definition === 'CM-Opening' && activity.writable)) throw new Error('Attachments can only be added during writable Opening.');
  const form = new FormData();
  form.append('file', file);
  form.append('attachment', new Blob([JSON.stringify({category: category._id, description: ''})], {type: 'application/json'}));
  const response = await api.raw(processPath(id) + '/attachments', {method: 'POST', body: form});
  return (await api.parse<Attachment>(response, 'POST')).data;
}

export async function submitRequest(activity: Activity, draft: RequestDraft, files: File[], category?: DmsCategory) {
  let created: Card;
  recordRequesterStage('creating_draft');
  try {
    created = await api.data<Card>(processPath(), 'POST', openingPayload(activity, draft));
    recordRequesterStage('draft_created');
  } catch (error) {
    recordRequesterStage('failed');
    const uncertain = Boolean((error as {uncertain?: boolean}).uncertain);
    throw new RequestSubmissionError((error as Error).message, 'creation', undefined, uncertain);
  }
  try {
    if (files.length && !category) throw new Error('No permitted attachment category is available.');
    for (const file of files) {
      recordRequesterStage('uploading_attachment');
      await uploadOpeningAttachment(created._id, file, category!);
      recordRequesterStage('attachment_uploaded');
    }
  } catch (error) {
    recordRequesterStage('failed');
    const uncertain = Boolean((error as {uncertain?: boolean}).uncertain);
    throw new RequestSubmissionError((error as Error).message, 'attachment', created, uncertain);
  }
  try {
    recordRequesterStage('refreshing_activity');
    const current = await getRequestActivities(created._id);
    const openings = current.filter(item => item._definition === 'CM-Opening' && item.writable);
    if (openings.length !== 1) throw new Error('The created request no longer has one writable Opening activity.');
    recordRequesterStage('advancing_opening');
    await api.data<Card>(processPath(created._id), 'PUT', {_activity: openings[0]._id, _advance: true});
    const result = await getRequest(created._id);
    recordRequesterStage('completed');
    return result;
  } catch (error) {
    recordRequesterStage('failed');
    const uncertain = Boolean((error as {uncertain?: boolean}).uncertain);
    throw new RequestSubmissionError((error as Error).message, 'advance', created, uncertain);
  }
}

export type RequestListResponse = Envelope<Card[]>;
