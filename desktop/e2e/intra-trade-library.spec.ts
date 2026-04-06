import { expect, test } from '@playwright/test';

test('E2E-04: Strategy lifecycle: edit, duplicate, archive, filter in library', async ({ page }) => {
  const strategyName = 'Draft Strategy Alpha';

  const libraryItems = [
    { id: 1, strategyName: 'Draft Strategy Alpha', instrumentKey: 'NSE_INDEX|Nifty 50', timeframeUnit: 'minutes', timeframeInterval: 5, strategyType: 'INTRADAY', status: 'DRAFT', lastModifiedAt: '2026-03-23T04:10:00.000Z', creator: 'admin', version: 1, paperEligible: false, liveEligible: false, latestPerformancePnl: 0, latestExecutedTrades: 0 },
    { id: 2, strategyName: 'Paper Ready Strategy', instrumentKey: 'NSE_INDEX|Nifty 50', timeframeUnit: 'minutes', timeframeInterval: 15, strategyType: 'INTRADAY', status: 'PAPER_READY', lastModifiedAt: '2026-03-22T04:10:00.000Z', creator: 'admin', version: 2, paperEligible: true, liveEligible: false, latestPerformancePnl: 100, latestExecutedTrades: 5 },
  ];
  const libraryState = [...libraryItems];

  const versionResponse = [{
    id: 10,
    strategyId: 1,
    version: 1,
    advancedMode: false,
    timeframeUnit: 'minutes',
    timeframeInterval: 5,
    strategy: { strategyName, underlyingKey: 'NSE_INDEX|Nifty 50', underlyingSource: 'FUTURES', strategyType: 'INTRADAY', entryTime: '09:35', exitTime: '15:15', startDate: '2026-03-20', endDate: '2026-03-23', legs: [], legwiseSettings: { squareOffMode: 'PARTIAL', trailSlToBreakEven: false, trailScope: 'ALL_LEGS', noReEntryAfterEnabled: false, overallMomentumEnabled: false }, overallSettings: { stopLossEnabled: false, targetEnabled: false, trailingEnabled: false }, advancedConditions: { enabled: false, entry: null, exit: null } },
    validation: { valid: false, paperEligible: false, liveEligible: false, fieldErrors: [], summaryErrors: [], warnings: [] },
    createdAt: '2026-03-23T04:00:00.000Z',
    validatedAt: null,
  }];
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });

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
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: libraryState, totalElements: libraryState.length, totalPages: 1, number: 0, size: 10 }) });
  });
  await page.route('**/api/v1/admin/intra-strategies/1/versions*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(versionResponse) });
  });
  await page.route('**/api/v1/admin/intra-strategies/1/duplicate', async (route) => {
    const duplicated = { id: 3, strategyName: 'Draft Strategy Alpha (copy)', instrumentKey: 'BSE_INDEX|SENSEX', timeframeUnit: 'minutes', timeframeInterval: 15, strategyType: 'INTRADAY', status: 'DRAFT', lastModifiedAt: '2026-03-23T05:10:00.000Z', creator: 'admin', version: 1, paperEligible: false, liveEligible: false, latestPerformancePnl: 0, latestExecutedTrades: 0 };
    libraryState.unshift(duplicated);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ strategy: { id: 3, strategyName: duplicated.strategyName, status: 'DRAFT' }, latestVersion: { ...versionResponse[0], id: 20, strategyId: 3, timeframeUnit: duplicated.timeframeUnit, timeframeInterval: duplicated.timeframeInterval, strategy: { ...versionResponse[0].strategy, strategyName: duplicated.strategyName, underlyingKey: duplicated.instrumentKey } } }),
    });
  });
  await page.route('**/api/v1/admin/intra-strategies/1/archive', async (route) => {
    const target = libraryState.find((item) => item.id === 1);
    if (target) target.status = 'ARCHIVED';
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, status: 'ARCHIVED' }) });
  });
  await page.route('**/api/v1/admin/intra-strategies/1?username=*', async (route) => {
    const index = libraryState.findIndex((item) => item.id === 1);
    if (index >= 0) libraryState.splice(index, 1);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, status: 'deleted' }) });
  });
  await page.route('**/api/v1/admin/intra-trade/executions*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [], totalElements: 0, totalPages: 1, number: 0, size: 20 }) });
  });
  await page.route('**/api/v1/admin/intra-trade/monitor/market-summary*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ marketTrend: 'UPTREND', sessionStatus: 'Open', refreshedAt: '2026-03-23T04:15:00.000Z', stale: false, freshnessSeconds: 8, indexValues: [] }) });
  });
  await page.route('**/api/v1/admin/intra-trade/monitor/runtimes*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [], totalElements: 0, totalPages: 1, number: 0, size: 50 }) });
  });
  await page.route('**/api/v1/admin/intra-trade/monitor/positions*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [], totalElements: 0, totalPages: 1, number: 0, size: 50 }) });
  });
  await page.route('**/api/v1/admin/intra-trade/monitor/events*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [], totalElements: 0, totalPages: 1, number: 0, size: 100 }) });
  });

  await page.goto('/intra/strategies');
  await page.getByRole('button', { name: 'Sign In' }).click();

  await expect(page.getByRole('cell', { name: strategyName })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Paper Ready Strategy' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'In Progress', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Ready to Test', exact: true })).toBeVisible();

  const draftRow = page.getByRole('row').filter({ has: page.getByRole('cell', { name: strategyName, exact: true }) });
  await draftRow.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByRole('textbox', { name: 'Strategy name', exact: true })).toHaveValue(strategyName);

  await draftRow.getByRole('button', { name: 'Duplicate' }).click();
  await expect(page.getByText('Strategy duplicated')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Draft Strategy Alpha (copy)' })).toBeVisible();

  await draftRow.getByRole('button', { name: 'Archive' }).click();
  await expect(page.getByText('Strategy archived')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Archived', exact: true })).toBeVisible();

  await draftRow.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('Strategy deleted')).toBeVisible();
  await expect(page.getByRole('cell', { name: strategyName, exact: true })).not.toBeVisible();

  await page.getByRole('button', { name: 'Open Intra Monitor' }).click();
  await expect(page).toHaveURL(/\/intra\/monitor$/);
  await expect(page.locator('[role="combobox"]').filter({ hasText: 'SENSEX' })).toHaveCount(1);
  await expect(page.locator('[role="combobox"]').filter({ hasText: '15 Min' })).toHaveCount(1);
  expect(pageErrors, `Page errors: ${pageErrors.join('\n')}`).toEqual([]);
});
