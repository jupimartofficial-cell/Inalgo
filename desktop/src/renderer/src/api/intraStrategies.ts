import type {
  IntraStrategyActionResponse,
  IntraStrategyAiGenerateRequest,
  IntraStrategyAiGenerateResponse,
  IntraStrategyBuilderPayload,
  IntraStrategyDetailsResponse,
  IntraStrategyImportResponse,
  IntraStrategyLibraryResponse,
  IntraStrategySort,
  IntraStrategyValidationResult,
  IntraStrategyVersion,
} from './intraStrategies.types';

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
      // fallback
    }
    throw new Error(message || `Request failed (${response.status})`);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export const fetchIntraStrategyLibrary = (
  tenantId: string,
  token: string,
  params: {
    username: string;
    q?: string;
    status?: string;
    instrument?: string;
    timeframe?: string;
    paperEligible?: boolean;
    liveEligible?: boolean;
    sort?: IntraStrategySort;
    page?: number;
    size?: number;
  }
) => {
  const qs = new URLSearchParams();
  qs.set('username', params.username);
  if (params.q) qs.set('q', params.q);
  if (params.status) qs.set('status', params.status);
  if (params.instrument) qs.set('instrument', params.instrument);
  if (params.timeframe) qs.set('timeframe', params.timeframe);
  if (params.paperEligible != null) qs.set('paperEligible', String(params.paperEligible));
  if (params.liveEligible != null) qs.set('liveEligible', String(params.liveEligible));
  qs.set('sort', params.sort ?? 'RECENT_EDITED');
  qs.set('page', String(params.page ?? 0));
  qs.set('size', String(params.size ?? 10));
  return request<IntraStrategyLibraryResponse>(`/admin/intra-strategies/library?${qs.toString()}`, 'GET', tenantId, token);
};

export const createIntraStrategyDraft = (
  tenantId: string,
  token: string,
  payload: { username: string; builder: IntraStrategyBuilderPayload }
) => request<IntraStrategyDetailsResponse>('/admin/intra-strategies/draft', 'POST', tenantId, token, payload);

export const updateIntraStrategyDraft = (
  tenantId: string,
  token: string,
  strategyId: number,
  payload: { username: string; builder: IntraStrategyBuilderPayload }
) => request<IntraStrategyDetailsResponse>(`/admin/intra-strategies/${strategyId}/draft`, 'PUT', tenantId, token, payload);

export const validateIntraStrategy = (
  tenantId: string,
  token: string,
  strategyId: number,
  payload: { username: string }
) => request<IntraStrategyValidationResult>(`/admin/intra-strategies/${strategyId}/validate`, 'POST', tenantId, token, payload);

export const publishIntraStrategy = (
  tenantId: string,
  token: string,
  strategyId: number,
  payload: { username: string; targetStatus: 'PAPER_READY' | 'LIVE_READY' }
) => request<IntraStrategyDetailsResponse>(`/admin/intra-strategies/${strategyId}/publish`, 'POST', tenantId, token, payload);

export const duplicateIntraStrategy = (
  tenantId: string,
  token: string,
  strategyId: number,
  payload: { username: string }
) => request<IntraStrategyDetailsResponse>(`/admin/intra-strategies/${strategyId}/duplicate`, 'POST', tenantId, token, payload);

export const archiveIntraStrategy = (
  tenantId: string,
  token: string,
  strategyId: number,
  payload: { username: string }
) => request<IntraStrategyActionResponse>(`/admin/intra-strategies/${strategyId}/archive`, 'POST', tenantId, token, payload);

export const deleteIntraStrategy = (
  tenantId: string,
  token: string,
  strategyId: number,
  username: string
) => request<IntraStrategyActionResponse>(
  `/admin/intra-strategies/${strategyId}?username=${encodeURIComponent(username)}`,
  'DELETE',
  tenantId,
  token
);

export const fetchIntraStrategyVersions = (
  tenantId: string,
  token: string,
  strategyId: number,
  username: string
) => request<IntraStrategyVersion[]>(
  `/admin/intra-strategies/${strategyId}/versions?username=${encodeURIComponent(username)}`,
  'GET',
  tenantId,
  token
);

export const fetchIntraStrategyVersion = (
  tenantId: string,
  token: string,
  strategyId: number,
  version: number,
  username: string
) => request<IntraStrategyVersion>(
  `/admin/intra-strategies/${strategyId}/versions/${version}?username=${encodeURIComponent(username)}`,
  'GET',
  tenantId,
  token
);

export const importIntraStrategiesFromBacktest = (
  tenantId: string,
  token: string,
  payload: { username: string; strategyIds?: number[] }
) => request<IntraStrategyImportResponse>('/admin/intra-strategies/import-from-backtest', 'POST', tenantId, token, payload);

export const generateIntraStrategiesWithAi = (
  tenantId: string,
  token: string,
  payload: IntraStrategyAiGenerateRequest
) => request<IntraStrategyAiGenerateResponse>('/admin/intra-strategies/ai-generate', 'POST', tenantId, token, payload);
