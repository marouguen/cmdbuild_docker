// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createApp, nextTick, type Component } from 'vue';
import RequestDetail from '../../src/components/requester/RequestDetail.vue';
import RequestList from '../../src/components/requester/RequestList.vue';
import RequesterWorkspace from '../../src/views/RequesterWorkspace.vue';
import * as requests from '../../src/api/requester';
import * as approval from '../../src/api/requesterApproval';
import { i18n, setLocale } from '../../src/i18n';
import type { Activity, Card, Lookup } from '../../src/types/api';

const card:Card={_id:90,_type:'CorrectiveMaint',_beginDate:'v1',Number:'CM.TEST',ShortDescr:'My pump request',_ProcessStatus_code:'CM-Approval',_ProcessStatus_description:'Backend Approval',_FlowStatus_code:'open.running',_Priority_description:'Backend priority',_Type_description:'Breakdown',_Site_description:'Factory',_CI_description:'Press',_Team_description:'Repair Team',_Outcome_description:'Positive',ExecStartDate:'2026-09-21T10:00:00Z',ExecEndDate:'2026-09-21T11:00:00Z',Register:'<p>Execution notes</p><p>Manager review note</p><script>unsafe()</script>'};
const activity:Activity={_id:'approval',_definition:'CM-Approval',description:'Backend Approval',performer:'Requester',writable:true,attributes:[{_id:'Action',mandatory:true,writable:true,detail:{name:'Action',type:'lookup',description:'Action'}},{_id:'ProcessNotes',mandatory:false,writable:true,detail:{name:'ProcessNotes',type:'text',description:'Closing note'}}]};
const action:Lookup={_id:7890,code:'CM-Approval_Advance',description:'Issue solved',active:true};
const closed:Card={...card,_beginDate:'v2',_ProcessStatus_code:'CM-Completed',_ProcessStatus_description:'Backend Completed',_FlowStatus_code:'closed.completed'};
const apps:ReturnType<typeof createApp>[]=[];
async function settle(){for(let i=0;i<40;i++){await Promise.resolve();await nextTick();}}
async function mount(component:Component,props={}){const root=document.createElement('div');document.body.appendChild(root);const app=createApp(component,props).use(i18n);apps.push(app);app.mount(root);await settle();return root;}
const submit=(root:Element)=>root.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
beforeEach(()=>{
  setLocale('en');
  vi.spyOn(requests,'listRequests').mockResolvedValue({success:true,data:[card],meta:{total:1}});
  vi.spyOn(requests,'getRequest').mockResolvedValue(card);
  vi.spyOn(requests,'getRequestActivities').mockResolvedValue([activity]);
  vi.spyOn(requests,'getRequestActivity').mockResolvedValue(activity);
  vi.spyOn(requests,'getRequestHistory').mockResolvedValue([{_id:1,_type:'CorrectiveMaint',_activity_description:'Accounting history',__user_description:'Manager'}]);
  vi.spyOn(requests,'getRequestAttachments').mockResolvedValue([{_id:'doc',name:'Report.pdf',category:1}]);
  vi.spyOn(requests,'getOriginalRequestNotes').mockResolvedValue('Original submitted note');
  vi.spyOn(approval,'findVisibleRequest').mockResolvedValue(card);
  vi.spyOn(approval,'approvalActions').mockResolvedValue([action,{...action,_id:7891,code:'CM-Approval_Back',description:'Issue not solved'}]);
});
afterEach(()=>{for(const app of apps.splice(0))app.unmount();document.body.innerHTML='';vi.restoreAllMocks();setLocale('en');});

