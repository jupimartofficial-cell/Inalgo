import { expect, test } from '@playwright/test';

type Candle = {
  instrumentKey: string;
  timeframeUnit: string;
  timeframeInterval: number;
  candleTs: string;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  closePrice: number;
  volume: number;
};

const buildCandles = (
  instrumentKey: string,
  timeframeUnit: string,
  timeframeInterval: number,
  count: number,
): Candle[] => {
  const now = Date.now();
  const intervalMs = Math.max(1, timeframeInterval) * 60_000;
  return Array.from({ length: count }).map((_, index) => {
    const base = 22000 + index * 3;
    const open = base + Math.sin(index / 3) * 4;
    const close = open + Math.cos(index / 2) * 3;
    return {
      instrumentKey,
      timeframeUnit,
      timeframeInterval,
      candleTs: new Date(now - (count - index) * intervalMs).toISOString(),
      openPrice: Number(open.toFixed(2)),
      highPrice: Number((Math.max(open, close) + 6).toFixed(2)),
      lowPrice: Number((Math.min(open, close) - 6).toFixed(2)),
      closePrice: Number(close.toFixed(2)),
      volume: 100000 + index * 150,
    };
  });
};

const openSidebarItem = async (page: import('@playwright/test').Page, group: 'Trading' | 'Analytics' | 'Admin', label: string) => {
  await page.getByRole('button', { name: `${group} section` }).click();
  await page.getByRole('button', { name: label, exact: true }).first().click();
};

const openFromPalette = async (page: import('@playwright/test').Page, label: string) => {
  await page.getByRole('button', { name: 'Open command palette' }).click();
  await page.getByPlaceholder('Search pages, workflows, and tools').fill(label);
  await page.getByRole('button', { name: `Open ${label}`, exact: true }).first().click();
};

test('Migration token controls and filter query params work from UI', async ({ page }) => {
  const jobsQueryCalls: Array<{ instrumentKey: string | null }> = [];
  const statusQueryCalls: Array<{ instrumentKey: string | null; timeframeUnit: string | null; timeframeInterval: string | null }> = [];
  const postedTokens: string[] = [];
  let tokenConfigured = false;

  await page.route('**/api/v1/admin/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'migration-token' }),
    });
  });

  await page.route('**/api/v1/admin/migrations/jobs*', async (route) => {
    const url = new URL(route.request().url());
    jobsQueryCalls.push({
      instrumentKey: url.searchParams.get('instrumentKey'),
    });

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
          progressPercent: 40,
          nextFromDate: '2025-02-01',
          updatedAt: new Date().toISOString(),
        },
      ]),
    });
  });

  await page.route('**/api/v1/admin/migrations/status*', async (route) => {
    const url = new URL(route.request().url());
    statusQueryCalls.push({
      instrumentKey: url.searchParams.get('instrumentKey'),
      timeframeUnit: url.searchParams.get('timeframeUnit'),
      timeframeInterval: url.searchParams.get('timeframeInterval'),
    });

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

  await page.route('**/api/v1/admin/upstox/token', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ configured: tokenConfigured, updatedAt: new Date().toISOString() }),
      });
      return;
    }

    const payload = route.request().postDataJSON() as { token?: string };
    postedTokens.push(payload.token ?? '');
    tokenConfigured = true;
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

  await page.addInitScript(() => {
    window.sessionStorage.setItem('inalgo_admin_session_v1', JSON.stringify({
      tenantId: 'local-desktop',
      username: 'admin',
      token: 'migration-token',
      section: 'migration',
      intraSubSection: 'intra-monitor',
      backtestSubSection: 'pnl',
      marketSignalsSubSection: 'trading-param',
      tradingDeskSubSection: 'advanced-trading',
      sidebarCollapsed: false,
      pinnedNavItemKeys: ['intra-monitor', 'trading-desk', 'option-chain'],
      expandedNavGroup: 'admin',
    }));
  });
  await page.goto('/migration');
  await expect(page.getByRole('heading', { name: 'Migration Jobs', exact: true })).toBeVisible();

  await expect(page.getByText('Not Configured')).toBeVisible();
  await page.getByRole('button', { name: 'Update Token' }).click();
  await expect(page.getByText('Upstox token is required')).toBeVisible();

  await page.getByPlaceholder('Paste the latest Upstox token').fill('new-upstox-token');
  await page.getByRole('button', { name: 'Update Token' }).click();
  await expect.poll(() => postedTokens.length).toBe(1);
  await expect.poll(() => postedTokens[0]).toBe('new-upstox-token');
  await expect(page.getByText('Upstox token updated')).toBeVisible();
  await expect(page.getByText('Configured')).toBeVisible();

  await page.getByLabel('Instrument').selectOption('NSE_INDEX|Nifty 50');
  await page.locator('input[type="number"]').first().fill('1');
  await page.getByRole('button', { name: 'Apply Filters' }).click();

  await expect.poll(() => jobsQueryCalls.at(-1)?.instrumentKey ?? null).toBe('NSE_INDEX|Nifty 50');
  await expect.poll(() => statusQueryCalls.at(-1)?.instrumentKey ?? null).toBe('NSE_INDEX|Nifty 50');
  await expect.poll(() => statusQueryCalls.at(-1)?.timeframeInterval ?? null).toBe('1');

  await page.locator('button:has(svg[data-testid="ClearRoundedIcon"])').click();
  await page.getByRole('button', { name: 'Apply Filters' }).click();

  await expect.poll(() => jobsQueryCalls.at(-1)?.instrumentKey ?? null).toBe(null);
  await expect.poll(() => statusQueryCalls.at(-1)?.instrumentKey ?? null).toBe(null);
  await expect.poll(() => statusQueryCalls.at(-1)?.timeframeInterval ?? null).toBe(null);
});

