import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  buildAttachmentTradingScriptSource,
  evaluateAttachmentLogic,
  normalizeExitTimeAttachment,
  type AttachmentEvaluation,
  type TradingDayParamRow,
  type TradingSignalRow,
} from './utils/tradingScriptSampleLogic';

const enabled = process.env.REAL_DATA_E2E === '1';
const tenantId = process.env.E2E_TENANT_ID ?? 'local-desktop';
const username = process.env.E2E_USERNAME ?? 'admin';
const password = process.env.E2E_PASSWORD ?? '';
const instrumentKey = process.env.TS_CERT_INSTRUMENT_KEY ?? 'NSE_INDEX|Nifty Bank';
const timeframeUnit = process.env.TS_CERT_TIMEFRAME_UNIT ?? 'minutes';
const timeframeInterval = Number(process.env.TS_CERT_TIMEFRAME_INTERVAL ?? '5');
const backendBaseUrl = process.env.TS_CERT_BACKEND_BASE_URL ?? 'http://localhost:8081';
const tradingDaysWindow = Number(process.env.TS_CERT_WINDOW_TRADING_DAYS ?? '30');
const parityExecutionLimit = Number(process.env.TS_CERT_PARITY_SAMPLE_LIMIT ?? '6');
const optionLots = 1;
const exitTime = normalizeExitTimeAttachment(process.env.TS_CERT_EXIT_TIME ?? '3.20PM');
const artifactRoot = process.env.TS_CERT_ARTIFACT_DIR ?? '../artifacts/trading-scripts-real-data';

const liveOrderEnabled = process.env.LIVE_ORDER_E2E === '1';
const liveConfirm = process.env.CONFIRM_LIVE === 'YES';
const liveOrderInstrumentToken = process.env.LIVE_ORDER_INSTRUMENT_TOKEN ?? '';
const liveOrderSide = (process.env.LIVE_ORDER_SIDE ?? 'BUY').toUpperCase();
const liveOrderQtyRaw = Number(process.env.LIVE_ORDER_QTY ?? '1');
const liveOrderTag = process.env.LIVE_ORDER_TAG ?? `TS-CERT-${Date.now()}`;

type Checkpoint = {
  id: string;
  pass: boolean;
  detail: string;
};

type PagedResponse<T> = {
  content: T[];
  totalPages: number;
  number: number;
  last?: boolean;
};

type SessionPayload = {
  token: string;
};

type TradingScriptDetailsResponse = {
  script: {
    id: number;
    status: string;
    compileStatus: string;
  };
  latestVersion: {
    version: number;
    compile: {
      compileStatus: string;
      valid: boolean;
      artifact: {
        runtimeHints?: Record<string, unknown>;
        compiledStrategy?: {
          legs?: Array<{ optionType?: string }>;
        };
      } | null;
    };
  };
};

type TradingScriptLibraryResponse = {
  content: Array<{ id: number; scriptName: string }>;
};

type TradingScriptCompileResponse = {
  compileStatus: string;
  valid: boolean;
  diagnostics?: Array<{ code?: string; message?: string }>;
  artifact: {
    runtimeHints?: Record<string, unknown>;
    compiledStrategy?: {
      legs?: Array<{ optionType?: string }>;
    };
  } | null;
};

type TradingScriptBacktestResponse = {
  summary: {
    totalPnl: number | null;
    executedTrades: number | null;
    realWorldAccuracyPct: number | null;
  };
};

type IntraOrderResult = {
  orderId: string | null;
  status: string | null;
  message: string | null;
};

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildBootstrapSource(name: string, instrument: string): string {
  return `export default defineScript({
  meta: {
    name: '${name}',
    instrumentKey: '${instrument}',
    timeframeUnit: 'minutes',
    timeframeInterval: 5,
    strategyType: 'INTRADAY',
    marketSession: 'REGULAR_MARKET',
  },
  inputs: {},
  runtimeHints: { bootstrap: true, liveScope: 'OPTIONS_ONLY' },
  compiledStrategy: {
    strategyName: '${name}',
    underlyingKey: '${instrument}',
    underlyingSource: 'CASH',
    strategyType: 'INTRADAY',
    entryTime: '09:20',
    exitTime: '15:20',
    startDate: '2026-01-01',
    endDate: '2026-01-01',
    legs: [
      {
        id: 'bootstrap-ce',
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
    advancedConditions: { enabled: false },
  },
  onBar(ctx, state, api) {
    if (state.positionOpen) {
      return api.actions.hold({ reason: 'Bootstrap hold.' });
    }
    return api.actions.enter({
      reason: 'Bootstrap entry',
      direction: 'LONG',
      legs: api.legs.atmCallBuy(1),
    });
  },
});\n`;
}

