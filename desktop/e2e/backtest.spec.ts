import { expect, test } from '@playwright/test';

test.use({ timezoneId: 'Asia/Kolkata' });

type StrategyPayload = {
  strategyName: string;
  underlyingKey: string;
  underlyingSource: 'CASH' | 'FUTURES';
  strategyType: 'INTRADAY' | 'BTST' | 'POSITIONAL';
  entryTime: string;
  exitTime: string;
  startDate: string;
  endDate: string;
  legs: Array<{
    id: string;
    segment: 'OPTIONS' | 'FUTURES';
    lots: number;
    position: 'BUY' | 'SELL';
    optionType?: 'CALL' | 'PUT';
    expiryType: 'WEEKLY' | 'MONTHLY';
    strikeType: 'ATM' | 'ITM' | 'OTM';
    strikeSteps: number;
  }>;
  legwiseSettings: {
    squareOffMode: 'PARTIAL' | 'COMPLETE';
    trailSlToBreakEven: boolean;
    trailScope: 'ALL_LEGS' | 'SL_LEGS';
    noReEntryAfterEnabled: boolean;
    noReEntryAfterTime?: string;
    overallMomentumEnabled: boolean;
    overallMomentumMode?: string;
    overallMomentumValue?: number;
  };
  overallSettings: {
    stopLossEnabled: boolean;
    stopLossMode?: string;
    stopLossValue?: number;
    targetEnabled: boolean;
    targetMode?: string;
    targetValue?: number;
    trailingEnabled: boolean;
    trailingMode?: string;
    trailingTrigger?: number;
    trailingLockProfit?: number;
  };
  advancedConditions?: {
    enabled: boolean;
    entry?: {
      operator: 'AND' | 'OR';
      items: Array<{
        rule?: {
          timeframeUnit: string;
          timeframeInterval: number;
          comparator: string;
          left: { kind: string; source?: string; field?: string; value?: string; valueType?: string };
          right: { kind: string; source?: string; field?: string; value?: string; valueType?: string };
        };
        group?: unknown;
      }>;
    } | null;
    exit?: {
      operator: 'AND' | 'OR';
      items: Array<{
        rule?: {
          timeframeUnit: string;
          timeframeInterval: number;
          comparator: string;
          left: { kind: string; source?: string; field?: string; value?: string; valueType?: string };
          right: { kind: string; source?: string; field?: string; value?: string; valueType?: string };
        };
        group?: unknown;
      }>;
    } | null;
  };
};

type StrategyRow = {
  id: number;
  username: string;
  strategyName: string;
  underlyingKey: string;
  underlyingSource: 'CASH' | 'FUTURES';
  strategyType: 'INTRADAY' | 'BTST' | 'POSITIONAL';
  startDate: string;
  endDate: string;
  entryTime: string;
  exitTime: string;
  legsCount: number;
  strategy: StrategyPayload;
  createdAt: string;
  updatedAt: string;
};

const toRow = (id: number, username: string, strategy: StrategyPayload): StrategyRow => {
  const now = new Date().toISOString();
  return {
    id,
    username,
    strategyName: strategy.strategyName,
    underlyingKey: strategy.underlyingKey,
    underlyingSource: strategy.underlyingSource,
    strategyType: strategy.strategyType,
    startDate: strategy.startDate,
    endDate: strategy.endDate,
    entryTime: strategy.entryTime,
    exitTime: strategy.exitTime,
    legsCount: strategy.legs.length,
    strategy,
    createdAt: now,
    updatedAt: now,
  };
};

const pad2 = (value: number) => value.toString().padStart(2, '0');

const toInputDate = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const startOfCurrentMonth = (date: Date) => toInputDate(new Date(date.getFullYear(), date.getMonth(), 1));