test('Historical data supports filters, sorting, pagination, and clear flow', async ({ page }) => {
  const candles = buildCandles('NSE_INDEX|Nifty 50', 'minutes', 5, 80);
  const historyCalls: Array<{
    instrumentKey: string | null;
    timeframeUnit: string | null;
    timeframeInterval: string | null;
    sortBy: string | null;
    sortDirection: string | null;
    page: string | null;
    size: string | null;
  }> = [];

  await page.route('**/api/v1/admin/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'history-token' }),
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
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
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
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ username: 'admin', preferences: null, updatedAt: null }),
    });
  });

  await page.route('**/api/v1/admin/historical-data*', async (route) => {
    const url = new URL(route.request().url());
    const params = url.searchParams;
    const instrumentKey = params.get('instrumentKey');
    const timeframeUnit = params.get('timeframeUnit');
    const timeframeInterval = params.get('timeframeInterval');
    const sortBy = params.get('sortBy') ?? 'candleTs';
    const sortDirection = params.get('sortDirection') ?? 'desc';
    const pageNumber = Number(params.get('page') ?? '0');
    const size = Number(params.get('size') ?? '25');

    historyCalls.push({
      instrumentKey,
      timeframeUnit,
      timeframeInterval,
      sortBy,
      sortDirection,
      page: params.get('page'),
      size: params.get('size'),
    });

    let filtered = [...candles];
    if (instrumentKey) filtered = filtered.filter((row) => row.instrumentKey === instrumentKey);
    if (timeframeUnit) filtered = filtered.filter((row) => row.timeframeUnit === timeframeUnit);
    if (timeframeInterval) {
      filtered = filtered.filter((row) => row.timeframeInterval === Number(timeframeInterval));
    }

    filtered.sort((a, b) => {
      if (sortBy === 'candleTs') {
        return new Date(a.candleTs).getTime() - new Date(b.candleTs).getTime();
      }
      const aValue = Number(a[sortBy as keyof Candle]);
      const bValue = Number(b[sortBy as keyof Candle]);
      return aValue - bValue;
    });
    if (sortDirection === 'desc') filtered.reverse();

    const offset = pageNumber * size;
    const pageContent = filtered.slice(offset, offset + size);

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: pageContent,
        totalElements: filtered.length,
        totalPages: Math.ceil(filtered.length / size),
        number: pageNumber,
        size,
      }),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.getByTestId('sidebar-collapse-toggle')).toBeVisible();
  await openSidebarItem(page, 'Analytics', 'Historical Data');
  await expect(page.getByRole('heading', { name: 'Historical Data' })).toBeVisible();

  await page.locator('main [role="combobox"]').first().click();
  await page.locator('li[role="option"][data-value="NSE_INDEX|Nifty 50"]').click();
  await page.getByRole('button', { name: /^5 Min$/ }).click();
  await page.getByRole('button', { name: 'Apply Filters' }).click();

  await expect(page.getByText(/Showing \d+ of 80 candles/)).toBeVisible();
  await expect.poll(() => historyCalls.at(-1)?.instrumentKey ?? null).toBe('NSE_INDEX|Nifty 50');
  await expect.poll(() => historyCalls.at(-1)?.timeframeUnit ?? null).toBe('minutes');
  await expect.poll(() => historyCalls.at(-1)?.timeframeInterval ?? null).toBe('5');
  await expect.poll(() => historyCalls.at(-1)?.sortBy ?? null).toBe('candleTs');
  await expect.poll(() => historyCalls.at(-1)?.sortDirection ?? null).toBe('desc');
  await expect.poll(() => historyCalls.at(-1)?.page ?? null).toBe('0');
  await expect.poll(() => historyCalls.at(-1)?.size ?? null).toBe('25');

  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await expect.poll(() => historyCalls.at(-1)?.sortBy ?? null).toBe('openPrice');
  await expect.poll(() => historyCalls.at(-1)?.sortDirection ?? null).toBe('asc');

  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await expect.poll(() => historyCalls.at(-1)?.sortBy ?? null).toBe('openPrice');
  await expect.poll(() => historyCalls.at(-1)?.sortDirection ?? null).toBe('desc');

  await page.getByLabel('Go to next page').click();
  await expect.poll(() => historyCalls.at(-1)?.page ?? null).toBe('1');

  await page.getByRole('button', { name: 'Clear Filters' }).click();
  await expect(page.getByText('Choose an instrument and timeframe, then click "Apply Filters"')).toBeVisible();
});

