// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createApp, nextTick, type Component } from 'vue';
import AccountingDetail from '../../src/components/manager/AccountingDetail.vue';
import ManagerWorkspace from '../../src/views/ManagerWorkspace.vue';
import * as requester from '../../src/api/requester';
import * as accounting from '../../src/api/managerAccounting';
import * as manager from '../../src/api/manager';
import { i18n, setLocale } from '../../src/i18n';
import type { Activity, Card, Lookup } from '../../src/types/api';

const text=(n:Element)=>n.textContent??'';
const find=(n:Element,p:(n:Element)=>boolean):Element[]=>[n,...n.querySelectorAll('*')].filter(p);
async function settle(){for(let i=0;i<30;i++){await Promise.resolve();await nextTick();}}
const apps:ReturnType<typeof createApp>[]=[];
async function mount(component:Component,props={}){const root=document.createElement('div');document.body.appendChild(root);const app=createApp(component,props);app.use(i18n);apps.push(app);app.mount(root);await settle();return root;}
const submit=(form:Element)=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
const card:Card={_id:50,_type:'CorrectiveMaint',_beginDate:'v1',Number:'CM.TEST',ShortDescr:'Pump repair',_Priority_description:'Backend priority',_Site_description:'Factory',_CI_description:'Press',_Requester_description:'Requester name',_Team_description:'Maintenance Team',_Outcome_description:'Positive',ExecStartDate:'2026-09-21T10:00:00Z',ExecEndDate:'2026-09-21T11:00:00Z'};
const activity:Activity={_id:'a',_definition:'CM-Accounting',description:'Backend Accounting',performer:'MaintOffice',writable:true,attributes:[{_id:'Action',mandatory:true,writable:true,detail:{name:'Action',description:'Action',type:'lookup'}},{_id:'ProcessNotes',mandatory:false,writable:true,detail:{name:'ProcessNotes',description:'Note',type:'text'}}]};
const action:Lookup={_id:456,code:'CM-Accounting_Advance',description:'Approve from backend',active:true};
beforeEach(()=>{
  setLocale('en');
  vi.spyOn(requester,'getRequest').mockResolvedValue(card);
  vi.spyOn(requester,'getRequestActivities').mockResolvedValue([activity]);
  vi.spyOn(requester,'getRequestActivity').mockResolvedValue(activity);
  vi.spyOn(requester,'getRequestHistory').mockResolvedValue([{_id:1,_type:'CorrectiveMaint',_activity_description:'Execution history'}]);
  vi.spyOn(requester,'getRequestAttachments').mockResolvedValue([{_id:'file',name:'Native report.pdf',category:1}]);
  vi.spyOn(requester,'getOriginalRequestNotes').mockResolvedValue('Original request note');
  vi.spyOn(accounting,'accountingActions').mockResolvedValue([action,{...action,_id:457,code:'CM-Accounting_Back',description:'Back to assignment'}]);
});
afterEach(()=>{for(const app of apps.splice(0))app.unmount();document.body.innerHTML='';vi.restoreAllMocks();setLocale('en');});

it.each([
  {locale:'en' as const,back:'Accounting queue',refresh:'Refresh Accounting detail',loading:'Loading Accounting detail…',wrong:'Assignment'},
  {locale:'fr' as const,back:'File de comptabilisation',refresh:'Actualiser le détail de comptabilisation',loading:'Chargement du détail de comptabilisation…',wrong:'affectation'},
])('uses Accounting-specific back, refresh and loading labels in $locale',async({locale,back,refresh,loading,wrong})=>{
  setLocale(locale);
  let resolve!: (value:Card)=>void;
  vi.mocked(requester.getRequest).mockReturnValue(new Promise<Card>(done=>{resolve=done;}));
  const root=await mount(AccountingDetail,{source:{card,activity}});
  expect(root.querySelector('[role="status"]')?.textContent).toBe(loading);
  expect(text(root)).toContain(back);
  expect(root.querySelector('button.icon-button')?.getAttribute('aria-label')).toBe(refresh);
  expect(text(root)).not.toContain(wrong);
  resolve(card);await settle();
  expect(text(root)).toContain(back);
  expect(text(root)).not.toContain(loading);
  expect(root.querySelector('button.icon-button')?.getAttribute('aria-label')).toBe(refresh);
});

