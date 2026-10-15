import { expect, test } from '@playwright/test';

test('loads the shell, signs in and opens both remotes; they communicate via the event bus', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Welcome to the AdFlow shell')).toBeVisible();
  await page.getByRole('button', { name: /Sign in/ }).click();

  await page.getByRole('link', { name: 'Campaigns' }).click();
  await expect(page.getByRole('heading', { name: 'Campaigns' })).toBeVisible();
  await expect(page.getByTestId('campaigns-user')).toHaveText('Demo Advertiser');
  await page.getByRole('button', { name: 'Select Spring Launch' }).click();
  await expect(page.getByTestId('selected')).toContainText('Spring Launch');

  await page.getByRole('link', { name: 'Reports' }).click();
  await expect(page.getByTestId('report-campaign')).toContainText('Spring Launch'); // web component, shadow DOM piercing
});

test('a remote that is down shows an isolated fallback; the shell and the other remote keep working', async ({ page }) => {
  await page.route('http://localhost:5172/adflow-reports.js', (r) => r.abort());
  await page.goto('/');
  await page.getByRole('button', { name: /Sign in/ }).click();

  await page.getByRole('link', { name: 'Reports' }).click();
  const fb = page.getByTestId('remote-fallback');
  await expect(fb).toContainText('Reports is temporarily unavailable');

  await page.getByRole('link', { name: 'Campaigns' }).click();
  await expect(page.getByRole('heading', { name: 'Campaigns' })).toBeVisible();
  await expect(fb).toHaveCount(0);
});

test('version skew is reported instead of crashing: a manifest requiring another React major', async ({ page }) => {
  await page.route('**/manifest.json', async (r) => {
    const m = await (await r.fetch()).json();
    m.remotes[0].requires.react = '^17.0.0';
    await r.fulfill({ json: m });
  });
  await page.goto('/');
  await page.getByRole('button', { name: /Sign in/ }).click();
  await page.getByRole('link', { name: 'Campaigns' }).click();
  await expect(page.getByTestId('remote-fallback')).toContainText('Reason: skew');
});

test('a Module Federation remote that is down is isolated too', async ({ page }) => {
  await page.route('http://localhost:5171/**', (r) => r.abort());
  await page.goto('/');
  await page.getByRole('button', { name: /Sign in/ }).click();
  await page.getByRole('link', { name: 'Campaigns' }).click();
  await expect(page.getByTestId('remote-fallback')).toContainText('Campaigns is temporarily unavailable');
  await page.getByRole('link', { name: 'Reports' }).click();
  await expect(page.getByTestId('report-empty')).toBeVisible();
});