test('Migration State tab exposes action controls even without runtime job rows', async ({ page }) => {
  let currentStatus: 'RUNNING' | 'PAUSED' | 'STOPPED' = 'RUNNING';
  let startCalls = 0;
  let pauseCalls = 0;
  let resumeCalls = 0;
  let stopCalls = 0;

  await page.route('**/api/v1/admin/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'state-controls-token' }),
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
          lastRunStatus: currentStatus,
          lastRunAt: new Date().toISOString(),
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

  await page.addInitScript(() => {
    window.sessionStorage.setItem('inalgo_admin_session_v1', JSON.stringify({
      tenantId: 'local-desktop',
      username: 'admin',
      token: 'state-tab-token',
      section: 'migration',
      intraSubSection: 'intra-monitor',
      backtestSubSection: 'pnl',
      marketSignalsSubSection: 'trading-param',
      tradingDeskSubSection: 'advanced-trading',
      sidebarCollapsed: false,
      pinnedNavItemKeys: ['intra-monitor', 'trading-desk', 'option-chain'],
      expandedNavGroup: 'admin',
    }));
  });
  await page.goto('/migration');
  await page.getByRole('tab', { name: /Migration State/i }).click();

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
  await page.getByRole('button', { name: 'Start' }).click();
  await expect.poll(() => startCalls).toBe(1);
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
});

test('Desktop navigation collapses to an icon rail with tooltips', async ({ page }) => {
  await page.route('**/api/v1/admin/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'sidebar-token' }),
    });
  });

  await page.route('**/api/v1/admin/migrations/jobs*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route('**/api/v1/admin/migrations/status*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
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

  await page.route('**/api/v1/admin/triggers/browser*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [],
        totalElements: 0,
        page: 0,
        size: 25,
        tabs: [
          { value: 'CANDLE_SYNC', label: 'Candle sync Jobs', count: 0 },
          { value: 'OTHERS', label: 'Others', count: 0 },
        ],
        instruments: [],
        timeframes: [],
        jobNatures: [],
        summary: {
          totalInTab: 0,
          filteredTotal: 0,
          runningCount: 0,
          pausedCount: 0,
          failedCount: 0,
          oneTimeCount: 0,
          attentionCount: 0,
        },
      }),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Sign In' }).click();

  await expect(page.getByRole('button', { name: 'Collapse navigation' })).toBeVisible();
  await page.getByTestId('sidebar-collapse-toggle').click();
  await expect(page.getByRole('button', { name: 'Expand navigation' })).toBeVisible();

  const manageTriggersButton = page.getByRole('button', { name: 'Manage Triggers' });
  await manageTriggersButton.hover();
  await expect(page.getByRole('tooltip')).toContainText('Manage Triggers');

  await manageTriggersButton.click();
  await expect(page.getByRole('heading', { name: 'Manage Triggers' })).toBeVisible();
});

test('Trader-first grouped navigation supports pinning and command palette jump', async ({ page }) => {
  await page.route('**/api/v1/admin/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'sidebar-ia-token' }),
    });
  });

  await page.route('**/api/v1/admin/migrations/jobs*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.route('**/api/v1/admin/migrations/status*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
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

  await page.route('**/api/v1/admin/backtest/strategies*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 100 }),
    });
  });

  await page.route('**/api/v1/admin/backtest/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 25 }) });
  });

  await page.route('**/api/v1/admin/market-watch/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tiles: [], refreshSeconds: 30, columns: 3 }) });
  });

  await page.route('**/api/v1/admin/intra-strategies/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 25 }) });
  });

  await page.route('**/api/v1/admin/intra-trade/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 25 }) });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.getByTestId('sidebar-collapse-toggle')).toBeVisible();

  await expect(page.getByRole('button', { name: 'Trading section' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Intra Monitor' }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Analytics section' }).click();
  await expect(page.getByRole('button', { name: 'Trading Param', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Intra Strategies', exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Pin Trading Signal' }).first().click();
  await page.getByRole('button', { name: 'Trading section' }).click();
  await expect(page.getByRole('button', { name: 'Trading Signal', exact: true }).first()).toBeVisible();
  await page.screenshot({ path: '../artifacts/sidebar-trader-ia.png', fullPage: true });

  await page.keyboard.press('Control+KeyK');
  await expect(page.getByPlaceholder('Search pages, workflows, and tools')).toBeVisible();
  await page.getByPlaceholder('Search pages, workflows, and tools').fill('strategy list');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/backtest\/strategy-list$/);

  await page.getByRole('button', { name: 'Intra P&L' }).first().click();
  await expect(page).toHaveURL(/\/intra\/pnl$/);
});

