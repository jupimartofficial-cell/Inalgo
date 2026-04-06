import {
  ColorType,
  CrosshairMode,
  LineStyle,
  createChart,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type LineData,
  type LogicalRange,
  type MouseEventParams,
  type Time,
} from 'lightweight-charts';
import { useEffect, type MutableRefObject } from 'react';
import {
  instrumentLabelFrom,
  priceScaleModeFrom,
  type CrosshairPreset,
  getTimeKey,
  type ChartStyle,
  type ChartVisualTheme,
  type IndicatorKey,
  type PreparedCandle,
  type PriceScalePreset,
} from './ProChartCanvasShared';

export interface ChartRefs {
  priceHostRef: MutableRefObject<HTMLDivElement | null>;
  macdHostRef: MutableRefObject<HTMLDivElement | null>;
  rsiHostRef: MutableRefObject<HTMLDivElement | null>;
  priceChartRef: MutableRefObject<IChartApi | null>;
  macdChartRef: MutableRefObject<IChartApi | null>;
  rsiChartRef: MutableRefObject<IChartApi | null>;
  candleSeriesRef: MutableRefObject<ISeriesApi<'Candlestick'> | null>;
  barSeriesRef: MutableRefObject<ISeriesApi<'Bar'> | null>;
  areaSeriesRef: MutableRefObject<ISeriesApi<'Area'> | null>;
  lineSeriesRef: MutableRefObject<ISeriesApi<'Line'> | null>;
  baselineSeriesRef: MutableRefObject<ISeriesApi<'Baseline'> | null>;
  volumeSeriesRef: MutableRefObject<ISeriesApi<'Histogram'> | null>;
  smaSeriesRef: MutableRefObject<ISeriesApi<'Line'> | null>;
  emaSeriesRef: MutableRefObject<ISeriesApi<'Line'> | null>;
  vwapSeriesRef: MutableRefObject<ISeriesApi<'Line'> | null>;
  bbUpperSeriesRef: MutableRefObject<ISeriesApi<'Line'> | null>;
  bbBasisSeriesRef: MutableRefObject<ISeriesApi<'Line'> | null>;
  bbLowerSeriesRef: MutableRefObject<ISeriesApi<'Line'> | null>;
  macdHistogramSeriesRef: MutableRefObject<ISeriesApi<'Histogram'> | null>;
  macdLineSeriesRef: MutableRefObject<ISeriesApi<'Line'> | null>;
  macdSignalSeriesRef: MutableRefObject<ISeriesApi<'Line'> | null>;
  rsiSeriesRef: MutableRefObject<ISeriesApi<'Line'> | null>;
  pivotLinesRef: MutableRefObject<IPriceLine[]>;
  rsiThresholdLinesRef: MutableRefObject<IPriceLine[]>;
  rangeSyncRef: MutableRefObject<boolean>;
  crosshairSyncRef: MutableRefObject<boolean>;
}

export interface UseProChartInitParams {
  refs: ChartRefs;
  theme: ChartVisualTheme;
  instrumentKey: string;
  currentTimeframeLabel: string;
  chartStyle: ChartStyle;
  showMacdChart: boolean;
  showRsiChart: boolean;
  candleLookup: Map<number, PreparedCandle>;
  macdLookup: Map<number, number>;
  rsiLookup: Map<number, number>;
  gridVisible: boolean;
  watermarkVisible: boolean;
  crosshairMode: CrosshairPreset;
  onHoveredTimeChange: (time: number | null) => void;
  onViewportChange?: () => void;
}

export interface UseProChartDataParams {
  refs: ChartRefs;
  theme: ChartVisualTheme;
  instrumentKey: string;
  currentTimeframeLabel: string;
  chartStyle: ChartStyle;
  priceScalePreset: PriceScalePreset;
  indicators: Record<IndicatorKey, boolean>;
  gridVisible: boolean;
  watermarkVisible: boolean;
  crosshairMode: CrosshairPreset;
  candleData: CandlestickData[];
  areaData: LineData[];
  volumeData: HistogramData[];
  sma20: LineData[];
  ema50: LineData[];
  vwap: LineData[];
  bollinger: { upper: LineData[]; basis: LineData[]; lower: LineData[] };
  macd: { histogram: HistogramData[]; macdLine: LineData[]; signalLine: LineData[] };
  rsi: LineData[];
  pivotLevels: { label: string; value: number; color: string }[];
}

