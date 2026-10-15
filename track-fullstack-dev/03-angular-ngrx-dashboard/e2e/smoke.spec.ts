import { expect, test } from '@playwright/test';

test.beforeEach(async ({ request }) => {
  await request.post('http://localhost:3001/__reset');
});

test('list -> create -> see it in the list', async ({ page }) => {
  // Guarded route redirects anonymous users to login, then returns after sign in.
  await page.goto('/campaigns');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue as demo advertiser' }).click();

  await expect(page.getByRole('heading', { name: 'Campaigns' })).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(10);

  await page.getByRole('link', { name: 'New campaign' }).click();
  // Client-side validation blocks an empty submit and shows an error summary.
  await page.getByRole('button', { name: 'Save campaign' }).click();
  await expect(page.getByRole('alert')).toContainText('Name: is required.');

  const name = `E2E smoke campaign ${Date.now()}`;
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Daily budget (cents)').fill('12345');
  await page.getByLabel('Max bid (cents)').fill('77');
  await page.getByLabel('Keywords').fill('e2e, smoke');
  await page.getByRole('button', { name: 'Save campaign' }).click();

  await expect(page.getByRole('heading', { name: 'Campaigns' })).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(name) })).toBeVisible();

  // Report view renders the accessible chart.
  await page.getByRole('link', { name: `Report for ${name}` }).click();
  await expect(page.getByRole('img', { name: 'Impressions versus clicks' })).toBeVisible();
});
