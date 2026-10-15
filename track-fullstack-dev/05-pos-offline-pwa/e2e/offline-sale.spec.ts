import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const SERVER = 'http://127.0.0.1:8787';
const serverSales = async (request: APIRequestContext) => (await request.get(`${SERVER}/sales`)).json() as Promise<Array<{ saleId: string; flags: Array<{ code: string }>; chargedCents: number }>>;

async function boot(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Add Notebook A5/ })).toBeVisible();
  // App shell must be installed before we cut the network.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
}

test('offline sale reaches the server exactly once after reconnecting', async ({ page, context, request }) => {
  const before = (await serverSales(request)).length;
  await boot(page);
  await expect(page.getByRole('status', { name: 'Connection status' })).toContainText('Online');

  await context.setOffline(true);
  // The shell itself loads from the service worker while offline.
  await page.reload();
  await expect(page.getByRole('status', { name: 'Connection status' })).toContainText('Offline');

  // Keyboard quick entry: quantity prefix + barcode.
  await page.getByLabel(/Scan or type/).fill('2*200000000001');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: /Add USB-C cable/ }).click();
  await expect(page.locator('#cart').getByText('Notebook A5, ruled')).toBeVisible();
  await page.getByRole('button', { name: /Pay cash/ }).click();

  const recent = page.getByTestId('recent-sales');
  await expect(recent.getByText('Waiting to sync')).toHaveCount(1);
  await expect(page.getByRole('status', { name: 'Connection status' })).toContainText('1 to sync');
  expect((await serverSales(request)).length).toBe(before); // nothing leaked while offline

  await context.setOffline(false);
  await expect(recent.getByText('Synced', { exact: true })).toHaveCount(1, { timeout: 20_000 });
  await expect(page.getByRole('status', { name: 'Connection status' })).toContainText('0 to sync');

  // Hammer manual retry: idempotency keys keep the server at exactly one copy.
  await page.getByRole('button', { name: 'Retry sync' }).click();
  await page.getByRole('button', { name: 'Retry sync' }).click();
  await page.waitForTimeout(500);
  const after = await serverSales(request);
  expect(after.length).toBe(before + 1);
  expect(new Set(after.map((s) => s.saleId)).size).toBe(after.length);
  expect(after.at(-1)?.chargedCents).toBe(2 * 450 + 899);
});

test('price changed while offline: sale syncs and is flagged, not lost', async ({ page, context, request }) => {
  const money = (c: number) => `\\$${(c / 100).toFixed(2).replace('.', '\\.')}`;
  const cat = (await (await request.get(`${SERVER}/catalog`)).json()) as { items: Array<{ sku: string; priceCents: number }> };
  const oldPrice = cat.items.find((i) => i.sku === 'AF-1002')!.priceCents;
  const newPrice = oldPrice + 5;

  await boot(page);
  await context.setOffline(true);
  await page.getByRole('button', { name: /Add Gel pen/ }).click();
  await page.getByRole('button', { name: /Pay cash/ }).click();
  await request.post(`${SERVER}/admin/prices`, { data: { sku: 'AF-1002', priceCents: newPrice } });
  await context.setOffline(false);
  const recent = page.getByTestId('recent-sales');
  await expect(recent.getByText('Synced, needs review')).toHaveCount(1, { timeout: 20_000 });
  await expect(recent.getByText(new RegExp(`AF-1002: price is now ${money(newPrice)} \\(charged ${money(oldPrice)}\\)`))).toBeVisible();
  // The new price then reaches the till (delta pull / push).
  await expect(page.getByRole('button', { name: new RegExp(`Add Gel pen, blue, ${money(newPrice)}`) })).toBeVisible({ timeout: 20_000 });
  expect((await serverSales(request)).some((s) => s.flags.some((f) => f.code === 'price_changed'))).toBe(true);
});
