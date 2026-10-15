import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: process.env['CI'] ? 1 : 0,
  workers: 1, // tests share one mock server whose rate is global
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4200', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel: process.env['PW_CHANNEL'] || undefined } }],
  webServer: [
    { command: 'npm run mock', url: 'http://localhost:4310/health', reuseExistingServer: !process.env['CI'] },
    { command: 'npx ng serve --port 4200', url: 'http://localhost:4200', reuseExistingServer: !process.env['CI'], timeout: 120_000 },
  ],
});
