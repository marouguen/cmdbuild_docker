import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '../../src/api/client';
import { approvalActivity, approvalActions, approvalPayload, findVisibleRequest, issueSolved, resolveIssueSolved } from '../../src/api/requesterApproval';
import type { Activity, Card, Lookup } from '../../src/types/api';
import rules from '../../src/config/execution-rules.json';
import { setLocale } from '../../src/i18n';
import { translateError } from '../../src/i18n/errors';

const card:Card={_id:90,_type:'CorrectiveMaint',_beginDate:'v1',_ProcessStatus_code:'CM-Approval',_FlowStatus_code:'open.running'};
const activity:Activity={_id:'approval-current',_definition:'CM-Approval',description:'Approval',performer:'Requester',writable:true,attributes:[
  {_id:'Action',writable:true,mandatory:true,detail:{name:'Action',type:'lookup',description:'Action',lookupType:'Process - Action',ecqlFilter:{id:'live-approval-filter',bindings:{server:['Id']}}}},
  {_id:'ProcessNotes',writable:true,mandatory:false,detail:{name:'ProcessNotes',type:'text',description:'Closing note',validationRules:rules.ProcessNotes}},
  {_id:'Survey',writable:true,mandatory:false,detail:{name:'Survey',type:'reference',description:'Survey'}}
],widgets:[{_id:'Survey',_type:'createModifyCard',_active:true,_required:false}]};
const action:Lookup={_id:7890,code:'CM-Approval_Advance',description:'Backend solved label',active:true};
const closed:Card={...card,_beginDate:'v2',_ProcessStatus_code:'CM-Completed',_FlowStatus_code:'closed.completed'};
afterEach(()=>{vi.restoreAllMocks();setLocale('en');});

function mock(options:{current?:Card;visible?:Card[];activities?:Activity[];detail?:Activity;actions?:Lookup[];result?:Card;resultActivities?:Activity[];failure?:Error;readFailure?:Error}={}){
  let puts=0;const calls:{method:string;path:string;payload?:unknown}[]=[];
  vi.spyOn(api,'request').mockImplementation(async path=>{
    calls.push({method:'GET',path});
    if(path.startsWith('lookup_types/'))return {success:true,data:options.actions??[action],meta:{total:(options.actions??[action]).length}};
    const rows=options.visible??[options.current??card];return {success:true,data:rows,meta:{total:rows.length}};
  });
  vi.spyOn(api,'data').mockImplementation(async(path,method='GET',payload)=>{
    calls.push({method,path,payload});
    if(method==='PUT'){puts++;if(options.failure)throw options.failure;return closed;}
    if(puts&&options.readFailure)throw options.readFailure;
    if(path.endsWith('/activities/approval-current'))return options.detail??activity;
    if(path.endsWith('/activities'))return puts?options.resultActivities??[]:options.activities??[activity];
    if(path.endsWith('/90'))return puts?options.result??closed:options.current??card;
    throw Error('Unexpected '+path);
  });
  return {calls,puts:()=>puts};
}

describe('Requester visibility and Approval eligibility',()=>{
  it('checks the full paginated server collection, including completed requests',async()=>{
    const request=vi.spyOn(api,'request').mockResolvedValueOnce({success:true,data:[{...card,_id:1}],meta:{total:2}}).mockResolvedValueOnce({success:true,data:[closed],meta:{total:2}});
    expect(await findVisibleRequest(90)).toEqual(closed);expect(request.mock.calls[1][0]).toContain('start=1');
  });
  it('fails closed on incomplete pagination',async()=>{
    vi.spyOn(api,'request').mockResolvedValueOnce({success:true,data:[card],meta:{total:2}}).mockResolvedValueOnce({success:true,data:[],meta:{total:2}});
    await expect(findVisibleRequest(90)).rejects.toThrow('could not be verified');
  });
  it('does not treat a status string as actionability',()=>{
    expect(approvalActivity([activity])).toEqual(activity);
    for(const rows of [[],[activity,activity],[{...activity,writable:false}],[{...activity,performer:'MaintOffice'}],...[ 'CM-Assignment','CM-Execution','CM-Accounting','CM-Completed'].map(_definition=>[{...activity,_definition}])])expect(approvalActivity(rows)).toBeNull();
  });
});