test('Backtest supports strategy save, edit, delete, and run flows', async ({ page }) => {
  const username = 'admin';
  const today = new Date();
  const strategies: StrategyRow[] = [];
  let nextId = 1;
  let createCalls = 0;
  let updateCalls = 0;
  let deleteCalls = 0;
  let runCalls = 0;
  let lastCreatePayload: StrategyPayload | null = null;
  let lastUpdatePayload: StrategyPayload | null = null;
  let lastRunPayload: StrategyPayload | null = null;

  await page.route('**/api/v1/admin/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'backtest-token' }),
    });
  });

  await page.route('**/api/v1/admin/migrations/jobs*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.route('**/api/v1/admin/migrations/status*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
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

  await page.route('**/api/v1/admin/backtest/strategies**', async (route) => {
    const method = route.request().method();
    const url = new URL(route.request().url());
    const strategyIdMatch = url.pathname.match(/\/backtest\/strategies\/(\d+)/);

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          content: strategies,
          totalElements: strategies.length,
          totalPages: strategies.length ? 1 : 0,
          number: 0,
          size: 100,
        }),
      });
      return;
    }

    if (method === 'POST') {
      createCalls += 1;
      const payload = route.request().postDataJSON() as { username: string; strategy: StrategyPayload };
      lastCreatePayload = payload.strategy;
      const created = toRow(nextId, payload.username, payload.strategy);
      nextId += 1;
      strategies.unshift(created);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(created),
      });
      return;
    }

    if (method === 'PUT' && strategyIdMatch) {
      updateCalls += 1;
      const strategyId = Number(strategyIdMatch[1]);
      const payload = route.request().postDataJSON() as { username: string; strategy: StrategyPayload };
      lastUpdatePayload = payload.strategy;
      const idx = strategies.findIndex((item) => item.id === strategyId);
      if (idx >= 0) {
        strategies[idx] = { ...toRow(strategyId, payload.username, payload.strategy), createdAt: strategies[idx].createdAt };
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(strategies[idx]),
      });
      return;
    }

    if (method === 'DELETE' && strategyIdMatch) {
      deleteCalls += 1;
      const strategyId = Number(strategyIdMatch[1]);
      const idx = strategies.findIndex((item) => item.id === strategyId);
      if (idx >= 0) {
        strategies.splice(idx, 1);
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'DELETED', id: strategyId }),
      });
      return;
    }

    await route.fulfill({ status: 400, body: 'Unexpected backtest strategies request' });
  });

  await page.route('**/api/v1/admin/backtest/run', async (route) => {
    runCalls += 1;
    const payload = route.request().postDataJSON() as { username: string; strategy: StrategyPayload };
    lastRunPayload = payload.strategy;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        strategy: payload.strategy,
        rows: [
          {
            tradeDate: '2026-03-03',
            exitDate: '2026-03-03',
            expiryLabel: '06-Mar-2026',
            entryTs: '2026-03-03T09:35:00+05:30',
            exitTs: '2026-03-03T15:15:00+05:30',
            entryUnderlyingPrice: 22450.5,
            exitUnderlyingPrice: 22500.25,
            pnlAmount: 1492.75,
            legsSummary: 'CALL ATM BUY: 1492.75',
            legs: [
              {
                legId: 'leg-1',
                legLabel: 'CALL ATM BUY',
                instrumentKey: 'NSE_FO|999|06-03-2026',
                expiryDate: '2026-03-06',
                strikePrice: 22450,
                lotSize: 75,
                lots: 1,
                entryPrice: 102.2,
                exitPrice: 122.1,
                pnlAmount: 1492.75,
              },
            ],
          },
        ],
        totalPnl: 1492.75,
        averagePnl: 1492.75,
        executedTrades: 1,
        winTrades: 1,
        lossTrades: 0,
        syncedInstruments: 2,
        syncedCandles: 300,
        realWorldAccuracyPct: 100,
        marketPricedTrades: 1,
        fallbackPricedTrades: 0,
        notes: ['Used expired option contracts'],
      }),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Sign In' }).click();

  await page.getByRole('button', { name: 'Backtest' }).click();
  await expect(page.getByRole('heading', { name: 'Backtest', exact: true })).toBeVisible();
  await expect(page.getByLabel('Start Date')).toHaveValue(startOfCurrentMonth(today));
  await expect(page.getByLabel('End Date')).toHaveValue(toInputDate(today));
  const formComboboxes = page.locator('main').getByRole('combobox');
  await expect(formComboboxes.nth(1)).toBeDisabled();
  await expect(formComboboxes.nth(1)).toContainText('Futures');

  await formComboboxes.nth(2).click();
  await expect(page.getByRole('option', { name: 'Intraday' })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Positional' })).toBeVisible();
  await expect(page.getByRole('option', { name: 'BTST' })).toHaveCount(0);
  await page.keyboard.press('Escape');

  await page.getByLabel('Strategy Name').fill('Nifty ATM Momentum');
  await page.getByRole('checkbox', { name: 'Enable Trailing Stop Loss' }).check();
  await page.getByLabel('Trailing SL Value').fill('2');
  await page.getByRole('button', { name: 'Save Strategy' }).click();
  await expect(page.getByText('Strategy saved', { exact: true })).toBeVisible();
  await expect.poll(() => createCalls).toBe(1);
  await expect.poll(() => strategies[0]?.underlyingSource).toBe('FUTURES');
  await expect.poll(() => lastCreatePayload?.overallSettings.trailingEnabled).toBe(true);
  await expect.poll(() => lastCreatePayload?.overallSettings.trailingTrigger).toBe(2);
  await page.getByRole('button', { name: 'Strategy List' }).click();
  await expect(page.getByRole('cell', { name: 'Nifty ATM Momentum' })).toBeVisible();

  const row = page.locator('tr', { hasText: 'Nifty ATM Momentum' });
  await row.locator('button:has(svg[data-testid="EditRoundedIcon"])').click();
  await expect(page.getByLabel('Trailing SL Value')).toHaveValue('2');
  await page.getByLabel('Trailing SL Value').fill('3');
  await page.getByLabel('Strategy Name').fill('Nifty ATM Momentum Updated');
  await page.getByRole('button', { name: 'Save Strategy' }).click();
  await expect.poll(() => updateCalls).toBe(1);
  await expect.poll(() => lastUpdatePayload?.overallSettings.trailingEnabled).toBe(true);
  await expect.poll(() => lastUpdatePayload?.overallSettings.trailingTrigger).toBe(3);
  await page.getByRole('button', { name: 'Strategy List' }).click();
  await expect(page.getByRole('cell', { name: 'Nifty ATM Momentum Updated' })).toBeVisible();

  await page.getByRole('button', { name: 'Backtest P&L' }).click();
  await page.getByRole('button', { name: 'Start Backtest' }).click();
  await expect.poll(() => runCalls).toBe(1);
  await expect.poll(() => lastRunPayload?.overallSettings.trailingEnabled).toBe(true);
  await expect.poll(() => lastRunPayload?.overallSettings.trailingTrigger).toBe(3);
  await expect(page.getByText('Backtest completed with 1 trades', { exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Entry Time' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Exit Time' })).toBeVisible();
  await expect(page.getByRole('cell', { name: '09:35' })).toBeVisible();
  await expect(page.getByRole('cell', { name: '15:15' })).toBeVisible();
  await expect(page.getByText('CALL ATM BUY: 1492.75')).toBeVisible();
  await expect(page.getByText('Trades 1')).toBeVisible();

  await page.getByRole('button', { name: 'Strategy List' }).click();
  const updatedRow = page.locator('tr', { hasText: 'Nifty ATM Momentum Updated' });
  await updatedRow.locator('button:has(svg[data-testid="DeleteOutlineRoundedIcon"])').click();
  await expect(page.getByText('Strategy deleted', { exact: true })).toBeVisible();
  await expect.poll(() => deleteCalls).toBe(1);
  await expect(page.getByText('No strategy saved yet')).toBeVisible();
});

