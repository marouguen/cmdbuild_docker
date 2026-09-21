import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '../../src/api/client';
import { actionableAccounting, listAccountingQueue } from '../../src/api/manager';
import { accountingPayload, approveAccounting, resolveApproveAction } from '../../src/api/managerAccounting';
import type { Activity, Card, Lookup } from '../../src/types/api';
import { i18n, setLocale } from '../../src/i18n';
import { translateError } from '../../src/i18n/errors';

const card:Card={_id:10,_type:'CorrectiveMaint',_beginDate:'v1',_ProcessStatus_code:'CM-Accounting'};
const activity:Activity={_id:'accounting',_definition:'CM-Accounting',description:'Accounting',performer:'MaintOffice',writable:true,attributes:[
  {_id:'Action',writable:true,mandatory:true,detail:{name:'Action',description:'Action',type:'lookup',lookupType:'Process - Action',ecqlFilter:{id:'live-filter',bindings:{server:['Id']}}}},
  {_id:'ProcessNotes',writable:true,mandatory:false,detail:{name:'ProcessNotes',description:'Manager note',type:'text'}}
],widgets:[{_id:'Accounting',_type:'accountingmovements',_active:true,_required:false}]};
const action:Lookup={_id:9382,code:'CM-Accounting_Advance',description:'Backend approval label',active:true};
const approval:Activity={_id:'approval',_definition:'CM-Approval',description:'Approval',performer:'Requester',writable:false};
afterEach(()=>{vi.restoreAllMocks();setLocale('en');});

function mock(options:{current?:Card; activities?:Activity[]; detail?:Activity; actions?:Lookup[]; failure?:Error; result?:Activity; readFailure?:boolean}={}){
  let puts=0;
  const request=vi.spyOn(api,'request').mockResolvedValue({success:true,data:options.actions??[action],meta:{total:(options.actions??[action]).length}});
  const data=vi.spyOn(api,'data').mockImplementation(async(path,method='GET')=>{
    if(method==='PUT'){puts++;if(options.failure)throw options.failure;return card;}
    if(puts&&options.readFailure)throw new ApiError('Cannot reach openMAINT. Check your connection and retry.');
    if(path.endsWith('/activities/accounting'))return options.detail??activity;
    if(path.endsWith('/activities/approval'))return options.result??approval;
    if(path.endsWith('/activities'))return puts?[options.result??approval]:options.activities??[activity];
    if(path.endsWith('/10'))return puts?{...card,_ProcessStatus_code:'CM-Approval'}:options.current??card;
    throw Error('Unexpected request '+path);
  });
  return {data,request,puts:()=>puts};
}

describe('Accounting queue',()=>{
  it('uses exactly one writable MaintOffice Accounting activity, independent of status',()=>{
    const cards=Array.from({length:7},(_,i)=>({...card,_id:i,_ProcessStatus_code:'CM-Assignment'}));
    const map=new Map<number,Activity[]>([[0,[activity]],[1,[{...activity,writable:false}]],[2,[{...activity,performer:'Team'}]],[3,[{...activity,_definition:'CM-Assignment'}]],[4,[activity,approval]],[5,[]]]);
    expect(actionableAccounting(cards,map).map(x=>x.card._id)).toEqual([0]);
  });
  it('retrieves all server-visible pages and checks current activities',async()=>{
    vi.spyOn(api,'request').mockResolvedValueOnce({success:true,data:[card],meta:{total:2}}).mockResolvedValueOnce({success:true,data:[{...card,_id:11}],meta:{total:2}});
    vi.spyOn(api,'data').mockResolvedValueOnce([activity]).mockResolvedValueOnce([{...activity,_definition:'CM-Assignment'}]);
    expect(await listAccountingQueue()).toEqual([{card,activity}]);
    expect(vi.mocked(api.request).mock.calls[1][0]).toContain('start=1');
  });
});

