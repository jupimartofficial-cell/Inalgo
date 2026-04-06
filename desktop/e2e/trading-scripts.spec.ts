import { expect, test } from '@playwright/test';

const nowIso = new Date().toISOString();

const compileResponse = {
  compileStatus: 'SUCCESS',
  valid: true,
  paperEligible: true,
  liveEligible: true,
  diagnostics: [],
  warnings: [],
  artifact: {
    meta: {
      name: 'Opening Range BankNifty',
      instrumentKey: 'NSE_INDEX|Nifty Bank',
      timeframeUnit: 'minutes',
      timeframeInterval: 5,
      strategyType: 'INTRADAY',
      marketSession: 'REGULAR_MARKET',
    },
    inputs: [],
    imports: [],
    notes: [],
    runtimeHints: {},
    compiledStrategy: {
      strategyName: 'Opening Range BankNifty',
      underlyingKey: 'NSE_INDEX|Nifty Bank',
      underlyingSource: 'CASH',
      strategyType: 'INTRADAY',
      entryTime: '09:20',
      exitTime: '15:15',
      startDate: '2026-01-01',
      endDate: '2026-03-28',
      legs: [
        {
          id: 'ce-entry',
          segment: 'OPTIONS',
          lots: 1,
          position: 'BUY',
          optionType: 'CALL',
          expiryType: 'WEEKLY',
          strikeType: 'ATM',
          strikeSteps: 0,
        },
      ],
      legwiseSettings: {
        squareOffMode: 'COMPLETE',
        trailSlToBreakEven: false,
        trailScope: 'ALL_LEGS',
        noReEntryAfterEnabled: false,
        overallMomentumEnabled: false,
      },
      overallSettings: {
        stopLossEnabled: true,
        stopLossMode: 'PERCENT',
        stopLossValue: 20,
        targetEnabled: true,
        targetMode: 'PERCENT',
        targetValue: 40,
        trailingEnabled: false,
      },
      advancedConditions: {
        enabled: false,
      },
    },
  },
};

