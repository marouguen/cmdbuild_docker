import { describe,it,expect,vi,afterEach } from 'vitest';
import { executionPayload,mapActions,mapJob,metadataFilter,saveExecution,visibleJobs } from '../../src/api/processes';
import { api } from '../../src/api/client';
import type { Activity,Card,Lookup } from '../../src/types/api';
import execution from '../fixtures/execution.json';
const activity=execution as unknown as Activity;
const actions:Lookup[]=[{_id:1,code:'CM-Execution_Advance',description:'Conclude',active:true},{_id:2,code:'CM-Execution_Return',description:'Change assignee',active:true},{_id:3,code:'CM-Execution_Back',description:'Reschedule',active:true},{_id:4,code:'CM-Accounting_Advance',description:'Close',active:true}];
const draft={Action:1,Outcome:5,ExecStartDate:'2026-09-14T08:00:00Z',ExecEndDate:'2026-09-14T09:00:00Z',ProcessNotes:'Fixed'};
afterEach(()=>vi.restoreAllMocks());
describe('job mapping and narrowing',()=>{
 const card:Card={_id:1,_type:'CorrectiveMaint',Number:'CM.1',ShortDescr:'Pump fault',_CI_description:'Press',_Site_description:'Building',_Floor_description:'Ground',_Priority_description:'High',_ProcessStatus_description:'Execution',_FlowStatus_code:'open.running'};
 it('maps actual openMAINT fields',()=>{expect(mapJob(card)).toMatchObject({subject:'Pump fault',equipment:'Press',location:'Building · Ground',priority:'High'});});
 it('only narrows server-authorized input; does not infer membership',()=>{const completed={...card,_id:2,_FlowStatus_code:'closed.completed'};expect(visibleJobs([card,completed])).toEqual([card]);expect(visibleJobs([card],'press')).toEqual([card]);expect(visibleJobs([],'',false)).toEqual([]);expect(visibleJobs([completed],'',false)).toEqual([completed]);});
});
describe('metadata-driven execution',()=>{
 it('restricts actions to current writable Execution',()=>{expect(mapActions(activity,actions)).toHaveLength(3);expect(mapActions({...activity,writable:false},actions)).toEqual([]);expect(mapActions({...activity,_definition:'CM-Accounting'},actions)).toEqual([]);});
 it('builds only permitted fields with current activity and ISO dates',()=>{expect(executionPayload(activity,draft,actions,true)).toEqual({...draft,ExecStartDate:'2026-09-14T08:00:00.000Z',ExecEndDate:'2026-09-14T09:00:00.000Z',_activity:activity._id,_advance:true});});
 it.each(['Action','ExecStartDate','ExecEndDate'] as const)('requires %s when advancing',(key)=>{expect(()=>executionPayload(activity,{...draft,[key]:undefined},actions,true)).toThrow('required');});
 it('requires Outcome only for conclude and Assignee for return',()=>{expect(()=>executionPayload(activity,{...draft,Outcome:undefined},actions,true)).toThrow('Outcome');expect(()=>executionPayload(activity,{...draft,Action:2,Outcome:undefined},actions,true)).toThrow('Assignee');expect(()=>executionPayload(activity,{...draft,Action:3,Outcome:undefined},actions,true)).not.toThrow();});
 it('rejects reversed or invalid dates',()=>{expect(()=>executionPayload(activity,{...draft,ExecEndDate:'2026-09-13T09:00Z'},actions,true)).toThrow('End time');expect(()=>executionPayload(activity,{...draft,ExecStartDate:'bad'},actions,true)).toThrow('valid');});
 it('supports partial save without workflow advancement',()=>{expect(executionPayload(activity,{ProcessNotes:'In progress'},actions,false)).toEqual({_activity:activity._id,_advance:false,ProcessNotes:'In progress'});});
 it('allows explicitly clearing notes',()=>{expect(executionPayload(activity,{ProcessNotes:''},actions,false).ProcessNotes).toBe('');});
 it('fails closed if server validation changes',()=>{const changed=structuredClone(activity);changed.attributes![0].detail.validationRules='return false;';expect(()=>executionPayload(changed,draft,actions,true)).toThrow('changed');});
 it('fails closed on required widget submissions',()=>{expect(()=>executionPayload({...activity,widgets:[{_id:'NewWidget',_type:'unknown',_active:true,_required:true}]},draft,actions,true)).toThrow('requires a widget');});
 it('rejects injected or read-only fields and unknown actions',()=>{expect(()=>executionPayload(activity,{...draft,Site:4} as typeof draft,actions,true)).toThrow('not writable');expect(()=>executionPayload(activity,{...draft,Action:4},actions,true)).toThrow('allowed');});
 it('honors additional required metadata',()=>{const extra={_id:'NewField',mandatory:true,writable:true,detail:{name:'NewField',type:'string',description:'New field'}};expect(()=>executionPayload({...activity,attributes:[...activity.attributes!,extra]},draft,actions,true)).toThrow('New field');});
 it('builds verified ECQL assignee bindings',()=>{const field=activity.attributes!.find(a=>a._id==='Assignee')!;expect(metadataFilter(field,{_id:1,_type:'CorrectiveMaint',Team:2})).toMatchObject({ecql:{context:{client:{'Team.Id':2},server:{}}}});});
 it('blocks a stale job before any write',async()=>{const data=vi.spyOn(api,'data').mockResolvedValueOnce({_id:1,_beginDate:'new'}).mockResolvedValueOnce([activity]);await expect(saveExecution({_id:1,_type:'CorrectiveMaint',_beginDate:'old'},activity,draft,true)).rejects.toThrow('changed');expect(data.mock.calls.every(c=>!c[1])).toBe(true);});
});