describe('Issue solved live metadata and write safety',()=>{
  it('resolves the unique native action without assuming a numeric ID or English label',()=>{
    expect(resolveIssueSolved(activity,[{...action,_id:555,description:'Problème résolu'}])?._id).toBe(555);
    expect(resolveIssueSolved(activity,[{...action,code:'CM-Approval_Back'}])).toBeNull();
    expect(resolveIssueSolved(activity,[action,action])).toBeNull();
  });
  it('paginates action metadata with live ECQL',async()=>{
    const request=vi.spyOn(api,'request').mockResolvedValueOnce({success:true,data:[{...action,_id:2,code:'CM-Approval_Back'}],meta:{total:2}}).mockResolvedValueOnce({success:true,data:[action],meta:{total:2}});
    expect(resolveIssueSolved(activity,await approvalActions(activity,card))).toEqual(action);
    expect(decodeURIComponent(request.mock.calls[1][0])).toContain('live-approval-filter');expect(request.mock.calls[1][0]).toContain('start=1');
  });
  it('rechecks card, membership, activity and action before exactly one PUT, then verifies completion',async()=>{
    const m=mock();expect(await issueSolved(card,activity,action,' Reviewed ')).toEqual(closed);
    expect(m.puts()).toBe(1);
    expect(m.calls.map(c=>c.method)).toEqual(['GET','GET','GET','GET','GET','PUT','GET','GET']);
    expect(m.calls[1].path).toContain('instances?limit=25&start=0');
    expect(m.calls[3].path).toContain('/activities/approval-current');
    expect(decodeURIComponent(m.calls[4].path)).toContain('live-approval-filter');
    expect(m.calls[5].payload).toEqual({_activity:'approval-current',_advance:true,Action:7890,ProcessNotes:'Reviewed'});
    expect(m.calls[7].path).toContain('/activities');
  });
  it.each([
    {current:{...card,_beginDate:'changed'}},{activities:[]},{activities:[activity,activity]},
    {activities:[{...activity,_id:'new'}]},{activities:[{...activity,writable:false}]},{activities:[{...activity,performer:'Team'}]},
    {activities:[{...activity,_definition:'CM-Completed'}]},
    {detail:{...activity,writable:false}},{detail:{...activity,_id:'new'}},{detail:{...activity,performer:'MaintOffice'}},
    {detail:{...activity,_definition:'CM-Accounting'}},
  ])('blocks changed state before PUT: %j',async options=>{
    const m=mock(options);await expect(issueSolved(card,activity,action)).rejects.toThrow('no longer awaiting');expect(m.puts()).toBe(0);
  });
  it('blocks a request removed from the server-filtered collection',async()=>{
    const m=mock({visible:[]});await expect(issueSolved(card,activity,action)).rejects.toThrow('no longer available in My Requests');expect(m.puts()).toBe(0);expect(m.calls.some(c=>c.path.includes('/activities'))).toBe(false);
  });
  it.each([[],[{...action,active:false}],[{...action,code:'CM-Approval_Back'}],[{...action,_id:999}],[action,action]].map(actions=>({actions})))('blocks missing or changed intended action: %j',async options=>{
    const m=mock(options);await expect(issueSolved(card,activity,action)).rejects.toThrow('not currently allowed');expect(m.puts()).toBe(0);
  });
  it('honors mandatory live fields without inventing note or survey requirements',async()=>{
    const m=mock();await issueSolved(card,activity,action);expect(m.calls.find(x=>x.method==='PUT')?.payload).toEqual({_activity:'approval-current',_advance:true,Action:7890});
    for(const id of ['ProcessNotes','Survey']){
      const required={...activity,attributes:activity.attributes!.map(x=>x._id===id?{...x,mandatory:true}:x)};
      expect(()=>approvalPayload(required,card,action)).toThrow('is required');
    }
    const missing={...activity,attributes:[...activity.attributes!,{_id:'Unexpected',mandatory:true,writable:true,detail:{name:'Unexpected',description:'Required review',type:'text'}}]};
    expect(()=>approvalPayload(missing,card,action)).toThrow('Required review is required');
  });
  it('blocks changed validation, required widgets and non-writable notes',()=>{
    const changed={...activity,attributes:activity.attributes!.map(x=>x._id==='ProcessNotes'?{...x,detail:{...x.detail,validationRules:'new rule'}}:x)};
    expect(()=>approvalPayload(changed,card,action)).toThrow('integration review');
    expect(()=>approvalPayload({...activity,widgets:[{_id:'Survey',_type:'createModifyCard',_active:true,_required:true}]},card,action)).toThrow('widget submission');
    expect(()=>approvalPayload({...activity,attributes:activity.attributes!.map(x=>x._id==='ProcessNotes'?{...x,writable:false}:x)},card,action,'Note')).toThrow('not writable');
  });
  it('does not retry uncertain writes or post-write verification reads',async()=>{
    const m=mock({failure:new ApiError('uncertain',0,true)});await expect(issueSolved(card,activity,action)).rejects.toMatchObject({uncertain:true});expect(m.puts()).toBe(1);
    vi.restoreAllMocks();const second=mock({readFailure:new Error('Read failed')});await expect(issueSolved(card,activity,action)).rejects.toThrow('Read failed');expect(second.puts()).toBe(1);
  });
  it('blocks concurrent double submission',async()=>{
    const m=mock();const first=issueSolved(card,activity,action);await expect(issueSolved(card,activity,action)).rejects.toThrow('already in progress');await first;expect(m.puts()).toBe(1);
  });
  it.each([{result:{...closed,_ProcessStatus_code:'CM-Approval'}},{result:{...closed,_FlowStatus_code:'open.running'}},{resultActivities:[activity]}])('requires all completion conditions: %j',async options=>{
    const m=mock(options);await expect(issueSolved(card,activity,action)).rejects.toThrow('did not confirm');expect(m.puts()).toBe(1);
  });
  it('preserves session-expiry errors without dispatching a PUT',async()=>{
    const m=mock();vi.mocked(api.data).mockRejectedValueOnce(new ApiError('Your session has ended. Please sign in again.',401));await expect(issueSolved(card,activity,action)).rejects.toMatchObject({status:401});expect(m.puts()).toBe(0);
  });
  it('translates owned errors EN/FR and preserves dynamic backend text',()=>{
    const messages=['This request is no longer awaiting your approval. Refresh it to see its current state.','This request is no longer available in My Requests.','The request list changed or could not be verified. Refresh My Requests.','Issue solved is not currently allowed by openMAINT.','Request approval is already in progress.','openMAINT did not confirm that the request completed. Refresh before taking any further action.'];
    for(const message of messages)expect(translateError(message)).toBe(message);setLocale('fr');for(const message of messages)expect(translateError(message)).not.toBe(message);expect(translateError('Backend field label')).toBe('Backend field label');
  });
});