it('renders request/execution/history/attachment context and only Approve, preserving backend labels in EN/FR',async()=>{
  vi.mocked(requester.getRequest).mockResolvedValue({...card,Register:'<p>Execution register note</p><script>unsafe()</script>'});
  const root=await mount(AccountingDetail,{source:{card,activity}});
  for(const expected of ['CM.TEST','Pump repair','Backend priority','Factory','Press','Requester name','Maintenance Team','Positive','Original request note','Execution history','Native report.pdf','Execution information'])expect(text(root)).toContain(expected);
  expect(find(root,n=>n.tagName==='BUTTON'&&n.getAttribute('type')==='submit').map(text)).toEqual(['Approve from backend']);
  expect(text(root)).not.toContain('Back to assignment');
  expect(text(root)).toContain('Execution register note');expect(root.querySelector('script')).toBeNull();
  setLocale('fr');await settle();expect(text(root)).toContain("Informations d'exécution");expect(text(root)).toContain('Approve from backend');expect(text(root)).toContain('Backend priority');
});
it('hides action controls when the detail has multiple current activities or is non-writable',async()=>{
  vi.mocked(requester.getRequestActivities).mockResolvedValue([activity,{...activity,_id:'other'}]);
  let root=await mount(AccountingDetail,{source:{card,activity}});expect(find(root,n=>n.tagName==='FORM')).toHaveLength(0);
  vi.mocked(requester.getRequestActivities).mockResolvedValue([{...activity,writable:false}]);
  root=await mount(AccountingDetail,{source:{card,activity}});expect(find(root,n=>n.tagName==='FORM')).toHaveLength(0);
});
it('locks submission after an uncertain error until explicit refresh and never retries',async()=>{
  const approve=vi.spyOn(accounting,'approveAccounting').mockRejectedValue(new Error('Connection interrupted. The server may have saved this change. Refresh and check before retrying.'));
  const root=await mount(AccountingDetail,{source:{card,activity}});
  const form=find(root,n=>n.tagName==='FORM')[0];
  submit(form);await settle();
  submit(form);await settle();
  expect(approve).toHaveBeenCalledTimes(1);expect(find(root,n=>n.tagName==='FIELDSET')[0].hasAttribute('disabled')).toBe(true);
  expect(text(root)).toContain('Refresh and check the current activity');
});
it('shows confirmed Approval/Requester and removes controls after success',async()=>{
  vi.spyOn(accounting,'approveAccounting').mockResolvedValue({card:{...card,_ProcessStatus_code:'CM-Approval'},activity:{...activity,_id:'next',_definition:'CM-Approval',description:'Approval',performer:'Requester',writable:false}});
  const root=await mount(AccountingDetail,{source:{card,activity}});
  submit(find(root,n=>n.tagName==='FORM')[0]);await settle();
  expect(text(root)).toContain('Approved. Current activity: Approval; responsible role: Requester.');expect(find(root,n=>n.tagName==='FORM')).toHaveLength(0);
});
it('keeps Assignment navigation and opens Accounting only from its listed item',async()=>{
  const assignments=vi.spyOn(manager,'listAssignmentQueue').mockResolvedValue([]);
  const accountingQueue=vi.spyOn(manager,'listAccountingQueue').mockResolvedValue([{card,activity}]);
  const root=await mount(ManagerWorkspace);
  expect(assignments).toHaveBeenCalledTimes(1);
  const tab=find(root,n=>n.tagName==='BUTTON'&&text(n)==='Accounting')[0];(tab as HTMLElement).click();await settle();
  expect(accountingQueue).toHaveBeenCalledTimes(1);expect(text(root)).toContain('Pump repair');expect(text(root)).toContain('Maintenance Team');
  const item=find(root,n=>n.tagName==='BUTTON'&&n.className==='job-card')[0];(item as HTMLElement).click();await settle();
  expect(requester.getRequest).toHaveBeenCalledWith(50);expect(text(root)).toContain('Original request note');
});

it('hides Approve when the live action is missing and honors a mandatory note in the form',async()=>{
  vi.mocked(accounting.accountingActions).mockResolvedValue([]);
  let root=await mount(AccountingDetail,{source:{card,activity}});expect(root.querySelector('form')).toBeNull();
  vi.mocked(accounting.accountingActions).mockResolvedValue([action]);
  vi.mocked(requester.getRequestActivity).mockResolvedValue({...activity,attributes:activity.attributes!.map(x=>x._id==='ProcessNotes'?{...x,mandatory:true}:x)});
  root=await mount(AccountingDetail,{source:{card,activity}});expect(root.querySelector('textarea')?.required).toBe(true);
});
