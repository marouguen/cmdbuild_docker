import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../src/api/client';
import { assertOpeningContract, choiceFilter, getOriginalRequestNotes, isRequesterDetailReadOnly, openingPayload, selectListedRequest, selectOpeningHistory, submitRequest, type RequestDraft } from '../../src/api/requester';
import { readRequesterDiagnostics } from '../../src/api/requesterDiagnostics';
import type { Activity, ActivityAttribute, Card } from '../../src/types/api';

const attribute = (id: string, mandatory = false, detail: Partial<ActivityAttribute['detail']> = {}): ActivityAttribute => ({
  _id:id, mandatory, writable:true, detail:{name:id,type:'string',description:id,...detail}
});
const opening: Activity = {
  _id:'CM-Opening', _definition:'CM-Opening', description:'Opening', writable:true,
  attributes:[attribute('Requester',true,{type:'reference',targetClass:'Employee'}),attribute('ShortDescr',true),attribute('Type',true,{type:'lookup',lookupType:'MaintProcess - Type'}),attribute('Priority',true,{type:'lookup',lookupType:'COMMON - Priority'}),attribute('Site',true,{type:'reference',targetClass:'Site'}),attribute('Floor',false,{type:'reference',targetClass:'Floor',ecqlFilter:{id:'floor-filter',bindings:{client:['Site.Id']}}}),attribute('Room',false,{type:'reference',targetClass:'Room',ecqlFilter:{id:'room-filter',bindings:{client:['Site.Id','Floor.Id']}}}),attribute('CI',false,{type:'reference',targetClass:'CI',ecqlFilter:{id:'ci-filter',bindings:{client:['Site.Id','Floor.Id','Room.Id']}}}),attribute('Category',false,{type:'reference',targetClass:'MaintCategory'}),attribute('Subcategory',false,{type:'reference',targetClass:'MaintSubcategory',ecqlFilter:{id:'subcategory-filter',bindings:{client:['Category.Id']}}}),attribute('ProcessNotes')]
};
const draft: RequestDraft={Requester:10,ShortDescr:' Pump issue ',Type:20,Priority:30,Site:40,Floor:50,Room:60,CI:70,Category:80,Subcategory:90,ProcessNotes:'Noise'};

afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});

describe('Requester Opening metadata',()=>{
  it('accepts the verified live required fields and rejects incompatible required fields',()=>{
    expect(()=>assertOpeningContract(opening)).not.toThrow();
    expect(()=>assertOpeningContract({...opening,attributes:[...opening.attributes!,attribute('Unexpected',true)]})).toThrow('unsupported');
    expect(()=>assertOpeningContract({...opening,writable:false})).toThrow('not writable');
  });
  it('builds dependent ECQL contexts from current selections',()=>{
    expect(choiceFilter(opening.attributes!.find(a=>a._id==='Floor')!,draft)).toMatchObject({ecql:{id:'floor-filter',context:{client:{'Site.Id':40}}}});
    expect(choiceFilter(opening.attributes!.find(a=>a._id==='Room')!,draft)).toMatchObject({ecql:{context:{client:{'Site.Id':40,'Floor.Id':50}}}});
    expect(choiceFilter(opening.attributes!.find(a=>a._id==='CI')!,draft)).toMatchObject({ecql:{context:{client:{'Site.Id':40,'Floor.Id':50,'Room.Id':60}}}});
    expect(choiceFilter(opening.attributes!.find(a=>a._id==='Subcategory')!,draft)).toMatchObject({ecql:{context:{client:{'Category.Id':80}}}});
  });
  it('builds a non-advancing creation payload using only live writable fields',()=>{
    expect(openingPayload(opening,draft)).toEqual({_activity:'CM-Opening',_advance:false,...draft,ShortDescr:'Pump issue'});
    expect(()=>openingPayload(opening,{...draft,Requester:undefined})).toThrow('Requester is required');
  });
});

