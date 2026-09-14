import { it,expect } from 'vitest';
import { validateLabour } from '../../src/api/accounting';
import { copyTopic } from '../../src/api/knowledge';
const valid={description:'Inspect pump',date:'2026-09-14',hours:0.5,unitPrice:20,notes:''};
it('validates labour values',()=>{expect(()=>validateLabour(valid)).not.toThrow();for(const hours of [0,-1,NaN,Infinity,25])expect(()=>validateLabour({...valid,hours})).toThrow();expect(()=>validateLabour({...valid,unitPrice:NaN})).toThrow();expect(()=>validateLabour({...valid,description:''})).toThrow();});
it('copies knowledge as a labelled reference after existing notes',()=>{expect(copyTopic({_id:1,_type:'Topic',Description:'Topic',Content:'Procedure'},'Already checked')).toBe('Already checked\n-------------- Reference only, not performed work --------------\nTopic\nProcedure');});
it('prompts for work performed when notes are empty',()=>{expect(copyTopic({_id:1,_type:'Topic',Description:'Topic',Content:'Procedure'},'')).toBe('Work performed: \n-------------- Reference only, not performed work --------------\nTopic\nProcedure');});
