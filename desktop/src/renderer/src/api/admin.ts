export * from './admin.types';
export * from './intraTrade.types';
export * from './intraTrade';
export * from './intraStrategies.types';
export * from './intraStrategies';
export * from './intraMonitor.types';
export * from './intraMonitor';
export * from './intraPnlAnalytics.types';
export * from './intraPnlAnalytics';
export * from './tradingScripts.types';
export * from './tradingScripts';

import type {
  AdminTrigger,
  BacktestRunResponse,
  BacktestStrategyPayload,
  BacktestStrategyResponse,
  Candle,
  MarketSentimentRefreshResponse,
  MarketSentimentRow,
  MarketWatchConfigResponse,
  MarketWatchDataResponse,
  MarketWatchLayoutConfig,
  TrendAccuracyReport,
  MigrationJob,
  MigrationStatus,
  NewsFeedPreviewResponse,
  OpenAiTokenStatus,
  OptionChainExpiriesResponse,
  OptionChainRefreshResponse,
  OptionChainSnapshot,
  TradingDayParamRow,
  TradingPreferencesPayload,
  TradingPreferencesResponse,
  TradingSignalRow,
  TriggerBrowserResponse,
  UpstoxTokenStatus
} from './admin.types';

const resolveApiBase = () => {
  const fromWindow = typeof window !== 'undefined' ? window.appConfig?.apiBaseUrl : undefined;
  return fromWindow ?? import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8081/api/v1';
};

const apiBaseUrl = resolveApiBase();

async function request<T>(
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  tenantId: string,
  token?: string,
  body?: unknown
): Promise<T> {
  const normalizedToken = token?.trim();
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    cache: method === 'GET' ? 'no-store' : 'default',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
      ...(normalizedToken ? { Authorization: `Bearer ${normalizedToken}` } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });

  if (!response.ok) {
    const text = await response.text();
    let message = text;
    try {
      const parsed = JSON.parse(text) as { message?: string; error?: string };
      message = parsed.message ?? parsed.error ?? text;
    } catch {
      // fallback to plain text
    }
    throw new Error(message || `Request failed (${response.status})`);
  }

  return (await response.json()) as T;
}

export const adminLogin = (tenantId: string, username: string, password: string) =>
  request<{ token: string }>('/admin/login', 'POST', tenantId, undefined, { username, password });

export const fetchInstruments = (tenantId: string, token: string) =>
  request<import('./admin.types').InstrumentDto[]>('/admin/instruments', 'GET', tenantId, token);

export const fetchMigrationStatus = (
  tenantId: string,
  token: string,
  instrumentKey?: string,
  timeframeUnit?: string,
  timeframeInterval?: number
) => {
  const params = new URLSearchParams();
  if (instrumentKey) params.set('instrumentKey', instrumentKey);
  if (timeframeUnit) params.set('timeframeUnit', timeframeUnit);
  if (timeframeInterval) params.set('timeframeInterval', timeframeInterval.toString());
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return request<MigrationStatus[]>(`/admin/migrations/status${suffix}`, 'GET', tenantId, token);
};

export const fetchMigrationJobs = (tenantId: string, token: string, instrumentKey?: string) => {
  const params = new URLSearchParams();
  if (instrumentKey) params.set('instrumentKey', instrumentKey);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return request<MigrationJob[]>(`/admin/migrations/jobs${suffix}`, 'GET', tenantId, token);
};

export const fetchTriggers = (tenantId: string, token: string) =>
  request<AdminTrigger[]>('/admin/triggers', 'GET', tenantId, token);

export const fetchTriggerBrowser = (
  tenantId: string,
  token: string,
  filters: {
    tabGroup: string;
    instrumentKey?: string;
    timeframeKey?: string;
    jobNatureKey?: string;
    page?: number;
    size?: number;
  }
) => {
  const params = new URLSearchParams();
  params.set('tabGroup', filters.tabGroup);
  if (filters.instrumentKey) params.set('instrumentKey', filters.instrumentKey);
  if (filters.timeframeKey) params.set('timeframeKey', filters.timeframeKey);
  if (filters.jobNatureKey) params.set('jobNatureKey', filters.jobNatureKey);
  params.set('page', String(filters.page ?? 0));
  params.set('size', String(filters.size ?? 25));
  return request<TriggerBrowserResponse>(`/admin/triggers/browser?${params.toString()}`, 'GET', tenantId, token);
};

