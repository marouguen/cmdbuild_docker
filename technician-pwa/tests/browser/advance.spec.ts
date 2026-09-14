import { test,expect } from '@playwright/test';
import fs from 'node:fs/promises';
test('one-shot disposable corrective workflow advances through the PWA',async({page})=>{
 test.skip(process.env.PWA_RUN_ADVANCE!=='yes','Explicit opt-in creates and advances a dedicated disposable fixture.');
 const base='http://localhost:8091/cmdbuild/services/rest/v3/';
 const username=process.env.OPENMAINT_USER,password=process.env.OPENMAINT_PASSWORD;
 if(!username||!password)throw Error('Test credentials required');
 const login=await(await fetch(base+'sessions?scope=service&returnId=true',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})})).json();
 const headers={'Cmdbuild-Authorization':login.data._id,'Content-Type':'application/json'};
 async function req(path:string,method='GET',body?:unknown){const r=await fetch(base+path,{method,headers,body:body?JSON.stringify(body):undefined});const d=await r.json();if(!r.ok||!d.success)throw Error(`Fixture request failed: ${method} ${path} ${r.status}`);return d.data;}
 try {
  const subject='PWA TEST - one-shot workflow advancement';
  const jobs=await req('processes/CorrectiveMaint/instances?limit=100');
  if(jobs.some((j:{ShortDescr:string})=>j.ShortDescr===subject))throw Error('One-shot fixture already exists. Do not repeat advancement.');
  const source=await req('processes/CorrectiveMaint/instances/431763');
  const start=await req('processes/CorrectiveMaint/start_activities');
  const payload:Record<string,unknown>={_activity:start._id,_advance:false,ShortDescr:subject,ProcessNotes:'Disposable PWA workflow verification; not a real maintenance job.'};
  for(const key of ['Requester','Type','Site','Priority','CI','Category','Subcategory'])payload[key]=source[key];
  const fixture=await req('processes/CorrectiveMaint/instances','POST',payload);
  const path=`processes/CorrectiveMaint/instances/${fixture._id}`;
  let [active]=await req(path+'/activities');await req(path,'PUT',{_activity:active._id,_advance:true});
  [active]=await req(path+'/activities');expect(active._definition).toBe('CM-Assignment');
  const actions=await req('lookup_types/Process%20-%20Action/values');const assign=actions.find((a:{code:string})=>a.code==='CM-Assignment_Advance');
  await req(path,'PUT',{_activity:active._id,_advance:true,Action:assign._id,Team:source.Team,ExpExecStartDate:new Date().toISOString()});
  [active]=await req(path+'/activities');expect(active._definition).toBe('CM-Execution');
  await page.goto('/');await page.getByLabel('Username',{exact:true}).fill(username);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.getByRole('button').filter({hasText:subject}).click();await page.getByRole('button',{name:'Work',exact:true}).click();
  await page.getByLabel('What did you do?').fill('PWA TEST - conclude verified through mobile browser.');
  await page.getByRole('button',{name:'Use current time'}).first().click();await page.getByRole('button',{name:'Use current time'}).last().click();
  await page.getByRole('combobox',{name:'Outcome',exact:true}).selectOption({label:'Positive'});
  await page.getByRole('button',{name:'Complete job',exact:true}).click();await page.getByRole('button',{name:'Confirm action'}).click();
  await expect(page.getByText('Saved to openMAINT.',{exact:true})).toBeVisible();
  const result=await req(path);expect(result._ProcessStatus_code).toBe('CM-Accounting');
  const protectedJob=await req('processes/CorrectiveMaint/instances/431763');expect(protectedJob._beginDate).toBe(source._beginDate);
  await fs.writeFile('investigation/browser-advance.json',JSON.stringify({id:fixture._id,number:fixture.Number,before:'CM-Execution',after:result._ProcessStatus_code,protectedJobUnchanged:true},null,2));
  console.log(`Verified disposable ${fixture.Number} (${fixture._id}): Execution -> Accounting`);
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
 }finally{await req('sessions/'+encodeURIComponent(login.data._id),'DELETE');}
});
