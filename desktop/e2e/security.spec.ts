import { expect, test } from '@playwright/test';

test('Frontend security regressions: CSP present, password not persisted, auth stays in headers', async ({ page }) => {
  const requestUrls: string[] = [];
  const mockPassword = `mock-${Date.now()}`;

  await page.route('**/api/v1/admin/login', async (route) => {
    requestUrls.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'security-token' }),
    });
  });

  await page.route('**/api/v1/admin/migrations/jobs', async (route) => {
    requestUrls.push(route.request().url());
    expect(route.request().headers().authorization).toBe('Bearer security-token');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.route('**/api/v1/admin/migrations/status*', async (route) => {
    requestUrls.push(route.request().url());
    expect(route.request().headers().authorization).toBe('Bearer security-token');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.route('**/api/v1/admin/upstox/token', async (route) => {
    requestUrls.push(route.request().url());
    expect(route.request().headers().authorization).toBe('Bearer security-token');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ configured: true, updatedAt: new Date().toISOString() }),
    });
  });

  await page.route('**/api/v1/admin/historical-data*', async (route) => {
    requestUrls.push(route.request().url());
    expect(route.request().headers().authorization).toBe('Bearer security-token');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 50 }),
    });
  });

  await page.route('**/api/v1/admin/trading/preferences*', async (route) => {
    requestUrls.push(route.request().url());
    expect(route.request().headers().authorization).toBe('Bearer security-token');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ username: 'admin', preferences: null, updatedAt: null }),
    });
  });

  await page.goto('/');
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute('content', /object-src 'none'/);
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).not.toHaveAttribute('content', /frame-ancestors/);

  await page.getByLabel('Password').fill(mockPassword);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  const storedSession = await page.evaluate(() => window.sessionStorage.getItem('inalgo_admin_session_v1'));
  expect(storedSession ?? '').not.toContain(mockPassword);

  for (const url of requestUrls) {
    expect(url).not.toContain('security-token');
  }
});
