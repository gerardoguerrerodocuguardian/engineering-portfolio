import { defineConfig } from '@playwright/test';

// PW_CHANNEL=chrome uses the locally installed Chrome (no browser download needed).
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5173', channel: process.env.PW_CHANNEL || undefined, trace: 'retain-on-failure' },
  webServer: {
    // The dev server loads .env.development (VITE_MOCKS=true): the browser talks to MSW, no backend needed.
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
