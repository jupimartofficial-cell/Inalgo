import { expect, test } from '@playwright/test';

const fieldLabels: Record<string, string> = {
  signal: 'Signal',
  currentClose: 'Current Close',
  dma26: 'DMA 26',
  gapType: 'Gap Type',
  closePrice: 'Close',
};

test('Market Watch supports chosen columns and tile reordering', async ({ page }) => {
  let savedConfig = {
    refreshIntervalSeconds: 60,
    gridColumns: 2,
    tiles: [
      {
        id: 'signal-tile',
        title: 'Signal tile',
        source: 'TRADING_SIGNAL',
        instrumentKey: 'NSE_INDEX|Nifty 50',
        timeframeUnit: 'minutes',
        timeframeInterval: 15,
        primaryField: 'signal',
      },
      {
        id: 'param-tile',
        title: 'Param tile',
        source: 'TRADING_PARAM',
        instrumentKey: 'NSE_INDEX|Nifty Bank',
        primaryField: 'gapType',
      },
    ],
  };

  await page.route('**/api/v1/admin/login', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: 'mock-token' }) });
  });

  await page.route('**/api/v1/admin/migrations/jobs', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.route('**/api/v1/admin/migrations/status*', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.route('**/api/v1/admin/market-watch/config*', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ username: 'admin', config: savedConfig, updatedAt: new Date().toISOString() }),
      });
      return;
    }

    const payload = route.request().postDataJSON() as { config: typeof savedConfig };
    savedConfig = payload.config;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ username: 'admin', config: savedConfig, updatedAt: new Date().toISOString() }),
    });
  });

  await page.route('**/api/v1/admin/market-watch/data*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        fetchedAt: new Date().toISOString(),
        tiles: savedConfig.tiles.map(tile => ({
          tileId: tile.id,
          source: tile.source,
          primaryField: tile.primaryField,
          primaryLabel: fieldLabels[tile.primaryField] ?? tile.primaryField,
          primaryValue: tile.primaryField === 'dma26' ? '23,199.35' : tile.primaryField === 'gapType' ? 'Gap Down' : 'SELL',
          statusLabel: tile.source === 'TRADING_PARAM' ? 'Gap Down' : 'SELL',
          statusTone: tile.source === 'TRADING_PARAM' ? 'negative' : 'negative',
          updatedAt: '22 Mar 2026, 10:05',
          fields: [
            { key: 'supporting', label: 'Support', value: 'Loaded', tone: 'neutral' },
          ],
        })),
      }),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.getByRole('button', { name: 'Market Signals' }).click();
  await page.getByRole('button', { name: 'Market Watch' }).click();

  await expect(page.getByRole('heading', { name: 'Market Watch' })).toBeVisible();
  await expect(page.getByText('Signal tile')).toBeVisible();
  await expect(page.getByText('Param tile')).toBeVisible();

  await page.getByLabel('Edit tile').first().click();
  const dialog = page.getByRole('dialog', { name: 'Edit Market Watch Tile' });
  await dialog.getByRole('combobox').nth(3).click();
  await page.getByRole('option', { name: 'DMA 26' }).click();
  await dialog.getByRole('button', { name: 'Update Tile' }).click();
  await page.getByRole('button', { name: 'Save Layout' }).click();

  await expect.poll(() => savedConfig.tiles[0]?.primaryField).toBe('dma26');
  await expect(page.getByText('DMA 26')).toBeVisible();

  await page.getByLabel('Move tile later').first().click();
  await page.getByRole('button', { name: 'Save Layout' }).click();

  await expect.poll(() => savedConfig.tiles[0]?.id).toBe('param-tile');
  await expect(page.locator('[data-testid="market-watch-tile-param-tile"]')).toBeVisible();
});
