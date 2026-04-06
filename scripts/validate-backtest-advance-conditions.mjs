const BASE_URL = process.env.BACKTEST_API_BASE_URL ?? 'http://localhost:8081/api/v1';
const TENANT_ID = process.env.BACKTEST_TENANT_ID ?? 'local-desktop';
const USERNAME = process.env.BACKTEST_USERNAME ?? 'admin';
const PASSWORD = process.env.BACKTEST_PASSWORD ?? '';
const UNDERLYING_KEY = process.env.BACKTEST_UNDERLYING_KEY ?? 'NSE_INDEX|Nifty 50';
const FROM_DATE = process.env.BACKTEST_FROM_DATE ?? '2026-01-01';
const TO_DATE = process.env.BACKTEST_TO_DATE ?? new Date().toISOString().slice(0, 10);
const PAGE_SIZE = Number(process.env.BACKTEST_PAGE_SIZE ?? 500);
const OUTPUT_PATH = process.env.BACKTEST_OUTPUT_PATH;

if (!PASSWORD) {
  throw new Error('BACKTEST_PASSWORD must be set in the environment.');
}

const defaultLegwiseSettings = {
  squareOffMode: 'PARTIAL',
  trailSlToBreakEven: false,
  trailScope: 'ALL_LEGS',
  noReEntryAfterEnabled: false,
  noReEntryAfterTime: '14:30',
  overallMomentumEnabled: false,
  overallMomentumMode: 'POINTS',
  overallMomentumValue: 0,
};

const defaultOverallSettings = {
  stopLossEnabled: false,
  stopLossMode: 'MAX_LOSS',
  stopLossValue: 0,
  targetEnabled: false,
  targetMode: 'MAX_PROFIT',
  targetValue: 0,
  trailingEnabled: false,
  trailingMode: 'TRAILING_SL',
  trailingTrigger: 0,
  trailingLockProfit: 0,
};

async function request(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Id': TENANT_ID,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${method} ${path} failed (${response.status}): ${text}`);
  }

  return response.json();
}

async function fetchAllPages(pathBuilder, token) {
  const rows = [];
  let page = 0;
  while (true) {
    const payload = await request(pathBuilder(page), { token });
    rows.push(...payload.content);
    page += 1;
    if (payload.last || page >= payload.totalPages) {
      break;
    }
  }
  return rows;
}

function tfKey(row) {
  return `${row.timeframeUnit}|${row.timeframeInterval}`;
}

function parseDate(value) {
  return new Date(`${value}T00:00:00Z`).getTime();
}

function sortByDateAsc(rows, dateKey) {
  return [...rows].sort((left, right) => parseDate(left[dateKey]) - parseDate(right[dateKey]));
}

function buildSignalRule(row, comparator, rightOperand) {
  return {
    timeframeUnit: row.timeframeUnit,
    timeframeInterval: row.timeframeInterval,
    left: { kind: 'FIELD', source: 'TRADING_SIGNAL', field: 'currentClose' },
    comparator,
    right: rightOperand,
  };
}

function buildSignalNameRule(row, expectedSignal) {
  return {
    timeframeUnit: row.timeframeUnit,
    timeframeInterval: row.timeframeInterval,
    left: { kind: 'FIELD', source: 'TRADING_SIGNAL', field: 'signal' },
    comparator: 'EQUAL_TO',
    right: { kind: 'VALUE', valueType: 'STRING', value: expectedSignal },
  };
}

function buildDayParamGapRule(signalRow, gapType) {
  return {
    timeframeUnit: signalRow.timeframeUnit,
    timeframeInterval: signalRow.timeframeInterval,
    left: { kind: 'FIELD', source: 'TRADING_DAY_PARAM', field: 'gapType' },
    comparator: 'EQUAL_TO',
    right: { kind: 'VALUE', valueType: 'STRING', value: gapType },
  };
}

function buildBooleanDayParamRule(signalRow, field, value) {
  return {
    timeframeUnit: signalRow.timeframeUnit,
    timeframeInterval: signalRow.timeframeInterval,
    left: { kind: 'FIELD', source: 'TRADING_DAY_PARAM', field },
    comparator: 'EQUAL_TO',
    right: { kind: 'VALUE', valueType: 'BOOLEAN', value: value ? 'true' : 'false' },
  };
}

