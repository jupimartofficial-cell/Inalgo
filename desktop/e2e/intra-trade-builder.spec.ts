import { expect, test } from '@playwright/test';

test('E2E-02/03: Basic mode hides advanced conditions, Advanced mode shows them', async ({ page }) => {
  await page.route('**/api/v1/admin/login', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: 'mock-token' }) });
  });
  await page.route('**/api/v1/admin/migrations/jobs', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
  await page.route('**/api/v1/admin/migrations/status*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
  await page.route('**/api/v1/admin/trading/preferences*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ username: 'admin', preferences: null }) });
  });
  await page.route('**/api/v1/admin/intra-strategies/library*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 10 }) });
  });

  await page.goto('/intra/strategies');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/intra\/strategies$/);

  await expect(page.getByText('Step 1: Basic setup')).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Step 2: Entry conditions')).toBeVisible();
  await expect(page.getByText('Basic mode uses time-based entry from Step 1')).toBeVisible();
  await expect(page.getByTestId('advanced-conditions-editor')).not.toBeVisible();

  await page.getByRole('checkbox', { name: 'Advanced mode' }).click();
  await expect(page.getByTestId('advanced-conditions-editor')).toBeVisible();
  await expect(page.getByText('Basic mode uses time-based entry from Step 1')).not.toBeVisible();

  await page.getByRole('checkbox', { name: 'Advanced mode' }).click();
  await expect(page.getByText('Basic mode uses time-based entry from Step 1')).toBeVisible();
  await expect(page.getByTestId('advanced-conditions-editor')).not.toBeVisible();
});
