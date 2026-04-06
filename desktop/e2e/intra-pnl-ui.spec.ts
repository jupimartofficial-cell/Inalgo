import { expect, test } from '@playwright/test';

test('Intra P&L trader-friendly sections render with status strip and sortable ledger', async ({ page }) => {
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
  await page.route('**/api/v1/admin/intra-trade/pnl/dashboard*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        summary: { totalPnl: 300, todayPnl: 120, realizedPnl: 80, unrealizedPnl: -40, winRate: 67, avgGain: 150, avgLoss: -75, maxDrawdown: 90 },
        dailyTrend: [{ date: '2026-03-24', value: -40, mode: 'LIVE' }, { date: '2026-03-25', value: 120, mode: 'PAPER' }],
        cumulative: [{ date: '2026-03-24', value: -40, mode: 'LIVE' }, { date: '2026-03-25', value: 80, mode: 'PAPER' }],
        strategyPerformance: [
          { strategyName: 'A Strategy', numberOfTrades: 5, winRate: 60, totalPnl: 500, avgTrade: 100, maxWin: 220, maxLoss: -80, drawdown: 90, paperTrades: 5, liveTrades: 0 },
          { strategyName: 'B Strategy', numberOfTrades: 3, winRate: 33, totalPnl: -200, avgTrade: -66, maxWin: 90, maxLoss: -140, drawdown: 220, paperTrades: 0, liveTrades: 3 },
        ],
        tradeLedger: [
          { executionId: 11, date: '2026-03-25', time: '09:40', instrument: 'NSE_INDEX|Nifty 50', strategy: 'A Strategy', tradeMode: 'PAPER', entry: null, exit: null, quantity: 1, pnl: 500, exitReason: 'Target hit', duration: '00:20', status: 'CLOSED', account: 'local-desktop:admin' },
          { executionId: 12, date: '2026-03-25', time: '09:45', instrument: 'NSE_INDEX|Nifty Bank', strategy: 'B Strategy', tradeMode: 'LIVE', entry: null, exit: null, quantity: 1, pnl: -200, exitReason: 'SL hit', duration: '00:05', status: 'OPEN', account: 'local-desktop:admin' },
        ],
      }),
    });
  });
  await page.route('**/api/v1/admin/intra-trade/pnl/export*', async (route) => {
    await route.fulfill({ status: 200, headers: { 'Content-Type': 'text/csv' }, body: 'Date,Mode\n2026-03-25,PAPER\n' });
  });
  await page.route('**/api/v1/admin/intra-trade/upstox/positions*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tenantId: 'local-desktop', positions: [], count: 0 }) });
  });
  await page.route('**/api/v1/admin/intra-trade/upstox/orders*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tenantId: 'local-desktop', orders: [], count: 0 }) });
  });

  await page.goto('/intra/pnl');
  await page.getByRole('button', { name: 'Sign In' }).click();

  await expect(page.getByRole('heading', { name: 'Intra P&L' })).toBeVisible();
  await expect(page.getByTestId('intra-pnl-status-strip')).toBeVisible();
  await expect(page.getByTestId('intra-pnl-active-filters')).toContainText('Range: Month');
  await expect(page.getByTestId('intra-pnl-quick-presets')).toContainText('Today');
  await expect(page.getByTestId('intra-pnl-filters-active-chips')).toContainText('Range: Month');

  await page.getByTestId('intra-pnl-filters-header').getByRole('button', { name: /collapse filters/i }).click();
  await expect(page.getByTestId('intra-pnl-filters-active-chips')).toBeHidden();
  await page.getByTestId('intra-pnl-filters-header').getByRole('button', { name: /expand filters/i }).click();
  await expect(page.getByTestId('intra-pnl-filters-active-chips')).toBeVisible();

  await page.getByTestId('intra-pnl-ledger-card').getByText('P&L').click();
  const firstRow = page.getByTestId('intra-pnl-ledger-card').locator('tbody tr').first();
  await expect(firstRow).toContainText('A Strategy');
  const stickyPosition = await page.getByTestId('intra-pnl-ledger-card').locator('thead').evaluate((element) => getComputedStyle(element).position);
  expect(stickyPosition).toBe('sticky');

  await page.getByTestId('intra-pnl-tab-upstox').click();
  await expect(page.getByTestId('intra-pnl-upstox-tab')).toBeVisible();
});