it('marks a server-visible request awaiting Approval in My Requests without duplicating the list',async()=>{
  const root=await mount(RequestList);expect(root.querySelectorAll('.job-card')).toHaveLength(1);expect(root.textContent).toContain('My pump request');expect(root.textContent).toContain('Awaiting your approval');
  expect(requests.getRequestActivities).toHaveBeenCalledWith(90);
});
it('keeps completed requests visible even without any activity',async()=>{
  vi.mocked(requests.listRequests).mockResolvedValue({success:true,data:[closed],meta:{total:1}});vi.mocked(requests.getRequestActivities).mockResolvedValue([]);
  const root=await mount(RequestList);expect(root.querySelectorAll('.job-card')).toHaveLength(1);expect(root.textContent).toContain('Backend Completed');expect(root.textContent).not.toContain('Awaiting your approval');
});
it('retains a visible request without approval indication if its activity cannot be read',async()=>{
  vi.mocked(requests.getRequestActivities).mockRejectedValue(new Error('Unavailable'));const root=await mount(RequestList);expect(root.querySelectorAll('.job-card')).toHaveLength(1);expect(root.textContent).not.toContain('Awaiting your approval');
});
it('reuses original notes, register, execution, history and attachments and exposes only Issue solved',async()=>{
  const root=await mount(RequestDetail,{source:card});
  for(const expected of ['CM.TEST','My pump request','Backend priority','Factory','Press','Original submitted note','Execution notes','Manager review note','Repair Team','Positive','Accounting history','Report.pdf'])expect(root.textContent).toContain(expected);
  expect(root.querySelector('script')).toBeNull();expect(root.querySelectorAll('button[type="submit"]')).toHaveLength(1);expect(root.querySelector('button[type="submit"]')?.textContent).toBe('Issue solved');expect(root.textContent).not.toContain('Issue not solved');expect(root.querySelector('textarea')?.required).toBe(false);
});
it.each(['CM-Assignment','CM-Execution','CM-Accounting','CM-Completed'])('does not expose Approval controls for %s',async _definition=>{
  const other={...activity,_definition};vi.mocked(requests.getRequestActivities).mockResolvedValue(_definition==='CM-Completed'?[]:[other]);vi.mocked(requests.getRequestActivity).mockResolvedValue(other);
  const root=await mount(RequestDetail,{source:card});expect(root.querySelector('form')).toBeNull();expect(approval.approvalActions).not.toHaveBeenCalled();
});
it.each([{activities:[activity,activity]},{activities:[{...activity,writable:false}]},{activities:[{...activity,performer:'MaintOffice'}]}])('requires exactly one writable Requester Approval: %j',async({activities})=>{
  vi.mocked(requests.getRequestActivities).mockResolvedValue(activities);const root=await mount(RequestDetail,{source:card});expect(root.querySelector('form')).toBeNull();
});
it('hides controls when detailed activity disagrees with the current summary',async()=>{
  vi.mocked(requests.getRequestActivity).mockResolvedValue({...activity,_id:'changed'});const root=await mount(RequestDetail,{source:card});expect(root.querySelector('form')).toBeNull();
});
it('refuses detail access when the request is no longer in the server-visible collection',async()=>{
  vi.mocked(approval.findVisibleRequest).mockResolvedValue(null);const root=await mount(RequestDetail,{source:card});expect(requests.getRequest).not.toHaveBeenCalled();expect(root.querySelector('form')).toBeNull();expect(root.textContent).toContain('no longer available in My Requests');
});
it('hides Issue solved if the live action is unavailable',async()=>{
  vi.mocked(approval.approvalActions).mockResolvedValue([{...action,code:'CM-Approval_Back'}]);const root=await mount(RequestDetail,{source:card});expect(root.querySelector('form')).toBeNull();expect(root.textContent).not.toContain('Issue not solved');
});
it('honors native mandatory note metadata in the form',async()=>{
  vi.mocked(requests.getRequestActivity).mockResolvedValue({...activity,attributes:activity.attributes!.map(x=>x._id==='ProcessNotes'?{...x,mandatory:true}:x)});const root=await mount(RequestDetail,{source:card});expect(root.querySelector('textarea')?.required).toBe(true);
});
it('locks after an uncertain submission with no retries and preserves the optional closing note',async()=>{
  const close=vi.spyOn(approval,'issueSolved').mockRejectedValue(new Error('Connection interrupted. The server may have saved this change. Refresh and check before retrying.'));
  const root=await mount(RequestDetail,{source:card});const input=root.querySelector('textarea')!;input.value='Closing review';input.dispatchEvent(new Event('input'));await settle();submit(root);await settle();submit(root);await settle();
  expect(close).toHaveBeenCalledTimes(1);expect(close).toHaveBeenCalledWith(card,activity,action,'Closing review');expect(root.querySelector('fieldset')?.disabled).toBe(true);expect(root.textContent).toContain('Refresh and check the current state');
});
it('blocks double clicks, removes controls after completion and keeps the request reachable after refresh and navigation',async()=>{
  const close=vi.spyOn(approval,'issueSolved').mockImplementation(async()=>{
    vi.mocked(requests.listRequests).mockResolvedValue({success:true,data:[closed],meta:{total:1}});vi.mocked(requests.getRequest).mockResolvedValue(closed);vi.mocked(requests.getRequestActivities).mockResolvedValue([]);vi.mocked(approval.findVisibleRequest).mockResolvedValue(closed);return closed;
  });
  const root=await mount(RequesterWorkspace);(root.querySelector('.job-card') as HTMLButtonElement).click();await settle();submit(root);submit(root);await settle();expect(close).toHaveBeenCalledTimes(1);expect(root.querySelector('form')).toBeNull();expect(root.textContent).toContain('Request completed.');
  (root.querySelector('button.icon-button') as HTMLButtonElement).click();await settle();expect(root.querySelector('form')).toBeNull();expect(root.textContent).toContain('Backend Completed');
  (root.querySelector('button.text-button') as HTMLButtonElement).click();await settle();expect(root.querySelectorAll('.job-card')).toHaveLength(1);expect(root.textContent).toContain('Backend Completed');(root.querySelector('.job-card') as HTMLButtonElement).click();await settle();expect(root.querySelector('form')).toBeNull();expect(root.textContent).toContain('Manager review note');expect(close).toHaveBeenCalledTimes(1);
});
it.each([{locale:'en' as const,execution:'Execution information',note:'Closing note',hint:'Confirm that the issue is solved'},{locale:'fr' as const,execution:"Informations d'exécution",note:'Note de clôture',hint:'Confirmez que le problème est résolu'}])('renders owned Approval text in $locale and preserves backend labels',async({locale,execution,note,hint})=>{
  setLocale(locale);const root=await mount(RequestDetail,{source:card});for(const value of [execution,note,hint,'Backend priority','Issue solved'])expect(root.textContent).toContain(value);expect(root.textContent).not.toContain('requester.approval.');
});
