import { useEffect, useMemo, useState } from 'react';
import { fetchHistoricalData, type Candle } from '../api/admin';
import { INSTRUMENTS, SESSION_STORAGE_KEY, type PersistedSession } from './AppShellShared';
import {
  createLocalId,
  instrumentLabelFrom,
  toChartTime,
  type CompareSeriesConfig,
  type CompareSeriesState,
} from './ProChartCanvasShared';

const normalizeCandles = (candles: Candle[]) =>
  [...candles]
    .sort((left, right) => new Date(left.candleTs).getTime() - new Date(right.candleTs).getTime())
    .filter((candle) => (
      Number.isFinite(new Date(candle.candleTs).getTime())
      && Number.isFinite(Number(candle.closePrice))
    ));

const readPersistedSession = (): PersistedSession | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedSession;
  } catch {
    return null;
  }
};

const deriveDateRange = (candles: Candle[]) => {
  const normalized = normalizeCandles(candles);
  if (normalized.length > 0) {
    return {
      from: normalized[0].candleTs,
      to: normalized[normalized.length - 1].candleTs,
      size: Math.max(200, normalized.length),
    };
  }

  const to = new Date();
  const from = new Date(to);
  from.setDate(to.getDate() - 30);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    size: 300,
  };
};

const buildOverlayPoints = (candles: Candle[], anchorPrice: number) => {
  const normalized = normalizeCandles(candles);
  const firstClose = Number(normalized[0]?.closePrice ?? 0);
  if (normalized.length === 0 || !Number.isFinite(firstClose) || firstClose <= 0 || anchorPrice <= 0) {
    return [];
  }

  return normalized.map((candle) => ({
    time: toChartTime(candle.candleTs),
    value: Number((((Number(candle.closePrice) / firstClose) * anchorPrice)).toFixed(3)),
  }));
};

export interface UseProChartCompareArgs {
  compareSeries: CompareSeriesConfig[];
  candles: Candle[];
  instrumentKey: string;
  timeframeUnit: string;
  timeframeInterval: number;
}

export const useProChartCompare = ({
  compareSeries,
  candles,
  instrumentKey,
  timeframeUnit,
  timeframeInterval,
}: UseProChartCompareArgs) => {
  const [states, setStates] = useState<Record<string, CompareSeriesState>>({});

  const anchorPrice = useMemo(() => {
    const normalized = normalizeCandles(candles);
    return Number(normalized[0]?.closePrice ?? 0);
  }, [candles]);

  useEffect(() => {
    const visibleSeries = compareSeries.filter((item) => item.visible && item.instrumentKey.trim() && item.instrumentKey !== instrumentKey);
    if (visibleSeries.length === 0) {
      setStates({});
      return;
    }

    const session = readPersistedSession();
    if (!session?.tenantId?.trim() || !session.token?.trim()) {
      setStates((current) => Object.fromEntries(
        visibleSeries.map((item) => [item.id, {
          ...item,
          loading: false,
          points: [],
          error: 'Admin session is required to load comparison symbols',
        } satisfies CompareSeriesState]),
      ));
      return;
    }

    const { from, to, size } = deriveDateRange(candles);
    let disposed = false;

    setStates((current) => Object.fromEntries(
      visibleSeries.map((item) => [item.id, {
        ...item,
        loading: true,
        points: current[item.id]?.points ?? [],
        error: undefined,
      } satisfies CompareSeriesState]),
    ));

    void Promise.all(visibleSeries.map(async (item) => {
      try {
        const response = await fetchHistoricalData(session.tenantId, session.token, {
          instrumentKey: item.instrumentKey,
          timeframeUnit,
          timeframeInterval,
          from,
          to,
          page: 0,
          size,
          sortBy: 'candleTs',
          sortDirection: 'desc',
        });

        if (disposed) return;
        const points = buildOverlayPoints(response.content, anchorPrice);
        setStates((current) => ({
          ...current,
          [item.id]: {
            ...item,
            loading: false,
            points,
            error: points.length === 0 ? 'No comparison candles were returned' : undefined,
          },
        }));
      } catch (error) {
        if (disposed) return;
        setStates((current) => ({
          ...current,
          [item.id]: {
            ...item,
            loading: false,
            points: [],
            error: error instanceof Error ? error.message : 'Unable to load comparison candles',
          },
        }));
      }
    }));

    return () => {
      disposed = true;
    };
  }, [anchorPrice, candles, compareSeries, instrumentKey, timeframeInterval, timeframeUnit]);

  const compareResults = useMemo(
    () => compareSeries.map((item) => {
      const current = states[item.id];
      return current ?? {
        ...item,
        loading: false,
        points: [],
        label: item.label ?? instrumentLabelFrom(item.instrumentKey),
      };
    }),
    [compareSeries, states],
  );

  const instrumentSuggestions = useMemo(
    () => INSTRUMENTS.map((instrument) => ({
      instrumentKey: instrument.key,
      label: instrument.label,
      id: createLocalId('compare-option'),
    })),
    [],
  );

  return { compareResults, instrumentSuggestions };
};
