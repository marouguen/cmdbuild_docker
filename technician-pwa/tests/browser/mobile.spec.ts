import { test,expect,type Page } from '@playwright/test';
const username=process.env.OPENMAINT_USER;
const password=process.env.OPENMAINT_PASSWORD;
test.skip(!username||!password,'Set live API test credentials.');
test.afterEach(async({page})=>{const button=page.getByRole('button',{name:'Sign out',exact:true});if(await button.count())await button.click().catch(()=>{});});
async function login(page:Page){await page.goto('/');await page.getByLabel('Username',{exact:true}).fill(username!);await page.getByLabel('Password',{exact:true}).fill(password!);await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('heading',{name:/My jobs/})).toBeVisible();}
async function openFixture(page:Page){await login(page);const job=page.getByRole('button').filter({hasText:'PWA TEST - disposable technician integration'});await expect(job).toBeVisible();await job.click();await expect(page.getByRole('heading',{name:'PWA TEST - disposable technician integration'})).toBeVisible();}
test('mobile login, authorized jobs, details and knowledge use real API',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await login(page);await page.screenshot({path:'test-results/mobile-jobs.png',fullPage:true});
 await page.getByRole('button').filter({hasText:'CM.000.000.002'}).click();
 await expect(page.getByRole('heading',{name:/Extrusion Press/})).toBeVisible();
 await expect(page.getByText('No technician Execution action is currently available')).toBeVisible();
 await page.getByRole('button',{name:'Knowledge',exact:true}).click();
 await page.getByRole('button').filter({hasText:'Hydraulic pump does not start'}).first().click();
 await expect(page.getByRole('heading',{name:'Hydraulic pump does not start'})).toBeVisible();
 await expect(page.getByText('Check incoming electrical supply.',{exact:false})).toBeVisible();
 await page.screenshot({path:'test-results/mobile-knowledge.png',fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page.getByLabel('Password',{exact:true})).toHaveValue('');
 expect(errors).toEqual([]);
});
test('fixture execution save and action review',async({page})=>{
 await openFixture(page);await page.getByRole('button',{name:'Work',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Record your work'})).toBeVisible();
 await page.getByLabel('What did you do?').fill('PWA TEST - saved from mobile browser; no real maintenance.');
 await page.getByRole('button',{name:'Save progress',exact:true}).click();await expect(page.getByText('Saved to openMAINT.',{exact:true})).toBeVisible();
 await expect(page.getByLabel('What did you do?')).toHaveValue('PWA TEST - saved from mobile browser; no real maintenance.');
 await page.getByRole('button',{name:'Complete job',exact:true}).click();await expect(page.getByRole('alert')).toContainText('required');
 const times=page.getByRole('button',{name:'Use current time'});await times.last().click();
 await page.getByRole('combobox',{name:'Outcome',exact:true}).selectOption({label:'Positive'});
 await page.getByRole('button',{name:'Complete job',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();
 await page.getByRole('button',{name:'Keep editing'}).click();await page.screenshot({path:'test-results/mobile-execution.png',fullPage:true});
});
test('fixture photo upload and download',async({page})=>{
 await openFixture(page);await page.getByRole('button',{name:'Photos',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Show what you found'})).toBeVisible();
 await expect(page.getByLabel('Add a photo')).toBeVisible();
 if(await page.getByRole('button').filter({hasText:'icon-192.png'}).count()===0){
  await page.getByLabel('Add a photo').setInputFiles('public/icons/icon-192.png');await page.getByLabel('Caption').fill('PWA TEST - browser upload');await page.getByRole('button',{name:'Upload photo'}).click();await expect(page.getByText('Photo saved to openMAINT.')).toBeVisible();
 }
 const download=page.waitForEvent('download');await page.getByRole('button').filter({hasText:'icon-192.png'}).click();expect((await download).suggestedFilename()).toBe('icon-192.png');
});
test('fixture labour entry uses backend accounting',async({page})=>{
 await openFixture(page);await page.getByRole('button',{name:'Resources',exact:true}).click();await expect(page.getByRole('heading',{name:'Time & labour'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Record labour',exact:true})).toBeVisible();
 if(await page.getByText('PWA TEST - browser labour',{exact:true}).count()===0){
  await page.getByLabel('Work performed').fill('PWA TEST - browser labour');await page.getByLabel('Hours',{exact:true}).fill('0.25');await page.getByLabel('Hourly rate').fill('0');await page.getByRole('button',{name:'Record labour',exact:true}).click();await expect(page.getByText('Labour saved to openMAINT.')).toBeVisible();
 }
 await expect(page.getByText('PWA TEST - browser labour',{exact:true}).first()).toBeVisible();await expect(page.getByText(/Spare-part entry is not available yet/)).toBeVisible();
});
test('real revoked session returns user to login',async({page,request})=>{
 await login(page);
 // Capture this browser's header only in memory. Never write session IDs into test artifacts.
 const response=page.waitForResponse(r=>r.url().includes('/CorrectiveMaint/instances?'));
 await page.getByRole('button',{name:'Refresh jobs'}).click();const r=await response;const token=r.request().headers()['cmdbuild-authorization'];expect(token).toBeTruthy();
 await request.delete('http://localhost:8091/cmdbuild/services/rest/v3/sessions/'+encodeURIComponent(token),{headers:{'Cmdbuild-Authorization':token}});
 await page.getByRole('button',{name:'Refresh jobs'}).click();await expect(page.getByRole('heading',{name:'Sign in',exact:true})).toBeVisible();await expect(page.getByText('Your session expired. Sign in to continue.')).toBeVisible();
});
test('PWA precaches only static assets and opens offline without job data',async({page,context})=>{
 await page.goto('/');await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();
 const cacheUrls=await page.evaluate(async()=>{const keys=await caches.keys();return(await Promise.all(keys.map(async key=>(await(await caches.open(key)).keys()).map(r=>r.url)))).flat();});
 expect(cacheUrls.some(u=>u.includes('/assets/'))).toBe(true);expect(cacheUrls.some(u=>u.includes('/services/'))).toBe(false);
 await context.setOffline(true);await page.reload();await expect(page.getByText(/You’re offline/)).toBeVisible();await expect(page.getByRole('heading',{name:'Sign in',exact:true})).toBeVisible();await context.setOffline(false);
 const manifest=await(await page.request.get('/manifest.webmanifest')).json();expect(manifest.display).toBe('standalone');expect(manifest.icons).toHaveLength(3);
});
