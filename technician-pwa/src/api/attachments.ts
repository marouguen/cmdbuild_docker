import { api, encode } from './client';
import { getActivities, processPath } from './processes';
import type { Attachment, Lookup } from '../types/api';
export interface DmsCategory extends Lookup { _type: string; modelClass?: string; allowedExtensions?: string; maxFileSize?: number; checkCount?: boolean; checkCountNumber?: number }
interface ProcessPermissions { _attachment_access_write: boolean; _relation_access_write: boolean; dmsCategory?: string; dmsCategories: {category: string; _can_create: boolean}[] }
export const attachmentList = (id: number) => api.data<Attachment[]>(processPath(id) + '/attachments');
export const permissions = () => api.data<ProcessPermissions>('processes/CorrectiveMaint');
export async function photoCategories() {
  const [process, categories] = await Promise.all([permissions(), api.data<DmsCategory[]>('dms/categories/_ALL/values')]);
  if (!process._attachment_access_write) return [];
  const type = process.dmsCategory || import.meta.env.VITE_DMS_CATEGORY_TYPE || 'AlfrescoCategory';
  return categories.filter(c => c._type === type && c.active && c.modelClass === 'BaseDocument' && process.dmsCategories.some(p => p.category === c.code && p._can_create));
}
export async function uploadPhoto(id: number, file: File, category: DmsCategory, description: string) {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Choose a JPEG, PNG, or WebP photo.');
  if (file.size > 10 * 1024 * 1024 || file.size === 0) throw new Error('Choose a photo smaller than 10 MB.');
  const [categories, activities] = await Promise.all([photoCategories(), getActivities(id)]);
  const allowed = categories.find(c => c._id === category._id);
  if (!allowed || !activities.some(a => a.writable && a._definition === 'CM-Execution')) throw new Error('Photo upload is not permitted for this activity.');
  const extensions = allowed.allowedExtensions?.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
  if (extensions?.length && !extensions.includes(file.name.split('.').pop()!.toLowerCase())) throw new Error('This category does not accept that file extension.');
  const form = new FormData();
  form.append('file', file);
  form.append('attachment', new Blob([JSON.stringify({category: allowed._id, description})], {type:'application/json'}));
  const response = await api.raw(processPath(id)+'/attachments', {method:'POST',body:form});
  return (await api.parse<Attachment>(response,'POST')).data;
}
export async function downloadAttachment(id: number, attachment: Attachment) {
  const response = await api.raw(processPath(id)+'/attachments/'+encode(attachment._id)+'/'+encode(attachment.name));
  return response.blob();
}
