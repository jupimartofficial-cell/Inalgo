import type {
  IntraEmergencyActionRequest,
  IntraEmergencyActionResponse,
  IntraEventLogItem,
  IntraLiveActionRequest,
  IntraMarketSummary,
  IntraPositionActionResponse,
  IntraPositionSnapshot,
  IntraRuntimeActionResponse,
  IntraRuntimeSummary,
} from './intraMonitor.types';

const resolveApiBase = () => {
  const fromWindow = typeof window === 'undefined' ? undefined : window.appConfig?.apiBaseUrl;
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
  const response = await fetch(apiBaseUrl + path, {
    method,
    cache: method === 'GET' ? 'no-store' : 'default',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
      ...(normalizedToken ? { Authorization: 'Bearer ' + normalizedToken } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (response.ok === false) {
    const text = await response.text();
    let message = text;
    try {
      const parsed = JSON.parse(text) as { message?: string; error?: string };
      message = parsed.message ?? parsed.error ?? text;
    } catch {
      // fallback
    }
    throw new Error(message || 'Request failed (' + response.status + ')');
  }

  return (await response.json()) as T;
}

export const fetchIntraMarketSummary = (tenantId: string, token: string, username: string) =>
  request<IntraMarketSummary>('/admin/intra-trade/monitor/market-summary?username=' + encodeURIComponent(username), 'GET', tenantId, token);

export const fetchIntraMonitorRuntimes = (
  tenantId: string,
  token: string,
  username: string,
  filters?: { mode?: string; status?: string; page?: number; size?: number },
) => {
  const params = new URLSearchParams();
  params.set('username', username);
  if (filters?.mode) params.set('mode', filters.mode);
  if (filters?.status) params.set('status', filters.status);
  params.set('page', String(filters?.page ?? 0));
  params.set('size', String(filters?.size ?? 25));
  return request<{ content: IntraRuntimeSummary[]; totalElements: number; totalPages: number; number: number; size: number }>(
    '/admin/intra-trade/monitor/runtimes?' + params.toString(),
    'GET',
    tenantId,
    token,
  );
};

export const fetchIntraMonitorPositions = (
  tenantId: string,
  token: string,
  username: string,
  filters?: { mode?: string; status?: string; page?: number; size?: number },
) => {
  const params = new URLSearchParams();
  params.set('username', username);
  if (filters?.mode) params.set('mode', filters.mode);
  if (filters?.status) params.set('status', filters.status);
  params.set('page', String(filters?.page ?? 0));
  params.set('size', String(filters?.size ?? 25));
  return request<{ content: IntraPositionSnapshot[]; totalElements: number; totalPages: number; number: number; size: number }>(
    '/admin/intra-trade/monitor/positions?' + params.toString(),
    'GET',
    tenantId,
    token,
  );
};

export const fetchIntraMonitorEvents = (
  tenantId: string,
  token: string,
  username: string,
  filters?: { eventType?: string; page?: number; size?: number },
) => {
  const params = new URLSearchParams();
  params.set('username', username);
  if (filters?.eventType) params.set('eventType', filters.eventType);
  params.set('page', String(filters?.page ?? 0));
  params.set('size', String(filters?.size ?? 50));
  return request<{ content: IntraEventLogItem[]; totalElements: number; totalPages: number; number: number; size: number }>(
    '/admin/intra-trade/monitor/events?' + params.toString(),
    'GET',
    tenantId,
    token,
  );
};

export const pauseIntraRuntime = (
  tenantId: string,
  token: string,
  runtimeId: number,
  username: string,
  payload: IntraLiveActionRequest,
) => request<IntraRuntimeActionResponse>(
  '/admin/intra-trade/monitor/runtimes/' + runtimeId + '/pause?username=' + encodeURIComponent(username),
  'POST',
  tenantId,
  token,
  payload,
);

export const resumeIntraRuntime = (
  tenantId: string,
  token: string,
  runtimeId: number,
  username: string,
  reason?: string,
) => request<IntraRuntimeActionResponse>(
  '/admin/intra-trade/monitor/runtimes/' + runtimeId + '/resume?username=' + encodeURIComponent(username) + (reason ? '&reason=' + encodeURIComponent(reason) : ''),
  'POST',
  tenantId,
  token,
);

export const exitIntraRuntime = (
  tenantId: string,
  token: string,
  runtimeId: number,
  username: string,
  payload: IntraLiveActionRequest,
) => request<IntraRuntimeActionResponse>(
  '/admin/intra-trade/monitor/runtimes/' + runtimeId + '/exit?username=' + encodeURIComponent(username),
  'POST',
  tenantId,
  token,
  payload,
);

export const partialExitIntraRuntime = (
  tenantId: string,
  token: string,
  runtimeId: number,
  username: string,
  payload: IntraLiveActionRequest,
) => request<IntraRuntimeActionResponse>(
  '/admin/intra-trade/monitor/runtimes/' + runtimeId + '/partial-exit?username=' + encodeURIComponent(username),
  'POST',
  tenantId,
  token,
  payload,
);

export const exitIntraPosition = (
  tenantId: string,
  token: string,
  positionId: number,
  username: string,
  payload: IntraLiveActionRequest,
) => request<IntraPositionActionResponse>(
  '/admin/intra-trade/monitor/positions/' + positionId + '/exit?username=' + encodeURIComponent(username),
  'POST',
  tenantId,
  token,
  payload,
);

export const partialExitIntraPosition = (
  tenantId: string,
  token: string,
  positionId: number,
  username: string,
  payload: IntraLiveActionRequest,
) => request<IntraPositionActionResponse>(
  '/admin/intra-trade/monitor/positions/' + positionId + '/partial-exit?username=' + encodeURIComponent(username),
  'POST',
  tenantId,
  token,
  payload,
);

export const convertPositionToManualWatch = (
  tenantId: string,
  token: string,
  positionId: number,
  username: string,
  reason?: string,
) => request<IntraPositionActionResponse>(
  '/admin/intra-trade/monitor/positions/' + positionId + '/manual-watch?username=' + encodeURIComponent(username) + (reason ? '&reason=' + encodeURIComponent(reason) : ''),
  'POST',
  tenantId,
  token,
);

export const emergencyIntraAction = (
  tenantId: string,
  token: string,
  username: string,
  payload: IntraEmergencyActionRequest,
) => request<IntraEmergencyActionResponse>(
  '/admin/intra-trade/monitor/emergency?username=' + encodeURIComponent(username),
  'POST',
  tenantId,
  token,
  payload,
);