describe('Accounting Approve safety',()=>{
  it('resolves a unique live action, preserves its label and does not use fixed IDs',()=>{
    expect(resolveApproveAction(activity,[{...action,_id:778}])?._id).toBe(778);
    for(const actions of [[],[{...action,active:false}],[{...action,code:'CM-Accounting_Back'}],[action,action]])expect(resolveApproveAction(activity,actions)).toBeNull();
  });
  it('re-reads state and live ECQL actions, sends one PUT, verifies Approval/Requester without accounting/warehouse requests',async()=>{
    const m=mock();
    await expect(approveAccounting(card,activity,action,' Reviewed ')).resolves.toMatchObject({card:{_ProcessStatus_code:'CM-Approval'},activity:{performer:'Requester'}});
    expect(m.puts()).toBe(1);
    expect(decodeURIComponent(String(m.request.mock.calls[0][0]))).toContain('live-filter');
    const put=m.data.mock.calls.findIndex(c=>c[1]==='PUT');
    expect(m.data.mock.calls.slice(0,put).map(c=>c[0])).toEqual(['processes/CorrectiveMaint/instances/10','processes/CorrectiveMaint/instances/10/activities','processes/CorrectiveMaint/instances/10/activities/accounting']);
    expect(m.data.mock.calls[put][2]).toEqual({_activity:'accounting',_advance:true,Action:9382,ProcessNotes:'Reviewed'});
    expect(m.data.mock.calls.slice(put+1).map(c=>c[0])).toEqual(['processes/CorrectiveMaint/instances/10','processes/CorrectiveMaint/instances/10/activities','processes/CorrectiveMaint/instances/10/activities/approval']);
  });
  it.each([
    {current:{...card,_beginDate:'v2'}}, {activities:[]}, {activities:[activity,approval]},
    {activities:[{...activity,_id:'changed'}]}, {activities:[{...activity,performer:'Team'}]},
    {activities:[{...activity,writable:false}]}, {activities:[{...activity,_definition:'CM-Execution'}]},
    {detail:{...activity,writable:false}}, {detail:{...activity,performer:'Requester'}}, {detail:{...activity,_id:'changed'}},
  ])('blocks stale/changed state before PUT: %j',async options=>{
    const m=mock(options);await expect(approveAccounting(card,activity,action)).rejects.toThrow('no longer available');expect(m.puts()).toBe(0);
  });
  it.each([[],[{...action,code:'CM-Accounting_Back'}],[{...action,active:false}],[{...action,_id:999}],[action,action]].map(actions=>({actions})))('blocks unavailable or changed intended actions: %j',async ({actions})=>{
    const m=mock({actions});await expect(approveAccounting(card,activity,action)).rejects.toThrow('not currently allowed');expect(m.puts()).toBe(0);
  });
  it('respects required writable metadata and blocks unsupported missing fields',async()=>{
    const detail={...activity,attributes:[...activity.attributes!,{_id:'Review',mandatory:true,writable:true,detail:{name:'Review',type:'text',description:'Review reference'}}]};
    const m=mock({detail});await expect(approveAccounting(card,activity,action)).rejects.toThrow('Review reference is required');expect(m.puts()).toBe(0);
  });
  it('requires a note only when native metadata requires it; rejects read-only notes and changed validation',()=>{
    const attrs=activity.attributes!;
    const required={...activity,attributes:[attrs[0],{...attrs[1],mandatory:true}]};
    expect(()=>accountingPayload(required,card,action,' ')).toThrow('Manager note is required');
    expect(accountingPayload(required,card,action,'Reviewed')).toHaveProperty('ProcessNotes','Reviewed');
    expect(()=>accountingPayload({...activity,attributes:[attrs[0],{...attrs[1],writable:false}]},card,action,'Note')).toThrow('not writable');
    expect(()=>accountingPayload({...activity,attributes:[attrs[0],{...attrs[1],detail:{...attrs[1].detail,validationRules:'new rule'}}]},card,action,'')).toThrow('integration review');
    expect(()=>accountingPayload({...activity,widgets:[{_id:'x',_type:'new',_active:true,_required:true}]},card,action,'')).toThrow('widget submission');
  });
  it('does not require accounting, warehouse, notes, costs or attachments',async()=>{
    const m=mock();await approveAccounting(card,activity,action);
    expect(m.data.mock.calls.find(c=>c[1]==='PUT')?.[2]).toEqual({_activity:'accounting',_advance:true,Action:9382});
    expect(m.data.mock.calls.some(c=>/AccountingMov|WrhMovement|attachments/.test(c[0]))).toBe(false);
  });
  it('never retries uncertain writes or post-write verification failures',async()=>{
    const m=mock({failure:new ApiError('uncertain',0,true)});await expect(approveAccounting(card,activity,action)).rejects.toMatchObject({uncertain:true});expect(m.puts()).toBe(1);
    vi.restoreAllMocks();const read=mock({readFailure:true});await expect(approveAccounting(card,activity,action)).rejects.toThrow('Cannot reach');expect(read.puts()).toBe(1);
  });
  it('rejects an unexpected resulting performer',async()=>{
    const m=mock({result:{...approval,performer:'SuperUser'}});await expect(approveAccounting(card,activity,action)).rejects.toThrow('did not confirm');expect(m.puts()).toBe(1);
  });
  it('prevents concurrent double submission',async()=>{
    const m=mock();const first=approveAccounting(card,activity,action);await expect(approveAccounting(card,activity,action)).rejects.toThrow('already in progress');await first;expect(m.puts()).toBe(1);
  });
  it('translates owned EN/FR errors without translating backend labels',()=>{
    const message='Approve is not currently allowed by openMAINT.';
    expect(translateError(message)).toBe(message);setLocale('fr');expect(translateError(message)).toBe(i18n.global.t('errors.approveNotAllowed'));expect(translateError(message)).not.toBe(message);expect(translateError('Backend approval label')).toBe('Backend approval label');
    expect(i18n.global.t('manager.accounting.execution')).toBe("Informations d'exécution");
  });
});
