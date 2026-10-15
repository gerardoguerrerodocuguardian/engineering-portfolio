import { expect, test } from '@playwright/test';

test('browse -> product -> add to cart -> cart page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Audio' }).click();
  await expect(page).toHaveURL(/\/category\/audio$/);

  await page.getByRole('link', { name: 'Pebble Bluetooth Speaker' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Pebble Bluetooth Speaker' })).toBeVisible();

  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.getByTestId('cart-count')).toHaveText('1');
  await expect(page.getByRole('status').filter({ hasText: 'added to cart' })).toBeAttached();

  await page.getByTestId('cart-link').click();
  await expect(page.getByRole('row', { name: /Pebble Bluetooth Speaker/ })).toBeVisible();
});

test('search is server-rendered from the query string', async ({ page }) => {
  await page.goto('/search?q=headphones');
  await expect(page.getByRole('link', { name: 'Nimbus Over-Ear Headphones' })).toBeVisible();
});

test('robots and sitemap are served', async ({ request }) => {
  expect((await request.get('/robots.txt')).ok()).toBe(true);
  expect(await (await request.get('/sitemap.xml')).text()).toContain('/product/');
});
