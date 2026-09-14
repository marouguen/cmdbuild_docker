import fs from 'node:fs/promises';
const base='http://localhost:8091/cmdbuild/services/rest/v3/';
const session=await(await fetch(base+'sessions?scope=service&returnId=true',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:process.env.OPENMAINT_USER,password:process.env.OPENMAINT_PASSWORD})})).json();
if(!session.data?._id)throw Error('Login failed');
const headers={'Cmdbuild-Authorization':session.data._id,'Content-Type':'application/json'};
async function req(path,method='GET',data){const r=await fetch(base+path,{method,headers,body:data?JSON.stringify(data):undefined});const d=await r.json();if(!r.ok||!d.success)throw Error(JSON.stringify(d));return d.data;}
try {
const id=436988,path=`processes/CorrectiveMaint/instances/${id}`;
const job=await req(path);if(!job.ShortDescr.startsWith('PWA TEST -'))throw Error('Not disposable');
let [a]=await req(path+'/activities');let detail=await req(path+'/activities/'+a._id);
if(process.argv.includes('--assign')&&a._definition==='CM-Assignment') {
 const actions=await req('lookup_types/Process%20-%20Action/values');
 const action=actions.find(x=>x.code==='CM-Assignment_Advance');
 if(!action)throw Error('Missing action');
 await req(path,'PUT',{_activity:a._id,_advance:true,Action:action._id,Team:427035,ExpExecStartDate:new Date().toISOString()});
 [a]=await req(path+'/activities');detail=await req(path+'/activities/'+a._id);
}
const actionAttr=detail.attributes.find(x=>x._id==='Action');
if(actionAttr?.detail.ecqlFilter){
 const filter={ecql:{id:actionAttr.detail.ecqlFilter.id,context:{server:{Id:id},client:{}}}};
 const actions=await req('lookup_types/Process%20-%20Action/values?filter='+encodeURIComponent(JSON.stringify(filter)));
 console.log('FILTERED ACTIONS',actions.map(x=>({id:x._id,code:x.code})));
}
if(process.argv.includes('--open')&&a._definition==='CM-Opening') {
 await req(path,'PUT',{_activity:a._id,_advance:true});
 [a]=await req(path+'/activities');detail=await req(path+'/activities/'+a._id);
}
await fs.writeFile(new URL('../investigation/fixture-activity.json',import.meta.url),JSON.stringify(detail,null,2));
console.log(JSON.stringify({definition:a._definition,attributes:detail.attributes.filter(x=>x.writable).map(x=>({id:x._id,mandatory:x.mandatory,validation:x.detail.validationRules,lookup:x.detail.lookupType}))},null,2));
}finally{await req('sessions/'+encodeURIComponent(session.data._id),'DELETE');}