export const useProChartInit = ({
  refs,
  theme,
  instrumentKey,
  currentTimeframeLabel,
  chartStyle,
  showMacdChart,
  showRsiChart,
  candleLookup,
  macdLookup,
  rsiLookup,
  gridVisible,
  watermarkVisible,
  crosshairMode,
  onHoveredTimeChange,
  onViewportChange,
}: UseProChartInitParams) => {
  useEffect(() => {
    if (!refs.priceHostRef.current) return undefined;

    const baseChartOptions = {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: theme.chartBg },
        textColor: theme.text,
      },
      grid: {
        vertLines: { color: gridVisible ? theme.grid : 'transparent' },
        horzLines: { color: gridVisible ? theme.grid : 'transparent' },
      },
      rightPriceScale: { borderColor: theme.border },
      timeScale: { borderColor: theme.border, timeVisible: true, secondsVisible: false },
      crosshair: {
        mode: crosshairMode === 'normal' ? CrosshairMode.Normal : CrosshairMode.Magnet,
        vertLine: { color: theme.crosshair, width: 1, style: LineStyle.Dashed, labelBackgroundColor: theme.labelBg },
        horzLine: { color: theme.crosshair, width: 1, style: LineStyle.Dashed, labelBackgroundColor: theme.labelBg },
      },
      watermark: {
        visible: watermarkVisible,
        color: theme.watermark,
        text: `${instrumentLabelFrom(instrumentKey)} · ${currentTimeframeLabel}`,
        fontSize: 28,
      },
    } as const;

    const createPaneChart = (host: HTMLDivElement, watermarkText: string) => createChart(host, {
      ...baseChartOptions,
      timeScale: { ...baseChartOptions.timeScale, visible: false },
      watermark: { visible: true, color: theme.watermark, text: watermarkText, fontSize: 18 },
      handleScale: { axisPressedMouseMove: { time: true, price: true }, axisDoubleClickReset: { time: true, price: true }, mouseWheel: true, pinch: true },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
    });

    const priceChart = createChart(refs.priceHostRef.current, {
      ...baseChartOptions,
      handleScale: { axisPressedMouseMove: { time: true, price: true }, axisDoubleClickReset: { time: true, price: true }, mouseWheel: true, pinch: true },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
    });

    const candleSeries = priceChart.addCandlestickSeries({ upColor: '#22c55e', downColor: '#ef4444', wickUpColor: '#22c55e', wickDownColor: '#ef4444', borderVisible: false, lastValueVisible: true, priceLineVisible: true });
    const barSeries = priceChart.addBarSeries({ upColor: '#22c55e', downColor: '#ef4444', thinBars: false, visible: false });
    const areaSeries = priceChart.addAreaSeries({ visible: false, lineColor: '#38bdf8', topColor: 'rgba(56, 189, 248, 0.35)', bottomColor: 'rgba(56, 189, 248, 0.02)', lineWidth: 2 });
    const lineSeries = priceChart.addLineSeries({ visible: false, color: '#38bdf8', lineWidth: 2, crosshairMarkerVisible: false });
    const baselineSeries = priceChart.addBaselineSeries({
      visible: false,
      baseValue: { type: 'price', price: 0 },
      topLineColor: '#16a34a',
      topFillColor1: 'rgba(34, 197, 94, 0.22)',
      topFillColor2: 'rgba(34, 197, 94, 0.04)',
      bottomLineColor: '#dc2626',
      bottomFillColor1: 'rgba(239, 68, 68, 0.08)',
      bottomFillColor2: 'rgba(239, 68, 68, 0.22)',
      lineWidth: 2,
      crosshairMarkerVisible: false,
    });
    const volumeSeries = priceChart.addHistogramSeries({ color: '#64748b', priceFormat: { type: 'volume' }, priceScaleId: '', lastValueVisible: false, priceLineVisible: false });
    priceChart.priceScale('').applyOptions({ scaleMargins: { top: 0.76, bottom: 0 } });

    const smaSeries = priceChart.addLineSeries({ color: '#fbbf24', lineWidth: 1, title: 'SMA 20', lastValueVisible: true, priceLineVisible: false });
    const emaSeries = priceChart.addLineSeries({ color: '#60a5fa', lineWidth: 2, title: 'EMA 50', lastValueVisible: true, priceLineVisible: false });
    const vwapSeries = priceChart.addLineSeries({ color: '#c084fc', lineWidth: 1, lineStyle: LineStyle.Dashed, title: 'VWAP', lastValueVisible: true, priceLineVisible: false });
    const bbUpperSeries = priceChart.addLineSeries({ color: 'rgba(239, 68, 68, 0.75)', lineWidth: 1, lineStyle: LineStyle.Dotted, title: 'BB Upper', lastValueVisible: false, priceLineVisible: false });
    const bbBasisSeries = priceChart.addLineSeries({ color: 'rgba(226, 232, 240, 0.55)', lineWidth: 1, lineStyle: LineStyle.Dashed, title: 'BB Basis', lastValueVisible: false, priceLineVisible: false });
    const bbLowerSeries = priceChart.addLineSeries({ color: 'rgba(34, 197, 94, 0.75)', lineWidth: 1, lineStyle: LineStyle.Dotted, title: 'BB Lower', lastValueVisible: false, priceLineVisible: false });

    let macdChart: IChartApi | null = null;
    let rsiChart: IChartApi | null = null;
    let macdHistogramSeries: ISeriesApi<'Histogram'> | null = null;
    let macdLineSeries: ISeriesApi<'Line'> | null = null;
    let macdSignalSeries: ISeriesApi<'Line'> | null = null;
    let rsiSeries: ISeriesApi<'Line'> | null = null;

    if (showMacdChart && refs.macdHostRef.current) {
      macdChart = createPaneChart(refs.macdHostRef.current, 'MACD');
      macdHistogramSeries = macdChart.addHistogramSeries({ priceLineVisible: false, lastValueVisible: true });
      macdLineSeries = macdChart.addLineSeries({ color: '#38bdf8', lineWidth: 2, title: 'MACD', priceLineVisible: false });
      macdSignalSeries = macdChart.addLineSeries({ color: '#f97316', lineWidth: 2, title: 'Signal', priceLineVisible: false });
    }

    if (showRsiChart && refs.rsiHostRef.current) {
      rsiChart = createPaneChart(refs.rsiHostRef.current, 'RSI');
      rsiSeries = rsiChart.addLineSeries({ color: '#22d3ee', lineWidth: 2, title: 'RSI 14', priceLineVisible: false });
    }

    refs.priceChartRef.current = priceChart;
    refs.macdChartRef.current = macdChart;
    refs.rsiChartRef.current = rsiChart;
    refs.candleSeriesRef.current = candleSeries;
    refs.barSeriesRef.current = barSeries;
    refs.areaSeriesRef.current = areaSeries;
    refs.lineSeriesRef.current = lineSeries;
    refs.baselineSeriesRef.current = baselineSeries;
    refs.volumeSeriesRef.current = volumeSeries;
    refs.smaSeriesRef.current = smaSeries;
    refs.emaSeriesRef.current = emaSeries;
    refs.vwapSeriesRef.current = vwapSeries;
    refs.bbUpperSeriesRef.current = bbUpperSeries;
    refs.bbBasisSeriesRef.current = bbBasisSeries;
    refs.bbLowerSeriesRef.current = bbLowerSeries;
    refs.macdHistogramSeriesRef.current = macdHistogramSeries;
    refs.macdLineSeriesRef.current = macdLineSeries;
    refs.macdSignalSeriesRef.current = macdSignalSeries;
    refs.rsiSeriesRef.current = rsiSeries;

    const syncVisibleRange = (sourceRange: LogicalRange | null, source: IChartApi) => {
      if (sourceRange === null || refs.rangeSyncRef.current) return;
      refs.rangeSyncRef.current = true;
      [priceChart, macdChart, rsiChart]
        .filter((chart): chart is IChartApi => chart !== null && chart !== source)
        .forEach((chart) => chart.timeScale().setVisibleLogicalRange(sourceRange));
      refs.rangeSyncRef.current = false;
    };

    const syncCrosshair = (source: IChartApi, param: MouseEventParams<Time>) => {
      if (refs.crosshairSyncRef.current) return;
      const crosshairTime = param.time;
      const hoveredKey = getTimeKey(param.time);
      onHoveredTimeChange(hoveredKey);
      refs.crosshairSyncRef.current = true;

      if (hoveredKey === null || !param.point || crosshairTime === undefined) {
        [priceChart, macdChart, rsiChart]
          .filter((chart): chart is IChartApi => chart !== null && chart !== source)
          .forEach((chart) => chart.clearCrosshairPosition());
        refs.crosshairSyncRef.current = false;
        return;
      }

      const candle = candleLookup.get(hoveredKey);
      const macdValue = macdLookup.get(hoveredKey);
      const rsiValue = rsiLookup.get(hoveredKey);
      const mainSeries = chartStyle === 'area'
        ? areaSeries
        : chartStyle === 'bars'
          ? barSeries
          : chartStyle === 'line'
            ? lineSeries
            : chartStyle === 'baseline'
              ? baselineSeries
              : candleSeries;

      if (candle) {
        if (source !== priceChart) priceChart.setCrosshairPosition(candle.close, crosshairTime, mainSeries);
        if (macdChart && macdLineSeries && source !== macdChart && typeof macdValue === 'number') {
          macdChart.setCrosshairPosition(macdValue, crosshairTime, macdLineSeries);
        }
        if (rsiChart && rsiSeries && source !== rsiChart && typeof rsiValue === 'number') {
          rsiChart.setCrosshairPosition(rsiValue, crosshairTime, rsiSeries);
        }
      }
      refs.crosshairSyncRef.current = false;
    };

    priceChart.timeScale().subscribeVisibleLogicalRangeChange((range) => syncVisibleRange(range, priceChart));
    macdChart?.timeScale().subscribeVisibleLogicalRangeChange((range) => syncVisibleRange(range, macdChart));
    rsiChart?.timeScale().subscribeVisibleLogicalRangeChange((range) => syncVisibleRange(range, rsiChart));
    priceChart.timeScale().subscribeVisibleLogicalRangeChange(() => onViewportChange?.());
    macdChart?.timeScale().subscribeVisibleLogicalRangeChange(() => onViewportChange?.());
    rsiChart?.timeScale().subscribeVisibleLogicalRangeChange(() => onViewportChange?.());
    priceChart.subscribeCrosshairMove((param) => syncCrosshair(priceChart, param));
    macdChart?.subscribeCrosshairMove((param) => syncCrosshair(macdChart, param));
    rsiChart?.subscribeCrosshairMove((param) => syncCrosshair(rsiChart, param));

    return () => {
      refs.pivotLinesRef.current = [];
      refs.rsiThresholdLinesRef.current = [];
      priceChart.remove();
      macdChart?.remove();
      rsiChart?.remove();
      refs.priceChartRef.current = null;
      refs.macdChartRef.current = null;
      refs.rsiChartRef.current = null;
      refs.candleSeriesRef.current = null;
      refs.barSeriesRef.current = null;
      refs.areaSeriesRef.current = null;
      refs.lineSeriesRef.current = null;
      refs.baselineSeriesRef.current = null;
      refs.volumeSeriesRef.current = null;
      refs.smaSeriesRef.current = null;
      refs.emaSeriesRef.current = null;
      refs.vwapSeriesRef.current = null;
      refs.bbUpperSeriesRef.current = null;
      refs.bbBasisSeriesRef.current = null;
      refs.bbLowerSeriesRef.current = null;
      refs.macdHistogramSeriesRef.current = null;
      refs.macdLineSeriesRef.current = null;
      refs.macdSignalSeriesRef.current = null;
      refs.rsiSeriesRef.current = null;
    };
  }, [candleLookup, chartStyle, crosshairMode, currentTimeframeLabel, gridVisible, instrumentKey, macdLookup, onHoveredTimeChange, onViewportChange, refs, rsiLookup, showMacdChart, showRsiChart, theme, watermarkVisible]);
};

