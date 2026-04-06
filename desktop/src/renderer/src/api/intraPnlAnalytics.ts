import type {
  IntraPnlDashboard,
  UpstoxOrdersResponse,
  UpstoxPositionsResponse,
} from './intraPnlAnalytics.types';

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

const addFilter = (params: URLSearchParams, key: string, value?: string) => {
  if (value && value.trim().length > 0) {
    params.set(key, value);
  }
};

export const fetchIntraPnlDashboard = (
  tenantId: string,
  token: string,
  username: string,
  filters?: {
    mode?: string;
    fromDate?: string;
    toDate?: string;
    strategy?: string;
    instrument?: string;
    status?: string;
    account?: string;
  },
) => {
  const params = new URLSearchParams();
  params.set('username', username);
  addFilter(params, 'mode', filters?.mode);
  addFilter(params, 'fromDate', filters?.fromDate);
  addFilter(params, 'toDate', filters?.toDate);
  addFilter(params, 'strategy', filters?.strategy);
  addFilter(params, 'instrument', filters?.instrument);
  addFilter(params, 'status', filters?.status);
  addFilter(params, 'account', filters?.account);

  return request<IntraPnlDashboard>('/admin/intra-trade/pnl/dashboard?' + params.toString(), 'GET', tenantId, token);
};

export const downloadIntraPnlExport = async (
  tenantId: string,
  token: string,
  username: string,
  format: 'CSV' | 'XLSX' | 'PDF',
  filters?: {
    mode?: string;
    fromDate?: string;
    toDate?: string;
    strategy?: string;
    instrument?: string;
    status?: string;
    account?: string;
  },
): Promise<Blob> => {
  const params = new URLSearchParams();
  params.set('username', username);
  params.set('format', format);
  addFilter(params, 'mode', filters?.mode);
  addFilter(params, 'fromDate', filters?.fromDate);
  addFilter(params, 'toDate', filters?.toDate);
  addFilter(params, 'strategy', filters?.strategy);
  addFilter(params, 'instrument', filters?.instrument);
  addFilter(params, 'status', filters?.status);
  addFilter(params, 'account', filters?.account);

  const normalizedToken = token?.trim();
  const response = await fetch(apiBaseUrl + '/admin/intra-trade/pnl/export?' + params.toString(), {
    method: 'GET',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
      ...(normalizedToken ? { Authorization: 'Bearer ' + normalizedToken } : {}),
    },
  });

  if (response.ok === false) {
    const text = await response.text();
    throw new Error(text || 'Unable to download export');
  }

  return await response.blob();
};

export const fetchUpstoxPositions = (tenantId: string, token: string, username: string) => {
  const params = new URLSearchParams({ username });
  return request<UpstoxPositionsResponse>(
    '/admin/intra-trade/upstox/positions?' + params.toString(),
    'GET',
    tenantId,
    token,
  );
};

export const fetchUpstoxOrders = (tenantId: string, token: string, username: string) => {
  const params = new URLSearchParams({ username });
  return request<UpstoxOrdersResponse>(
    '/admin/intra-trade/upstox/orders?' + params.toString(),
    'GET',
    tenantId,
    token,
  );
};
