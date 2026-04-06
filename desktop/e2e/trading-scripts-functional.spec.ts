import { expect, test } from '@playwright/test';

const nowIso = new Date().toISOString();

type RouteStats = {
  draftCreateCalls: number;
  draftUpdateCalls: number;
  duplicateCalls: number;
  archiveCalls: number;
  deleteCalls: number;
  compileCalls: number;
  lastDraftSource: string;
};

async function bootstrapRoutes(page: Parameters<typeof test>[0]['page'], stats: RouteStats) {
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
            latestPerformancePnl: 1500,
            latestExecutedTrades: 10,
            latestRealWorldAccuracyPct: 89.5,
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
          sourceJs: `export default defineScript({\n  meta: {\n    name: 'Opening Range BankNifty',\n    instrumentKey: 'NSE_INDEX|Nifty Bank',\n    timeframeUnit: 'minutes',\n    timeframeInterval: 5,\n    strategyType: 'INTRADAY',\n  },\n  compiledStrategy: {\n    strategyName: 'Opening Range BankNifty',\n    underlyingKey: 'NSE_INDEX|Nifty Bank',\n    underlyingSource: 'CASH',\n    strategyType: 'INTRADAY',\n    entryTime: '09:20',\n    exitTime: '15:15',\n    startDate: '2026-01-01',\n    endDate: '2026-03-28',\n    legs: [{ id: 'ce-entry', segment: 'OPTIONS', lots: 1, position: 'BUY', optionType: 'CALL', expiryType: 'WEEKLY', strikeType: 'ATM', strikeSteps: 0 }],\n    legwiseSettings: { squareOffMode: 'COMPLETE', trailSlToBreakEven: false, trailScope: 'ALL_LEGS', noReEntryAfterEnabled: false, overallMomentumEnabled: false },\n    overallSettings: { stopLossEnabled: true, stopLossMode: 'PERCENT', stopLossValue: 20, targetEnabled: true, targetMode: 'PERCENT', targetValue: 40, trailingEnabled: false },\n    advancedConditions: { enabled: false },\n  },\n  onBar(ctx, state, api) {\n    return api.actions.hold({ reason: 'loaded version' });\n  },\n});`,
          compile: {
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
                legs: [{ id: 'ce-entry', segment: 'OPTIONS', lots: 1, position: 'BUY', optionType: 'CALL', expiryType: 'WEEKLY', strikeType: 'ATM', strikeSteps: 0 }],
                legwiseSettings: { squareOffMode: 'COMPLETE', trailSlToBreakEven: false, trailScope: 'ALL_LEGS', noReEntryAfterEnabled: false, overallMomentumEnabled: false },
                overallSettings: { stopLossEnabled: true, stopLossMode: 'PERCENT', stopLossValue: 20, targetEnabled: true, targetMode: 'PERCENT', targetValue: 40, trailingEnabled: false },
                advancedConditions: { enabled: false },
              },
            },
          },
          createdAt: nowIso,
          compiledAt: nowIso,
        },
      ]),
    });
  });

  await page.route('**/api/v1/admin/trading-scripts/draft', async (route) => {
    stats.draftCreateCalls += 1;
    const payload = route.request().postDataJSON() as { builder?: { sourceJs?: string } };
    stats.lastDraftSource = payload?.builder?.sourceJs ?? '';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
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
          sourceJs: stats.lastDraftSource,
          compile: {
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
                legs: [{ id: 'ce-entry', segment: 'OPTIONS', lots: 1, position: 'BUY', optionType: 'CALL', expiryType: 'WEEKLY', strikeType: 'ATM', strikeSteps: 0 }],
                legwiseSettings: { squareOffMode: 'COMPLETE', trailSlToBreakEven: false, trailScope: 'ALL_LEGS', noReEntryAfterEnabled: false, overallMomentumEnabled: false },
                overallSettings: { stopLossEnabled: true, stopLossMode: 'PERCENT', stopLossValue: 20, targetEnabled: true, targetMode: 'PERCENT', targetValue: 40, trailingEnabled: false },
                advancedConditions: { enabled: false },
              },
            },
          },
          createdAt: nowIso,
          compiledAt: nowIso,
        },
        latestBacktest: null,
      }),
    });
  });

  await page.route('**/api/v1/admin/trading-scripts/7/draft', async (route) => {
    stats.draftUpdateCalls += 1;
    const payload = route.request().postDataJSON() as { builder?: { sourceJs?: string } };
    stats.lastDraftSource = payload?.builder?.sourceJs ?? '';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        script: {
          id: 7,
          scriptName: 'Complex Dynamic Strategy',
          instrumentKey: 'NSE_INDEX|Nifty 50',
          timeframeUnit: 'minutes',
          timeframeInterval: 15,
          strategyType: 'INTRADAY',
          status: 'DRAFT',
          compileStatus: 'SUCCESS',
          creator: 'admin',
          version: 5,
          paperEligible: true,
          liveEligible: true,
        },
        latestVersion: {
          id: 32,
          scriptId: 7,
          version: 5,
          sourceJs: stats.lastDraftSource,
          compile: {
            compileStatus: 'SUCCESS',
            valid: true,
            paperEligible: true,
            liveEligible: true,
            diagnostics: [],
            warnings: [],
            artifact: {
              meta: {
                name: 'Complex Dynamic Strategy',
                instrumentKey: 'NSE_INDEX|Nifty 50',
                timeframeUnit: 'minutes',
                timeframeInterval: 15,
                strategyType: 'INTRADAY',
                marketSession: 'REGULAR_MARKET',
              },
              inputs: [
                { key: 'riskPct', label: 'Risk %', type: 'number', defaultValue: 1.5, required: true, description: 'Risk budget' },
                { key: 'targetPct', label: 'Target %', type: 'number', defaultValue: 2.5, required: true, description: 'Target' },
                { key: 'maxTrades', label: 'Max Trades', type: 'number', defaultValue: 3, required: true, description: 'Daily cap' },
              ],
              imports: ['@inalgo/market', '@inalgo/analytics', '@inalgo/options', '@inalgo/runtime', '@inalgo/strategy'],
              notes: ['complex script parsed'],
              runtimeHints: { lookbackBars: 200, liveScope: 'OPTIONS_ONLY', dynamicParams: ['riskPct', 'targetPct', 'maxTrades'] },
              compiledStrategy: {
                strategyName: 'Complex Dynamic Strategy',
                underlyingKey: 'NSE_INDEX|Nifty 50',
                underlyingSource: 'CASH',
                strategyType: 'INTRADAY',
                entryTime: '09:25',
                exitTime: '15:10',
                startDate: '2026-01-01',
                endDate: '2026-03-28',
                legs: [{ id: 'ce-entry', segment: 'OPTIONS', lots: 1, position: 'BUY', optionType: 'CALL', expiryType: 'WEEKLY', strikeType: 'ATM', strikeSteps: 0 }],
                legwiseSettings: { squareOffMode: 'COMPLETE', trailSlToBreakEven: false, trailScope: 'ALL_LEGS', noReEntryAfterEnabled: false, overallMomentumEnabled: false },
                overallSettings: { stopLossEnabled: true, stopLossMode: 'PERCENT', stopLossValue: 20, targetEnabled: true, targetMode: 'PERCENT', targetValue: 40, trailingEnabled: false },
                advancedConditions: { enabled: false },
              },
            },
          },
          createdAt: nowIso,
          compiledAt: nowIso,
        },
        latestBacktest: null,
      }),
    });
  });

  await page.route('**/api/v1/admin/trading-scripts/7/compile', async (route) => {
    stats.compileCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        compileStatus: 'SUCCESS',
        valid: true,
        paperEligible: true,
        liveEligible: true,
        diagnostics: [],
        warnings: [],
        artifact: {
          meta: {
            name: 'Complex Dynamic Strategy',
            instrumentKey: 'NSE_INDEX|Nifty 50',
            timeframeUnit: 'minutes',
            timeframeInterval: 15,
            strategyType: 'INTRADAY',
            marketSession: 'REGULAR_MARKET',
          },
          inputs: [
            { key: 'riskPct', label: 'Risk %', type: 'number', defaultValue: 1.5, required: true, description: 'Risk budget' },
            { key: 'targetPct', label: 'Target %', type: 'number', defaultValue: 2.5, required: true, description: 'Target' },
            { key: 'maxTrades', label: 'Max Trades', type: 'number', defaultValue: 3, required: true, description: 'Daily cap' },
          ],
          imports: ['@inalgo/market', '@inalgo/analytics', '@inalgo/options', '@inalgo/runtime', '@inalgo/strategy'],
          notes: ['complex script parsed'],
          runtimeHints: { lookbackBars: 200, liveScope: 'OPTIONS_ONLY', dynamicParams: ['riskPct', 'targetPct', 'maxTrades'] },
          compiledStrategy: {
            strategyName: 'Complex Dynamic Strategy',
            underlyingKey: 'NSE_INDEX|Nifty 50',
            underlyingSource: 'CASH',
            strategyType: 'INTRADAY',
            entryTime: '09:25',
            exitTime: '15:10',
            startDate: '2026-01-01',
            endDate: '2026-03-28',
            legs: [{ id: 'ce-entry', segment: 'OPTIONS', lots: 1, position: 'BUY', optionType: 'CALL', expiryType: 'WEEKLY', strikeType: 'ATM', strikeSteps: 0 }],
            legwiseSettings: { squareOffMode: 'COMPLETE', trailSlToBreakEven: false, trailScope: 'ALL_LEGS', noReEntryAfterEnabled: false, overallMomentumEnabled: false },
            overallSettings: { stopLossEnabled: true, stopLossMode: 'PERCENT', stopLossValue: 20, targetEnabled: true, targetMode: 'PERCENT', targetValue: 40, trailingEnabled: false },
            advancedConditions: { enabled: false },
          },
        },
      }),
    });
  });

  await page.route('**/api/v1/admin/trading-scripts/7/duplicate', async (route) => {
    stats.duplicateCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        script: {
          id: 8,
          scriptName: 'Copy of Opening Range BankNifty',
          instrumentKey: 'NSE_INDEX|Nifty Bank',
          timeframeUnit: 'minutes',
          timeframeInterval: 5,
          strategyType: 'INTRADAY',
          status: 'DRAFT',
          compileStatus: 'SUCCESS',
          creator: 'admin',
          version: 1,
          paperEligible: true,
          liveEligible: true,
        },
        latestVersion: {
          id: 41,
          scriptId: 8,
          version: 1,
          sourceJs: 'export default defineScript({ meta: { name: \'Copy of Opening Range BankNifty\', instrumentKey: \'NSE_INDEX|Nifty Bank\', timeframeUnit: \'minutes\', timeframeInterval: 5, strategyType: \'INTRADAY\' }, compiledStrategy: {}, onBar(ctx, state, api) { return api.actions.hold({ reason: \'copy\' }); } });',
          compile: { compileStatus: 'SUCCESS', valid: true, paperEligible: true, liveEligible: true, diagnostics: [], warnings: [], artifact: null },
          createdAt: nowIso,
          compiledAt: nowIso,
        },
        latestBacktest: null,
      }),
    });
  });

  await page.route('**/api/v1/admin/trading-scripts/7/archive', async (route) => {
    stats.archiveCalls += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'archived', scriptId: 7 }) });
  });

  await page.route('**/api/v1/admin/trading-scripts/7?username=admin', async (route) => {
    stats.deleteCalls += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'deleted', scriptId: 7 }) });
  });

  await page.route('**/api/v1/admin/trading-scripts/7/backtest', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        summary: {
          totalPnl: 1200,
          averagePnl: 120,
          executedTrades: 10,
          winTrades: 6,
          lossTrades: 4,
          realWorldAccuracyPct: 87,
          marketPricedTrades: 9,
          fallbackPricedTrades: 1,
          evaluatedAt: nowIso,
          notes: [],
        },
        result: {
          strategy: {},
          rows: [],
          totalPnl: 1200,
          averagePnl: 120,
          executedTrades: 10,
          winTrades: 6,
          lossTrades: 4,
          syncedInstruments: 1,
          syncedCandles: 200,
          realWorldAccuracyPct: 87,
          marketPricedTrades: 9,
          fallbackPricedTrades: 1,
          notes: [],
        },
      }),
    });
  });

  await page.route('**/api/v1/admin/trading-scripts/7/publish', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        script: {
          id: 7,
          scriptName: 'Complex Dynamic Strategy',
          instrumentKey: 'NSE_INDEX|Nifty 50',
          timeframeUnit: 'minutes',
          timeframeInterval: 15,
          strategyType: 'INTRADAY',
          status: 'PAPER_READY',
          compileStatus: 'SUCCESS',
          creator: 'admin',
          version: 5,
          paperEligible: true,
          liveEligible: true,
        },
        latestVersion: {
          id: 32,
          scriptId: 7,
          version: 5,
          sourceJs: stats.lastDraftSource,
          compile: { compileStatus: 'SUCCESS', valid: true, paperEligible: true, liveEligible: true, diagnostics: [], warnings: [], artifact: null },
          createdAt: nowIso,
          compiledAt: nowIso,
        },
        latestBacktest: { totalPnl: 1200, averagePnl: 120, executedTrades: 10, winTrades: 6, lossTrades: 4, realWorldAccuracyPct: 87, marketPricedTrades: 9, fallbackPricedTrades: 1, evaluatedAt: nowIso, notes: [] },
      }),
    });
  });

  await page.addInitScript(() => {
    window.sessionStorage.setItem('inalgo_admin_session_v1', JSON.stringify({
      tenantId: 'local-desktop',
      username: 'admin',
      token: 'trading-scripts-functional-token',
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
}

test.describe('Trading Scripts Functional Checks', () => {
  test('Mini IDE snippet insert and manual edit works', async ({ page }) => {
    const stats: RouteStats = {
      draftCreateCalls: 0,
      draftUpdateCalls: 0,
      duplicateCalls: 0,
      archiveCalls: 0,
      deleteCalls: 0,
      compileCalls: 0,
      lastDraftSource: '',
    };
    await bootstrapRoutes(page, stats);

    await page.goto('/trading-scripts');
    await expect(page.getByRole('heading', { name: 'Trading Scripts', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Opening Range BankNifty', exact: true }).click();
    await expect(page.getByText('v3', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Loaded', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Latest signal' }).click();
    const fallbackEditor = page.getByLabel('Mini IDE source');
    if (await fallbackEditor.count()) {
      await fallbackEditor.fill(`${await fallbackEditor.inputValue()}\n// MINI_IDE_EDIT_CHECK\n`);
    } else {
      const editor = page.locator('.monaco-editor').first();
      await expect(editor).toBeVisible();
      await editor.click({ position: { x: 120, y: 120 } });
      await page.keyboard.type('\n// MINI_IDE_EDIT_CHECK\n');
    }

    await page.getByRole('button', { name: 'Save Draft' }).click();
    await expect.poll(() => stats.draftCreateCalls + stats.draftUpdateCalls).toBeGreaterThan(0);
    expect(stats.lastDraftSource).toContain("api.signals.latest('ORB_BREAKOUT')");
    expect(stats.lastDraftSource).toContain('MINI_IDE_EDIT_CHECK');
  });

  test('Library copy/archive/delete actions invoke expected APIs', async ({ page }) => {
    const stats: RouteStats = {
      draftCreateCalls: 0,
      draftUpdateCalls: 0,
      duplicateCalls: 0,
      archiveCalls: 0,
      deleteCalls: 0,
      compileCalls: 0,
      lastDraftSource: '',
    };
    await bootstrapRoutes(page, stats);

    await page.goto('/trading-scripts');
    await expect(page.getByRole('heading', { name: 'Trading Scripts', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Opening Range BankNifty', exact: true }).click();
    await expect(page.getByText('v3', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Loaded', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Duplicate script' }).first().click();
    await page.getByRole('button', { name: 'Archive script' }).first().click();
    await page.getByRole('button', { name: 'Delete script permanently' }).first().click();

    await expect.poll(() => stats.duplicateCalls).toBe(1);
    await expect.poll(() => stats.archiveCalls).toBe(1);
    await expect.poll(() => stats.deleteCalls).toBe(1);
  });

  test('Library add/edit paths save through create and update draft APIs', async ({ page }) => {
    const stats: RouteStats = {
      draftCreateCalls: 0,
      draftUpdateCalls: 0,
      duplicateCalls: 0,
      archiveCalls: 0,
      deleteCalls: 0,
      compileCalls: 0,
      lastDraftSource: '',
    };
    await bootstrapRoutes(page, stats);

    await page.goto('/trading-scripts');
    await expect(page.getByRole('heading', { name: 'Trading Scripts', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Save Draft' }).click();
    await expect.poll(() => stats.draftCreateCalls).toBe(1);

    await page.getByRole('button', { name: 'Opening Range BankNifty', exact: true }).click();
    await expect(page.getByText('v3', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Loaded', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Save Draft' }).click();
    await expect.poll(() => stats.draftUpdateCalls).toBe(1);
  });

  test('Complex script compile supports params/instrument/timeframe/dynamic hints', async ({ page }) => {
    const stats: RouteStats = {
      draftCreateCalls: 0,
      draftUpdateCalls: 0,
      duplicateCalls: 0,
      archiveCalls: 0,
      deleteCalls: 0,
      compileCalls: 0,
      lastDraftSource: '',
    };
    await bootstrapRoutes(page, stats);

    await page.goto('/trading-scripts');
    await expect(page.getByRole('heading', { name: 'Trading Scripts', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Opening Range BankNifty', exact: true }).click();
    await expect(page.getByText('v3', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Loaded', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Runtime hint' }).click();
    await page.getByRole('button', { name: 'Compile' }).click();

    await expect.poll(() => stats.compileCalls).toBe(1);
    await expect(page.getByText('Declared Inputs')).toBeVisible();
    await expect(page.getByText('Risk %')).toBeVisible();
    await expect(page.getByText('Target %')).toBeVisible();
    await expect(page.getByText('Max Trades')).toBeVisible();

    await expect(page.getByText('Timeframe', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('15 minutes', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Compile: SUCCESS')).toBeVisible();
  });
});
