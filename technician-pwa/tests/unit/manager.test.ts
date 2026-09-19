import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '../../src/api/client';
import { actionableAssignments, assignmentChoices, assignmentPayload, assignToTeam, isAssignmentReadOnly, resolveAssignAction, type AssignmentDraft } from '../../src/api/manager';
import { metadataFilter } from '../../src/api/processes';
import type { Activity, ActivityAttribute, Card, Lookup } from '../../src/types/api';

const attribute=(id:string,detail:Partial<ActivityAttribute['detail']>={}):ActivityAttribute=>({_id:id,writable:true,mandatory:false,detail:{name:id,type:'reference',description:id,targetClass:id,...detail}});
const activity:Activity={_id:'assignment-1',_definition:'CM-Assignment',description:'Assignment',writable:true,performer:'MaintOffice',attributes:[
  attribute('Action',{type:'lookup',lookupType:'Process - Action',ecqlFilter:{id:'action-filter',bindings:{server:['Id']}}}),
  attribute('Site'),attribute('Category'),attribute('Subcategory',{ecqlFilter:{id:'subcategory-filter',bindings:{client:['Category.Id']}}}),
  attribute('Team',{ecqlFilter:{id:'team-filter',bindings:{client:['Category.Id','Subcategory.Id','Site.Id','Company']}}}),
  attribute('Assignee',{ecqlFilter:{id:'assignee-filter',bindings:{client:['Team.Id']}}}),attribute('ExpExecStartDate',{type:'dateTime',targetClass:undefined}),attribute('ProcessNotes',{type:'text',targetClass:undefined})
]};
const action:Lookup={_id:900,code:'CM-Assignment_Advance',description:'Assign to team',active:true};
const card:Card={_id:10,_type:'CorrectiveMaint',_beginDate:'v1',Site:1,Category:2,Subcategory:3,Company:8};
const draft:AssignmentDraft={Site:1,Category:2,Subcategory:3,Team:4,ExpExecStartDate:'2026-09-20T10:00:00Z',ProcessNotes:'Ready'};
afterEach(()=>vi.restoreAllMocks());

describe('Manager Assignment metadata',()=>{
  it('keeps only server-confirmed writable Assignment activities in the queue',()=>{
    const cards=[card,{...card,_id:11},{...card,_id:12}];
    const map=new Map([[10,[activity]],[11,[{...activity,_id:'a2',writable:false}]],[12,[{...activity,_id:'e',_definition:'CM-Execution'}]]]);
    expect(actionableAssignments(cards,map)).toEqual([{card,activity}]);
  });
  it('treats non-writable Assignment as read-only',()=>expect(isAssignmentReadOnly({...activity,writable:false},action)).toBe(true));
  it('resolves Assign dynamically by backend code, never by numeric ID',()=>{
    expect(resolveAssignAction(activity,[{...action,_id:12345}])?._id).toBe(12345);
    expect(resolveAssignAction(activity,[{...action,code:'CM-Assignment_Split'}])).toBeNull();
  });
  it('uses live ECQL for Category to Subcategory, Team filters, and Team to Assignee',()=>{
    const sub=activity.attributes!.find(item=>item._id==='Subcategory')!,team=activity.attributes!.find(item=>item._id==='Team')!,assignee=activity.attributes!.find(item=>item._id==='Assignee')!;
    expect(metadataFilter(sub,card,draft as Record<string,unknown>)).toMatchObject({ecql:{id:'subcategory-filter',context:{client:{'Category.Id':2}}}});
    expect(metadataFilter(team,card,draft as Record<string,unknown>)).toMatchObject({ecql:{id:'team-filter',context:{client:{'Category.Id':2,'Subcategory.Id':3,'Site.Id':1,Company:8}}}});
    expect(metadataFilter(assignee,card,draft as Record<string,unknown>)).toMatchObject({ecql:{id:'assignee-filter',context:{client:{'Team.Id':4}}}});
  });
  it('passes backend ECQL to the live reference endpoint',async()=>{
    const data=vi.spyOn(api,'data').mockResolvedValue([]);
    await assignmentChoices(activity,'Subcategory',card,draft);
    expect(decodeURIComponent(String(data.mock.calls[0][0]))).toContain('subcategory-filter');
  });
  it('requires Site, Category, Subcategory, and Team while keeping Assignee optional',()=>{
    expect(()=>assignmentPayload(activity,action,draft)).not.toThrow();
    expect(assignmentPayload(activity,action,draft)).not.toHaveProperty('Assignee');
    for(const field of ['Site','Category','Subcategory','Team'] as const) expect(()=>assignmentPayload(activity,action,{...draft,[field]:undefined})).toThrow(`${field} is required`);
  });
});

