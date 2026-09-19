import { test, expect, type Page } from '@playwright/test';

const username=process.env.REQUESTER_USER;
const password=process.env.REQUESTER_PASSWORD;
test.skip(!username||!password,'Set Requester test credentials.');

async function login(page: Page) {
  await page.goto('/');
  await page.getByLabel('Username',{exact:true}).fill(username!);
  await page.getByLabel('Password',{exact:true}).fill(password!);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.getByRole('heading',{name:/My requests/})).toBeVisible();
}

test.afterEach(async({page})=>{const signOut=page.getByRole('button',{name:'Sign out',exact:true});if(await signOut.count())await signOut.click().catch(()=>{});});

test('Requester list and Assignment detail remain list-derived and read-only',async({page})=>{
  await login(page);
  await expect(page.getByRole('button').filter({hasText:'CM.000.000.005'})).toHaveCount(1);
  await expect(page.getByText('CM.000.000.002')).toHaveCount(0);
  await page.getByRole('button').filter({hasText:'CM.000.000.005'}).click();
  await expect(page.getByRole('heading',{name:'REQUESTER TEST - hydraulic pump issue'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Original submitted notes'})).toBeVisible();
  await expect(page.getByText('Test request created by Requester role for PWA validation.')).toBeVisible();
  await expect(page.getByText('This activity is read-only for your account.')).toBeVisible();
  await expect(page.getByRole('button',{name:/Assign to team|Manage subtasks|Reject and close/})).toHaveCount(0);
  await expect(page.getByRole('button',{name:/upload|cancel|abort/i})).toHaveCount(0);
  await expect(page.getByLabel(/process id/i)).toHaveCount(0);
});

test('New Request uses the resolved Requester and live Opening choices without writing',async({page})=>{
  await login(page);
  await page.getByRole('button',{name:'New request',exact:true}).click();
  await expect(page.getByRole('heading',{name:'New request',exact:true})).toBeVisible();
  await expect(page.getByLabel('Requester',{exact:true})).toHaveValue(/Test Requester/);
  await expect(page.getByRole('combobox',{name:'Type',exact:true}).getByRole('option')).toHaveCount(4);
  await expect(page.getByRole('combobox',{name:'Priority',exact:true}).getByRole('option')).toHaveCount(5);
  await expect(page.getByRole('button',{name:'Submit request',exact:true})).toBeVisible();
});
