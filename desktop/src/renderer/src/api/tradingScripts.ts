import type {
  TradingScriptActionResponse,
  TradingScriptBacktestResponse,
  TradingScriptBuilderPayload,
  TradingScriptCompileResponse,
  TradingScriptDetailsResponse,
  TradingScriptLibraryResponse,
  TradingScriptSort,
  TradingScriptStatus,
  TradingScriptVersion,
} from './tradingScripts.types';

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
  body?: unknown,
): Promise<T> {
  const normalizedToken = token?.trim();
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    cache: method === 'GET' ? 'no-store' : 'default',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
      ...(normalizedToken ? { Authorization: `Bearer ${normalizedToken}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    const text = await response.text();
    let message = text;
    try {
      const parsed = JSON.parse(text) as { message?: string; error?: string };
      message = parsed.message ?? parsed.error ?? text;
    } catch {
      // fallback
    }
    throw new Error(message || `Request failed (${response.status})`);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export const fetchTradingScriptLibrary = (
  tenantId: string,
  token: string,
  params: {
    username: string;
    q?: string;
    status?: TradingScriptStatus | '';
    instrument?: string;
    timeframe?: string;
    compileStatus?: string;
    sort?: TradingScriptSort;
    page?: number;
    size?: number;
  },
) => {
  const qs = new URLSearchParams();
  qs.set('username', params.username);
  if (params.q) qs.set('q', params.q);
  if (params.status) qs.set('status', params.status);
  if (params.instrument) qs.set('instrument', params.instrument);
  if (params.timeframe) qs.set('timeframe', params.timeframe);
  if (params.compileStatus) qs.set('compileStatus', params.compileStatus);
  qs.set('sort', params.sort ?? 'RECENT_EDITED');
  qs.set('page', String(params.page ?? 0));
  qs.set('size', String(params.size ?? 10));
  return request<TradingScriptLibraryResponse>(`/admin/trading-scripts/library?${qs.toString()}`, 'GET', tenantId, token);
};

export const createTradingScriptDraft = (
  tenantId: string,
  token: string,
  payload: { username: string; builder: TradingScriptBuilderPayload },
) => request<TradingScriptDetailsResponse>('/admin/trading-scripts/draft', 'POST', tenantId, token, payload);

export const updateTradingScriptDraft = (
  tenantId: string,
  token: string,
  scriptId: number,
  payload: { username: string; builder: TradingScriptBuilderPayload },
) => request<TradingScriptDetailsResponse>(`/admin/trading-scripts/${scriptId}/draft`, 'PUT', tenantId, token, payload);

export const compileTradingScript = (
  tenantId: string,
  token: string,
  scriptId: number,
  payload: { username: string },
) => request<TradingScriptCompileResponse>(`/admin/trading-scripts/${scriptId}/compile`, 'POST', tenantId, token, payload);

export const validateTradingScript = (
  tenantId: string,
  token: string,
  scriptId: number,
  payload: { username: string },
) => request<TradingScriptCompileResponse>(`/admin/trading-scripts/${scriptId}/validate`, 'POST', tenantId, token, payload);

export const backtestTradingScript = (
  tenantId: string,
  token: string,
  scriptId: number,
  payload: { username: string },
) => request<TradingScriptBacktestResponse>(`/admin/trading-scripts/${scriptId}/backtest`, 'POST', tenantId, token, payload);

export const publishTradingScript = (
  tenantId: string,
  token: string,
  scriptId: number,
  payload: { username: string; targetStatus: 'PAPER_READY' | 'LIVE_READY' },
) => request<TradingScriptDetailsResponse>(`/admin/trading-scripts/${scriptId}/publish`, 'POST', tenantId, token, payload);

export const duplicateTradingScript = (
  tenantId: string,
  token: string,
  scriptId: number,
  payload: { username: string },
) => request<TradingScriptDetailsResponse>(`/admin/trading-scripts/${scriptId}/duplicate`, 'POST', tenantId, token, payload);

export const archiveTradingScript = (
  tenantId: string,
  token: string,
  scriptId: number,
  payload: { username: string },
) => request<TradingScriptActionResponse>(`/admin/trading-scripts/${scriptId}/archive`, 'POST', tenantId, token, payload);

export const deleteTradingScript = (
  tenantId: string,
  token: string,
  scriptId: number,
  username: string,
) => request<TradingScriptActionResponse>(
  `/admin/trading-scripts/${scriptId}?username=${encodeURIComponent(username)}`,
  'DELETE',
  tenantId,
  token,
);

export const fetchTradingScriptVersions = (
  tenantId: string,
  token: string,
  scriptId: number,
  username: string,
) => request<TradingScriptVersion[]>(
  `/admin/trading-scripts/${scriptId}/versions?username=${encodeURIComponent(username)}`,
  'GET',
  tenantId,
  token,
);

export const fetchTradingScriptVersion = (
  tenantId: string,
  token: string,
  scriptId: number,
  version: number,
  username: string,
) => request<TradingScriptVersion>(
  `/admin/trading-scripts/${scriptId}/versions/${version}?username=${encodeURIComponent(username)}`,
  'GET',
  tenantId,
  token,
);