export const createTrigger = (
  tenantId: string,
  token: string,
  payload: {
    jobKey?: string;
    instrumentKey: string;
    timeframeUnit?: string;
    timeframeInterval?: number;
    eventSource: string;
    triggerType: string;
    intervalValue?: number;
    scheduledAt?: string;
  }
) => request<AdminTrigger>('/admin/triggers', 'POST', tenantId, token, payload);

export const updateTrigger = (
  tenantId: string,
  token: string,
  triggerId: number,
  payload: {
    jobKey?: string;
    instrumentKey: string;
    timeframeUnit?: string;
    timeframeInterval?: number;
    eventSource: string;
    triggerType: string;
    intervalValue?: number;
    scheduledAt?: string;
  }
) => request<AdminTrigger>(`/admin/triggers/${triggerId}`, 'PUT', tenantId, token, payload);

export const deleteTrigger = (tenantId: string, token: string, triggerId: number) =>
  request<{ status: string; id: number }>(`/admin/triggers/${triggerId}`, 'DELETE', tenantId, token);

export const startTrigger = (tenantId: string, token: string, triggerId: number) =>
  request<{ status: string }>(`/admin/triggers/${triggerId}/start`, 'POST', tenantId, token);

export const pauseTrigger = (tenantId: string, token: string, triggerId: number) =>
  request<{ status: string }>(`/admin/triggers/${triggerId}/pause`, 'POST', tenantId, token);

export const resumeTrigger = (tenantId: string, token: string, triggerId: number) =>
  request<{ status: string }>(`/admin/triggers/${triggerId}/resume`, 'POST', tenantId, token);

export const stopTrigger = (tenantId: string, token: string, triggerId: number) =>
  request<{ status: string }>(`/admin/triggers/${triggerId}/stop`, 'POST', tenantId, token);

export const fetchUpstoxTokenStatus = (tenantId: string, token: string) =>
  request<UpstoxTokenStatus>('/admin/upstox/token', 'GET', tenantId, token);

export const updateUpstoxToken = (tenantId: string, token: string, upstoxToken: string) =>
  request<UpstoxTokenStatus>('/admin/upstox/token', 'POST', tenantId, token, { token: upstoxToken });

export const fetchOpenAiTokenStatus = (tenantId: string, token: string) =>
  request<OpenAiTokenStatus>('/admin/openai/token', 'GET', tenantId, token);

export const updateOpenAiToken = (tenantId: string, token: string, openAiToken: string) =>
  request<OpenAiTokenStatus>('/admin/openai/token', 'POST', tenantId, token, { token: openAiToken });

export const fetchTradingPreferences = (tenantId: string, token: string, username: string) =>
  request<TradingPreferencesResponse>(
    `/admin/trading/preferences?username=${encodeURIComponent(username)}`,
    'GET',
    tenantId,
    token
  );

export const saveTradingPreferences = (
  tenantId: string,
  token: string,
  payload: {
    username: string;
    preferences: TradingPreferencesPayload;
  }
) =>
  request<TradingPreferencesResponse>(
    '/admin/trading/preferences',
    'PUT',
    tenantId,
    token,
    payload
  );

export const startMigrationJob = (tenantId: string, token: string, jobKey: string) =>
  request<{ status: string }>(`/admin/migrations/${encodeURIComponent(jobKey)}/start`, 'POST', tenantId, token);

export const pauseMigrationJob = (tenantId: string, token: string, jobKey: string) =>
  request<{ status: string }>(`/admin/migrations/${encodeURIComponent(jobKey)}/pause`, 'POST', tenantId, token);

export const resumeMigrationJob = (tenantId: string, token: string, jobKey: string) =>
  request<{ status: string }>(`/admin/migrations/${encodeURIComponent(jobKey)}/resume`, 'POST', tenantId, token);

export const stopMigrationJob = (tenantId: string, token: string, jobKey: string) =>
  request<{ status: string }>(`/admin/migrations/${encodeURIComponent(jobKey)}/stop`, 'POST', tenantId, token);

