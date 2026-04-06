import type {
  IntraTradeDeleteResponse,
  IntraTradeExecutionResponse,
  IntraTradeExecutionSummary,
  IntraTradeRunPayload,
  IntraTradeTrendCheckResponse,
} from './intraTrade.types';
import type {
  IntraOrderPlaceRequest,
  IntraOrderResult,
  IntraOrdersResponse,
  IntraPositionsResponse,
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

export const fetchIntraTradeExecutions = (
  tenantId: string,
  token: string,
  username: string,
  page = 0,
  size = 10
) =>
  request<{ content: IntraTradeExecutionSummary[]; totalElements: number; totalPages: number; number: number; size: number }>(
    `/admin/intra-trade/executions?username=${encodeURIComponent(username)}&page=${page}&size=${size}`,
    'GET',
    tenantId,
    token
  );

export const fetchIntraTradeExecution = (
  tenantId: string,
  token: string,
  executionId: number,
  username: string
) =>
  request<IntraTradeExecutionResponse>(
    `/admin/intra-trade/executions/${executionId}?username=${encodeURIComponent(username)}`,
    'GET',
    tenantId,
    token
  );

export const runIntraTradeExecution = (
  tenantId: string,
  token: string,
  payload: IntraTradeRunPayload
) => request<IntraTradeExecutionResponse>('/admin/intra-trade/run', 'POST', tenantId, token, payload);

export const checkIntraTradeTrend = (
  tenantId: string,
  token: string,
  payload: IntraTradeRunPayload
) => request<IntraTradeTrendCheckResponse>('/admin/intra-trade/trend-check', 'POST', tenantId, token, payload);

export const refreshIntraTradeExecution = (
  tenantId: string,
  token: string,
  executionId: number,
  username: string
) =>
  request<IntraTradeExecutionResponse>(
    `/admin/intra-trade/executions/${executionId}/refresh?username=${encodeURIComponent(username)}`,
    'POST',
    tenantId,
    token
  );

export const updateIntraTradeExecution = (
  tenantId: string,
  token: string,
  executionId: number,
  payload: IntraTradeRunPayload
) => request<IntraTradeExecutionResponse>(`/admin/intra-trade/executions/${executionId}`, 'PUT', tenantId, token, payload);

export const exitIntraTradeExecution = (
  tenantId: string,
  token: string,
  executionId: number,
  username: string
) => request<IntraTradeExecutionResponse>(
  `/admin/intra-trade/executions/${executionId}/exit?username=${encodeURIComponent(username)}`,
  'POST',
  tenantId,
  token
);

export const deleteIntraTradeExecution = (
  tenantId: string,
  token: string,
  executionId: number,
  username: string
) => request<IntraTradeDeleteResponse>(
  `/admin/intra-trade/executions/${executionId}?username=${encodeURIComponent(username)}`,
  'DELETE',
  tenantId,
  token
);

// ─── Live order management (LIVE mode only) ────────────────────────────────────

/**
 * Places an intraday order via Upstox for a LIVE mode execution.
 * Requires a valid Upstox access token configured for the tenant.
 */
export const placeIntraTradeOrder = (
  tenantId: string,
  token: string,
  payload: IntraOrderPlaceRequest
) => request<IntraOrderResult>('/admin/intra-trade/orders/place', 'POST', tenantId, token, payload);

/**
 * Fetches all orders placed in the current intraday session from Upstox.
 */
export const fetchIntraTradeOrders = (
  tenantId: string,
  token: string
) => request<IntraOrdersResponse>('/admin/intra-trade/orders', 'GET', tenantId, token);

/**
 * Cancels an open order by Upstox order ID.
 */
export const cancelIntraTradeOrder = (
  tenantId: string,
  token: string,
  orderId: string
) => request<{ status: string; orderId: string }>(`/admin/intra-trade/orders/${encodeURIComponent(orderId)}`, 'DELETE', tenantId, token);

/**
 * Fetches current intraday positions from the Upstox portfolio.
 */
export const fetchIntraTradePositions = (
  tenantId: string,
  token: string
) => request<IntraPositionsResponse>('/admin/intra-trade/positions', 'GET', tenantId, token);
