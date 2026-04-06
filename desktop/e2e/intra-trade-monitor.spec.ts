import { expect, test, type Page } from '@playwright/test';

type MockOptions = {
  promotionReady: boolean;
  runtimeStatus?: 'PAUSED' | 'WAITING' | 'ENTERED';
  includeArchivedStrategy?: boolean;
};

const strategyName = 'Nifty Intraday Momentum';

async function mockIntraMonitor(page: Page, options: MockOptions) {
  const runModes: string[] = [];
  const runtimeStatus = options.runtimeStatus ?? 'PAUSED';
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
    overallSettings: {
      stopLossEnabled: options.promotionReady,
      stopLossValue: options.promotionReady ? 20 : null,
      targetEnabled: false,
      trailingEnabled: false,
    },
    advancedConditions: { enabled: false, entry: null, exit: null },
  };

  const libraryItem = {
    id: 11,
    strategyName,
    instrumentKey: 'NSE_INDEX|Nifty 50',
    timeframeUnit: 'minutes',
    timeframeInterval: 5,
    strategyType: 'INTRADAY',
    status: options.promotionReady ? 'LIVE_READY' : 'PAPER_READY',
    lastModifiedAt: '2026-03-23T04:10:00.000Z',
    creator: 'admin',
    version: 3,
    paperEligible: true,
    liveEligible: options.promotionReady,
    latestPerformancePnl: 3250.5,
    latestExecutedTrades: 18,
  };
  const archivedLibraryItem = {
    ...libraryItem,
    id: 15,
    strategyName: 'Archived Legacy Strategy',
    status: 'ARCHIVED',
    paperEligible: false,
    liveEligible: false,
  };

  const executionList = options.promotionReady
    ? [{
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
        createdAt: '2026-03-23T04:10:00.000Z',
        updatedAt: '2026-03-23T04:15:00.000Z',
      }]
    : [];

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
    const content = options.includeArchivedStrategy ? [libraryItem, archivedLibraryItem] : [libraryItem];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ content, totalElements: content.length, totalPages: 1, number: 0, size: 100 }),
    });
  });
  await page.route('**/api/v1/admin/intra-strategies/11/versions*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{
        id: 31,
        strategyId: 11,
        version: 3,
        advancedMode: false,
        timeframeUnit: 'minutes',
        timeframeInterval: 5,
        strategy: strategyPayload,
        validation: { valid: true, paperEligible: true, liveEligible: options.promotionReady, fieldErrors: [], summaryErrors: [], warnings: [] },
        createdAt: '2026-03-23T04:05:00.000Z',
        validatedAt: '2026-03-23T04:06:00.000Z',
      }]),
    });
  });
  await page.route('**/api/v1/admin/intra-trade/executions*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: executionList, totalElements: executionList.length, totalPages: 1, number: 0, size: 20 }) });
  });
  await page.route('**/api/v1/admin/intra-trade/trend-check', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ hasConflict: false, strategyBias: 'BULL', currentTrend: 'BUY', message: '' }),
    });
  });
  await page.route('**/api/v1/admin/intra-trade/run', async (route) => {
    const body = route.request().postDataJSON() as { mode?: string };
    runModes.push(body.mode ?? 'UNKNOWN');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: body.mode === 'LIVE' ? 92 : 91,
        username: 'admin',
        strategyId: 11,
        mode: body.mode,
        status: body.mode === 'LIVE' ? 'WAITING_ENTRY' : 'COMPLETED',
        strategyName,
        scanInstrumentKey: 'NSE_INDEX|Nifty 50',
        scanTimeframeUnit: 'minutes',
        scanTimeframeInterval: 5,
        totalPnl: 425.75,
        executedTrades: 1,
        evaluatedAt: '2026-03-23T04:15:00.000Z',
        createdAt: '2026-03-23T04:10:00.000Z',
        updatedAt: '2026-03-23T04:15:00.000Z',
        strategy: strategyPayload,
        result: { totalPnl: 425.75, executedTrades: 1, rows: [], strategy: strategyPayload },
      }),
    });
  });
  await page.route('**/api/v1/admin/intra-trade/monitor/market-summary*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        marketTrend: 'UPTREND',
        sessionStatus: options.promotionReady ? 'Open' : 'Closed',
        refreshedAt: '2026-03-23T04:15:00.000Z',
        stale: !options.promotionReady,
        freshnessSeconds: 8,
        indexValues: [{ instrumentKey: 'NSE_INDEX|Nifty 50', label: 'Nifty 50', value: 23164.25, valueTs: '2026-03-23T04:15:00.000Z' }],
      }),
    });
  });
  await page.route('**/api/v1/admin/intra-trade/monitor/runtimes*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: [{
          runtimeId: 201,
          executionId: 92,
          strategyId: 11,
          strategyName,
          instrument: 'NSE_INDEX|Nifty 50',
          mode: 'LIVE',
          status: runtimeStatus,
          entryTime: '2026-03-23T04:05:00.000Z',
          currentSignal: 'BUY',
          currentMtm: 425.75,
          slState: 'Active',
          targetState: 'Disabled',
          nextExpectedAction: 'Monitor entry',
          refreshedAt: '2026-03-23T04:15:00.000Z',
          freshnessSeconds: 8,
        }],
        totalElements: 1,
        totalPages: 1,
        number: 0,
        size: 5,
      }),
    });
  });
  await page.route('**/api/v1/admin/intra-trade/monitor/positions*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: [{
          positionId: 401,
          runtimeId: 201,
          executionId: 92,
          instrument: 'NSE_INDEX|Nifty 50',
          quantityLots: 1,
          entryPrice: 23120.5,
          currentPrice: 23164.25,
          unrealizedPnl: 425.75,
          realizedPnl: 0,
          strategyName,
          status: 'OPEN',
          manualWatch: false,
          mode: 'LIVE',
          updatedAt: '2026-03-23T04:15:00.000Z',
        }],
        totalElements: 1,
        totalPages: 1,
        number: 0,
        size: 100,
      }),
    });
  });
  await page.route('**/api/v1/admin/intra-trade/monitor/events*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: [{
          id: 501,
          eventTime: '2026-03-23T04:15:00.000Z',
          eventType: 'POSITION_ENTERED',
          severity: 'INFO',
          mode: 'LIVE',
          message: 'Position entered from trader workflow',
          actor: 'admin',
          runtimeId: 201,
          positionId: 401,
        }],
        totalElements: 1,
        totalPages: 1,
        number: 0,
        size: 200,
      }),
    });
  });
  await page.route('**/api/v1/admin/market-watch/config*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ username: 'admin', config: { refreshIntervalSeconds: 30, gridColumns: 2, tiles: [] }, updatedAt: new Date().toISOString() }) });
  });
  await page.route('**/api/v1/admin/market-watch/data*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ fetchedAt: new Date().toISOString(), tiles: [] }) });
  });
  page.on('dialog', async (dialog) => {
    await dialog.accept();
  });

  return { runModes };
}