export const fetchHistoricalData = (
  tenantId: string,
  token: string,
  filters: {
    instrumentKey?: string;
    timeframeUnit?: string;
    timeframeInterval?: number;
    from?: string;
    to?: string;
    sortBy?: "candleTs" | "openPrice" | "highPrice" | "lowPrice" | "closePrice" | "volume";
    sortDirection?: "asc" | "desc";
    page?: number;
    size?: number;
  }
) => {
  const params = new URLSearchParams();
  if (filters.instrumentKey) params.set('instrumentKey', filters.instrumentKey);
  if (filters.timeframeUnit) params.set('timeframeUnit', filters.timeframeUnit);
  if (filters.timeframeInterval) params.set('timeframeInterval', filters.timeframeInterval.toString());
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.sortBy) params.set('sortBy', filters.sortBy);
  if (filters.sortDirection) params.set('sortDirection', filters.sortDirection);
  params.set('page', (filters.page ?? 0).toString());
  params.set('size', (filters.size ?? 50).toString());

  return request<{ content: Candle[]; totalElements: number; totalPages: number; number: number; size: number }>(
    `/admin/historical-data?${params.toString()}`,
    'GET',
    tenantId,
    token
  );
};

export const fetchOptionChainExpiries = (
  tenantId: string,
  token: string,
  underlyingKey: string,
  refreshFromProvider = true
) =>
  request<OptionChainExpiriesResponse>(
    `/admin/option-chain/expiries?underlyingKey=${encodeURIComponent(underlyingKey)}&refreshFromProvider=${refreshFromProvider}`,
    'GET',
    tenantId,
    token
  );

export const fetchLatestOptionChain = (
  tenantId: string,
  token: string,
  underlyingKey: string,
  expiryDate: string,
  refreshIfMissing = true
) =>
  request<OptionChainSnapshot>(
    `/admin/option-chain/latest?underlyingKey=${encodeURIComponent(underlyingKey)}&expiryDate=${encodeURIComponent(expiryDate)}&refreshIfMissing=${refreshIfMissing}`,
    'GET',
    tenantId,
    token
  );

export const migrateOptionChainHistorical = (
  tenantId: string,
  token: string,
  payload?: { underlyingKey?: string; includeAllExpiries?: boolean }
) =>
  request<OptionChainRefreshResponse>(
    '/admin/option-chain/migrate-historical',
    'POST',
    tenantId,
    token,
    payload ?? {}
  );

export const fetchBacktestStrategies = (
  tenantId: string,
  token: string,
  username: string,
  page = 0,
  size = 25
) =>
  request<{ content: BacktestStrategyResponse[]; totalElements: number; totalPages: number; number: number; size: number }>(
    `/admin/backtest/strategies?username=${encodeURIComponent(username)}&page=${page}&size=${size}`,
    'GET',
    tenantId,
    token
  );

export const fetchTradingSignals = (
  tenantId: string,
  token: string,
  filters: {
    instrumentKey?: string;
    timeframeUnit?: string;
    timeframeInterval?: number;
    signal?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    size?: number;
  }
) => {
  const params = new URLSearchParams();
  if (filters.instrumentKey) params.set('instrumentKey', filters.instrumentKey);
  if (filters.timeframeUnit) params.set('timeframeUnit', filters.timeframeUnit);
  if (filters.timeframeInterval) params.set('timeframeInterval', String(filters.timeframeInterval));
  if (filters.signal) params.set('signal', filters.signal);
  if (filters.fromDate) params.set('fromDate', filters.fromDate);
  if (filters.toDate) params.set('toDate', filters.toDate);
  params.set('page', String(filters.page ?? 0));
  params.set('size', String(filters.size ?? 25));

  return request<{ content: TradingSignalRow[]; totalElements: number; totalPages: number; number: number; size: number }>(
    `/admin/backtest/trading-signals?${params.toString()}`,
    'GET',
    tenantId,
    token
  );
};

