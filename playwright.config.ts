import { defineConfig, devices } from '@playwright/test';

/** Dedicated port so smoke tests do not attach to another process on 8000. */
const testPort =
  process.env.PW_TEST_PORT ||
  process.env.DATABRICKS_APP_PORT ||
  process.env.PORT ||
  '8095';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: `http://localhost:${testPort}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // No `tsx watch` — faster cold start for CI / `databricks apps validate`.
    command: 'npm run dev:smoke',
    url: `http://localhost:${testPort}`,
    // AppKit reads DATABRICKS_APP_PORT (not PORT) for the dev server bind address.
    // VITE_CLIENT_PORT aligns HMR websocket with the app port (avoids stray 24678 conflicts).
    env: {
      ...process.env,
      DATABRICKS_APP_PORT: testPort,
      VITE_CLIENT_PORT: testPort,
    },
    reuseExistingServer: true,
    timeout: 240 * 1000,
  },
});