async function readSessionToken(page: Parameters<typeof test>[0]['page']): Promise<string> {
  const token = await page.evaluate(() => {
    const raw = window.sessionStorage.getItem('inalgo_admin_session_v1');
    if (!raw) return '';
    const session = JSON.parse(raw) as SessionPayload;
    return session.token ?? '';
  });
  return token;
}

test.describe('Real Data Certification: Trading Scripts (Attachment Parity + Production Gates)', () => {
  test.skip(!enabled, 'Set REAL_DATA_E2E=1 to run real-data certification.');
  test.skip(enabled && !password, 'Set E2E_PASSWORD to run real-data certification.');

  test('certifies trading script lifecycle with attachment parity on last 30 trading days', async ({ page }) => {
    test.setTimeout(600_000);

    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const runId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const artifactDir = path.resolve(process.cwd(), artifactRoot, ts);
    await fs.mkdir(artifactDir, { recursive: true });

    const checkpoints: Checkpoint[] = [];
    const mark = (id: string, pass: boolean, detail: string) => checkpoints.push({ id, pass, detail });

    await page.goto('/trading-scripts');
    await page.getByLabel('Tenant ID').fill(tenantId);
    await page.getByLabel('Username').fill(username);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page).toHaveURL(/\/trading-scripts$/);
    await expect(page.getByRole('heading', { name: 'Trading Scripts', exact: true })).toBeVisible();
    mark('ui_login_and_route', true, 'Authenticated and opened Trading Scripts route.');

    await page.screenshot({ path: path.join(artifactDir, 'trading-scripts-page.png'), fullPage: true });

    const uiToken = await readSessionToken(page);
    mark('session_token_available', uiToken.length > 10, 'Admin session token resolved from UI login session.');

    let token = uiToken;
    if (token.length <= 10) {
      const loginResponse = await page.request.fetch(`${backendBaseUrl}/api/v1/admin/login`, {
        method: 'POST',
        headers: {
          'X-Tenant-Id': tenantId,
          'Content-Type': 'application/json',
        },
        data: { username, password },
      });
      if (!loginResponse.ok()) {
        const text = await loginResponse.text();
        throw new Error(`Backend login failed (${loginResponse.status()}): ${text}`);
      }
      const loginPayload = (await loginResponse.json()) as SessionPayload;
      token = loginPayload.token ?? '';
      mark('backend_login', true, 'Backend token acquired from /api/v1/admin/login.');
    } else {
      mark('backend_login', true, 'Backend login skipped because UI session token is already available.');
    }
    expect(token.length).toBeGreaterThan(10);

    const api = async <T>(pathSuffix: string, init?: { method?: string; data?: unknown }): Promise<T> => {
      const response = await page.request.fetch(`${backendBaseUrl}/api/v1${pathSuffix}`, {
        method: init?.method ?? 'GET',
        headers: {
          'X-Tenant-Id': tenantId,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: init?.data,
      });
      if (!response.ok()) {
        const text = await response.text();
        throw new Error(`${init?.method ?? 'GET'} ${pathSuffix} failed (${response.status()}): ${text}`);
      }
      const contentType = response.headers()['content-type'] ?? '';
      if (!contentType.toLowerCase().includes('application/json')) {
        const text = await response.text();
        throw new Error(`${init?.method ?? 'GET'} ${pathSuffix} returned non-JSON content-type=${contentType}: ${text.slice(0, 180)}`);
      }
      return (await response.json()) as T;
    };

    const fetchPaged = async <T>(pathBuilder: (page: number) => string): Promise<T[]> => {
      const rows: T[] = [];
      let pageNumber = 0;
      while (true) {
        const payload = await api<PagedResponse<T>>(pathBuilder(pageNumber));
        rows.push(...payload.content);
        if (payload.last === true || pageNumber + 1 >= payload.totalPages) break;
        pageNumber += 1;
      }
      return rows;
    };

    const fromDate = isoDate(new Date(Date.now() - 120 * 24 * 60 * 60 * 1000));
    const toDate = isoDate(new Date());

    const tradingSignals = await fetchPaged<TradingSignalRow>((pageNumber) =>
      `/admin/backtest/trading-signals?instrumentKey=${encodeURIComponent(instrumentKey)}&timeframeUnit=${encodeURIComponent(timeframeUnit)}&timeframeInterval=${timeframeInterval}&fromDate=${fromDate}&toDate=${toDate}&page=${pageNumber}&size=500`
    );
    const tradingParams = await fetchPaged<TradingDayParamRow>((pageNumber) =>
      `/admin/backtest/trading-day-params?instrumentKey=${encodeURIComponent(instrumentKey)}&fromDate=${fromDate}&toDate=${toDate}&page=${pageNumber}&size=500`
    );

    const paramsByDate = new Map<string, TradingDayParamRow>();
    for (const row of tradingParams) {
      paramsByDate.set(row.tradeDate, row);
    }

    const evaluations: AttachmentEvaluation[] = [];
    for (const signalRow of tradingSignals) {
      const dayParam = paramsByDate.get(signalRow.signalDate);
      if (!dayParam) continue;
      evaluations.push(evaluateAttachmentLogic(signalRow, dayParam));
    }

    const dedupByDate = new Map<string, AttachmentEvaluation>();
    for (const evalRow of evaluations) {
      dedupByDate.set(evalRow.date, evalRow);
    }

    const latestTradingDays = Array.from(dedupByDate.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-tradingDaysWindow);

    expect(latestTradingDays.length).toBeGreaterThanOrEqual(Math.min(10, tradingDaysWindow));
    mark(
      'analytics_window_loaded',
      latestTradingDays.length >= Math.min(10, tradingDaysWindow),
      `Loaded ${latestTradingDays.length} joined trading days for ${instrumentKey} ${timeframeUnit}|${timeframeInterval}.`
    );

    const actionableDays = latestTradingDays.filter((row) => row.decision !== 'HOLD');
    expect(actionableDays.length).toBeGreaterThan(0);
    mark('actionable_days_present', actionableDays.length > 0, `Found ${actionableDays.length} actionable trading days from attachment logic.`);

    const sampledDays = actionableDays.slice(-Math.max(1, Math.min(parityExecutionLimit, actionableDays.length)));

    const bootstrapBaseName = `Attachment Harness ${runId}`;
    const library = await api<TradingScriptLibraryResponse>(`/admin/trading-scripts/library?username=${encodeURIComponent(username)}&sort=RECENT_EDITED&page=0&size=1`);
    let scriptId: number | null = library.content[0]?.id ?? null;
    if (scriptId == null) {
      const bootstrapDraft = await api<TradingScriptDetailsResponse>('/admin/trading-scripts/draft', {
        method: 'POST',
        data: { username, builder: { sourceJs: buildBootstrapSource(bootstrapBaseName, instrumentKey) } },
      });
      scriptId = bootstrapDraft.script.id;
    } else {
      await api<TradingScriptDetailsResponse>(`/admin/trading-scripts/${scriptId}/draft`, {
        method: 'PUT',
        data: { username, builder: { sourceJs: buildBootstrapSource(bootstrapBaseName, instrumentKey) } },
      });
    }
    mark('bootstrap_draft_created', scriptId != null, `Bootstrap draft created with scriptId=${scriptId ?? 'N/A'}.`);

    const parityResults: Array<{
      date: string;
      decision: string;
      expectedOptionType: string;
      actualOptionType: string;
      compileStatus: string;
      diagnostics: Array<{ code?: string; message?: string }>;
      pass: boolean;
    }> = [];
    let lifecycleCandidateReady = false;

    for (let index = 0; index < sampledDays.length; index += 1) {
      const evalRow = sampledDays[index];
      const expectedOptionType = evalRow.decision === 'ENTER_PUT' ? 'PUT' : 'CALL';
      const strategyName = `Attachment Cert ${evalRow.date} ${runId}`;
      const sourceJs = buildAttachmentTradingScriptSource({
        strategyName,
        tradeDate: evalRow.date,
        decision: evalRow.decision,
        instrumentKey,
        exitTime,
        lots: optionLots,
      });

      await api<TradingScriptDetailsResponse>(`/admin/trading-scripts/${scriptId}/draft`, {
        method: 'PUT',
        data: { username, builder: { sourceJs } },
      });

      const compile = await api<TradingScriptCompileResponse>(`/admin/trading-scripts/${scriptId}/compile`, {
        method: 'POST',
        data: { username },
      });

      const actualOptionType = String(compile.artifact?.compiledStrategy?.legs?.[0]?.optionType ?? '');
      const runtimeDecision = String((compile.artifact?.runtimeHints?.decision as string | undefined) ?? '');
      const pass = compile.compileStatus === 'SUCCESS'
        && compile.valid
        && actualOptionType.toUpperCase() === expectedOptionType
        && runtimeDecision === evalRow.decision;

      parityResults.push({
        date: evalRow.date,
        decision: evalRow.decision,
        expectedOptionType,
        actualOptionType,
        compileStatus: compile.compileStatus,
        diagnostics: compile.diagnostics ?? [],
        pass,
      });
      if (pass) {
        lifecycleCandidateReady = true;
      }
    }

    if (lifecycleCandidateReady && scriptId != null) {
      try {
        const backtest = await api<TradingScriptBacktestResponse>(`/admin/trading-scripts/${scriptId}/backtest`, {
          method: 'POST',
          data: { username },
        });
        const hasMetrics = backtest.summary != null
          && backtest.summary.totalPnl != null
          && backtest.summary.executedTrades != null
          && backtest.summary.realWorldAccuracyPct != null;
        mark('backtest_metrics_present', hasMetrics, 'Backtest summary returned totalPnl, executedTrades, and accuracy metrics.');

        const paperPublished = await api<TradingScriptDetailsResponse>(`/admin/trading-scripts/${scriptId}/publish`, {
          method: 'POST',
          data: { username, targetStatus: 'PAPER_READY' },
        });
        mark('publish_paper_ready', paperPublished.script.status === 'PAPER_READY', `Script status after paper publish: ${paperPublished.script.status}`);

        const livePublished = await api<TradingScriptDetailsResponse>(`/admin/trading-scripts/${scriptId}/publish`, {
          method: 'POST',
          data: { username, targetStatus: 'LIVE_READY' },
        });
        mark('publish_live_ready', livePublished.script.status === 'LIVE_READY', `Script status after live publish: ${livePublished.script.status}`);
      } catch (error) {
        mark('backtest_metrics_present', false, (error as Error).message);
        mark('publish_paper_ready', false, 'Skipped because backtest/publish lifecycle failed.');
        mark('publish_live_ready', false, 'Skipped because backtest/publish lifecycle failed.');
      }
    } else {
      mark('backtest_metrics_present', false, 'No successfully compiled parity sample available for backtest.');
      mark('publish_paper_ready', false, 'Skipped because no compiled parity sample was available.');
      mark('publish_live_ready', false, 'Skipped because no compiled parity sample was available.');
    }

    const parityPass = parityResults.every((row) => row.pass);
    mark('behavioral_parity', parityPass, `Parity comparison on ${parityResults.length} executable sample days.`);

    let liveOrderResult: IntraOrderResult | null = null;
    let liveOrderCheckpointDetail = 'Live order step skipped (LIVE_ORDER_E2E!=1).';
    let liveOrderPass = true;

    if (liveOrderEnabled) {
      if (!liveConfirm) {
        liveOrderPass = false;
        liveOrderCheckpointDetail = 'LIVE_ORDER_E2E=1 requires CONFIRM_LIVE=YES.';
      } else if (!liveOrderInstrumentToken.trim()) {
        liveOrderPass = false;
        liveOrderCheckpointDetail = 'LIVE_ORDER_INSTRUMENT_TOKEN is required when live-order step is enabled.';
      } else if (!['BUY', 'SELL'].includes(liveOrderSide)) {
        liveOrderPass = false;
        liveOrderCheckpointDetail = 'LIVE_ORDER_SIDE must be BUY or SELL.';
      } else if (!Number.isFinite(liveOrderQtyRaw) || liveOrderQtyRaw < 1 || liveOrderQtyRaw > 1) {
        liveOrderPass = false;
        liveOrderCheckpointDetail = 'Ultra-low risk cap enforced: LIVE_ORDER_QTY must be exactly 1.';
      } else {
        const order = await api<IntraOrderResult>('/admin/intra-trade/orders/place', {
          method: 'POST',
          data: {
            instrumentToken: liveOrderInstrumentToken,
            transactionType: liveOrderSide,
            quantity: 1,
            orderType: 'MARKET',
            tag: liveOrderTag,
            executionId: String(scriptId ?? ''),
          },
        });
        liveOrderResult = order;
        const status = String(order.status ?? '').toUpperCase();
        liveOrderPass = Boolean(order.orderId) && !['REJECTED', 'FAILED', 'CANCELLED'].includes(status);
        liveOrderCheckpointDetail = `Placed capped live order with status=${status || 'UNKNOWN'} and orderId=${order.orderId ?? 'N/A'}.`;
      }
    }

    mark('live_order_checkpoint', liveOrderPass, liveOrderCheckpointDetail);

    const passed = checkpoints.every((checkpoint) => checkpoint.pass);
    const report = {
      generatedAt: new Date().toISOString(),
      tenantId,
      username,
      instrumentKey,
      timeframe: { unit: timeframeUnit, interval: timeframeInterval },
      window: {
        requestedTradingDays: tradingDaysWindow,
        resolvedTradingDays: latestTradingDays.length,
        fromDate,
        toDate,
      },
      attachmentNormalization: {
        optionLots,
        exitTime,
      },
      sampledParityExecutions: parityResults,
      dailyBaseline: latestTradingDays,
      liveOrder: {
        enabled: liveOrderEnabled,
        confirmLive: liveConfirm,
        hardCap: { maxOrders: 1, maxQtyPerOrder: 1 },
        result: liveOrderResult,
      },
      checkpoints,
      passed,
      artifacts: {
        tradingScriptsScreenshot: 'trading-scripts-page.png',
      },
    };

    await fs.writeFile(path.join(artifactDir, 'certification-report.json'), JSON.stringify(report, null, 2), 'utf-8');
    expect(passed, `Certification checkpoints failed. See ${path.join(artifactDir, 'certification-report.json')}`).toBe(true);
  });
});
