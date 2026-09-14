import fs from 'node:fs/promises';
const base='http://localhost:8091/cmdbuild/services/rest/v3/';
const session=await(await fetch(base+'sessions?scope=service&returnId=true',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:process.env.OPENMAINT_USER,password:process.env.OPENMAINT_PASSWORD})})).json();
if(!session.data?._id)throw Error('Login failed');
const headers={'Cmdbuild-Authorization':session.data._id};
const results=[];
async function req(path,method='GET',body){const r=await fetch(base+path,{method,headers:{...headers,...(body instanceof FormData?{}:{'Content-Type':'application/json'})},body:body?(body instanceof FormData?body:JSON.stringify(body)):undefined});const d=await r.json();results.push({path,method,status:r.status,success:d.success});if(!r.ok||!d.success)throw Error(JSON.stringify(d));return d.data;}
const id=436988,path=`processes/CorrectiveMaint/instances/${id}`;
try {
const job=await req(path);if(!job.ShortDescr.startsWith('PWA TEST -'))throw Error('Not disposable');
const [active]=await req(path+'/activities');if(active._definition!=='CM-Execution')throw Error('Not execution');
const activity=await req(path+'/activities/'+active._id);
const assignee=activity.attributes.find(x=>x._id==='Assignee');
const choices=await req('classes/Employee/cards?filter='+encodeURIComponent(JSON.stringify({ecql:{id:assignee.detail.ecqlFilter.id,context:{server:{},client:{'Team.Id':job.Team}}}})));
console.log('Assignee candidates',choices.map(x=>({id:x._id,code:x.Code})));
await req(path,'PUT',{_activity:active._id,_advance:false,ProcessNotes:'PWA TEST - execution notes saved without advancing.',ExecStartDate:new Date().toISOString()});
const attachments=await req(path+'/attachments');
if(!attachments.some(x=>x.name==='pwa-test.png')) {
 const form=new FormData();
 form.append('file',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=','base64')],{type:'image/png'}),'pwa-test.png');
 const categories=await req('dms/categories/_ALL/values');
 const category=categories.find(x=>x.code==='Photo'&&x._type==='AlfrescoCategory');
 form.append('attachment',new Blob([JSON.stringify({category:category._id,description:'Disposable PWA integration photo'})],{type:'application/json'}));
 const photo=await req(path+'/attachments','POST',form);console.log('Photo',photo._id);
}
const relationsPath=`processes/MaintProcess/cards/${id}/relations`;
const relations=await req(relationsPath);
if(!relations.some(x=>x._type==='MaintProcessTopic'&&x._destinationId===431233)) {
 const relation=await req(relationsPath,'POST',{_type:'MaintProcessTopic',_sourceType:'MaintProcess',_sourceId:id,_destinationType:'Topic',_destinationId:431233,_is_direct:true});console.log('KB relation',relation._id);
}
const filter='filter='+encodeURIComponent(JSON.stringify({attribute:{simple:{attribute:'MaintProcess',operator:'equal',value:[id]}}}));
const labour=await req('classes/LabourAccMov/cards?'+filter);
if(!labour.some(x=>x.Description==='PWA TEST - labour validation')) {
 const types=await req('lookup_types/AccountingMov%20-%20Type/values');const states=await req('lookup_types/AccountingMov%20-%20State/values');
 const payload={Description:'PWA TEST - labour validation',Date:new Date().toISOString().slice(0,10),MaintProcess:id,Site:job.Site,Type:types.find(x=>x.code==='Cost')._id,State:states.find(x=>x.code==='Actual')._id,ManualQuantity:true,Quantity:0.25,UnitPrice:0,Notes:'Disposable integration fixture; not real labour or cost.'};
 const movement=await req('classes/LabourAccMov/cards','POST',payload);console.log('Labour',movement._id,movement.Quantity,movement.TotalAmount);
}
await req(path+'/attachments');await req('classes/LabourAccMov/cards?'+filter);await req(path+'/relations');
}finally{await fs.writeFile(new URL('../investigation/capability-test.json',import.meta.url),JSON.stringify(results,null,2));await req('sessions/'+encodeURIComponent(session.data._id),'DELETE');}
