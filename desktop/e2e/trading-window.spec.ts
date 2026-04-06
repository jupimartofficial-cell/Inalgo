import { expect, test } from '@playwright/test';

const INSTRUMENTS = [
  'NSE_INDEX|Nifty 50',
  'NSE_INDEX|Nifty Bank',
  'BSE_INDEX|SENSEX',
  'NSE_FO|51714',
  'NSE_FO|51701',
  'BSE_FO|825565',
];

const toIntervalMinutes = (unit: string, interval: number) => {
  if (unit === 'days') return interval * 24 * 60;
  if (unit === 'weeks') return interval * 7 * 24 * 60;
  if (unit === 'months') return interval * 30 * 24 * 60;
  return interval;
};

const buildCandles = (instrumentKey: string, timeframeUnit: string, timeframeInterval: number) => {
  const intervalMins = toIntervalMinutes(timeframeUnit, timeframeInterval);
  const now = Date.now();
  return Array.from({ length: 120 }).map((_, idx) => {
    const base = 22000 + idx * 2;
    const open = base + Math.sin(idx / 4) * 6;
    const close = open + Math.cos(idx / 3) * 5;
    const high = Math.max(open, close) + 8;
    const low = Math.min(open, close) - 8;
    return {
      instrumentKey,
      timeframeUnit,
      timeframeInterval,
      candleTs: new Date(now - (120 - idx) * intervalMins * 60_000).toISOString(),
      openPrice: Number(open.toFixed(2)),
      highPrice: Number(high.toFixed(2)),
      lowPrice: Number(low.toFixed(2)),
      closePrice: Number(close.toFixed(2)),
      volume: 100000 + idx * 250,
    };
  });
};

test('Trading window supports chart/tab constraints and preference persistence', async ({ page }) => {
  let savedPreferences: unknown = null;

  await page.route('**/api/v1/admin/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'mock-token' }),
    });
  });

  await page.route('**/api/v1/admin/migrations/jobs', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route('**/api/v1/admin/migrations/status*', async (route) => {
    const statusRows = [
      {
        instrumentKey: 'NSE_INDEX|Nifty 50',
        timeframeUnit: 'minutes',
        timeframeInterval: 1,
        nextFromDate: '2025-01-01',
        completed: false,
        lastRunStatus: 'RUNNING',
        lastRunAt: new Date().toISOString(),
      },
      {
        instrumentKey: 'NSE_INDEX|Nifty Bank',
        timeframeUnit: 'minutes',
        timeframeInterval: 5,
        nextFromDate: '2025-01-01',
        completed: true,
        lastRunStatus: 'COMPLETED',
        lastRunAt: new Date().toISOString(),
      },
      {
        instrumentKey: 'BSE_INDEX|SENSEX',
        timeframeUnit: 'days',
        timeframeInterval: 1,
        nextFromDate: '2025-01-01',
        completed: true,
        lastRunStatus: 'COMPLETED',
        lastRunAt: new Date().toISOString(),
      },
    ];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(statusRows),
    });
  });

  await page.route('**/api/v1/admin/historical-data*', async (route) => {
    const url = new URL(route.request().url());
    const instrumentKey = url.searchParams.get('instrumentKey');
    const timeframeUnit = url.searchParams.get('timeframeUnit');
    const timeframeInterval = Number(url.searchParams.get('timeframeInterval') ?? '1');

    const candles = instrumentKey && timeframeUnit
      ? buildCandles(instrumentKey, timeframeUnit, timeframeInterval)
      : INSTRUMENTS.flatMap((instrument) => buildCandles(instrument, 'minutes', 1).slice(0, 20));

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: candles,
        totalElements: candles.length,
        totalPages: 1,
        number: 0,
        size: candles.length,
      }),
    });
  });

  await page.route('**/api/v1/admin/trading/preferences*', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          username: 'admin',
          preferences: savedPreferences,
          updatedAt: savedPreferences ? new Date().toISOString() : null,
        }),
      });
      return;
    }

    const payload = route.request().postDataJSON() as {
      username: string;
      preferences: unknown;
    };
    savedPreferences = payload.preferences;

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        username: payload.username,
        preferences: payload.preferences,
        updatedAt: new Date().toISOString(),
      }),
    });
  });

  await page.goto('/');

  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  await page.getByRole('button', { name: 'Trading window' }).click();
  await expect(page.getByRole('heading', { name: 'Trading window' })).toBeVisible();
  await expect(page.getByText('2 charts', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Indicators' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Compare' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Objects' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Auto' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log' }).first()).toBeVisible();
  await expect(page.getByLabel('Chart settings').first()).toBeVisible();
  await expect(page.getByLabel('Take a snapshot').first()).toBeVisible();
  await expect(page.getByTestId('trading-chart-drawing-tool-trendLine').first()).toBeVisible();

  await page.getByRole('button', { name: 'Indicators' }).first().click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Indicators', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Pivot Levels/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /MACD/ })).toBeVisible();
  await page.keyboard.press('Escape');

  const addChartButton = page.getByTestId('trading-window-add-chart');
  await addChartButton.click();
  await expect(page.getByText('3 charts', { exact: true })).toBeVisible();

  await page.getByTestId('trading-window-save-layout').click();
  await expect.poll(() => {
    const prefs = savedPreferences as { tabs?: Array<{ charts?: unknown[] }> } | null;
    return prefs?.tabs?.[0]?.charts?.length ?? 0;
  }).toBe(3);

  const deleteButtons = page.locator('[data-testid^="trading-window-delete-chart-"]');
  await expect(deleteButtons).toHaveCount(3);
  await deleteButtons.first().click();
  await expect(page.getByText('2 charts', { exact: true })).toBeVisible();
  await expect(deleteButtons.first()).toBeDisabled();

  const addTabButton = page.getByTestId('trading-window-add-tab');
  await addTabButton.click();
  await addTabButton.click();
  await addTabButton.click();
  await addTabButton.click();
  await expect(page.locator('[role="tab"]')).toHaveCount(5);
  await expect(addTabButton).toBeDisabled();

  await page.reload();
  const signInVisible = await page.getByRole('button', { name: 'Sign In' }).isVisible({ timeout: 1200 }).catch(() => false);
  if (signInVisible) {
    await page.getByRole('button', { name: 'Sign In' }).click();
  }
  await page.getByRole('button', { name: 'Trading window' }).click();
  await expect(page.getByRole('heading', { name: 'Trading window' })).toBeVisible();
  await expect(page.getByText('3 charts', { exact: true })).toBeVisible();
});