function buildGroup(operator, ...rulesOrGroups) {
  return {
    operator,
    items: rulesOrGroups.map((item) => ('operator' in item ? { group: item } : { rule: item })),
  };
}

function findFirst(rows, predicate) {
  for (const row of rows) {
    if (predicate(row)) {
      return row;
    }
  }
  return null;
}

function buildStrategy(name, tradeDate, advancedConditions) {
  return {
    strategyName: name,
    underlyingKey: UNDERLYING_KEY,
    underlyingSource: 'FUTURES',
    strategyType: 'INTRADAY',
    entryTime: '09:35',
    exitTime: '15:15',
    startDate: tradeDate,
    endDate: tradeDate,
    legs: [
      {
        id: 'leg-1',
        segment: 'FUTURES',
        lots: 1,
        position: 'BUY',
        expiryType: 'WEEKLY',
        strikeType: 'ATM',
        strikeSteps: 0,
      },
    ],
    legwiseSettings: defaultLegwiseSettings,
    overallSettings: defaultOverallSettings,
    advancedConditions,
  };
}

function summarizeRun(caseName, descriptor, response) {
  return {
    caseName,
    descriptor,
    executedTrades: response.executedTrades,
    totalPnl: response.totalPnl,
    realWorldAccuracyPct: response.realWorldAccuracyPct,
    marketPricedTrades: response.marketPricedTrades,
    fallbackPricedTrades: response.fallbackPricedTrades,
    firstNote: response.notes?.[0] ?? null,
    exitTs: response.rows?.[0]?.exitTs ?? null,
  };
}