test('Manage Triggers creates and controls time-driven trigger schedules', async ({ page }) => {
  const createdPayloads: Array<Record<string, unknown>> = [];
  let triggerStatus: 'STOPPED' | 'RUNNING' | 'PAUSED' = 'STOPPED';
  let lastRunStatus: 'PENDING' | 'SUCCESS' = 'PENDING';
  let startCalls = 0;
  let pauseCalls = 0;
  let resumeCalls = 0;
  let stopCalls = 0;

  const buildTrigger = () => ({
    id: 1,
    jobKey: 'CANDLE_SYNC',
    instrumentKey: 'NSE_INDEX|Nifty 50',
    timeframeUnit: 'minutes',
    timeframeInterval: 1,
    eventSource: 'TIME_DRIVEN',
    triggerType: 'HOUR_TIMER',
    intervalValue: 1,
    bootstrapFromDate: '2026-03-08',
    status: triggerStatus,
    lastRunStatus,
    nextRunAt: triggerStatus === 'RUNNING' ? new Date(Date.now() + 3600_000).toISOString() : null,
    lastRunAt: lastRunStatus === 'SUCCESS' ? new Date().toISOString() : null,
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  });

  const buildBrowserResponse = () => {
    const items = createdPayloads.length > 0 ? [{
      ...buildTrigger(),
      tabGroup: 'CANDLE_SYNC',
      jobNatureKey: 'CANDLE_INTRADAY',
      jobNatureLabel: 'Intraday sync',
      oneTime: false,
    }] : [];
    const runningCount = triggerStatus === 'RUNNING' ? 1 : 0;
    const pausedCount = triggerStatus === 'PAUSED' ? 1 : 0;
    return {
      items,
      totalElements: items.length,
      page: 0,
      size: 25,
      tabs: [
        { value: 'CANDLE_SYNC', label: 'Candle sync Jobs', count: items.length },
        { value: 'OTHERS', label: 'Others', count: 0 },
      ],
      instruments: items.length > 0 ? [{ value: 'NSE_INDEX|Nifty 50', label: 'NSE_INDEX|Nifty 50', count: 1 }] : [],
      timeframes: items.length > 0 ? [{ value: 'minutes|1', label: '1 Min', timeframeUnit: 'minutes', timeframeInterval: 1, count: 1 }] : [],
      jobNatures: items.length > 0 ? [{ value: 'CANDLE_INTRADAY', label: 'Intraday sync', count: 1 }] : [],
      summary: {
        totalInTab: items.length,
        filteredTotal: items.length,
        runningCount,
        pausedCount,
        failedCount: 0,
        oneTimeCount: 0,
        attentionCount: pausedCount,
      },
    };
  };

  await page.route('**/api/v1/admin/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'trigger-token' }),
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
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
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

  await page.route('**/api/v1/admin/triggers/browser*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildBrowserResponse()),
    });
  });

  await page.route('**/api/v1/admin/triggers', async (route) => {
    const payload = route.request().postDataJSON() as Record<string, unknown>;
    createdPayloads.push(payload);
    triggerStatus = 'STOPPED';
    lastRunStatus = 'PENDING';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildTrigger()),
    });
  });

  await page.route('**/api/v1/admin/triggers/1/start', async (route) => {
    startCalls += 1;
    triggerStatus = 'RUNNING';
    lastRunStatus = 'SUCCESS';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'RUNNING' }),
    });
  });

  await page.route('**/api/v1/admin/triggers/1/pause', async (route) => {
    pauseCalls += 1;
    triggerStatus = 'PAUSED';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'PAUSED' }),
    });
  });

  await page.route('**/api/v1/admin/triggers/1/resume', async (route) => {
    resumeCalls += 1;
    triggerStatus = 'RUNNING';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'RUNNING' }),
    });
  });

  await page.route('**/api/v1/admin/triggers/1/stop', async (route) => {
    stopCalls += 1;
    triggerStatus = 'STOPPED';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'STOPPED' }),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.getByTestId('sidebar-collapse-toggle')).toBeVisible();
  await openSidebarItem(page, 'Admin', 'Manage Triggers');

  await expect(page.getByRole('heading', { name: 'Manage Triggers' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0);
  await page.getByTestId('create-trigger-toggle').click();
  await page.getByRole('button', { name: 'Save' }).click();

  await expect.poll(() => createdPayloads.length).toBe(1);
  await expect.poll(() => createdPayloads[0]?.jobKey ?? null).toBe('CANDLE_SYNC');
  await expect.poll(() => createdPayloads[0]?.eventSource ?? null).toBe('TIME_DRIVEN');
  await expect.poll(() => createdPayloads[0]?.triggerType ?? null).toBe('HOUR_TIMER');
  await expect.poll(() => createdPayloads[0]?.intervalValue ?? null).toBe(1);
  await expect(page.getByText('Trigger saved in stopped state')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect.poll(() => startCalls).toBe(1);
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect.poll(() => pauseCalls).toBe(1);
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect.poll(() => resumeCalls).toBe(1);
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect.poll(() => stopCalls).toBe(1);
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeVisible();
});

test('Manage Triggers creates trading day param jobs without timeframe input', async ({ page }) => {
  const createdPayloads: Array<Record<string, unknown>> = [];
  let othersCount = 0;

  const buildBrowserResponse = () => ({
    items: [],
    totalElements: 0,
    page: 0,
    size: 25,
    tabs: [
      { value: 'CANDLE_SYNC', label: 'Candle sync Jobs', count: 0 },
      { value: 'OTHERS', label: 'Others', count: othersCount },
    ],
    instruments: [],
    timeframes: [],
    jobNatures: [],
    summary: {
      totalInTab: 0,
      filteredTotal: 0,
      runningCount: 0,
      pausedCount: 0,
      failedCount: 0,
      oneTimeCount: 0,
      attentionCount: 0,
    },
  });

  await page.route('**/api/v1/admin/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'trigger-job-token' }),
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
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
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

  await page.route('**/api/v1/admin/triggers/browser*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildBrowserResponse()),
    });
  });

  await page.route('**/api/v1/admin/triggers', async (route) => {
    createdPayloads.push(route.request().postDataJSON() as Record<string, unknown>);
    othersCount = 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 2,
        jobKey: 'TRADING_DAY_PARAM_REFRESH',
        instrumentKey: 'NSE_INDEX|Nifty 50',
        eventSource: 'TIME_DRIVEN',
        triggerType: 'HOUR_TIMER',
        intervalValue: 1,
        status: 'STOPPED',
        lastRunStatus: 'PENDING',
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      }),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.getByTestId('sidebar-collapse-toggle')).toBeVisible();
  await openSidebarItem(page, 'Admin', 'Manage Triggers');

  await page.getByTestId('create-trigger-toggle').click();
  await page.locator('[role="combobox"]').nth(1).click();
  await page.getByRole('option', { name: 'Trading day params' }).click();
  await expect(page.getByText('This job uses the 15 Min opening-range candle automatically.')).toBeVisible();
  await page.getByRole('button', { name: 'Save' }).click();

  await expect.poll(() => createdPayloads.length).toBe(1);
  await expect.poll(() => createdPayloads[0]?.jobKey ?? null).toBe('TRADING_DAY_PARAM_REFRESH');
  await expect.poll(() => createdPayloads[0]?.timeframeUnit).toBeUndefined();
  await expect.poll(() => createdPayloads[0]?.timeframeInterval).toBeUndefined();
});