export const fetchTradingDayParams = (
  tenantId: string,
  token: string,
  filters: {
    instrumentKey?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    size?: number;
  }
) => {
  const params = new URLSearchParams();
  if (filters.instrumentKey) params.set('instrumentKey', filters.instrumentKey);
  if (filters.fromDate) params.set('fromDate', filters.fromDate);
  if (filters.toDate) params.set('toDate', filters.toDate);
  params.set('page', String(filters.page ?? 0));
  params.set('size', String(filters.size ?? 25));

  return request<{ content: TradingDayParamRow[]; totalElements: number; totalPages: number; number: number; size: number }>(
    `/admin/backtest/trading-day-params?${params.toString()}`,
    'GET',
    tenantId,
    token
  );
};

export const fetchMarketSentiments = (
  tenantId: string,
  token: string,
  filters: {
    marketScope?: string;
    trendStatus?: string;
    fromSnapshotAt?: string;
    toSnapshotAt?: string;
    page?: number;
    size?: number;
  }
) => {
  const params = new URLSearchParams();
  if (filters.marketScope) params.set('marketScope', filters.marketScope);
  if (filters.trendStatus) params.set('trendStatus', filters.trendStatus);
  if (filters.fromSnapshotAt) params.set('fromSnapshotAt', filters.fromSnapshotAt);
  if (filters.toSnapshotAt) params.set('toSnapshotAt', filters.toSnapshotAt);
  params.set('page', String(filters.page ?? 0));
  params.set('size', String(filters.size ?? 25));
  return request<{ content: MarketSentimentRow[]; totalElements: number; totalPages: number; number: number; size: number }>(
    `/admin/backtest/market-trends?${params.toString()}`,
    'GET',
    tenantId,
    token
  );
};

export const createBacktestStrategy = (
  tenantId: string,
  token: string,
  payload: { username: string; strategy: BacktestStrategyPayload }
) => request<BacktestStrategyResponse>('/admin/backtest/strategies', 'POST', tenantId, token, payload);

export const updateBacktestStrategy = (
  tenantId: string,
  token: string,
  strategyId: number,
  payload: { username: string; strategy: BacktestStrategyPayload }
) => request<BacktestStrategyResponse>(`/admin/backtest/strategies/${strategyId}`, 'PUT', tenantId, token, payload);

export const deleteBacktestStrategy = (
  tenantId: string,
  token: string,
  strategyId: number,
  username: string
) =>
  request<{ status: string; id: number }>(
    `/admin/backtest/strategies/${strategyId}?username=${encodeURIComponent(username)}`,
    'DELETE',
    tenantId,
    token
  );

export const runBacktest = (
  tenantId: string,
  token: string,
  payload: { username: string; strategy: BacktestStrategyPayload }
) => request<BacktestRunResponse>('/admin/backtest/run', 'POST', tenantId, token, payload);

// ─── Market Watch ─────────────────────────────────────────────────────────────

export const fetchMarketWatchConfig = (tenantId: string, token: string, username: string) =>
  request<MarketWatchConfigResponse>(
    `/admin/market-watch/config?username=${encodeURIComponent(username)}`,
    'GET',
    tenantId,
    token
  );

export const saveMarketWatchConfig = (
  tenantId: string,
  token: string,
  username: string,
  config: MarketWatchLayoutConfig
) =>
  request<MarketWatchConfigResponse>('/admin/market-watch/config', 'PUT', tenantId, token, {
    username,
    config,
  });

export const fetchMarketWatchData = (tenantId: string, token: string, username: string) =>
  request<MarketWatchDataResponse>(
    `/admin/market-watch/data?username=${encodeURIComponent(username)}`,
    'GET',
    tenantId,
    token
  );

export const refreshMarketSentiment = (tenantId: string, token: string) =>
  request<MarketSentimentRefreshResponse>('/admin/market-watch/refresh', 'POST', tenantId, token);

export const fetchNewsFeedPreview = (tenantId: string, token: string, scope: string) =>
  request<NewsFeedPreviewResponse>(
    `/admin/market-watch/news-preview?scope=${encodeURIComponent(scope)}`,
    'GET',
    tenantId,
    token
  );

export const fetchTrendAccuracy = (
  tenantId: string,
  token: string,
  lookbackDays = 60,
  candleIntervalMinutes: 5 | 15 = 15
) =>
  request<TrendAccuracyReport>(
    `/admin/market-watch/accuracy?lookbackDays=${lookbackDays}&candleIntervalMinutes=${candleIntervalMinutes}`,
    'GET',
    tenantId,
    token
  );
