import { expect, test } from '@playwright/test';

const SERVER = 'http://localhost:4310';
const num = async (loc: import('@playwright/test').Locator) => Number((await loc.innerText()).replace(/[^0-9.]/g, ''));

test.beforeEach(async ({ request, page }) => {
  await request.post(`${SERVER}/rate`, { data: { eps: 200 } });
  await page.goto('/');
  await expect(page.getByTestId('status')).toHaveAttribute('data-state', 'open');
});

test('streams events, aggregates in the worker and renders the lazily loaded panels', async ({ page }) => {
  await expect.poll(() => num(page.getByTestId('received'))).toBeGreaterThan(100);
  await expect(page.getByRole('heading', { name: /CTR per campaign/ })).toBeVisible(); // @defer block resolved
  await expect(page.locator('app-campaign-chart tbody tr').first()).toContainText('cmp-');
  await expect.poll(() => num(page.getByTestId('eps')), { timeout: 15_000 }).toBeGreaterThan(50);
});

test('pause/resume is keyboard operable and freezes the display', async ({ page }) => {
  const pause = page.getByTestId('pause');
  await pause.focus();
  await page.keyboard.press('Enter');
  await expect(pause).toHaveAttribute('aria-pressed', 'true');
  const frozen = await page.getByTestId('row-count').innerText();
  await page.waitForTimeout(800);
  expect(await page.getByTestId('row-count').innerText()).toBe(frozen);
  await page.keyboard.press('p'); // global shortcut (focus is on a button, not a form field)
  await expect(pause).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(async () => page.getByTestId('row-count').innerText()).not.toBe(frozen);
});

test('filters by event type', async ({ page }) => {
  await page.getByTestId('rate').selectOption('5000'); // clicks are ~3% of events: make sure some arrive
  await page.getByTestId('type-filter').selectOption('CLICK');
  await expect(page.locator('cdk-virtual-scroll-viewport [data-type="CLICK"]').first()).toBeVisible();
  await page.getByTestId('pause').click(); // freeze so the assertion is stable
  await expect(page.locator('cdk-virtual-scroll-viewport [data-type="IMPRESSION"]')).toHaveCount(0);
});

test('reconnects with backoff after the server drops the connection', async ({ page, request }) => {
  await request.post(`${SERVER}/admin/drop`);
  await expect(page.getByTestId('status')).toHaveAttribute('data-state', 'reconnecting');
  await expect(page.getByTestId('status')).toHaveAttribute('data-state', 'open', { timeout: 15_000 });
});

test('works over server-sent events too', async ({ page }) => {
  await page.getByTestId('transport').selectOption('sse');
  await expect(page.getByTestId('status')).toContainText('server-sent events');
  const before = await num(page.getByTestId('received'));
  await expect.poll(() => num(page.getByTestId('received'))).toBeGreaterThan(before + 100);
});

test('dark mode toggles and persists', async ({ page }) => {
  await page.getByTestId('theme').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('fills a 100k-row log while keeping the DOM small (virtual scrolling)', async ({ page }) => {
  test.setTimeout(90_000);
  await page.getByTestId('rate').selectOption('20000');
  await expect(page.getByTestId('log-size')).toContainText('100,000 / 100,000', { timeout: 60_000 });
  await expect.poll(() => num(page.getByTestId('row-count'))).toBe(100000);
  const rendered = await page.locator('cdk-virtual-scroll-viewport .row').count();
  expect(rendered).toBeGreaterThan(0);
  expect(rendered).toBeLessThan(60);
});
