import { test, expect } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const APP_CONFIG = {
  name: 'hilton-kb-chat',
  plugins: [] as const,
};

interface PluginPage {
  navLabel: string;
  path: string;
  expectedTexts: string[];
}

const PLUGIN_PAGES: Record<string, PluginPage> = {
  analytics: {
    navLabel: 'Analytics',
    path: '/analytics',
    expectedTexts: ['SQL Query Result', 'Sales Data Filter'],
  },
  serving: {
    navLabel: 'Serving',
    path: '/serving',
    expectedTexts: ['Chat with a Databricks Model Serving endpoint.'],
  },
};

const enabledPages = Object.entries(PLUGIN_PAGES).filter(([key]) =>
  APP_CONFIG.plugins.includes(key as (typeof APP_CONFIG.plugins)[number]),
);

let testArtifactsDir: string;
let consoleLogs: string[] = [];
let consoleErrors: string[] = [];
let pageErrors: string[] = [];
let failedRequests: string[] = [];

test('smoke test - overview page loads', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Sales Compensation Hub' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Overview' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'My Comp' })).toBeVisible();
  await expect(page.getByText('Welcome to your sales earnings hub!')).toBeVisible();
});

test('smoke test - my compensation KPI page loads', async ({ page }) => {
  await page.goto('/my-compensation');
  await expect(page.getByRole('heading', { name: /My Commissions & Earnings/ })).toBeVisible();
});

test('smoke test - team performance page loads', async ({ page }) => {
  await page.goto('/team');
  await expect(page.getByRole('heading', { name: /Team Performance Hub/ })).toBeVisible();
});

test('smoke test - admin strategy console loads', async ({ page }) => {
  await page.goto('/admin-console');
  await expect(page.getByRole('heading', { name: /Strategy Control Room/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Data Model & Ingestion/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Semantic Metrics/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Scenario Modeler/ })).toBeVisible();
});

for (const [name, plugin] of enabledPages) {
  test(`smoke test - ${name} page loads`, async ({ page }) => {
    await page.goto(plugin.path);
    for (const text of plugin.expectedTexts) {
      await expect(page.getByText(text)).toBeVisible();
    }
  });
}

test.beforeEach(async ({ page }) => {
  // Clear localStorage to prevent test pollution
  await page.addInitScript(() => {
    window.localStorage.clear();
  });

  // Set default manager headers so standard page load tests bypass rep access controls
  await page.setExtraHTTPHeaders({
    'x-user-username': 'Vance',
  });

  consoleLogs = [];
  consoleErrors = [];
  pageErrors = [];
  failedRequests = [];

  testArtifactsDir = join(process.cwd(), '.smoke-test');
  mkdirSync(testArtifactsDir, { recursive: true });

  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    if (!text.trim() || /^%[osd]$/.test(text.trim())) return;
    const location = msg.location();
    const locationStr = location.url ? ` at ${location.url}:${location.lineNumber}:${location.columnNumber}` : '';
    consoleLogs.push(`[${type}] ${text}${locationStr}`);
    if (type === 'error') consoleErrors.push(`${text}${locationStr}`);
  });

  page.on('pageerror', (error) => {
    pageErrors.push(`Page error: ${error.message}\nStack: ${error.stack || 'No stack trace available'}`);
  });

  page.on('requestfailed', (request) => {
    failedRequests.push(`Failed request: ${request.url()} - ${request.failure()?.errorText}`);
  });
});

test.afterEach(async ({ page }, testInfo) => {
  const testName = testInfo.title.replace(/ /g, '-').toLowerCase();
  const screenshotPath = join(testArtifactsDir, `${testName}-app-screenshot.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const logsPath = join(testArtifactsDir, `${testName}-console-logs.txt`);
  writeFileSync(
    logsPath,
    [
      '=== Console Logs ===',
      ...consoleLogs,
      '\n=== Console Errors ===',
      ...consoleErrors,
      '\n=== Page Errors ===',
      ...pageErrors,
      '\n=== Failed Requests ===',
      ...failedRequests,
    ].join('\n'),
    'utf-8',
  );

  await page.close();
});

test('smoke test - sales representative has restricted access', async ({ page }) => {
  // Clear local storage prior to navigation to wipe any cached manager states
  await page.addInitScript(() => {
    window.localStorage.clear();
  });

  // Set representative headers to simulate Jason Morrison (Sales Rep)
  await page.setExtraHTTPHeaders({
    'x-user-username': 'Jason',
  });

  await page.goto('/');

  // Should see standard overview and sales earnings cards
  await expect(page.getByRole('heading', { name: 'Sales Compensation Hub' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Overview' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'My Comp' })).toBeVisible();

  // Should NOT see Manager navbar links
  await expect(page.locator('#nav-team')).not.toBeVisible();
  await expect(page.locator('#nav-admin-console')).not.toBeVisible();

  // Should NOT see Manager card links in overview grid
  await expect(page.locator('#overview-link-team')).not.toBeVisible();
  await expect(page.locator('#overview-link-admin-console')).not.toBeVisible();

  // Going directly to team page should show Access Restricted
  await page.goto('/team');
  await expect(page.getByRole('heading', { name: 'Access Restricted' })).toBeVisible();

  // Going directly to admin page should show Access Restricted
  await page.goto('/admin-console');
  await expect(page.getByRole('heading', { name: 'Access Restricted' })).toBeVisible();
});
