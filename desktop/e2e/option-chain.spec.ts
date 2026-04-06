import { expect, test } from '@playwright/test';

test('Option chain section loads expiries, shows rows, and triggers migration', async ({ page }) => {
  await page.route('**/api/v1/admin/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'option-chain-token' }),
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

  await page.route('**/api/v1/admin/option-chain/expiries*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        underlyingKey: 'NSE_INDEX|Nifty 50',
        expiries: ['2026-03-26', '2026-04-30'],
      }),
    });
  });

  await page.route('**/api/v1/admin/option-chain/latest*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        underlyingKey: 'NSE_INDEX|Nifty 50',
        expiryDate: '2026-03-26',
        snapshotTs: new Date().toISOString(),
        underlyingSpotPrice: 22460.5,
        pcr: 1.12,
        syntheticFuturePrice: 22464.2,
        rows: [
          {
            strikePrice: 22400,
            callLtp: 188.2,
            callOi: 1600000,
            callPrevOi: 1400000,
            callVolume: 410000,
            callIv: 19.1,
            callOiChangePercent: 14.3,
            putLtp: 132.4,
            putOi: 2100000,
            putPrevOi: 1800000,
            putVolume: 370000,
            putIv: 20.4,
            putOiChangePercent: 16.7,
          },
          {
            strikePrice: 22450,
            callLtp: 155.5,
            callOi: 1450000,
            callPrevOi: 1210000,
            callVolume: 350000,
            callIv: 19.8,
            callOiChangePercent: 19.8,
            putLtp: 141.6,
            putOi: 1940000,
            putPrevOi: 1750000,
            putVolume: 330000,
            putIv: 20.9,
            putOiChangePercent: 10.8,
          },
        ],
      }),
    });
  });

  await page.route('**/api/v1/admin/option-chain/migrate-historical', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        results: [
          {
            underlyingKey: 'NSE_INDEX|Nifty 50',
            processedExpiries: 2,
            persistedRows: 120,
            failedExpiries: 0,
            errors: [],
          },
        ],
      }),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.getByRole('button', { name: 'Option Chain' }).click();

  await expect(page.getByRole('heading', { name: 'Option Chain' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '22,450' })).toBeVisible();
  await expect(page.getByText('Spot 22,460.50')).toBeVisible();

  await page.getByRole('button', { name: 'Migrate Historical' }).click();
  await expect(page.getByText('Migration done: 120 rows, 0 failed expiries')).toBeVisible();
});