test('Trading Scripts page supports library load and compile actions', async ({ page }) => {
  let savedDrafts = 0;
  let compiled = 0;
  let backtested = 0;

  await page.route('**/api/v1/admin/migrations/jobs*', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/v1/admin/migrations/status*', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/v1/admin/historical-data*', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"content":[],"totalElements":0,"totalPages":0,"number":0,"size":50}' }));
  await page.route('**/api/v1/admin/trading/preferences*', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"username":"admin","preferences":null}' }));

  await page.route('**/api/v1/admin/trading-scripts/library*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: [
          {
            id: 7,
            scriptName: 'Opening Range BankNifty',
            instrumentKey: 'NSE_INDEX|Nifty Bank',
            timeframeUnit: 'minutes',
            timeframeInterval: 5,
            strategyType: 'INTRADAY',
            status: 'COMPILED',
            compileStatus: 'SUCCESS',
            creator: 'admin',
            version: 3,
            paperEligible: true,
            liveEligible: true,
            latestPerformancePnl: 1250.5,
            latestExecutedTrades: 14,
            latestRealWorldAccuracyPct: 92.4,
            lastModifiedAt: nowIso,
          },
        ],
        totalElements: 1,
        totalPages: 1,
        number: 0,
        size: 10,
      }),
    });
  });

  await page.route('**/api/v1/admin/trading-scripts/7/versions*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 30,
          scriptId: 7,
          version: 3,
          sourceJs: "export default defineScript({ meta: { name: 'Opening Range BankNifty', instrumentKey: 'NSE_INDEX|Nifty Bank', timeframeUnit: 'minutes', timeframeInterval: 5, strategyType: 'INTRADAY' }, compiledStrategy: { strategyName: 'Opening Range BankNifty', underlyingKey: 'NSE_INDEX|Nifty Bank', underlyingSource: 'CASH', strategyType: 'INTRADAY', entryTime: '09:20', exitTime: '15:15', startDate: '2026-01-01', endDate: '2026-03-28', legs: [{ id: 'ce-entry', segment: 'OPTIONS', lots: 1, position: 'BUY', optionType: 'CALL', expiryType: 'WEEKLY', strikeType: 'ATM', strikeSteps: 0 }], legwiseSettings: { squareOffMode: 'COMPLETE', trailSlToBreakEven: false, trailScope: 'ALL_LEGS', noReEntryAfterEnabled: false, overallMomentumEnabled: false }, overallSettings: { stopLossEnabled: true, stopLossMode: 'PERCENT', stopLossValue: 20, targetEnabled: true, targetMode: 'PERCENT', targetValue: 40, trailingEnabled: false }, advancedConditions: { enabled: false } }, onBar() { return { type: 'HOLD' }; } });",
          compile: compileResponse,
          createdAt: nowIso,
          compiledAt: nowIso,
        },
      ]),
    });
  });

  const draftResponse = {
    script: {
      id: 7,
      scriptName: 'Opening Range BankNifty',
      instrumentKey: 'NSE_INDEX|Nifty Bank',
      timeframeUnit: 'minutes',
      timeframeInterval: 5,
      strategyType: 'INTRADAY',
      status: 'DRAFT',
      compileStatus: 'SUCCESS',
      creator: 'admin',
      version: 4,
      paperEligible: true,
      liveEligible: true,
    },
    latestVersion: {
      id: 31,
      scriptId: 7,
      version: 4,
      sourceJs: "export default defineScript({ meta: { name: 'Opening Range BankNifty', instrumentKey: 'NSE_INDEX|Nifty Bank', timeframeUnit: 'minutes', timeframeInterval: 5, strategyType: 'INTRADAY' }, compiledStrategy: {}, onBar() { return { type: 'HOLD' }; } });",
      compile: compileResponse,
      createdAt: nowIso,
      compiledAt: nowIso,
    },
    latestBacktest: null,
  };

  await page.route('**/api/v1/admin/trading-scripts/draft', async (route) => {
    savedDrafts += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(draftResponse) });
  });

  await page.route('**/api/v1/admin/trading-scripts/7/draft', async (route) => {
    savedDrafts += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(draftResponse) });
  });

  await page.route('**/api/v1/admin/trading-scripts/7/compile', async (route) => {
    compiled += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(compileResponse) });
  });

  await page.route('**/api/v1/admin/trading-scripts/7/backtest', async (route) => {
    backtested += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        summary: {
          totalPnl: 1500,
          averagePnl: 107.14,
          executedTrades: 14,
          winTrades: 9,
          lossTrades: 5,
          realWorldAccuracyPct: 93,
          marketPricedTrades: 13,
          fallbackPricedTrades: 1,
          evaluatedAt: nowIso,
          notes: [],
        },
        result: {
          strategy: compileResponse.artifact.compiledStrategy,
          rows: [],
          totalPnl: 1500,
          averagePnl: 107.14,
          executedTrades: 14,
          winTrades: 9,
          lossTrades: 5,
          syncedInstruments: 1,
          syncedCandles: 200,
          realWorldAccuracyPct: 93,
          marketPricedTrades: 13,
          fallbackPricedTrades: 1,
          notes: [],
        },
      }),
    });
  });

  await page.addInitScript(() => {
    window.sessionStorage.setItem('inalgo_admin_session_v1', JSON.stringify({
      tenantId: 'local-desktop',
      username: 'admin',
      token: 'trading-scripts-token',
      section: 'trading-scripts',
      intraSubSection: 'intra-monitor',
      backtestSubSection: 'pnl',
      marketSignalsSubSection: 'trading-param',
      tradingDeskSubSection: 'advanced-trading',
      sidebarCollapsed: false,
      pinnedNavItemKeys: ['intra-monitor', 'trading-scripts', 'option-chain'],
      expandedNavGroup: 'trading',
    }));
  });

  await page.goto('/trading-scripts');
  await expect(page.getByRole('heading', { name: 'Trading Scripts', exact: true })).toBeVisible();
  await expect(page.getByText('Opening Range BankNifty').first()).toBeVisible();

  await page.getByRole('button', { name: 'Opening Range BankNifty', exact: true }).click();
  await expect(page.getByText('v3', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Loaded', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Save Draft' }).click();
  await expect.poll(() => savedDrafts).toBe(1);

  await page.getByRole('button', { name: 'Compile' }).click();
  await expect.poll(() => compiled).toBe(1);

  await page.getByRole('button', { name: 'Backtest' }).click();
  await expect.poll(() => backtested).toBe(1);
  await expect(page.getByText('Backtest completed')).toBeVisible();
});