function mockSuccessfulAssignment(putFailure?:Error) {
  let putCount=0,activitiesCount=0;
  const execution:Activity={_id:'execution-1',_definition:'CM-Execution',description:'Execution',writable:true,performer:'Team'};
  const data=vi.spyOn(api,'data').mockImplementation(async(path:string,method='GET')=>{
    if(method==='PUT'){putCount++;if(putFailure)throw putFailure;return card;}
    if(path.endsWith('/10/activities')){activitiesCount++;return activitiesCount===1?[activity]:[execution];}
    if(path.endsWith('/activities/assignment-1'))return activity;
    if(path.endsWith('/activities/execution-1'))return execution;
    if(path.endsWith('/10'))return {...card,_beginDate:activitiesCount>1?'v2':'v1',_ProcessStatus_code:activitiesCount>1?'CM-Execution':'CM-Assignment'};
    if(path.startsWith('lookup_types/'))return [action];
    if(path.startsWith('classes/Site/'))return [{_id:1,_type:'Site'}];
    if(path.startsWith('classes/Category/'))return [{_id:2,_type:'Category'}];
    if(path.startsWith('classes/Subcategory/'))return [{_id:3,_type:'Subcategory'}];
    if(path.startsWith('classes/Team/'))return [{_id:4,_type:'Team'}];
    if(path.startsWith('classes/Assignee/'))return [];
    throw new Error(`Unexpected ${method} ${path}`);
  });
  return {data,getPutCount:()=>putCount};
}

describe('Manager Assignment write safety',()=>{
  it('re-reads activity, advances exactly once, then verifies resulting server state',async()=>{
    const mock=mockSuccessfulAssignment();
    await expect(assignToTeam(card,activity,draft)).resolves.toMatchObject({activity:{_definition:'CM-Execution',performer:'Team'}});
    expect(mock.getPutCount()).toBe(1);
    const calls=mock.data.mock.calls.map(call=>[call[1]??'GET',call[0]]);
    expect(calls.findIndex(call=>call[1]==='processes/CorrectiveMaint/instances/10/activities/assignment-1')).toBeLessThan(calls.findIndex(call=>call[0]==='PUT'));
    expect(calls.slice(calls.findIndex(call=>call[0]==='PUT')+1).some(call=>String(call[1]).endsWith('/activities'))).toBe(true);
  });
  it('prevents a write when the freshly read activity is stale or non-writable',async()=>{
    vi.spyOn(api,'data').mockResolvedValueOnce(card).mockResolvedValueOnce([activity]).mockResolvedValueOnce({...activity,writable:false});
    await expect(assignToTeam(card,activity,draft)).rejects.toThrow('no longer available');
    expect(vi.mocked(api.data).mock.calls.every(call=>call[1]!=='PUT')).toBe(true);
  });
  it('does not retry an uncertain advancement',async()=>{
    const mock=mockSuccessfulAssignment(new ApiError('uncertain',0,true));
    await expect(assignToTeam(card,activity,draft)).rejects.toMatchObject({uncertain:true});
    expect(mock.getPutCount()).toBe(1);
  });
});