test('Intra monitor command bar and mode switch stay trader-readable', async ({ page }) => {
  await mockIntraMonitor(page, { promotionReady: true, runtimeStatus: 'WAITING' });

  await page.goto('/intra/monitor');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.getByRole('button', { name: /Nifty Intraday Momentum Open/ }).click();
  await expect(page.getByRole('heading', { name: strategyName })).toBeVisible();

  await expect(page.getByText('Trading Command Bar')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run Paper Test' }).first()).toBeVisible();
  await expect(page.getByText('Saved Strategies')).toBeVisible();
  await expect(page.getByText('Paper Test Setup')).toBeVisible();
  await expect(page.getByText('Paper Validation Runs')).toBeVisible();
  await expect(page.getByText('Promote Live Strategy')).toBeVisible();

  await page.getByRole('tab', { name: 'Live Monitor' }).click();

  await expect(page.getByRole('button', { name: 'Exit Now' }).first()).toBeVisible();
  await expect(page.getByText('Active Live Strategies')).toBeVisible();
  await expect(page.getByText('Selected Runtime')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Open Positions' })).toBeVisible();
  await expect(page.getByText('Audit Trail')).toBeVisible();
});

test('Quick test hides archived strategies by default and can show them on demand', async ({ page }) => {
  await mockIntraMonitor(page, { promotionReady: true, runtimeStatus: 'WAITING', includeArchivedStrategy: true });

  await page.goto('/intra/monitor');
  await page.getByRole('button', { name: 'Sign In' }).click();

  await expect(page.getByRole('button', { name: /Nifty Intraday Momentum Open/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Archived Legacy Strategy Open/ })).toHaveCount(0);

  await page.getByRole('combobox').first().click();
  await page.getByRole('option', { name: 'Archived' }).click();
  await expect(page.getByRole('button', { name: /Archived Legacy Strategy Open/ })).toBeVisible();
});

test('Quick test historical backtest mode posts BACKTEST and shows date controls', async ({ page }) => {
  const { runModes } = await mockIntraMonitor(page, { promotionReady: true, runtimeStatus: 'WAITING' });

  await page.goto('/intra/monitor');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.getByRole('button', { name: /Nifty Intraday Momentum Open/ }).click();

  await page.getByRole('combobox').filter({ hasText: 'Real-Time Paper' }).click();
  await page.getByRole('option', { name: 'Historical Backtest' }).click();

  await expect(page.getByLabel('Start date')).toBeVisible();
  await expect(page.getByLabel('End date')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run Historical Test' }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Run Historical Test' }).first().click();
  await expect.poll(() => runModes).toContain('BACKTEST');
});

test('Intra monitor allows live promotion even when readiness checks show warnings', async ({ page }) => {
  await mockIntraMonitor(page, { promotionReady: false, runtimeStatus: 'PAUSED' });

  await page.goto('/intra/monitor');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.getByRole('button', { name: /Nifty Intraday Momentum Open/ }).click();

  await expect(page.getByRole('button', { name: 'Promote Live Strategy' })).toBeEnabled();
  await expect(page.getByText('Wait for the India market session to open.')).toBeVisible();
  await expect(page.getByText('Market summary is stale. Refresh before promotion.')).toBeVisible();
  await expect(page.getByText('Publish the strategy to LIVE_READY first.')).toBeVisible();
  await expect(page.getByText('Add stop loss, target, or trailing protection before promotion.')).toBeVisible();
  await expect(page.getByText('Run at least one paper validation first.')).toBeVisible();

  await page.getByRole('button', { name: 'Promote Live Strategy' }).click();
  await expect(page.getByRole('dialog', { name: 'Promote To Live' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start Live' })).toBeEnabled();
});

test('Intra monitor promotion flow starts live only after explicit confirmation', async ({ page }) => {
  const { runModes } = await mockIntraMonitor(page, { promotionReady: true, runtimeStatus: 'WAITING' });

  await page.goto('/intra/monitor');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.getByRole('button', { name: /Nifty Intraday Momentum Open/ }).click();
  await expect(page.getByRole('button', { name: 'Promote Live Strategy' })).toBeEnabled();

  await page.getByRole('button', { name: 'Promote Live Strategy' }).click();
  await expect(page.getByRole('dialog', { name: 'Promote To Live' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start Live' })).toBeEnabled();
  await page.getByRole('button', { name: 'Start Live' }).click();

  await expect.poll(() => runModes).toContain('LIVE');
  await page.getByRole('tab', { name: 'Live Monitor' }).click();
  await expect(page.getByRole('button', { name: 'Exit Now' }).first()).toBeVisible();
});