test('Backtest Target, Stop Loss, and Trailing Stop Loss controls work end-to-end from UI', async ({ page }) => {
  const strategies: StrategyRow[] = [];
  let nextId = 1;
  let createCalls = 0;
  let updateCalls = 0;
  let runCalls = 0;
  let lastCreatePayload: StrategyPayload | null = null;
  let lastUpdatePayload: StrategyPayload | null = null;
  let lastRunPayload: StrategyPayload | null = null;

  await page.route('**/api/v1/admin/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'backtest-risk-token' }),
    });
  });

  await page.route('**/api/v1/admin/migrations/jobs*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.route('**/api/v1/admin/migrations/status*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
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

  await page.route('**/api/v1/admin/backtest/strategies**', async (route) => {
    const method = route.request().method();
    const url = new URL(route.request().url());
    const strategyIdMatch = url.pathname.match(/\/backtest\/strategies\/(\d+)/);

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          content: strategies,
          totalElements: strategies.length,
          totalPages: strategies.length ? 1 : 0,
          number: 0,
          size: 100,
        }),
      });
      return;
    }

    if (method === 'POST') {
      createCalls += 1;
      const payload = route.request().postDataJSON() as { username: string; strategy: StrategyPayload };
      lastCreatePayload = payload.strategy;
      const created = toRow(nextId, payload.username, payload.strategy);
      nextId += 1;
      strategies.unshift(created);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(created),
      });
      return;
    }

    if (method === 'PUT' && strategyIdMatch) {
      updateCalls += 1;
      const strategyId = Number(strategyIdMatch[1]);
      const payload = route.request().postDataJSON() as { username: string; strategy: StrategyPayload };
      lastUpdatePayload = payload.strategy;
      const idx = strategies.findIndex((item) => item.id === strategyId);
      if (idx >= 0) {
        strategies[idx] = { ...toRow(strategyId, payload.username, payload.strategy), createdAt: strategies[idx].createdAt };
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(strategies[idx]),
      });
      return;
    }

    await route.fulfill({ status: 400, body: 'Unexpected backtest strategies request' });
  });

  await page.route('**/api/v1/admin/backtest/run', async (route) => {
    runCalls += 1;
    const payload = route.request().postDataJSON() as { username: string; strategy: StrategyPayload };
    lastRunPayload = payload.strategy;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        strategy: payload.strategy,
        rows: [],
        totalPnl: 0,
        averagePnl: 0,
        executedTrades: 0,
        winTrades: 0,
        lossTrades: 0,
        syncedInstruments: 0,
        syncedCandles: 0,
        realWorldAccuracyPct: 100,
        marketPricedTrades: 0,
        fallbackPricedTrades: 0,
        notes: [],
      }),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.getByRole('button', { name: 'Backtest' }).click();
  await expect(page.getByRole('heading', { name: 'Backtest', exact: true })).toBeVisible();

  await page.getByLabel('Strategy Name').fill('Risk Controls Strategy');

  await page.getByRole('checkbox', { name: 'Enable Stop Loss' }).check();
  await page.getByRole('spinbutton', { name: 'SL Value', exact: true }).fill('8');
  await page.getByRole('checkbox', { name: 'Enable Target' }).check();
  await page.getByRole('spinbutton', { name: 'Target Value', exact: true }).fill('12');
  await page.getByRole('checkbox', { name: 'Enable Trailing Stop Loss' }).check();
  await page.getByRole('spinbutton', { name: 'Trailing SL Value', exact: true }).fill('3');

  await page.getByRole('button', { name: 'Save Strategy' }).click();
  await expect.poll(() => createCalls).toBe(1);
  await expect.poll(() => lastCreatePayload?.overallSettings.stopLossEnabled).toBe(true);
  await expect.poll(() => lastCreatePayload?.overallSettings.stopLossValue).toBe(8);
  await expect.poll(() => lastCreatePayload?.overallSettings.targetEnabled).toBe(true);
  await expect.poll(() => lastCreatePayload?.overallSettings.targetValue).toBe(12);
  await expect.poll(() => lastCreatePayload?.overallSettings.trailingEnabled).toBe(true);
  await expect.poll(() => lastCreatePayload?.overallSettings.trailingTrigger).toBe(3);

  await page.getByRole('button', { name: 'Strategy List' }).click();
  const row = page.locator('tr', { hasText: 'Risk Controls Strategy' });
  await row.locator('button:has(svg[data-testid="EditRoundedIcon"])').click();

  await page.getByRole('spinbutton', { name: 'SL Value', exact: true }).fill('9');
  await page.getByRole('spinbutton', { name: 'Target Value', exact: true }).fill('14');
  await page.getByRole('spinbutton', { name: 'Trailing SL Value', exact: true }).fill('4');
  await page.getByRole('button', { name: 'Save Strategy' }).click();
  await expect.poll(() => updateCalls).toBe(1);
  await expect.poll(() => lastUpdatePayload?.overallSettings.stopLossValue).toBe(9);
  await expect.poll(() => lastUpdatePayload?.overallSettings.targetValue).toBe(14);
  await expect.poll(() => lastUpdatePayload?.overallSettings.trailingTrigger).toBe(4);

  await page.getByRole('button', { name: 'Start Backtest' }).click();
  await expect.poll(() => runCalls).toBe(1);
  await expect.poll(() => lastRunPayload?.overallSettings.stopLossEnabled).toBe(true);
  await expect.poll(() => lastRunPayload?.overallSettings.stopLossValue).toBe(9);
  await expect.poll(() => lastRunPayload?.overallSettings.targetEnabled).toBe(true);
  await expect.poll(() => lastRunPayload?.overallSettings.targetValue).toBe(14);
  await expect.poll(() => lastRunPayload?.overallSettings.trailingEnabled).toBe(true);
  await expect.poll(() => lastRunPayload?.overallSettings.trailingTrigger).toBe(4);
});

