import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import type { PersistedProChartState, ChartStyle, CompareSeriesState } from './ProChartCanvasShared';

type MainSeries = ISeriesApi<'Candlestick'> | ISeriesApi<'Bar'> | ISeriesApi<'Area'> | ISeriesApi<'Line'> | ISeriesApi<'Baseline'>;

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
};

export const readPersistedProChartState = (chartId: string): PersistedProChartState => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(`inalgo-pro-chart:${chartId}`);
    if (!raw) return {};
    return JSON.parse(raw) as PersistedProChartState;
  } catch {
    return {};
  }
};

export const usePersistedProChartStateEffect = (chartId: string, payload: PersistedProChartState) => {
  useEffect(() => {
    window.localStorage.setItem(`inalgo-pro-chart:${chartId}`, JSON.stringify(payload));
  }, [chartId, payload]);
};

export const useFullscreenChartShell = (shellRef: MutableRefObject<HTMLDivElement | null>) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === shellRef.current);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [shellRef]);

  const toggleFullscreen = async () => {
    if (!shellRef.current) return;
    if (document.fullscreenElement === shellRef.current) {
      await document.exitFullscreen();
      return;
    }
    await shellRef.current.requestFullscreen();
  };

  return { isFullscreen, toggleFullscreen };
};

export const useChartSnapshot = (
  chartId: string,
  priceChartRef: MutableRefObject<IChartApi | null>,
  priceHostRef: MutableRefObject<HTMLDivElement | null>,
) => {
  return () => {
    const chartWithScreenshot = priceChartRef.current as IChartApi & { takeScreenshot?: () => HTMLCanvasElement };
    const screenshot = typeof chartWithScreenshot?.takeScreenshot === 'function'
      ? chartWithScreenshot.takeScreenshot()
      : priceHostRef.current?.querySelector('canvas');
    if (!(screenshot instanceof HTMLCanvasElement)) return;
    screenshot.toBlob((blob) => {
      if (!blob) return;
      downloadBlob(blob, `${chartId}.png`);
    });
  };
};

export const useMainSeriesSync = (
  mainSeriesRef: MutableRefObject<MainSeries | null>,
  chartStyle: ChartStyle,
  refs: {
    candleSeriesRef: MutableRefObject<ISeriesApi<'Candlestick'> | null>;
    barSeriesRef: MutableRefObject<ISeriesApi<'Bar'> | null>;
    areaSeriesRef: MutableRefObject<ISeriesApi<'Area'> | null>;
    lineSeriesRef: MutableRefObject<ISeriesApi<'Line'> | null>;
    baselineSeriesRef: MutableRefObject<ISeriesApi<'Baseline'> | null>;
  },
  viewportVersion: number,
) => {
  useEffect(() => {
    mainSeriesRef.current = chartStyle === 'area'
      ? refs.areaSeriesRef.current
      : chartStyle === 'bars'
        ? refs.barSeriesRef.current
        : chartStyle === 'line'
          ? refs.lineSeriesRef.current
          : chartStyle === 'baseline'
            ? refs.baselineSeriesRef.current
            : refs.candleSeriesRef.current;
  }, [chartStyle, mainSeriesRef, refs, viewportVersion]);
};

export const useCompareLineSeries = (
  priceChartRef: MutableRefObject<IChartApi | null>,
  compareResults: CompareSeriesState[],
  viewportVersion: number,
) => {
  const compareLineSeriesRef = useRef<ISeriesApi<'Line'>[]>([]);

  useEffect(() => {
    const chart = priceChartRef.current;
    if (!chart) return;

    compareLineSeriesRef.current.forEach((series) => chart.removeSeries(series));
    compareLineSeriesRef.current = [];

    compareResults
      .filter((item) => item.visible && item.points.length > 0)
      .forEach((item) => {
        const series = chart.addLineSeries({
          color: item.color,
          lineWidth: 2,
          title: item.label,
          lastValueVisible: false,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
        });
        series.setData(item.points);
        compareLineSeriesRef.current.push(series);
      });

    return () => {
      compareLineSeriesRef.current.forEach((series) => chart.removeSeries(series));
      compareLineSeriesRef.current = [];
    };
  }, [compareResults, priceChartRef, viewportVersion]);
};