test('Migration jobs remain synced with browser session after refresh', async ({ page }) => {
  let migrationJobsCalls = 0;

  await page.route('**/api/v1/admin/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'session-token' }),
    });
  });

  await page.route('**/api/v1/admin/migrations/jobs', async (route) => {
    migrationJobsCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          instrumentKey: 'NSE_INDEX|Nifty 50',
          timeframeUnit: 'minutes',
          timeframeInterval: 1,
          bootstrapFromDate: '2025-01-01',
          status: 'RUNNING',
          progressPercent: 47,
          nextFromDate: '2025-02-01',
          updatedAt: new Date().toISOString(),
        },
      ]),
    });
  });

  await page.route('**/api/v1/admin/migrations/status*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          instrumentKey: 'NSE_INDEX|Nifty 50',
          timeframeUnit: 'minutes',
          timeframeInterval: 1,
          nextFromDate: '2025-02-01',
          completed: false,
          lastRunStatus: 'RUNNING',
          lastRunAt: new Date().toISOString(),
        },
      ]),
    });
  });

  await page.route('**/api/v1/admin/historical-data*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: [],
        totalElements: 0,
        totalPages: 0,
        number: 0,
        size: 50,
      }),
    });
  });

  await page.route('**/api/v1/admin/upstox/token', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ configured: true, updatedAt: new Date().toISOString() }),
    });
  });

  await page.route('**/api/v1/admin/trading/preferences*', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ username: 'admin', preferences: null, updatedAt: null }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ username: 'admin', preferences: null, updatedAt: new Date().toISOString() }),
    });
  });

  await page.goto('/');
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const dashboardVisible = await page.getByRole('heading', { name: 'Dashboard' }).isVisible({ timeout: 1200 }).catch(() => false);
    if (dashboardVisible) break;
    await page.getByRole('button', { name: 'Sign In' }).click();
  }
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await page.getByRole('button', { name: 'Migration Jobs' }).click();
  await expect(page.getByRole('heading', { name: 'Migration Jobs', exact: true })).toBeVisible();
  await expect(page.getByText('Nifty 50', { exact: true }).last()).toBeVisible();

  await page.reload();
  const needsSignInAgain = await page.getByRole('button', { name: 'Sign In' }).isVisible({ timeout: 1200 }).catch(() => false);
  expect(needsSignInAgain).toBeFalsy();
  await expect(page.getByRole('heading', { name: 'Migration Jobs', exact: true })).toBeVisible();
  await expect.poll(() => migrationJobsCalls).toBeGreaterThan(1);
});

