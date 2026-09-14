import { api, encode, filterQuery } from './client';
import { getActivities, processPath } from './processes';
import type { Card } from '../types/api';
export const getTopic = (id: number) => api.data<Card>(`classes/Topic/cards/${id}`);
export const relations = (id: number) => api.data<Card[]>(processPath(id) + '/relations');
export async function searchTopics(job: Card, query = '', relevant = true, start = 0) {
  const and = relevant ? ['Category','Subcategory'].filter(k => job[k]).map(attribute => ({simple:{attribute,operator:'equal',value:[job[attribute]]}})) : [];
  const filter = {...(query.trim() ? {query: query.trim()} : {}), ...(and.length ? {attribute:{and}} : {})};
  return api.request<Card[]>(`classes/Topic/cards?limit=20&start=${start}&` + filterQuery(filter));
}
export async function linkTopic(jobId: number, topicId: number) {
  const activities = await getActivities(jobId);
  if (!activities.some(a => a.writable && a._definition === 'CM-Execution')) throw new Error('Linking knowledge is available during writable Execution.');
  const current = await relations(jobId);
  if (current.some(r => r._type === 'MaintProcessTopic' && r._destinationId === topicId)) return;
  return api.data(`processes/MaintProcess/cards/${jobId}/relations`, 'POST', {_type:'MaintProcessTopic',_sourceType:'MaintProcess',_sourceId:jobId,_destinationType:'Topic',_destinationId:topicId,_is_direct:true});
}
export function copyTopic(topic: Card, notes: string) {
  const reference = [String(topic.Description || topic.Title || ''), String(topic.Content || '')].filter(Boolean).join('\n');
  const work = notes.trim() || 'Work performed: ';
  return [work, '-------------- Reference only, not performed work --------------', reference].filter(Boolean).join('\n');
}
