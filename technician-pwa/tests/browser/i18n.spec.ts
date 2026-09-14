import { test, expect } from '@playwright/test';
// Pure client-side UI check: no openMAINT credentials or live server data required.
test('language selector switches the UI and persists the choice across reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Se connecter', exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'FR', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Connexion', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Se connecter', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('cmms-locale'))).toBe('fr');

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Connexion', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('cmms-locale'))).toBe('en');

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
});