test('Migration Start Pause Resume Stop controls work in browser flow', async ({ page }) => {
  let currentStatus: 'FAILED' | 'RUNNING' | 'PAUSED' | 'STOPPED' = 'FAILED';
  let startCalls = 0;
  let pauseCalls = 0;
  let resumeCalls = 0;
  let stopCalls = 0;

  await page.route('**/api/v1/admin/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'controls-token' }),
    });
  });

  await page.route('**/api/v1/admin/migrations/status*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          instrumentKey: 'NSE_INDEX|Nifty 50',
          timeframeUnit: 'minutes',
          timeframeInterval: 1,
          nextFromDate: '2025-02-01',
          completed: currentStatus === 'STOPPED' ? false : false,
          lastRunStatus: currentStatus,
          lastRunAt: new Date().toISOString(),
        },
      ]),
    });
  });

  await page.route('**/api/v1/admin/migrations/jobs', async (route) => {
    const progress = currentStatus === 'RUNNING' ? 48 : currentStatus === 'PAUSED' ? 52 : 31;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          instrumentKey: 'NSE_INDEX|Nifty 50',
          timeframeUnit: 'minutes',
          timeframeInterval: 1,
          bootstrapFromDate: '2025-01-01',
          status: currentStatus,
          progressPercent: progress,
          nextFromDate: '2025-02-01',
          updatedAt: new Date().toISOString(),
          lastError: currentStatus === 'FAILED' ? 'simulated failure' : null,
        },
      ]),
    });
  });

  await page.route('**/api/v1/admin/migrations/*/start', async (route) => {
    startCalls += 1;
    currentStatus = 'RUNNING';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'STARTED' }),
    });
  });

  await page.route('**/api/v1/admin/migrations/*/pause', async (route) => {
    pauseCalls += 1;
    currentStatus = 'PAUSED';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'PAUSED' }),
    });
  });

  await page.route('**/api/v1/admin/migrations/*/resume', async (route) => {
    resumeCalls += 1;
    currentStatus = 'RUNNING';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'RESUMED' }),
    });
  });

  await page.route('**/api/v1/admin/migrations/*/stop', async (route) => {
    stopCalls += 1;
    currentStatus = 'STOPPED';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'STOPPED' }),
    });
  });

  await page.route('**/api/v1/admin/upstox/token', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ configured: true, updatedAt: new Date().toISOString() }),
      });
      return;
    }
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
      body: JSON.stringify({
        content: [],
        totalElements: 0,
        totalPages: 0,
        number: 0,
        size: 50,
      }),
    });
  });

  await page.route('**/api/v1/admin/trading/preferences*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ username: 'admin', preferences: null, updatedAt: null }),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Sign In' }).click();
  const signInStillVisible = await page.getByRole('button', { name: 'Sign In' }).isVisible({ timeout: 1200 }).catch(() => false);
  if (signInStillVisible) {
    await page.getByRole('button', { name: 'Sign In' }).click();
  }
  await page.getByRole('button', { name: 'Migration Jobs' }).click();
  await expect(page.getByRole('heading', { name: 'Migration Jobs', exact: true })).toBeVisible();

  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect.poll(() => startCalls).toBe(1);
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();

  await page.getByRole('button', { name: 'Pause' }).click();
  await expect.poll(() => pauseCalls).toBe(1);
  await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();

  await page.getByRole('button', { name: 'Resume' }).click();
  await expect.poll(() => resumeCalls).toBe(1);
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();

  await page.getByRole('button', { name: 'Stop' }).click();
  await expect.poll(() => stopCalls).toBe(1);
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
});

