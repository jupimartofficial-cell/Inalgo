import { expect, test } from '@playwright/test';

test('Intra routes support build, monitor, and pnl analytics flows', async ({ page }) => {
  const strategyName = 'Nifty Intraday Momentum';

  const strategyPayload = {
    strategyName,
    underlyingKey: 'NSE_INDEX|Nifty 50',
    underlyingSource: 'FUTURES',
    strategyType: 'INTRADAY',
    entryTime: '09:35',
    exitTime: '15:15',
    startDate: '2026-03-20',
    endDate: '2026-03-23',
    legs: [{ id: 'leg-1', segment: 'OPTIONS', lots: 1, position: 'BUY', optionType: 'CALL', expiryType: 'WEEKLY', strikeType: 'ATM', strikeSteps: 0 }],
    legwiseSettings: { squareOffMode: 'PARTIAL', trailSlToBreakEven: false, trailScope: 'ALL_LEGS', noReEntryAfterEnabled: false, overallMomentumEnabled: false },
    overallSettings: { stopLossEnabled: true, stopLossValue: 20, targetEnabled: false, trailingEnabled: false },
    advancedConditions: { enabled: false, entry: null, exit: null },
  };

  const libraryItem = {
    id: 11,
    strategyName,
    instrumentKey: 'NSE_INDEX|Nifty 50',
    timeframeUnit: 'minutes',
    timeframeInterval: 5,
    strategyType: 'INTRADAY',
    status: 'LIVE_READY',
    lastModifiedAt: '2026-03-23T04:10:00.000Z',
    creator: 'admin',
    version: 3,
    paperEligible: true,
    liveEligible: true,
    latestPerformancePnl: 3250.5,
    latestExecutedTrades: 18,
  };

  const latestVersion = {
    id: 31,
    strategyId: 11,
    version: 3,
    advancedMode: false,
    timeframeUnit: 'minutes',
    timeframeInterval: 5,
    strategy: strategyPayload,
    validation: { valid: true, paperEligible: true, liveEligible: true, fieldErrors: [], summaryErrors: [], warnings: [] },
    createdAt: '2026-03-23T04:05:00.000Z',
    validatedAt: '2026-03-23T04:06:00.000Z',
  };

  const executionResponse = {
    id: 91,
    username: 'admin',
    strategyId: 11,
    mode: 'PAPER',
    status: 'COMPLETED',
    strategyName,
    scanInstrumentKey: 'NSE_INDEX|Nifty 50',
    scanTimeframeUnit: 'minutes',
    scanTimeframeInterval: 5,
    totalPnl: 425.75,
    executedTrades: 1,
    evaluatedAt: '2026-03-23T04:15:00.000Z',
    statusMessage: 'Paper run completed successfully',
    createdAt: '2026-03-23T04:10:00.000Z',
    updatedAt: '2026-03-23T04:15:00.000Z',
    strategy: strategyPayload,
    result: { strategy: strategyPayload, rows: [], totalPnl: 425.75, averagePnl: 425.75, executedTrades: 1, winTrades: 1, lossTrades: 0, syncedInstruments: 1, syncedCandles: 24, realWorldAccuracyPct: 100, marketPricedTrades: 1, fallbackPricedTrades: 0, notes: [] },
  };

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
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [libraryItem], totalElements: 1, totalPages: 1, number: 0, size: 10 }) });
  });
  await page.route('**/api/v1/admin/intra-strategies/11/versions*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([latestVersion]) });
  });
  await page.route('**/api/v1/admin/intra-trade/trend-check', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ hasConflict: false, strategyBias: 'BULL', currentTrend: 'BUY', message: '' }) });
  });
  await page.route('**/api/v1/admin/intra-trade/run', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(executionResponse) });
  });
  await page.route('**/api/v1/admin/intra-trade/executions/91/refresh*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(executionResponse) });
  });
  await page.route('**/api/v1/admin/intra-trade/executions*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [executionResponse], totalElements: 1, totalPages: 1, number: 0, size: 20 }) });
  });
  await page.route('**/api/v1/admin/intra-trade/monitor/market-summary*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ marketTrend: 'UPTREND', sessionStatus: 'Open', refreshedAt: '2026-03-23T04:15:00.000Z', stale: false, freshnessSeconds: 8, indexValues: [{ instrumentKey: 'NSE_INDEX|Nifty 50', label: 'Nifty 50', value: 23164.25, valueTs: '2026-03-23T04:15:00.000Z' }] }),
    });
  });
  await page.route('**/api/v1/admin/intra-trade/monitor/runtimes*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: [{ runtimeId: 201, executionId: 91, strategyId: 11, strategyName, instrument: 'NSE_INDEX|Nifty 50', mode: 'LIVE', status: 'WAITING', entryTime: '2026-03-23T04:05:00.000Z', currentSignal: 'BUY', currentMtm: 425.75, slState: 'Active', targetState: 'Disabled', nextExpectedAction: 'Monitor entry', refreshedAt: '2026-03-23T04:15:00.000Z', freshnessSeconds: 8 }],
        totalElements: 1,
        totalPages: 1,
        number: 0,
        size: 50,
      }),
    });
  });
  await page.route('**/api/v1/admin/intra-trade/monitor/positions*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ content: [{ positionId: 401, runtimeId: 201, executionId: 91, instrument: 'NSE_INDEX|Nifty 50', quantityLots: 1, entryPrice: 23120.5, currentPrice: 23164.25, unrealizedPnl: 425.75, realizedPnl: 0, strategyName, status: 'OPEN', manualWatch: false, mode: 'LIVE', updatedAt: '2026-03-23T04:15:00.000Z' }], totalElements: 1, totalPages: 1, number: 0, size: 50 }),
    });
  });
  await page.route('**/api/v1/admin/intra-trade/monitor/events*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ content: [{ id: 501, eventTime: '2026-03-23T04:15:00.000Z', eventType: 'POSITION_ENTERED', severity: 'INFO', mode: 'LIVE', message: 'Position entered from intra monitor run', reason: 'Run execution', actor: 'admin', runtimeId: 201, positionId: 401, correlationId: 'corr-501' }], totalElements: 1, totalPages: 1, number: 0, size: 100 }),
    });
  });
  await page.route('**/api/v1/admin/market-watch/config*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ username: 'admin', config: { refreshIntervalSeconds: 30, gridColumns: 2, tiles: [{ id: 'signal-tile', title: 'Nifty signal', source: 'TRADING_SIGNAL', instrumentKey: 'NSE_INDEX|Nifty 50', timeframeUnit: 'minutes', timeframeInterval: 5, primaryField: 'signal' }] }, updatedAt: new Date().toISOString() }) });
  });
  await page.route('**/api/v1/admin/market-watch/data*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ fetchedAt: new Date().toISOString(), tiles: [{ tileId: 'signal-tile', source: 'TRADING_SIGNAL', primaryField: 'signal', primaryLabel: 'Signal', primaryValue: 'BUY', statusLabel: 'BUY', statusTone: 'positive', updatedAt: '23 Mar 2026, 09:45', fields: [{ key: 'currentClose', label: 'Current Close', value: '23164.25', tone: 'positive' }] }] }) });
  });
  await page.route('**/api/v1/admin/intra-trade/pnl/dashboard*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ summary: { totalPnl: 425.75, todayPnl: 425.75, realizedPnl: 0, unrealizedPnl: 425.75, winRate: 100, avgGain: 425.75, avgLoss: 0, maxDrawdown: 0 }, dailyTrend: [{ date: '2026-03-23', value: 425.75, mode: 'PAPER' }], cumulative: [{ date: '2026-03-23', value: 425.75, mode: 'PAPER' }], strategyPerformance: [{ strategyName, numberOfTrades: 1, winRate: 100, totalPnl: 425.75, avgTrade: 425.75, maxWin: 425.75, maxLoss: 425.75, drawdown: 0, paperTrades: 1, liveTrades: 0 }], tradeLedger: [{ executionId: 91, date: '2026-03-23', time: '09:45', instrument: 'NSE_INDEX|Nifty 50', strategy: strategyName, tradeMode: 'PAPER', entry: null, exit: null, quantity: 1, pnl: 425.75, exitReason: 'strategy exit', duration: '00:10', status: 'OPEN', account: 'local-desktop:admin' }] }) });
  });
  await page.route('**/api/v1/admin/intra-trade/pnl/export*', async (route) => {
    await route.fulfill({ status: 200, headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="intra-pnl-report.csv"' }, body: 'Date,Mode,Strategy\n2026-03-23,PAPER,Nifty Intraday Momentum\n' });
  });

  page.on('dialog', async (dialog) => {
    await dialog.accept();
  });

  await page.goto('/intra/strategies');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/intra\/strategies$/);
  await expect(page.getByRole('heading', { name: 'Intra Strategies' })).toBeVisible();

  const strategyRow = page.getByRole('row', { name: new RegExp(strategyName) });
  await strategyRow.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByRole('textbox', { name: 'Strategy name', exact: true })).toHaveValue(strategyName);
  await page.getByRole('button', { name: 'Open Intra Monitor' }).click();

  await expect(page).toHaveURL(/\/intra\/monitor$/);
  await expect(page.getByRole('tab', { name: 'Quick Test' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Live Monitor' })).toBeVisible();
  await expect(page.getByText('Saved Strategies')).toBeVisible();
  await expect(page.getByText('Market Status')).toBeVisible();
  await expect(page.getByRole('button', { name: /Nifty Intraday Momentum Open/ })).toBeVisible();

  await page.getByRole('button', { name: /Nifty Intraday Momentum Open/ }).click();
  await page.getByRole('button', { name: 'Run Paper Test' }).nth(1).click();
  await expect(page.getByText('Run started', { exact: true })).toBeVisible();
  await expect(page.getByText('Paper Validation Runs')).toBeVisible();

  await page.getByRole('button', { name: 'View P&L' }).first().click();

  await expect(page).toHaveURL(/\/intra\/pnl$/);
  await expect(page.getByRole('heading', { name: 'Intra P&L' })).toBeVisible();
  await expect(page.getByText('Strategy Performance')).toBeVisible();
  await expect(page.getByRole('cell', { name: strategyName }).first()).toBeVisible();
  await expect(page.getByRole('cell').filter({ hasText: '426' }).first()).toBeVisible();

  const downloadPromise = page.waitForResponse((response) => response.url().includes('/api/v1/admin/intra-trade/pnl/export'));
  await page.getByRole('button', { name: 'CSV' }).click();
  await downloadPromise;

  await page.screenshot({ path: 'test-results/intra-routes-monitor-pnl.png', fullPage: true });
});

test('E2E-01: Intra Trade navigation supports direct deep links and three child modules', async ({ page }) => {
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
  await page.route('**/api/v1/admin/intra-trade/executions*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 }) });
  });
  await page.route('**/api/v1/admin/intra-trade/monitor/market-summary*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ marketTrend: 'UPTREND', sessionStatus: 'Closed', refreshedAt: new Date().toISOString(), stale: false, freshnessSeconds: 60, indexValues: [] }) });
  });
  await page.route('**/api/v1/admin/intra-trade/monitor/runtimes*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 50 }) });
  });
  await page.route('**/api/v1/admin/intra-trade/monitor/positions*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 50 }) });
  });
  await page.route('**/api/v1/admin/intra-trade/monitor/events*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 100 }) });
  });
  await page.route('**/api/v1/admin/intra-trade/pnl/dashboard*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ summary: { totalPnl: 0, todayPnl: 0, realizedPnl: 0, unrealizedPnl: 0, winRate: 0, avgGain: 0, avgLoss: 0, maxDrawdown: 0 }, dailyTrend: [], cumulative: [], strategyPerformance: [], tradeLedger: [] }) });
  });
  await page.route('**/api/v1/admin/market-watch/config*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ username: 'admin', config: { refreshIntervalSeconds: 30, gridColumns: 2, tiles: [] }, updatedAt: new Date().toISOString() }) });
  });
  await page.route('**/api/v1/admin/market-watch/data*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ fetchedAt: new Date().toISOString(), tiles: [] }) });
  });

  await page.goto('/backtest/pnl#/intra/monitor');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/intra\/monitor$/);
  await expect(page.getByRole('tab', { name: 'Quick Test' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Live Monitor' })).toBeVisible();

  const tradingGroupList = page
    .getByRole('list')
    .filter({ has: page.getByRole('button', { name: 'Intra Strategies', exact: true }) })
    .first();
  await expect(tradingGroupList.getByRole('button', { name: 'Intra Strategies', exact: true })).toBeVisible();
  await expect(tradingGroupList.getByRole('button', { name: 'Intra Monitor', exact: true })).toBeVisible();
  await expect(tradingGroupList.getByRole('button', { name: 'Intra P&L', exact: true })).toBeVisible();

  await tradingGroupList.getByRole('button', { name: 'Intra Strategies', exact: true }).click();
  await expect(page).toHaveURL(/\/intra\/strategies$/);
  await expect(page.getByRole('heading', { name: 'Intra Strategies' })).toBeVisible();

  await tradingGroupList.getByRole('button', { name: 'Intra P&L', exact: true }).click();
  await expect(page).toHaveURL(/\/intra\/pnl$/);
  await expect(page.getByRole('heading', { name: 'Intra P&L' })).toBeVisible();
  await expect(page.getByText('Intra Workspace')).toBeVisible();
});
