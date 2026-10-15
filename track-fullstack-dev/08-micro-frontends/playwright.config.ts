import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env['CI'] ? 1 : 0,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5170', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel: process.env['PW_CHANNEL'] || undefined } }],
  // Serves the built artifacts (run `npm run build` first) as three separate origins.
  webServer: { command: 'npm run serve', url: 'http://localhost:5172/adflow-reports.js', reuseExistingServer: !process.env['CI'], timeout: 30_000 },
});
