import fs from 'node:fs/promises';
const base = process.env.OPENMAINT_API ?? 'http://localhost:8091/cmdbuild/services/rest/v3/';
const username = process.env.OPENMAINT_USER;
const password = process.env.OPENMAINT_PASSWORD;
if (!username || !password) throw new Error('Set OPENMAINT_USER and OPENMAINT_PASSWORD');
const login = await fetch(base+'sessions?scope=service&returnId=true', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});
const session = await login.json();
if (!session.success || !session.data?._id) throw new Error('Login failed');
const headers = {'Cmdbuild-Authorization':session.data._id};
const out = new URL('../investigation/', import.meta.url);
await fs.mkdir(out,{recursive:true});
const results=[];
async function get(path,name) {
 const r=await fetch(base+path,{headers}); const data=await r.json();
 if (name !== 'session') await fs.writeFile(new URL(`${username}-${name}.json`,out),JSON.stringify(data,null,2));
 results.push({path,status:r.status,success:data.success,total:data.meta?.total,keys:Object.keys(Array.isArray(data.data)?data.data[0]??{}:data.data??{})});
 return data.data;
}
const current=await get('sessions/current','session');
// Never persist session identifiers or tokens in the evidence directory.
await fs.writeFile(new URL(`${username}-session.json`,out),JSON.stringify({username:current.username,role:current.role,availableRoles:current.availableRoles,rolePrivileges:current.rolePrivileges},null,2));
await get('processes/CorrectiveMaint/instances?limit=25&start=0','jobs');
await get('processes/CorrectiveMaint/instances/431763','job');
const activities=await get('processes/CorrectiveMaint/instances/431763/activities','activities');
for(const a of activities??[]) await get(`processes/CorrectiveMaint/instances/431763/activities/${a._id}`,'activity');
await get('lookup_types/Process%20-%20Action/values','actions');
await get('classes','classes');
await get('processes','processes');
await get('processes/CorrectiveMaint/instances/431763/attachments','attachments');
await fs.writeFile(new URL(`${username}-summary.json`,out),JSON.stringify(results,null,2));
console.log(JSON.stringify(results.map(({keys,...r})=>r),null,2));
// Session DELETE contract is verified in the installed Session model before use.
const logout=await fetch(base+'sessions/'+encodeURIComponent(session.data._id),{method:'DELETE',headers});
console.log('Logout',logout.status);
const expired=await fetch(base+'processes/CorrectiveMaint/instances?limit=1',{headers});
console.log('After logout',expired.status);