test('UI supports futures instruments in filters and trading charts', async ({ page }) => {
  const requestedInstrumentKeys: string[] = [];

  await page.route('**/api/v1/admin/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'futures-token' }),
    });
  });

  await page.route('**/api/v1/admin/migrations/jobs', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          instrumentKey: 'NSE_FO|51714',
          timeframeUnit: 'days',
          timeframeInterval: 1,
          bootstrapFromDate: '2024-01-01',
          status: 'RUNNING',
          progressPercent: 52,
          nextFromDate: '2026-03-07',
          updatedAt: new Date().toISOString(),
        },
      ]),
    });
  });

  await page.route('**/api/v1/admin/migrations/status*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          instrumentKey: 'NSE_FO|51714',
          timeframeUnit: 'days',
          timeframeInterval: 1,
          nextFromDate: '2026-03-07',
          completed: false,
          lastRunStatus: 'RUNNING',
          lastRunAt: new Date().toISOString(),
        },
      ]),
    });
  });

  await page.route('**/api/v1/admin/historical-data*', async (route) => {
    const url = new URL(route.request().url());
    const instrumentKey = url.searchParams.get('instrumentKey');
    const timeframeUnit = url.searchParams.get('timeframeUnit') ?? 'minutes';
    const timeframeInterval = Number(url.searchParams.get('timeframeInterval') ?? '1');
    if (instrumentKey) {
      requestedInstrumentKeys.push(instrumentKey);
    }

    const candles = instrumentKey
      ? buildCandles(instrumentKey, timeframeUnit, timeframeInterval)
      : buildCandles('NSE_INDEX|Nifty 50', 'minutes', 1).slice(0, 20);

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: candles,
        totalElements: candles.length,
        totalPages: 1,
        number: 0,
        size: candles.length,
      }),
    });
  });

  await page.route('**/api/v1/admin/trading/preferences*', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ username: 'admin', preferences: null, updatedAt: null }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ username: 'admin', preferences: null, updatedAt: new Date().toISOString() }),
    });
  });

  await page.route('**/api/v1/admin/upstox/token', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ configured: true, updatedAt: new Date().toISOString() }),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Sign In' }).click();

  await page.getByRole('button', { name: 'Historical Data' }).click();
  await expect(page.getByRole('heading', { name: 'Historical Data' })).toBeVisible();

  await page.getByRole('combobox').first().click();
  await expect(page.locator('li[role="option"][data-value="NSE_FO|51714"]')).toBeVisible();
  await page.locator('li[role="option"][data-value="NSE_FO|51714"]').click();
  await page.getByRole('button', { name: 'Apply Filters' }).click();
  await expect.poll(
    () => requestedInstrumentKeys.filter((key) => key === 'NSE_FO|51714').length,
  ).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'Trading window' }).click();
  await expect(page.getByRole('heading', { name: 'Trading window' })).toBeVisible();
  await page.locator('[data-testid^="trading-window-chart-"]').first().getByRole('combobox').first().click();
  await page.locator('li[role="option"][data-value="NSE_FO|51714"]').click();

  await expect.poll(
    () => requestedInstrumentKeys.filter((key) => key === 'NSE_FO|51714').length,
  ).toBeGreaterThan(1);
});