describe('Requester navigation and read-only rules',()=>{
  const listed:Card={_id:491550,_type:'CorrectiveMaint',ShortDescr:'Mine'};
  it('only resolves detail targets present in the server-filtered list',()=>{expect(selectListedRequest([listed],491550)).toBe(listed);expect(selectListedRequest([listed],431763)).toBeNull();});
  it('treats a non-writable Assignment as read-only regardless of field metadata',()=>{expect(isRequesterDetailReadOnly({...opening,_definition:'CM-Assignment',writable:false})).toBe(true);expect(isRequesterDetailReadOnly({...opening,writable:true})).toBe(false);});
});

describe('Requester original Opening notes',()=>{
  const assignment:Card={_id:3,_type:'CorrectiveMaint',_activity_code:'CM-Assignment',_endDate:'2026-09-19T02:00:00Z'};
  const openingOld:Card={_id:1,_type:'CorrectiveMaint',_activity_code:'CM-Opening',_endDate:'2026-09-19T01:00:00Z'};
  const openingFinal:Card={_id:2,_type:'CorrectiveMaint',_activity_code:'CM-Opening',_endDate:'2026-09-19T01:30:00Z'};
  it('selects the final Opening version rather than the current activity',()=>{
    expect(selectOpeningHistory([assignment,openingOld,openingFinal])).toBe(openingFinal);
  });
  it('loads ProcessNotes from the full Opening history snapshot',async()=>{
    const data=vi.spyOn(api,'data').mockResolvedValue({_id:2,_type:'CorrectiveMaint',ProcessNotes:'Original requester description'});
    await expect(getOriginalRequestNotes(99,[assignment,openingFinal])).resolves.toBe('Original requester description');
    expect(data).toHaveBeenCalledWith('processes/CorrectiveMaint/instances/99/history/2');
  });
  it('does not request a snapshot when Opening history is unavailable',async()=>{
    const data=vi.spyOn(api,'data');
    await expect(getOriginalRequestNotes(99,[assignment])).resolves.toBeNull();
    expect(data).not.toHaveBeenCalled();
  });
});

describe('Requester submission sequencing',()=>{
  it('creates, uploads during Opening, re-reads activity, then advances without retries',async()=>{
    const values = new Map<string,string>();
    vi.stubGlobal('sessionStorage',{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key)});
    const created:Card={_id:99,_type:'CorrectiveMaint',Number:'CM.99'};
    const completed:Card={...created,_ProcessStatus_code:'CM-Assignment'};
    const data=vi.spyOn(api,'data').mockImplementation(async(path:string,method='GET')=>{
      if(method==='POST')return created;
      if(path.endsWith('/activities'))return [opening];
      if(method==='PUT')return completed;
      if(path.endsWith('/99'))return completed;
      throw new Error('Unexpected call '+method+' '+path);
    });
    const raw=vi.spyOn(api,'raw').mockResolvedValue(new Response(JSON.stringify({success:true,data:{_id:'file',name:'photo.png',category:1}}),{status:200,headers:{'Content-Type':'application/json'}}));
    const file=new File(['image'],'photo.png',{type:'image/png'});
    await expect(submitRequest(opening,draft,[file],{_id:1,_type:'AlfrescoCategory',code:'Photo',description:'Photo',active:true,modelClass:'BaseDocument'})).resolves.toMatchObject({_id:99,_ProcessStatus_code:'CM-Assignment'});
    expect(data.mock.calls.map(call=>[call[1]??'GET',call[0]])).toEqual([
      ['POST','processes/CorrectiveMaint/instances'],
      ['GET','processes/CorrectiveMaint/instances/99/activities'],
      ['GET','processes/CorrectiveMaint/instances/99/activities'],
      ['PUT','processes/CorrectiveMaint/instances/99'],
      ['GET','processes/CorrectiveMaint/instances/99']
    ]);
    expect(raw).toHaveBeenCalledOnce();
    expect(readRequesterDiagnostics().map(item=>item.event)).toEqual([
      'creating_draft','draft_created','uploading_attachment','attachment_uploaded','refreshing_activity','advancing_opening','completed'
    ]);
  });
});
