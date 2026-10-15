import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  workers: 1, // tests share one sync server
  retries: process.env['CI'] ? 1 : 0,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure', serviceWorkers: 'allow' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], channel: process.env['PW_CHANNEL'] || undefined } },
  ],
  // Production build (the service worker only exists there) + the real sync server.
  webServer: [
    { command: 'npx tsx server/index.ts', url: 'http://127.0.0.1:8787/health', reuseExistingServer: !process.env['CI'] },
    { command: 'npm run build && npx vite preview --host 127.0.0.1', url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env['CI'], timeout: 180_000 },
  ],
});