test('Backtest advance conditions are saved, edited, and sent on run', async ({ page }) => {
  const strategies: StrategyRow[] = [];
  let nextId = 1;
  let createCalls = 0;
  let runCalls = 0;
  let lastCreatePayload: StrategyPayload | null = null;
  let lastRunPayload: StrategyPayload | null = null;

  await page.route('**/api/v1/admin/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'backtest-advance-token' }),
    });
  });

  await page.route('**/api/v1/admin/migrations/jobs*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.route('**/api/v1/admin/migrations/status*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
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

  await page.route('**/api/v1/admin/backtest/strategies**', async (route) => {
    const method = route.request().method();
    const url = new URL(route.request().url());

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          content: strategies,
          totalElements: strategies.length,
          totalPages: strategies.length ? 1 : 0,
          number: 0,
          size: 100,
        }),
      });
      return;
    }

    if (method === 'POST') {
      createCalls += 1;
      const payload = route.request().postDataJSON() as { username: string; strategy: StrategyPayload };
      lastCreatePayload = payload.strategy;
      const created = toRow(nextId, payload.username, payload.strategy);
      nextId += 1;
      strategies.unshift(created);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(created),
      });
      return;
    }

    await route.fulfill({ status: 400, body: `Unexpected request ${url.pathname}` });
  });

  await page.route('**/api/v1/admin/backtest/run', async (route) => {
    runCalls += 1;
    const payload = route.request().postDataJSON() as { username: string; strategy: StrategyPayload };
    lastRunPayload = payload.strategy;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        strategy: payload.strategy,
        rows: [],
        totalPnl: 0,
        averagePnl: 0,
        executedTrades: 0,
        winTrades: 0,
        lossTrades: 0,
        syncedInstruments: 0,
        syncedCandles: 0,
        realWorldAccuracyPct: 100,
        marketPricedTrades: 0,
        fallbackPricedTrades: 0,
        notes: ['Advance conditions applied'],
      }),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.getByRole('button', { name: 'Backtest' }).click();

  await page.getByLabel('Strategy Name').fill('Advance Condition Strategy');
  await expect(page.getByTestId('backtest-logic-preview')).toContainText('Basic mode only');
  await page.getByRole('checkbox', { name: 'Enable Advance Conditions' }).check();
  await expect(page.getByTestId('advanced-conditions-editor')).toContainText('Advance');
  await expect(page.getByTestId('backtest-logic-preview')).toContainText('Trading Signal Signal equal to "BUY"');

  const entryGroup = page.getByTestId('advanced-entry-group');
  await entryGroup.getByRole('button', { name: 'Add condition' }).click();
  await entryGroup.getByRole('combobox').nth(0).click();
  await page.getByRole('option', { name: 'or' }).click();
  await entryGroup.getByLabel('Value').first().fill('SELL');
  await expect(page.getByTestId('backtest-logic-preview')).toContainText('Trading Signal Signal equal to "SELL"');
  await expect(page.getByTestId('backtest-logic-preview')).toContainText('Enter when');

  await page.getByRole('button', { name: 'Save Strategy' }).click();
  await expect.poll(() => createCalls).toBe(1);
  await expect.poll(() => lastCreatePayload?.advancedConditions?.enabled).toBe(true);
  await expect.poll(() => lastCreatePayload?.advancedConditions?.entry?.operator).toBe('OR');
  await expect.poll(() => lastCreatePayload?.advancedConditions?.entry?.items.length).toBe(2);
  await expect.poll(() => lastCreatePayload?.advancedConditions?.entry?.items[0]?.rule?.right?.value).toBe('SELL');
  await expect.poll(() => lastCreatePayload?.advancedConditions?.exit?.items.length).toBe(1);

  await page.getByRole('button', { name: 'Strategy List' }).click();
  await page.locator('tr', { hasText: 'Advance Condition Strategy' })
    .locator('button:has(svg[data-testid="EditRoundedIcon"])')
    .click();
  await expect(page.getByRole('checkbox', { name: 'Enable Advance Conditions' })).toBeChecked();
  await expect(page.getByTestId('backtest-logic-preview')).toContainText('Trading Signal Signal equal to "SELL"');
  await page.getByRole('button', { name: 'Backtest P&L' }).click();
  await page.getByRole('button', { name: 'Start Backtest' }).click();
  await expect.poll(() => runCalls).toBe(1);
  await expect.poll(() => lastRunPayload?.advancedConditions?.enabled).toBe(true);
  await expect.poll(() => lastRunPayload?.advancedConditions?.entry?.operator).toBe('OR');
  await expect(page.getByText('Advance conditions applied')).toBeVisible();
});

