import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const screenshotPath = path.resolve(__dirname, '../../docs/assets/inalgo-trading-scripts-hero.png');
const nowIso = '2026-04-06T09:20:00.000Z';

const demoSource = `export default defineScript({
  meta: {
    name: 'Opening Range Demo Strategy',
    instrumentKey: 'NSE_INDEX|Nifty Bank',
    timeframeUnit: 'minutes',
    timeframeInterval: 5,
    strategyType: 'INTRADAY',
  },
  compiledStrategy: {
    strategyName: 'Opening Range Demo Strategy',
    underlyingKey: 'NSE_INDEX|Nifty Bank',
    underlyingSource: 'CASH',
    strategyType: 'INTRADAY',
    entryTime: '09:20',
    exitTime: '15:15',
    startDate: '2026-01-01',
    endDate: '2026-04-06',
    legs: [
      {
        id: 'demo-call-entry',
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
      enabled: true,
      notes: ['Demo-only strategy data for public README screenshot.'],
    },
  },
  onBar(ctx) {
    if (ctx.firstCandleClr === 'GREEN' && ctx.ema9 > ctx.ema26) {
      return { type: 'ENTER', legId: 'demo-call-entry' };
    }
    return { type: 'HOLD' };
  },
});`;

const compileResponse = {
  compileStatus: 'SUCCESS',
  valid: true,
  paperEligible: true,
  liveEligible: false,
  diagnostics: [],
  warnings: ['Public demo compile: live publishing is intentionally disabled for the README capture.'],
  artifact: {
    meta: {
      name: 'Opening Range Demo Strategy',
      instrumentKey: 'NSE_INDEX|Nifty Bank',
      timeframeUnit: 'minutes',
      timeframeInterval: 5,
      strategyType: 'INTRADAY',
      marketSession: 'REGULAR_MARKET',
    },
    inputs: [],
    imports: [],
    notes: ['Sanitized public demo artifact.'],
    runtimeHints: {},
    compiledStrategy: {
      strategyName: 'Opening Range Demo Strategy',
      underlyingKey: 'NSE_INDEX|Nifty Bank',
      underlyingSource: 'CASH',
      strategyType: 'INTRADAY',
      entryTime: '09:20',
      exitTime: '15:15',
      startDate: '2026-01-01',
      endDate: '2026-04-06',
      legs: [
        {
          id: 'demo-call-entry',
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
        enabled: true,
      },
    },
  },
};

const demoDetails = {
  script: {
    id: 7,
    scriptName: 'Opening Range Demo Strategy',
    instrumentKey: 'NSE_INDEX|Nifty Bank',
    timeframeUnit: 'minutes',
    timeframeInterval: 5,
    strategyType: 'INTRADAY',
    status: 'COMPILED',
    compileStatus: 'SUCCESS',
    creator: 'demo-contributor',
    version: 3,
    paperEligible: true,
    liveEligible: false,
  },
  latestVersion: {
    id: 30,
    scriptId: 7,
    version: 3,
    sourceJs: demoSource,
    compile: compileResponse,
    createdAt: nowIso,
    compiledAt: nowIso,
  },
  latestBacktest: {
    summary: {
      totalPnl: 4280,
      averagePnl: 267.5,
      executedTrades: 16,
      winTrades: 11,
      lossTrades: 5,
      realWorldAccuracyPct: 96.3,
      marketPricedTrades: 16,
      fallbackPricedTrades: 0,
      evaluatedAt: nowIso,
      notes: ['Synthetic demo metrics only.'],
    },
  },
};

test('captures sanitized Trading Scripts hero image for README', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 950 });

  await page.route('**/api/v1/admin/migrations/jobs*', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/v1/admin/migrations/status*', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/v1/admin/historical-data*', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"content":[],"totalElements":0,"totalPages":0,"number":0,"size":50}' }));
  await page.route('**/api/v1/admin/trading/preferences*', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"username":"demo-contributor","preferences":null}' }));

  await page.route('**/api/v1/admin/trading-scripts/library*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: [
          {
            id: 7,
            scriptName: 'Opening Range Demo Strategy',
            instrumentKey: 'NSE_INDEX|Nifty Bank',
            timeframeUnit: 'minutes',
            timeframeInterval: 5,
            strategyType: 'INTRADAY',
            status: 'COMPILED',
            compileStatus: 'SUCCESS',
            creator: 'demo-contributor',
            version: 3,
            paperEligible: true,
            liveEligible: false,
            latestPerformancePnl: 4280,
            latestExecutedTrades: 16,
            latestRealWorldAccuracyPct: 96.3,
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
      body: JSON.stringify([demoDetails.latestVersion]),
    });
  });

  await page.route('**/api/v1/admin/trading-scripts/draft', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(demoDetails) }));
  await page.route('**/api/v1/admin/trading-scripts/7/draft', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(demoDetails) }));
  await page.route('**/api/v1/admin/trading-scripts/7/compile', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(compileResponse) }));
  await page.route('**/api/v1/admin/trading-scripts/7/backtest', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(demoDetails.latestBacktest) }));

  await page.addInitScript(() => {
    window.sessionStorage.setItem('inalgo_admin_session_v1', JSON.stringify({
      tenantId: 'demo-tenant',
      username: 'demo-contributor',
      token: 'demo-session-placeholder',
      section: 'trading-scripts',
      intraSubSection: 'intra-monitor',
      backtestSubSection: 'pnl',
      marketSignalsSubSection: 'trading-param',
      tradingDeskSubSection: 'advanced-trading',
      sidebarCollapsed: false,
      pinnedNavItemKeys: ['trading-scripts', 'intra-monitor', 'backtest-pnl'],
      expandedNavGroup: 'trading',
    }));
  });

  await page.goto('/trading-scripts');
  await expect(page.getByRole('heading', { name: 'Trading Scripts', exact: true })).toBeVisible();
  await expect(page.getByText('Opening Range Demo Strategy').first()).toBeVisible();
  await page.getByRole('button', { name: 'Opening Range Demo Strategy', exact: true }).click();
  await expect(page.getByText('v3', { exact: true }).first()).toBeVisible();
  await page.getByRole('tab', { name: 'Backtest' }).click();
  await expect(page.getByText('Total P&L')).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));

  await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: false });
});
