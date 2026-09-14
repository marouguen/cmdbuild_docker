import { api, equalFilter, filterQuery } from './client';
import { getActivities, getActivity, getJob, lookups } from './processes';
import type { Card } from '../types/api';
export const listAccounting = (id: number) => api.data<Card[]>('classes/AccountingMov/cards?limit=100&' + filterQuery(equalFilter('MaintProcess',id)));
export const accountingEnabled = async (id: number) => (await api.data<{outcome: boolean}[]>('functions/wf_maintprocess_accmov_enabled/outputs?parameters='+encodeURIComponent(JSON.stringify({process_id:id}))))[0]?.outcome === true;
export interface LabourDraft { description: string; date: string; hours: number; unitPrice: number; notes: string }
export function validateLabour(draft: LabourDraft) {
  if (!draft.description.trim()) throw new Error('Describe the labour performed.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || !Number.isFinite(Date.parse(draft.date))) throw new Error('Enter a valid work date.');
  if (!Number.isFinite(draft.hours) || draft.hours <= 0 || draft.hours > 24) throw new Error('Hours must be greater than zero and no more than 24.');
  if (!Number.isFinite(draft.unitPrice) || draft.unitPrice < 0) throw new Error('Enter a valid hourly rate.');
}
export async function recordLabour(id: number, draft: LabourDraft) {
  validateLabour(draft);
  const [job, activities, enabled, klass] = await Promise.all([getJob(id),getActivities(id),accountingEnabled(id),api.data<{_can_create: boolean}>('classes/LabourAccMov')]);
  const active = activities.find(a => a.writable && a._definition === 'CM-Execution');
  if (!active || !enabled || !klass._can_create) throw new Error('openMAINT does not enable labour entry for this job.');
  const detail = await getActivity(id, active._id);
  const widget = detail.widgets?.find(w => w._active && w._type === 'accountingmovements');
  if (!widget?.CostState) throw new Error('Accounting configuration is unavailable.');
  const [types, states] = await Promise.all([lookups('AccountingMov - Type'),lookups('AccountingMov - State')]);
  const type = types.find(x => x.active && x.code === 'Cost');
  const state = states.find(x => x.active && x.code === widget.CostState);
  if (!type || !state) throw new Error('Accounting lookups are unavailable.');
  return api.data<Card>('classes/LabourAccMov/cards','POST',{Description:draft.description.trim(),Date:draft.date,MaintProcess:id,Site:job.Site,Type:type._id,State:state._id,ManualQuantity:true,Quantity:draft.hours,UnitPrice:draft.unitPrice,Notes:draft.notes});
}
