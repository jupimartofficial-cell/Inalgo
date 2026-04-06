import { expect, test, type Page } from '@playwright/test';

async function stubPostLoginApis(page: Page) {
  await page.route('**/api/v1/admin/migrations/jobs', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route('**/api/v1/admin/migrations/status*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route('**/api/v1/admin/historical-data*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: [],
        totalElements: 0,
        totalPages: 0,
        number: 0,
        size: 50,
      }),
    });
  });

  await page.route('**/api/v1/admin/upstox/token', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ configured: true, updatedAt: new Date().toISOString() }),
    });
  });

  await page.route('**/api/v1/admin/trading/preferences*', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ username: 'admin', preferences: null, updatedAt: null }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ username: 'admin', preferences: null, updatedAt: new Date().toISOString() }),
    });
  });
}

test.describe('Login UI flow', () => {
  test('requires tenant id before sign-in', async ({ page }) => {
    await stubPostLoginApis(page);
    await page.goto('/');

    await page.getByLabel('Tenant ID').fill('');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page.getByText('Tenant ID is required')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
  });

  test('requires username before sign-in', async ({ page }) => {
    await stubPostLoginApis(page);
    await page.goto('/');

    await page.getByLabel('Username').fill('');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page.getByText('Username is required')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
  });

  test('shows backend authentication error and stays on login screen', async ({ page }) => {
    await stubPostLoginApis(page);

    await page.route('**/api/v1/admin/login', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Invalid admin credentials' }),
      });
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page.getByText('Invalid admin credentials')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).not.toBeVisible();
  });

  test('supports Enter key submit, persists session on refresh, and clears session on logout', async ({ page }) => {
    await stubPostLoginApis(page);

    let loginCalls = 0;
    await page.route('**/api/v1/admin/login', async (route) => {
      loginCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: 'persisted-session-token' }),
      });
    });

    await page.goto('/');
    await page.getByLabel('Password').press('Enter');

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect.poll(() => loginCalls).toBe(1);

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).not.toBeVisible();
    await expect.poll(() => loginCalls).toBe(1);

    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
  });
});
