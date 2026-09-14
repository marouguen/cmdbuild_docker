// Read-only release gate. Credentials are supplied through the environment.
import fs from 'node:fs/promises';
const base=process.env.OPENMAINT_API ?? 'http://localhost:8091/cmdbuild/services/rest/v3/';
const username=process.env.OPENMAINT_USER,password=process.env.OPENMAINT_PASSWORD;
if(!username||!password||username==='admin')throw Error('Provide a real technician test account, not admin.');
let token;
const summary={username,checks:[]};
async function req(path,method='GET',body){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{'Cmdbuild-Authorization':token}:{})},body:body?JSON.stringify(body):undefined});const d=await r.json();summary.checks.push({path:path.startsWith('sessions/')?'sessions/[redacted]':path,method,status:r.status,success:d.success,total:d.meta?.total});if(!r.ok||!d.success)throw Error(`Technician request rejected (${r.status}): ${path}`);return d.data;}
try{
 const session=await req('sessions?scope=service&returnId=true','POST',{username,password});token=session._id;
 const current=await req('sessions/current');summary.role=current.role;
 if(current.username!==username)throw Error('Session user mismatch');
 let start=0,total=Infinity;const ids=[];
 while(start<total){const r=await fetch(base+`processes/CorrectiveMaint/instances?limit=25&start=${start}`,{headers:{'Cmdbuild-Authorization':token}});const d=await r.json();if(!r.ok||!d.success)throw Error('Jobs read failed');ids.push(...d.data.map(j=>j._id));total=d.meta?.total??ids.length;if(!d.data.length)break;start+=d.data.length;}
 summary.authorizedJobIds=ids;
 summary.protectedExampleVisible=ids.includes(431763);
 for(const id of [431763,436988].filter(id=>ids.includes(id))){
  await req(`processes/CorrectiveMaint/instances/${id}`);
  const active=await req(`processes/CorrectiveMaint/instances/${id}/activities`);
  summary.checks.push({id,activities:active.map(a=>({definition:a._definition,writable:a.writable,performer:a.performer}))});
 }
 await req('classes/Topic/cards?limit=1');
 console.log(JSON.stringify(summary,null,2));
}finally{
 if(token){await req('sessions/'+encodeURIComponent(token),'DELETE');token=undefined;}
 await fs.mkdir(new URL('../investigation/',import.meta.url),{recursive:true});
 await fs.writeFile(new URL('../investigation/technician-verification.json',import.meta.url),JSON.stringify(summary,null,2));
}