test('Manage Triggers exposes and submits the expanded minute interval options', async ({ page }) => {
  const createdPayloads: Array<Record<string, unknown>> = [];

  const buildBrowserResponse = () => ({
    items: [],
    totalElements: 0,
    page: 0,
    size: 25,
    tabs: [
      { value: 'CANDLE_SYNC', label: 'Candle sync Jobs', count: createdPayloads.length },
      { value: 'OTHERS', label: 'Others', count: 0 },
    ],
    instruments: [],
    timeframes: [],
    jobNatures: [],
    summary: {
      totalInTab: 0,
      filteredTotal: 0,
      runningCount: 0,
      pausedCount: 0,
      failedCount: 0,
      oneTimeCount: 0,
      attentionCount: 0,
    },
  });

  await page.route('**/api/v1/admin/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'trigger-minute-options-token' }),
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
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
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

  await page.route('**/api/v1/admin/triggers/browser*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildBrowserResponse()),
    });
  });

  await page.route('**/api/v1/admin/triggers', async (route) => {
    createdPayloads.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 3,
        jobKey: 'CANDLE_SYNC',
        instrumentKey: 'NSE_INDEX|Nifty 50',
        timeframeUnit: 'minutes',
        timeframeInterval: 1,
        eventSource: 'TIME_DRIVEN',
        triggerType: 'MINUTES_TIMER',
        intervalValue: 7,
        status: 'STOPPED',
        lastRunStatus: 'PENDING',
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      }),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.getByTestId('sidebar-collapse-toggle')).toBeVisible();
  await openSidebarItem(page, 'Admin', 'Manage Triggers');

  await page.getByTestId('create-trigger-toggle').click();
  await page.locator('[role="combobox"]').nth(2).click();
  await page.getByRole('option', { name: 'Minutes timer' }).click();

  await page.locator('[role="combobox"]').nth(3).click();
  for (const optionLabel of [
    'Every 2 minutes',
    'Every 3 minutes',
    'Every 4 minutes',
    'Every 6 minutes',
    'Every 7 minutes',
  ]) {
    await expect(page.getByRole('option', { name: optionLabel })).toBeVisible();
  }
  await page.getByRole('option', { name: 'Every 7 minutes' }).click();

  await expect(page.locator('[role="combobox"]').nth(3)).toContainText('Every 7 minutes');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect.poll(() => createdPayloads.length).toBe(1);
  await expect.poll(() => createdPayloads[0]?.triggerType ?? null).toBe('MINUTES_TIMER');
  await expect.poll(() => createdPayloads[0]?.intervalValue ?? null).toBe(7);
});

