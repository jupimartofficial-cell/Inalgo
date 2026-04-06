export interface Candle {
  instrumentKey: string;
  timeframeUnit: string;
  timeframeInterval: number;
  candleTs: string;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  closePrice: number;
  volume?: number;
}

const TENANT_ID = 'local-desktop';

export const fetchCandles = async (): Promise<Candle[]> => {
  const query = new URLSearchParams({
    instrumentKey: 'NSE_INDEX|Nifty 50',
    timeframeUnit: 'minutes',
    timeframeInterval: '1',
    from: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    to: new Date().toISOString(),
    page: '0',
    size: '300'
  });

  const apiBaseUrl = window.appConfig?.apiBaseUrl ?? import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8081/api/v1';

  const response = await fetch(`${apiBaseUrl}/candles?${query.toString()}`, {
    headers: { 'X-Tenant-Id': TENANT_ID }
  });

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as { content: Candle[] };
  return data.content;
};
