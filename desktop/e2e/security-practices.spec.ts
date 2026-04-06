import { expect, test } from '@playwright/test';

test('Security practices: login request keeps auth data out of URL and sends tenant header', async ({ page }) => {
  let loginTenantHeader: string | undefined;

  await page.route('**/api/v1/admin/login', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    expect(Array.from(url.searchParams.keys())).not.toContain('token');
    loginTenantHeader = request.headers()['x-tenant-id'];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'rate-limit-test-token' }),
    });
  });

  await page.route('**/api/v1/admin/migrations/jobs', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.route('**/api/v1/admin/migrations/status*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.route('**/api/v1/admin/upstox/token', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ configured: true, updatedAt: new Date().toISOString() }),
    });
  });

  await page.route('**/api/v1/admin/historical-data*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 50 }),
    });
  });

  await page.route('**/api/v1/admin/trading/preferences*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ username: 'admin', preferences: null, updatedAt: null }),
    });
  });

  await page.goto('/');
  await page.getByLabel('Password').fill('mock-password-not-secret');
  await page.getByRole('button', { name: 'Sign In' }).click();

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  expect(loginTenantHeader).toBeTruthy();
});