test('Manage Triggers supports pagination, edit, and delete actions', async ({ page }) => {
  const updatedPayloads: Array<Record<string, unknown>> = [];
  const deletedIds: number[] = [];
  let triggers = [
    {
      id: 11,
      jobKey: 'CANDLE_SYNC',
      instrumentKey: 'NSE_INDEX|Nifty 50',
      timeframeUnit: 'minutes',
      timeframeInterval: 1,
      eventSource: 'TIME_DRIVEN',
      triggerType: 'HOUR_TIMER',
      intervalValue: 1,
      status: 'STOPPED',
      lastRunStatus: 'PENDING',
      updatedAt: new Date(Date.now() - 1_000).toISOString(),
      createdAt: new Date(Date.now() - 2_000).toISOString(),
    },
    {
      id: 12,
      jobKey: 'TRADING_SIGNAL_REFRESH',
      instrumentKey: 'NSE_INDEX|Nifty Bank',
      timeframeUnit: 'minutes',
      timeframeInterval: 5,
      eventSource: 'TIME_DRIVEN',
      triggerType: 'MINUTES_TIMER',
      intervalValue: 5,
      status: 'PAUSED',
      lastRunStatus: 'SUCCESS',
      updatedAt: new Date(Date.now() - 2_000).toISOString(),
      createdAt: new Date(Date.now() - 3_000).toISOString(),
    },
    {
      id: 13,
      jobKey: 'TRADING_DAY_PARAM_REFRESH',
      instrumentKey: 'BSE_INDEX|SENSEX',
      eventSource: 'TIME_DRIVEN',
      triggerType: 'HOUR_TIMER',
      intervalValue: 2,
      status: 'STOPPED',
      lastRunStatus: 'PENDING',
      updatedAt: new Date(Date.now() - 3_000).toISOString(),
      createdAt: new Date(Date.now() - 4_000).toISOString(),
    },
    {
      id: 14,
      jobKey: 'CANDLE_SYNC',
      instrumentKey: 'NSE_FO|51714',
      timeframeUnit: 'minutes',
      timeframeInterval: 15,
      eventSource: 'TIME_DRIVEN',
      triggerType: 'DAY_TIMER',
      intervalValue: 1,
      status: 'STOPPED',
      lastRunStatus: 'PENDING',
      updatedAt: new Date(Date.now() - 4_000).toISOString(),
      createdAt: new Date(Date.now() - 5_000).toISOString(),
    },
    {
      id: 15,
      jobKey: 'TRADING_SIGNAL_REFRESH',
      instrumentKey: 'NSE_FO|51701',
      timeframeUnit: 'days',
      timeframeInterval: 1,
      eventSource: 'TIME_DRIVEN',
      triggerType: 'WEEK_TIMER',
      intervalValue: 1,
      status: 'STOPPED',
      lastRunStatus: 'PENDING',
      updatedAt: new Date(Date.now() - 5_000).toISOString(),
      createdAt: new Date(Date.now() - 6_000).toISOString(),
    },
    {
      id: 16,
      jobKey: 'CANDLE_SYNC',
      instrumentKey: 'BSE_FO|825565',
      timeframeUnit: 'minutes',
      timeframeInterval: 30,
      eventSource: 'TIME_DRIVEN',
      triggerType: 'MONTH_TIMER',
      intervalValue: 1,
      status: 'STOPPED',
      lastRunStatus: 'PENDING',
      updatedAt: new Date(Date.now() - 6_000).toISOString(),
      createdAt: new Date(Date.now() - 7_000).toISOString(),
    },
    {
      id: 17,
      jobKey: 'TRADING_DAY_PARAM_REFRESH',
      instrumentKey: 'NSE_INDEX|Nifty 50',
      eventSource: 'TIME_DRIVEN',
      triggerType: 'SPECIFIC_DATE_TIME',
      scheduledAt: new Date(Date.now() + 60_000).toISOString(),
      status: 'STOPPED',
      lastRunStatus: 'PENDING',
      updatedAt: new Date(Date.now() - 7_000).toISOString(),
      createdAt: new Date(Date.now() - 8_000).toISOString(),
    },
    {
      id: 18,
      jobKey: 'TRADING_SIGNAL_REFRESH',
      instrumentKey: 'NSE_INDEX|Nifty 50',
      timeframeUnit: 'minutes',
      timeframeInterval: 15,
      eventSource: 'TIME_DRIVEN',
      triggerType: 'HOUR_TIMER',
      intervalValue: 1,
      status: 'RUNNING',
      lastRunStatus: 'SUCCESS',
      updatedAt: new Date(Date.now() - 7_500).toISOString(),
      createdAt: new Date(Date.now() - 8_500).toISOString(),
    },
    ...Array.from({ length: 23 }, (_, index) => ({
      id: 19 + index,
      jobKey: 'CANDLE_SYNC',
      instrumentKey: `CUSTOM|CANDLE_${19 + index}`,
      timeframeUnit: 'minutes',
      timeframeInterval: 5,
      eventSource: 'TIME_DRIVEN',
      triggerType: 'MINUTES_TIMER',
      intervalValue: 5,
      status: 'STOPPED',
      lastRunStatus: 'PENDING',
      updatedAt: new Date(Date.now() - (8_000 + index * 1_000)).toISOString(),
      createdAt: new Date(Date.now() - (9_000 + index * 1_000)).toISOString(),
    })),
  ];

  const getJobNature = (trigger: Record<string, unknown>) => {
    if (trigger.jobKey === 'CANDLE_SYNC') {
      if (trigger.triggerType === 'SPECIFIC_DATE_TIME') {
        return { key: 'CANDLE_ONE_TIME', label: 'One-time backfill' };
      }
      return { key: 'CANDLE_INTRADAY', label: 'Intraday sync' };
    }
    if (trigger.jobKey === 'TRADING_SIGNAL_REFRESH') {
      return { key: 'SIGNAL_ANALYTICS', label: 'Signal analytics' };
    }
    return { key: 'OPENING_RANGE_ANALYTICS', label: 'Opening range analytics' };
  };

  const getTimeframeKey = (trigger: Record<string, unknown>) =>
    trigger.timeframeUnit && trigger.timeframeInterval
      ? `${trigger.timeframeUnit as string}|${trigger.timeframeInterval as number}`
      : 'NO_TIMEFRAME';

  const buildBrowserResponse = (requestUrl: string) => {
    const url = new URL(requestUrl);
    const tabGroup = url.searchParams.get('tabGroup') ?? 'CANDLE_SYNC';
    const instrumentKey = url.searchParams.get('instrumentKey');
    const timeframeKey = url.searchParams.get('timeframeKey');
    const jobNatureKey = url.searchParams.get('jobNatureKey');
    const pageIndex = Number(url.searchParams.get('page') ?? '0');
    const pageSize = Number(url.searchParams.get('size') ?? '25');

    const tabRows = triggers.filter((trigger) =>
      tabGroup === 'CANDLE_SYNC' ? trigger.jobKey === 'CANDLE_SYNC' : trigger.jobKey !== 'CANDLE_SYNC'
    );

    const filteredRows = tabRows.filter((trigger) => {
      if (instrumentKey && trigger.instrumentKey !== instrumentKey) return false;
      if (timeframeKey && getTimeframeKey(trigger) !== timeframeKey) return false;
      if (jobNatureKey && getJobNature(trigger).key !== jobNatureKey) return false;
      return true;
    });

    const items = filteredRows
      .slice(pageIndex * pageSize, pageIndex * pageSize + pageSize)
      .map((trigger) => ({
        ...trigger,
        tabGroup,
        jobNatureKey: getJobNature(trigger).key,
        jobNatureLabel: getJobNature(trigger).label,
        oneTime: trigger.triggerType === 'SPECIFIC_DATE_TIME',
      }));

    const instrumentCounts = new Map<string, number>();
    const timeframeCounts = new Map<string, { label: string; timeframeUnit?: string; timeframeInterval?: number; count: number }>();
    const natureCounts = new Map<string, { label: string; count: number }>();

    for (const trigger of tabRows) {
      instrumentCounts.set(trigger.instrumentKey, (instrumentCounts.get(trigger.instrumentKey) ?? 0) + 1);

      const timeframeValue = getTimeframeKey(trigger);
      const timeframeLabel = timeframeValue === 'NO_TIMEFRAME'
        ? 'No timeframe'
        : `${trigger.timeframeInterval} ${trigger.timeframeUnit === 'minutes' ? 'Min' : trigger.timeframeUnit}`;
      const existingTimeframe = timeframeCounts.get(timeframeValue);
      timeframeCounts.set(timeframeValue, {
        label: timeframeLabel,
        timeframeUnit: trigger.timeframeUnit as string | undefined,
        timeframeInterval: trigger.timeframeInterval as number | undefined,
        count: (existingTimeframe?.count ?? 0) + 1,
      });

      const nature = getJobNature(trigger);
      const existingNature = natureCounts.get(nature.key);
      natureCounts.set(nature.key, { label: nature.label, count: (existingNature?.count ?? 0) + 1 });
    }

    return {
      items,
      totalElements: filteredRows.length,
      page: pageIndex,
      size: pageSize,
      tabs: [
        { value: 'CANDLE_SYNC', label: 'Candle sync Jobs', count: triggers.filter((trigger) => trigger.jobKey === 'CANDLE_SYNC').length },
        { value: 'OTHERS', label: 'Others', count: triggers.filter((trigger) => trigger.jobKey !== 'CANDLE_SYNC').length },
      ],
      instruments: Array.from(instrumentCounts.entries()).map(([value, count]) => ({ value, label: value, count })),
      timeframes: Array.from(timeframeCounts.entries()).map(([value, option]) => ({
        value,
        label: option.label,
        timeframeUnit: option.timeframeUnit,
        timeframeInterval: option.timeframeInterval,
        count: option.count,
      })),
      jobNatures: Array.from(natureCounts.entries()).map(([value, option]) => ({ value, label: option.label, count: option.count })),
      summary: {
        totalInTab: tabRows.length,
        filteredTotal: filteredRows.length,
        runningCount: filteredRows.filter((trigger) => trigger.status === 'RUNNING').length,
        pausedCount: filteredRows.filter((trigger) => trigger.status === 'PAUSED').length,
        failedCount: filteredRows.filter((trigger) => trigger.lastRunStatus === 'FAILED').length,
        oneTimeCount: filteredRows.filter((trigger) => trigger.triggerType === 'SPECIFIC_DATE_TIME').length,
        attentionCount: filteredRows.filter((trigger) => trigger.status === 'PAUSED' || trigger.lastRunStatus === 'FAILED').length,
      },
    };
  };

  await page.route('**/api/v1/admin/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'trigger-edit-token' }),
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
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
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

  await page.route('**/api/v1/admin/triggers/browser*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildBrowserResponse(route.request().url())),
    });
  });

  await page.route('**/api/v1/admin/triggers', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(triggers[0]),
    });
  });

  await page.route('**/api/v1/admin/triggers/11', async (route) => {
    if (route.request().method() === 'PUT') {
      const payload = route.request().postDataJSON() as Record<string, unknown>;
      updatedPayloads.push(payload);
      triggers = triggers.map((trigger) => trigger.id === 11 ? {
        ...trigger,
        ...payload,
        timeframeUnit: payload.timeframeUnit as string | undefined,
        timeframeInterval: payload.timeframeInterval as number | undefined,
        updatedAt: new Date().toISOString(),
      } : trigger);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(triggers.find((trigger) => trigger.id === 11)),
      });
      return;
    }

    deletedIds.push(11);
    triggers = triggers.filter((trigger) => trigger.id !== 11);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'DELETED', id: 11 }),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.getByTestId('sidebar-collapse-toggle')).toBeVisible();
  await openSidebarItem(page, 'Admin', 'Manage Triggers');

  await expect(page.getByRole('heading', { name: 'Manage Triggers' })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Candle sync Jobs/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Others/ })).toBeVisible();
  await expect(page.getByText('Advanced Filters')).toBeVisible();
  await expect(page.locator('[role="combobox"]').nth(6)).toContainText('Nifty 50');
  await expect(page.locator('[role="combobox"]').nth(8)).toContainText('Intraday sync');
  await expect(page.getByText('CUSTOM|CANDLE_40')).not.toBeVisible();

  await page.locator('[role="combobox"]').nth(6).click();
  await page.getByRole('option', { name: 'All instruments' }).click();
  await page.locator('[role="combobox"]').nth(8).click();
  await page.getByRole('option', { name: 'All job natures' }).click();
  await page.getByTestId('configured-triggers-pagination').getByLabel('Go to next page').click();
  await expect(page.getByText('CUSTOM|CANDLE_41')).toBeVisible();

  await page.getByTestId('configured-triggers-pagination').getByLabel('Go to previous page').click();
  await page.getByRole('tab', { name: /Others/ }).click();
  await expect(page.locator('[role="combobox"]').nth(6)).toContainText('Nifty 50');
  const advancedFiltersToggle = page.getByRole('button', { name: /Advanced Filters/ });
  await advancedFiltersToggle.click();
  await expect(page.locator('[role="combobox"]').nth(8)).not.toBeVisible();
  await advancedFiltersToggle.click();
  await expect(page.locator('[role="combobox"]').nth(8)).toBeVisible();
  await page.locator('[role="combobox"]').nth(8).click();
  await page.getByRole('option', { name: 'Opening range analytics (2)' }).click();
  await page.locator('[role="combobox"]').nth(6).click();
  await page.getByRole('option', { name: 'SENSEX (1)' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'SENSEX' }).first()).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'Nifty Bank' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear filters' }).click();

  await page.getByRole('tab', { name: /Candle sync Jobs/ }).click();
  const firstRow = page.getByRole('row').filter({ hasText: 'Nifty 50' }).first();
  await firstRow.getByRole('button', { name: 'Edit' }).click();

  await expect(page.getByTestId('create-trigger-toggle').getByText('Edit Trigger')).toBeVisible();
  await page.locator('[role="combobox"]').nth(1).click();
  await page.getByRole('option', { name: 'Trading day params' }).click();
  await expect(page.getByText('This job uses the 15 Min opening-range candle automatically.')).toBeVisible();
  await page.getByRole('button', { name: 'Update', exact: true }).click();

  await expect.poll(() => updatedPayloads.length).toBe(1);
  await expect.poll(() => updatedPayloads[0]?.jobKey ?? null).toBe('TRADING_DAY_PARAM_REFRESH');
  await expect.poll(() => updatedPayloads[0]?.timeframeUnit).toBeUndefined();
  await expect.poll(() => updatedPayloads[0]?.timeframeInterval).toBeUndefined();
  await expect(page.getByText('Trigger updated')).toBeVisible();

  await page.getByRole('tab', { name: /Others/ }).click();
  await page.locator('[role="combobox"]').nth(8).click();
  await page.getByRole('option', { name: /Opening range analytics/ }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Nifty 50' }).first().getByText('Trading day params')).toBeVisible();

  page.once('dialog', async (dialog) => {
    await dialog.accept();
  });
  const migratedRow = page.getByRole('row').filter({ hasText: 'Nifty 50' }).first();
  await migratedRow.getByRole('button', { name: 'Delete' }).click();

  await expect.poll(() => deletedIds).toEqual([11]);
  await expect(page.getByText('Trigger deleted')).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'Nifty 50' })).toHaveCount(1);
});
