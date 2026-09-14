// Dedicated REST-only corrective fixture. Never advances the protected existing job.
import fs from 'node:fs/promises';
const base='http://localhost:8091/cmdbuild/services/rest/v3/';
const login=await(await fetch(base+'sessions?scope=service&returnId=true',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:process.env.OPENMAINT_USER,password:process.env.OPENMAINT_PASSWORD})})).json();
if(!login.data?._id) throw Error('Login failed');
const headers={'Cmdbuild-Authorization':login.data._id,'Content-Type':'application/json'};
async function request(path,method='GET',body){const r=await fetch(base+path,{method,headers,body:body?JSON.stringify(body):undefined});const d=await r.json();if(!r.ok||!d.success)throw Error(JSON.stringify(d));return d.data;}
try {
const existing=await request('processes/CorrectiveMaint/instances?limit=100');
if(existing.some(j=>j.ShortDescr?.startsWith('PWA TEST -'))) throw Error('Fixture already exists; inspect before making another');
const start=await request('processes/CorrectiveMaint/start_activities');
const source=await request('processes/CorrectiveMaint/instances/431763');
const payload={_activity:start._id,_advance:false,ShortDescr:'PWA TEST - disposable technician integration',ProcessNotes:'Dedicated PWA integration fixture. Not a real fault. Do not dispatch.'};
for(const key of ['Requester','Type','Site','Priority','CI','Category','Subcategory']) payload[key]=source[key];
const result=await request('processes/CorrectiveMaint/instances','POST',payload);
await fs.writeFile(new URL('../investigation/fixture.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify({id:result._id,number:result.Number,status:result._ProcessStatus_code}));
} finally {await request('sessions/'+encodeURIComponent(login.data._id),'DELETE');}
