import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: process.env.WEB_ADMIN_TEST_URL || 'http://127.0.0.1:5173',
    browserName: 'chromium',
    channel: process.env.PW_CHANNEL || 'chrome',
    headless: true,
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  reporter: [['list']],
  ...(process.env.WEB_ADMIN_TEST_URL
    ? {}
    : {
        webServer: {
          command: 'npm run dev -- --port 5173 --strictPort',
          url: 'http://127.0.0.1:5173',
          reuseExistingServer: true,
          timeout: 30000,
        },
      }),
});