test('Backtest Trading Signal and Trading Param sections render grid data', async ({ page }) => {
  const tradingSignalCalls: Array<{
    instrumentKey: string | null;
    timeframeUnit: string | null;
    timeframeInterval: string | null;
    signal: string | null;
    fromDate: string | null;
    toDate: string | null;
    page: string | null;
    size: string | null;
  }> = [];
  const tradingDayParamCalls: Array<{
    instrumentKey: string | null;
    fromDate: string | null;
    toDate: string | null;
    page: string | null;
    size: string | null;
  }> = [];
  const marketTrendCalls: Array<{
    marketScope: string | null;
    trendStatus: string | null;
    fromSnapshotAt: string | null;
    toSnapshotAt: string | null;
    page: string | null;
    size: string | null;
  }> = [];

  await page.route('**/api/v1/admin/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'backtest-analytics-token' }),
    });
  });

  await page.route('**/api/v1/admin/migrations/jobs*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.route('**/api/v1/admin/migrations/status*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
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

  await page.route('**/api/v1/admin/backtest/strategies**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: [],
        totalElements: 0,
        totalPages: 0,
        number: 0,
        size: 25,
      }),
    });
  });

  await page.route('**/api/v1/admin/backtest/trading-signals*', async (route) => {
    const url = new URL(route.request().url());
    tradingSignalCalls.push({
      instrumentKey: url.searchParams.get('instrumentKey'),
      timeframeUnit: url.searchParams.get('timeframeUnit'),
      timeframeInterval: url.searchParams.get('timeframeInterval'),
      signal: url.searchParams.get('signal'),
      fromDate: url.searchParams.get('fromDate'),
      toDate: url.searchParams.get('toDate'),
      page: url.searchParams.get('page'),
      size: url.searchParams.get('size'),
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: [
          {
            id: 101,
            instrumentKey: 'NSE_INDEX|Nifty 50',
            timeframeUnit: 'minutes',
            timeframeInterval: 5,
            signalDate: '2026-03-14',
            previousClose: 22012.3,
            currentClose: 22044.6,
            dma9: 22030.2,
            dma26: 22018.8,
            dma110: 21990.1,
            signal: 'BUY',
            createdAt: '2026-03-14T09:20:00Z',
            updatedAt: '2026-03-14T09:21:00Z',
          },
        ],
        totalElements: 1,
        totalPages: 1,
        number: Number(url.searchParams.get('page') ?? '0'),
        size: Number(url.searchParams.get('size') ?? '25'),
      }),
    });
  });

  await page.route('**/api/v1/admin/backtest/trading-day-params*', async (route) => {
    const url = new URL(route.request().url());
    tradingDayParamCalls.push({
      instrumentKey: url.searchParams.get('instrumentKey'),
      fromDate: url.searchParams.get('fromDate'),
      toDate: url.searchParams.get('toDate'),
      page: url.searchParams.get('page'),
      size: url.searchParams.get('size'),
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: [
          {
            id: 202,
            tradeDate: '2026-03-14',
            instrumentKey: 'NSE_INDEX|Nifty 50',
            orbHigh: 22050.2,
            orbLow: 21980.4,
            orbBreakout: 'Yes',
            orbBreakdown: 'No',
            todayOpen: 22000.5,
            todayClose: 22040.9,
            prevHigh: 22010.3,
            prevLow: 21950.8,
            prevClose: 21985.6,
            gapPct: 0.63,
            gapType: 'Gap Up',
            gapUpPct: 0.63,
            gapDownPct: null,
            createdAt: '2026-03-14T09:20:00Z',
            updatedAt: '2026-03-14T09:21:00Z',
          },
        ],
        totalElements: 1,
        totalPages: 1,
        number: Number(url.searchParams.get('page') ?? '0'),
        size: Number(url.searchParams.get('size') ?? '25'),
      }),
    });
  });

  await page.route('**/api/v1/admin/backtest/market-trends*', async (route) => {
    const url = new URL(route.request().url());
    marketTrendCalls.push({
      marketScope: url.searchParams.get('marketScope'),
      trendStatus: url.searchParams.get('trendStatus'),
      fromSnapshotAt: url.searchParams.get('fromSnapshotAt'),
      toSnapshotAt: url.searchParams.get('toSnapshotAt'),
      page: url.searchParams.get('page'),
      size: url.searchParams.get('size'),
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: [
          {
            id: 303,
            marketScope: 'GLOBAL_NEWS',
            marketName: 'Global Market Trend',
            evaluationType: 'NEWS',
            trendStatus: 'BEAR',
            reason: 'BEAR from 3 matched articles across 5 sources',
            currentValue: null,
            ema9: null,
            ema21: null,
            ema110: null,
            sourceCount: 5,
            evidenceCount: 3,
            sourceNames: 'Google News, CNBC World, MarketWatch Markets',
            dataAsOf: '2026-03-21T10:00:00Z',
            snapshotAt: '2026-03-21T10:05:00Z',
            createdAt: '2026-03-21T10:05:00Z',
            updatedAt: '2026-03-21T10:05:00Z',
          },
        ],
        totalElements: 1,
        totalPages: 1,
        number: Number(url.searchParams.get('page') ?? '0'),
        size: Number(url.searchParams.get('size') ?? '25'),
      }),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.getByRole('button', { name: 'Backtest' }).click();

  await page.getByRole('button', { name: 'Trading Signal' }).click();
  await expect(page.getByRole('heading', { name: 'Trading Signal' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'NSE_INDEX|Nifty 50' }).first()).toBeVisible();
  await expect(page.getByRole('cell', { name: 'BUY' })).toBeVisible();
  await expect.poll(() => tradingSignalCalls.at(-1)?.page ?? null).toBe('0');
  await expect.poll(() => tradingSignalCalls.at(-1)?.size ?? null).toBe('25');
  await expect.poll(() => tradingSignalCalls.at(-1)?.instrumentKey ?? null).toBe(null);
  await expect.poll(() => tradingSignalCalls.at(-1)?.signal ?? null).toBe(null);

  await page.getByLabel('Index').click();
  await page.getByRole('option', { name: 'Nifty 50' }).click();
  await page.getByLabel('Timeframe').click();
  await page.getByRole('option', { name: '15 minutes' }).click();
  await page.getByLabel('Signal').click();
  await page.getByRole('option', { name: 'BUY' }).click();
  await page.getByLabel('From Date').fill('2026-03-10');
  await page.getByLabel('To Date').fill('2026-03-14');
  await page.getByRole('button', { name: 'Apply Filters' }).click();
  await expect.poll(() => tradingSignalCalls.at(-1)?.instrumentKey ?? null).toBe('NSE_INDEX|Nifty 50');
  await expect.poll(() => tradingSignalCalls.at(-1)?.timeframeUnit ?? null).toBe('minutes');
  await expect.poll(() => tradingSignalCalls.at(-1)?.timeframeInterval ?? null).toBe('15');
  await expect.poll(() => tradingSignalCalls.at(-1)?.signal ?? null).toBe('BUY');
  await expect.poll(() => tradingSignalCalls.at(-1)?.fromDate ?? null).toBe('2026-03-10');
  await expect.poll(() => tradingSignalCalls.at(-1)?.toDate ?? null).toBe('2026-03-14');

  await page.getByRole('button', { name: 'Trading Param' }).click();
  await expect(page.getByRole('heading', { name: 'Trading Param' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Gap Up' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Yes' })).toBeVisible();
  await expect.poll(() => tradingDayParamCalls.at(-1)?.page ?? null).toBe('0');
  await expect.poll(() => tradingDayParamCalls.at(-1)?.size ?? null).toBe('25');
  await expect.poll(() => tradingDayParamCalls.at(-1)?.instrumentKey ?? null).toBe(null);

  await page.getByLabel('Index').click();
  await page.getByRole('option', { name: 'Nifty Bank' }).click();
  await page.getByLabel('From Date').fill('2026-03-01');
  await page.getByLabel('To Date').fill('2026-03-14');
  await page.getByRole('button', { name: 'Apply Filters' }).click();
  await expect.poll(() => tradingDayParamCalls.at(-1)?.instrumentKey ?? null).toBe('NSE_INDEX|Nifty Bank');
  await expect.poll(() => tradingDayParamCalls.at(-1)?.fromDate ?? null).toBe('2026-03-01');
  await expect.poll(() => tradingDayParamCalls.at(-1)?.toDate ?? null).toBe('2026-03-14');

  await page.getByRole('button', { name: 'Market Trend' }).click();
  await expect(page.getByRole('heading', { name: 'Market Trend' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Global Market Trend' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'BEAR', exact: true }).first()).toBeVisible();
  await expect.poll(() => marketTrendCalls.at(-1)?.page ?? null).toBe('0');
  await expect.poll(() => marketTrendCalls.at(-1)?.size ?? null).toBe('25');

  await page.getByLabel('Market').click();
  await page.getByRole('option', { name: 'Gift Nifty' }).click();
  await page.getByLabel('Trend').click();
  await page.getByRole('option', { name: 'HOLD' }).click();
  await page.getByLabel('From Date').fill('2026-03-20');
  await page.getByLabel('To Date').fill('2026-03-21');
  await page.getByRole('button', { name: 'Apply Filters' }).click();
  await expect.poll(() => marketTrendCalls.at(-1)?.marketScope ?? null).toBe('GIFT_NIFTY');
  await expect.poll(() => marketTrendCalls.at(-1)?.trendStatus ?? null).toBe('HOLD');
  await expect.poll(() => marketTrendCalls.at(-1)?.fromSnapshotAt ?? null).toContain('2026-03-20T00:00:00.000Z');
  await expect.poll(() => marketTrendCalls.at(-1)?.toSnapshotAt ?? null).toContain('2026-03-21T23:59:59.999Z');
});