export const useProChartData = ({
  refs,
  theme,
  instrumentKey,
  currentTimeframeLabel,
  chartStyle,
  priceScalePreset,
  indicators,
  gridVisible,
  watermarkVisible,
  crosshairMode,
  candleData,
  areaData,
  volumeData,
  sma20,
  ema50,
  vwap,
  bollinger,
  macd,
  rsi,
  pivotLevels,
}: UseProChartDataParams) => {
  useEffect(() => {
    const priceChart = refs.priceChartRef.current;
    if (!priceChart || !refs.candleSeriesRef.current || !refs.barSeriesRef.current || !refs.areaSeriesRef.current || !refs.lineSeriesRef.current || !refs.baselineSeriesRef.current || !refs.volumeSeriesRef.current) {
      return;
    }

    priceChart.applyOptions({
      grid: {
        vertLines: { color: gridVisible ? theme.grid : 'transparent' },
        horzLines: { color: gridVisible ? theme.grid : 'transparent' },
      },
      watermark: {
        visible: watermarkVisible,
        color: theme.watermark,
        text: `${instrumentLabelFrom(instrumentKey)} · ${currentTimeframeLabel}`,
        fontSize: 28,
      },
      crosshair: {
        mode: crosshairMode === 'normal' ? CrosshairMode.Normal : CrosshairMode.Magnet,
      },
      rightPriceScale: { mode: priceScaleModeFrom(priceScalePreset) },
    });

    refs.candleSeriesRef.current.setData(candleData);
    refs.barSeriesRef.current.setData(candleData);
    refs.areaSeriesRef.current.setData(areaData);
    refs.lineSeriesRef.current.setData(areaData);
    refs.baselineSeriesRef.current.setData(areaData);
    refs.volumeSeriesRef.current.setData(volumeData);

    refs.candleSeriesRef.current.applyOptions({ visible: chartStyle === 'candles' });
    refs.barSeriesRef.current.applyOptions({ visible: chartStyle === 'bars' });
    refs.areaSeriesRef.current.applyOptions({ visible: chartStyle === 'area' });
    refs.lineSeriesRef.current.applyOptions({ visible: chartStyle === 'line' });
    refs.baselineSeriesRef.current.applyOptions({ visible: chartStyle === 'baseline' });
    refs.baselineSeriesRef.current.applyOptions({
      baseValue: {
        type: 'price',
        price: areaData[0]?.value ?? 0,
      },
    });
    refs.volumeSeriesRef.current.applyOptions({ visible: indicators.volume });
    priceChart.priceScale('').applyOptions({ scaleMargins: { top: indicators.volume ? 0.76 : 0.97, bottom: 0 } });

    refs.smaSeriesRef.current?.setData(sma20);
    refs.smaSeriesRef.current?.applyOptions({ visible: indicators.sma });
    refs.emaSeriesRef.current?.setData(ema50);
    refs.emaSeriesRef.current?.applyOptions({ visible: indicators.ema });
    refs.vwapSeriesRef.current?.setData(vwap);
    refs.vwapSeriesRef.current?.applyOptions({ visible: indicators.vwap });
    refs.bbUpperSeriesRef.current?.setData(bollinger.upper);
    refs.bbUpperSeriesRef.current?.applyOptions({ visible: indicators.bollinger });
    refs.bbBasisSeriesRef.current?.setData(bollinger.basis);
    refs.bbBasisSeriesRef.current?.applyOptions({ visible: indicators.bollinger });
    refs.bbLowerSeriesRef.current?.setData(bollinger.lower);
    refs.bbLowerSeriesRef.current?.applyOptions({ visible: indicators.bollinger });

    const mainSeries = chartStyle === 'area'
      ? refs.areaSeriesRef.current
      : chartStyle === 'bars'
        ? refs.barSeriesRef.current
        : chartStyle === 'line'
          ? refs.lineSeriesRef.current
          : chartStyle === 'baseline'
            ? refs.baselineSeriesRef.current
        : refs.candleSeriesRef.current;

    refs.pivotLinesRef.current.forEach((line) => mainSeries.removePriceLine(line));
    refs.pivotLinesRef.current = indicators.pivots
      ? pivotLevels.map((level) => mainSeries.createPriceLine({
        price: level.value,
        color: level.color,
        lineWidth: level.label === 'P' ? 2 : 1,
        lineStyle: level.label === 'P' ? LineStyle.Dashed : LineStyle.Solid,
        axisLabelVisible: true,
        title: level.label,
      }))
      : [];

    refs.macdHistogramSeriesRef.current?.setData(macd.histogram);
    refs.macdLineSeriesRef.current?.setData(macd.macdLine);
    refs.macdSignalSeriesRef.current?.setData(macd.signalLine);
    refs.rsiSeriesRef.current?.setData(rsi);

    if (refs.rsiSeriesRef.current) {
      refs.rsiThresholdLinesRef.current.forEach((line) => refs.rsiSeriesRef.current?.removePriceLine(line));
      refs.rsiThresholdLinesRef.current = [
        refs.rsiSeriesRef.current.createPriceLine({ price: 70, color: 'rgba(248, 113, 113, 0.85)', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: '70' }),
        refs.rsiSeriesRef.current.createPriceLine({ price: 50, color: 'rgba(148, 163, 184, 0.75)', lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: '50' }),
        refs.rsiSeriesRef.current.createPriceLine({ price: 30, color: 'rgba(74, 222, 128, 0.85)', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: '30' }),
      ];
    }

    if (candleData.length > 0) {
      priceChart.timeScale().fitContent();
      refs.macdChartRef.current?.timeScale().fitContent();
      refs.rsiChartRef.current?.timeScale().fitContent();
    }
  }, [areaData, bollinger, candleData, chartStyle, crosshairMode, currentTimeframeLabel, ema50, gridVisible, indicators, instrumentKey, macd, pivotLevels, priceScalePreset, refs, rsi, sma20, theme, volumeData, vwap, watermarkVisible]);
};
