import { expect, test } from '@playwright/test';

test('login, browse, optimistic pause, report, language switch', async ({ page }) => {
  await page.goto('/campaigns');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

  await page.getByLabel('Email').fill('ada@adflow.test');
  await page.getByLabel('Password').fill('adflow-demo');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('heading', { name: 'Campaigns' })).toBeVisible();
  const row = page.getByRole('row', { name: /Spring Launch/ });
  await expect(row).toContainText('Active');

  await row.getByRole('button', { name: /Pause/ }).click();
  await expect(row).toContainText('Paused');
  await expect(page.getByRole('status').filter({ hasText: 'Campaign updated.' })).toBeVisible();

  await row.getByRole('link', { name: /Report/ }).click();
  await expect(page.getByRole('heading', { name: 'Report for cmp-001' })).toBeVisible();
  await expect(page.getByText('Impressions')).toBeVisible();

  await page.getByLabel('Language').selectOption('es');
  await expect(page.getByRole('heading', { name: 'Reporte de cmp-001' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
});

test('session survives a reload via refresh token', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('ada@adflow.test');
  await page.getByLabel('Password').fill('adflow-demo');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Campaigns' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Campaigns' })).toBeVisible();
});

test('a failed create form shows accessible validation', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('ada@adflow.test');
  await page.getByLabel('Password').fill('adflow-demo');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('button', { name: 'Create campaign' }).click();
  await expect(page.getByText('Name must be between 3 and 120 characters.')).toBeVisible();
  await expect(page.getByLabel('Name', { exact: true })).toHaveAttribute('aria-invalid', 'true');
});