async function main() {
  const login = await request('/admin/login', {
    method: 'POST',
    body: { username: USERNAME, password: PASSWORD },
  });
  const token = login.token;

  const signalRows = await fetchAllPages(
    (page) => `/admin/backtest/trading-signals?instrumentKey=${encodeURIComponent(UNDERLYING_KEY)}&fromDate=${FROM_DATE}&toDate=${TO_DATE}&page=${page}&size=${PAGE_SIZE}`,
    token
  );
  const dayParamRows = await fetchAllPages(
    (page) => `/admin/backtest/trading-day-params?instrumentKey=${encodeURIComponent(UNDERLYING_KEY)}&fromDate=${FROM_DATE}&toDate=${TO_DATE}&page=${page}&size=${PAGE_SIZE}`,
    token
  );

  const signalsByTimeframe = new Map();
  for (const row of signalRows) {
    const key = tfKey(row);
    const bucket = signalsByTimeframe.get(key) ?? [];
    bucket.push(row);
    signalsByTimeframe.set(key, bucket);
  }
  for (const [key, rows] of signalsByTimeframe.entries()) {
    signalsByTimeframe.set(key, sortByDateAsc(rows, 'signalDate'));
  }

  const dayParamByDate = new Map(dayParamRows.map((row) => [row.tradeDate, row]));
  const signal15m = signalsByTimeframe.get('minutes|15') ?? [];
  const signal60m = signalsByTimeframe.get('minutes|60') ?? [];

  const numericValueOperand = (value) => ({ kind: 'VALUE', valueType: 'NUMBER', value: String(value) });
  const fieldOperand = (field) => ({ kind: 'FIELD', source: 'TRADING_SIGNAL', field });

  const crossesAbove = (() => {
    for (let index = 1; index < signal15m.length; index += 1) {
      const previous = signal15m[index - 1];
      const current = signal15m[index];
      if (previous.currentClose <= previous.dma9 && current.currentClose > current.dma9) {
        return current;
      }
    }
    return null;
  })();

  const crossesBelow = (() => {
    for (let index = 1; index < signal15m.length; index += 1) {
      const previous = signal15m[index - 1];
      const current = signal15m[index];
      if (previous.currentClose >= previous.dma9 && current.currentClose < current.dma9) {
        return current;
      }
    }
    return null;
  })();

  const cases = [
    {
      name: 'equal_to_signal_sell',
      descriptor: '15m signal equals SELL',
      row: findFirst(signal15m, (row) => row.signal === 'SELL'),
      advancedConditions: (row) => ({ enabled: true, entry: buildGroup('AND', buildSignalNameRule(row, 'SELL')), exit: null }),
    },
    {
      name: 'higher_than_dma9',
      descriptor: '15m current close higher than DMA 9',
      row: findFirst(signal15m, (row) => row.currentClose > row.dma9),
      advancedConditions: (row) => ({ enabled: true, entry: buildGroup('AND', buildSignalRule(row, 'HIGHER_THAN', fieldOperand('dma9'))), exit: null }),
    },
    {
      name: 'higher_than_equal_to_value',
      descriptor: '15m current close higher than or equal to an actual close value',
      row: findFirst(signal15m, (row) => Number.isFinite(row.currentClose)),
      advancedConditions: (row) => ({ enabled: true, entry: buildGroup('AND', buildSignalRule(row, 'HIGHER_THAN_EQUAL_TO', numericValueOperand(row.currentClose))), exit: null }),
    },
    {
      name: 'lower_than_dma9',
      descriptor: '15m current close lower than DMA 9',
      row: findFirst(signal15m, (row) => row.currentClose < row.dma9),
      advancedConditions: (row) => ({ enabled: true, entry: buildGroup('AND', buildSignalRule(row, 'LOWER_THAN', fieldOperand('dma9'))), exit: null }),
    },
    {
      name: 'lower_than_equal_to_value',
      descriptor: '15m current close lower than or equal to an actual close value',
      row: findFirst(signal15m, (row) => Number.isFinite(row.currentClose)),
      advancedConditions: (row) => ({ enabled: true, entry: buildGroup('AND', buildSignalRule(row, 'LOWER_THAN_EQUAL_TO', numericValueOperand(row.currentClose))), exit: null }),
    },
    {
      name: 'up_by_dma26',
      descriptor: '15m current close up by DMA 26 (engine directional numeric comparison)',
      row: findFirst(signal15m, (row) => row.currentClose > row.dma26),
      advancedConditions: (row) => ({ enabled: true, entry: buildGroup('AND', buildSignalRule(row, 'UP_BY', fieldOperand('dma26'))), exit: null }),
    },
    {
      name: 'down_by_dma26',
      descriptor: '15m current close down by DMA 26 (engine directional numeric comparison)',
      row: findFirst(signal15m, (row) => row.currentClose < row.dma26),
      advancedConditions: (row) => ({ enabled: true, entry: buildGroup('AND', buildSignalRule(row, 'DOWN_BY', fieldOperand('dma26'))), exit: null }),
    },
    {
      name: 'crosses_above_dma9',
      descriptor: '15m current close crosses above DMA 9',
      row: crossesAbove,
      advancedConditions: (row) => ({ enabled: true, entry: buildGroup('AND', buildSignalRule(row, 'CROSSES_ABOVE', fieldOperand('dma9'))), exit: null }),
    },
    {
      name: 'crosses_below_dma9',
      descriptor: '15m current close crosses below DMA 9',
      row: crossesBelow,
      advancedConditions: (row) => ({ enabled: true, entry: buildGroup('AND', buildSignalRule(row, 'CROSSES_BELOW', fieldOperand('dma9'))), exit: null }),
    },
    {
      name: 'day_param_gap_down',
      descriptor: '15m entry with Trading Param gap type equals Gap Down',
      row: findFirst(signal15m, (row) => dayParamByDate.get(row.signalDate)?.gapType === 'Gap Down'),
      advancedConditions: (row) => ({ enabled: true, entry: buildGroup('AND', buildDayParamGapRule(row, 'Gap Down')), exit: null }),
    },
    {
      name: 'entry_and_group',
      descriptor: '15m SELL signal and Gap Down on the same date',
      row: findFirst(signal15m, (row) => row.signal === 'SELL' && dayParamByDate.get(row.signalDate)?.gapType === 'Gap Down'),
      advancedConditions: (row) => ({ enabled: true, entry: buildGroup('AND', buildSignalNameRule(row, 'SELL'), buildDayParamGapRule(row, 'Gap Down')), exit: null }),
    },
    {
      name: 'entry_or_group',
      descriptor: '60m BUY signal or ORB Breakdown equals true',
      row: findFirst(signal60m, (row) => row.signal === 'BUY' || dayParamByDate.get(row.signalDate)?.orbBreakdown === 'Yes'),
      advancedConditions: (row) => ({ enabled: true, entry: buildGroup('OR', buildSignalNameRule(row, 'BUY'), buildBooleanDayParamRule(row, 'orbBreakdown', true)), exit: null }),
    },
    {
      name: 'nested_group',
      descriptor: 'Nested group combining SELL or Gap Down, plus current close lower than DMA 9',
      row: findFirst(signal15m, (row) => row.signal === 'SELL' && dayParamByDate.get(row.signalDate)?.gapType === 'Gap Down' && row.currentClose < row.dma9),
      advancedConditions: (row) => ({
        enabled: true,
        entry: buildGroup(
          'AND',
          buildGroup('OR', buildSignalNameRule(row, 'SELL'), buildDayParamGapRule(row, 'Gap Down')),
          buildSignalRule(row, 'LOWER_THAN', fieldOperand('dma9'))
        ),
        exit: null,
      }),
    },
    {
      name: 'entry_and_exit_combo',
      descriptor: 'Entry on SELL and exit early on Gap Down',
      row: findFirst(signal15m, (row) => row.signal === 'SELL' && dayParamByDate.get(row.signalDate)?.gapType === 'Gap Down'),
      advancedConditions: (row) => ({
        enabled: true,
        entry: buildGroup('AND', buildSignalNameRule(row, 'SELL')),
        exit: buildGroup('AND', buildDayParamGapRule(row, 'Gap Down')),
      }),
    },
  ];

  const results = [];

  for (const testCase of cases) {
    if (!testCase.row) {
      results.push({ caseName: testCase.name, descriptor: testCase.descriptor, skipped: 'No matching live data row found in the selected range' });
      continue;
    }

    const strategy = buildStrategy(`Validation ${testCase.name}`, testCase.row.signalDate, testCase.advancedConditions(testCase.row));
    try {
      const response = await request('/admin/backtest/run', {
        method: 'POST',
        token,
        body: { username: USERNAME, strategy },
      });
      results.push({
        tradeDate: testCase.row.signalDate,
        ...summarizeRun(testCase.name, testCase.descriptor, response),
      });
    } catch (error) {
      results.push({
        caseName: testCase.name,
        descriptor: testCase.descriptor,
        tradeDate: testCase.row.signalDate,
        error: error.message,
      });
    }
  }

  const successfulCases = results.filter((result) => typeof result.executedTrades === 'number' && !result.error);
  const executedCases = successfulCases.filter((result) => result.executedTrades > 0);
  const averageAccuracy = executedCases.length
    ? executedCases.reduce((total, result) => total + Number(result.realWorldAccuracyPct ?? 0), 0) / executedCases.length
    : 0;

  const report = {
    generatedAt: new Date().toISOString(),
    config: {
      baseUrl: BASE_URL,
      tenantId: TENANT_ID,
      username: USERNAME,
      underlyingKey: UNDERLYING_KEY,
      fromDate: FROM_DATE,
      toDate: TO_DATE,
      pageSize: PAGE_SIZE,
    },
    analyticsCoverage: {
      tradingSignals: signalRows.length,
      tradingDayParams: dayParamRows.length,
      timeframes: [...signalsByTimeframe.keys()],
    },
    summary: {
      totalCases: results.length,
      successfulCases: successfulCases.length,
      executedCases: executedCases.length,
      averageAccuracyPct: Number(averageAccuracy.toFixed(2)),
    },
    results,
  };

  if (OUTPUT_PATH) {
    const { writeFile } = await import('node:fs/promises');
    await writeFile(OUTPUT_PATH, JSON.stringify(report, null, 2));
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