test('Migration runtime and status tabs support pagination', async ({ page }) => {
  const runtimeJobs = Array.from({ length: 13 }).map((_, idx) => ({
    instrumentKey: `NSE_INDEX|Runtime-${idx + 1}`,
    timeframeUnit: 'minutes',
    timeframeInterval: 1,
    bootstrapFromDate: '2025-01-01',
    status: idx % 2 === 0 ? 'RUNNING' : 'PAUSED',
    progressPercent: 10 + idx * 3,
    nextFromDate: '2025-02-01',
    updatedAt: new Date().toISOString(),
  }));
  const statusRows = Array.from({ length: 23 }).map((_, idx) => ({
    instrumentKey: `NSE_INDEX|Status-${idx + 1}`,
    timeframeUnit: 'minutes',
    timeframeInterval: 5,
    nextFromDate: '2025-02-01',
    completed: false,
    lastRunStatus: idx % 3 === 0 ? 'RUNNING' : 'PENDING',
    lastRunAt: new Date().toISOString(),
  }));

  await page.route('**/api/v1/admin/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'pagination-token' }),
    });
  });

  await page.route('**/api/v1/admin/migrations/jobs', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(runtimeJobs),
    });
  });

  await page.route('**/api/v1/admin/migrations/status*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(statusRows),
    });
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
      body: JSON.stringify({
        content: [],
        totalElements: 0,
        totalPages: 0,
        number: 0,
        size: 50,
      }),
    });
  });

  await page.route('**/api/v1/admin/trading/preferences*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ username: 'admin', preferences: null, updatedAt: null }),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.getByRole('button', { name: 'Migration Jobs' }).click();
  await expect(page.getByRole('heading', { name: 'Migration Jobs', exact: true })).toBeVisible();

  await expect(page.getByText('NSE_INDEX|Runtime-1', { exact: true })).toBeVisible();
  await expect(page.getByText('NSE_INDEX|Runtime-7', { exact: true })).not.toBeVisible();
  await page.getByTestId('runtime-jobs-pagination').getByLabel('Go to next page').click();
  await expect(page.getByText('NSE_INDEX|Runtime-7', { exact: true })).toBeVisible();

  await page.getByRole('tab', { name: /Migration State/i }).click();
  await expect(page.getByText('NSE_INDEX|Status-1', { exact: true })).toBeVisible();
  await expect(page.getByText('NSE_INDEX|Status-11', { exact: true })).not.toBeVisible();
  await page.getByTestId('migration-status-pagination').getByLabel('Go to next page').click();
  await expect(page.getByText('NSE_INDEX|Status-11', { exact: true })).toBeVisible();
});

test('Trading window includes instruments discovered from migration jobs', async ({ page }) => {
  const requestedInstrumentKeys: string[] = [];
  const catalogOnlyInstruments = ['NSE_EQ|RELIANCE', 'NSE_EQ|TCS'];

  await page.route('**/api/v1/admin/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'catalog-token' }),
    });
  });

  await page.route('**/api/v1/admin/migrations/jobs', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          instrumentKey: catalogOnlyInstruments[0],
          timeframeUnit: 'minutes',
          timeframeInterval: 1,
          bootstrapFromDate: '2025-01-01',
          status: 'PENDING',
          progressPercent: 0,
          nextFromDate: '2025-02-01',
          updatedAt: new Date().toISOString(),
        },
        {
          instrumentKey: catalogOnlyInstruments[1],
          timeframeUnit: 'days',
          timeframeInterval: 1,
          bootstrapFromDate: '2025-01-01',
          status: 'PENDING',
          progressPercent: 0,
          nextFromDate: '2025-02-01',
          updatedAt: new Date().toISOString(),
        },
      ]),
    });
  });

  await page.route('**/api/v1/admin/migrations/status*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route('**/api/v1/admin/historical-data*', async (route) => {
    const url = new URL(route.request().url());
    const instrumentKey = url.searchParams.get('instrumentKey');
    const timeframeUnit = url.searchParams.get('timeframeUnit') ?? 'minutes';
    const timeframeInterval = Number(url.searchParams.get('timeframeInterval') ?? '1');
    if (instrumentKey) {
      requestedInstrumentKeys.push(instrumentKey);
    }

    const candles = instrumentKey
      ? buildCandles(instrumentKey, timeframeUnit, timeframeInterval)
      : [];

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: candles,
        totalElements: candles.length,
        totalPages: candles.length > 0 ? 1 : 0,
        number: 0,
        size: 500,
      }),
    });
  });

  await page.route('**/api/v1/admin/trading/preferences*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ username: 'admin', preferences: null, updatedAt: null }),
    });
  });

  await page.route('**/api/v1/admin/upstox/token', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ configured: true, updatedAt: new Date().toISOString() }),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.getByRole('button', { name: 'Trading window' }).click();
  await expect(page.getByRole('heading', { name: 'Trading window' })).toBeVisible();

  await page.locator('[data-testid^="trading-window-chart-"]').first().getByRole('combobox').first().click();
  await expect(page.locator(`li[role="option"][data-value="${catalogOnlyInstruments[0]}"]`)).toBeVisible();
  await page.locator(`li[role="option"][data-value="${catalogOnlyInstruments[0]}"]`).click();

  await expect.poll(
    () => requestedInstrumentKeys.filter((key) => key === catalogOnlyInstruments[0]).length,
  ).toBeGreaterThan(0);
});
