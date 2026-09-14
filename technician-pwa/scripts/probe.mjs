import fs from 'node:fs/promises';
const base=process.env.OPENMAINT_API??'http://localhost:8091/cmdbuild/services/rest/v3/';
const s=await (await fetch(base+'sessions?scope=service&returnId=true',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:process.env.OPENMAINT_USER,password:process.env.OPENMAINT_PASSWORD})})).json();
if(!s.data?._id) throw Error('Login failed');
const headers={'Cmdbuild-Authorization':s.data._id};
try {
 for(const path of process.argv.slice(2)) {
 const r=await fetch(base+path,{headers}); const body=await r.text();
 const file=path.replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,180);
 await fs.writeFile(new URL(`../investigation/${process.env.OPENMAINT_USER}-${file}.json`,import.meta.url),body);
 let d;try{d=JSON.parse(body)}catch{}
 console.log(JSON.stringify({path,status:r.status,total:d?.meta?.total,keys:Object.keys(Array.isArray(d?.data)?d.data[0]??{}:d?.data??{}),file}));
 }
} finally {await fetch(base+'sessions/'+encodeURIComponent(s.data._id),{method:'DELETE',headers});}
