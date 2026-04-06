import { Box } from '@mui/material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CandlestickData, IChartApi, IPriceLine, ISeriesApi, LineData } from 'lightweight-charts';
import {
  CHART_THEMES,
  DEFAULT_CHART_SETTINGS,
  DEFAULT_INDICATORS,
  INDICATOR_LIBRARY,
  TIMEFRAME_SECTION_ORDER,
  buildBollingerBands,
  buildEma,
  buildMacd,
  buildPivotLevels,
  buildRsi,
  buildSma,
  buildVwap,
  instrumentLabelFrom,
  timeframeLabel,
  type ChartColorMode,
  type ChartDrawing,
  type ChartStyle,
  type CompareSeriesConfig,
  type IndicatorKey,
  type PreparedCandle,
  type ProChartCanvasProps,
  type ProChartSettingsState,
  type PriceScalePreset,
} from './ProChartCanvasShared';
import { ProChartDrawingLayer } from './ProChartDrawingLayer';
import { ProChartDialogs } from './ProChartDialogs';
import { ProChartPanes } from './ProChartPanes';
import { ProChartSurfaceMeta } from './ProChartSurfaceMeta';
import { ProChartToolbar } from './ProChartToolbar';
import { useProChartCompare } from './useProChartCompare';
import {
  readPersistedProChartState,
  useChartSnapshot,
  useCompareLineSeries,
  useFullscreenChartShell,
  useMainSeriesSync,
  usePersistedProChartStateEffect,
} from './useProChartShell';
import { type ChartRefs, useProChartData, useProChartInit } from './useProChartSetup';

type MainSeries = ISeriesApi<'Candlestick'> | ISeriesApi<'Bar'> | ISeriesApi<'Area'> | ISeriesApi<'Line'> | ISeriesApi<'Baseline'>;
type CollapsedPanesState = Record<'macd' | 'rsi', boolean>;

export const ProChartCanvas = ({
  chartId,
  candles,
  height,
  loading,
  error,
  instrumentKey,
  timeframeUnit,
  timeframeInterval,
  timeframeOptions,
  onTimeframeChange,
  defaultIndicators,
  defaultColorMode,
}: ProChartCanvasProps) => {
  const persistedState = useMemo(() => readPersistedProChartState(chartId), [chartId]);

  const [chartStyle, setChartStyle] = useState<ChartStyle>(persistedState.chartStyle ?? 'candles');
  const [colorMode, setColorMode] = useState<ChartColorMode>(persistedState.colorMode ?? defaultColorMode ?? 'dark');
  const [priceScalePreset, setPriceScalePreset] = useState<PriceScalePreset>(persistedState.priceScalePreset ?? 'normal');
  const [indicatorSearch, setIndicatorSearch] = useState('');
  const [indicatorsOpen, setIndicatorsOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [drawingsOpen, setDrawingsOpen] = useState(false);
  const [indicators, setIndicators] = useState<Record<IndicatorKey, boolean>>(() => ({
    ...DEFAULT_INDICATORS,
    ...defaultIndicators,
    ...persistedState.indicators,
  }));
  const [collapsedPanes, setCollapsedPanes] = useState<CollapsedPanesState>({
    macd: persistedState.collapsedPanes?.macd ?? false,
    rsi: persistedState.collapsedPanes?.rsi ?? false,
  });
  const [timeframeMenuAnchor, setTimeframeMenuAnchor] = useState<HTMLElement | null>(null);
  const [chartTypeMenuAnchor, setChartTypeMenuAnchor] = useState<HTMLElement | null>(null);
  const [hoveredTime, setHoveredTime] = useState<number | null>(null);
  const [viewportVersion, setViewportVersion] = useState(0);
  const [activeTool, setActiveTool] = useState<'cursor' | 'trendLine' | 'horizontalLine' | 'verticalLine' | 'rectangle' | 'text' | 'measure'>('cursor');
  const [compareSeries, setCompareSeries] = useState<CompareSeriesConfig[]>(() => Array.isArray(persistedState.compareSeries) ? persistedState.compareSeries.slice(0, 3) : []);
  const [drawings, setDrawings] = useState<ChartDrawing[]>(persistedState.drawings ?? []);
  const [compareInstrument, setCompareInstrument] = useState('');
  const [customCompareInstrument, setCustomCompareInstrument] = useState('');
  const [settings, setSettings] = useState<ProChartSettingsState>({
    ...DEFAULT_CHART_SETTINGS,
    ...persistedState.settings,
  });

  const shellRef = useRef<HTMLDivElement | null>(null);
  const priceHostRef = useRef<HTMLDivElement | null>(null);
  const macdHostRef = useRef<HTMLDivElement | null>(null);
  const rsiHostRef = useRef<HTMLDivElement | null>(null);

  const priceChartRef = useRef<IChartApi | null>(null);
  const macdChartRef = useRef<IChartApi | null>(null);
  const rsiChartRef = useRef<IChartApi | null>(null);

  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const barSeriesRef = useRef<ISeriesApi<'Bar'> | null>(null);
  const areaSeriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const lineSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const baselineSeriesRef = useRef<ISeriesApi<'Baseline'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const smaSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const emaSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const vwapSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbUpperSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbBasisSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbLowerSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const macdHistogramSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const macdLineSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const macdSignalSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const pivotLinesRef = useRef<IPriceLine[]>([]);
  const rsiThresholdLinesRef = useRef<IPriceLine[]>([]);
  const rangeSyncRef = useRef(false);
  const crosshairSyncRef = useRef(false);
  const mainSeriesRef = useRef<MainSeries | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const refs: ChartRefs = useMemo(() => ({
    priceHostRef,
    macdHostRef,
    rsiHostRef,
    priceChartRef,
    macdChartRef,
    rsiChartRef,
    candleSeriesRef,
    barSeriesRef,
    areaSeriesRef,
    lineSeriesRef,
    baselineSeriesRef,
    volumeSeriesRef,
    smaSeriesRef,
    emaSeriesRef,
    vwapSeriesRef,
    bbUpperSeriesRef,
    bbBasisSeriesRef,
    bbLowerSeriesRef,
    macdHistogramSeriesRef,
    macdLineSeriesRef,
    macdSignalSeriesRef,
    rsiSeriesRef,
    pivotLinesRef,
    rsiThresholdLinesRef,
    rangeSyncRef,
    crosshairSyncRef,
  // Refs are stable (created by useRef) — deps omitted intentionally
  }), []);

  const theme = useMemo(() => CHART_THEMES[colorMode], [colorMode]);

  const preparedCandles = useMemo<PreparedCandle[]>(
    () => [...candles]
      .sort((left, right) => new Date(left.candleTs).getTime() - new Date(right.candleTs).getTime())
      .filter((candle) => (
        Number.isFinite(new Date(candle.candleTs).getTime())
        && Number.isFinite(Number(candle.openPrice))
        && Number.isFinite(Number(candle.highPrice))
        && Number.isFinite(Number(candle.lowPrice))
        && Number.isFinite(Number(candle.closePrice))
      ))
      .map((candle) => ({
        time: Math.floor(new Date(candle.candleTs).getTime() / 1000),
        labelTime: candle.candleTs,
        open: Number(candle.openPrice),
        high: Number(candle.highPrice),
        low: Number(candle.lowPrice),
        close: Number(candle.closePrice),
        volume: Number(candle.volume ?? 0),
      })),
    [candles],
  );

  const candleData = useMemo(
    () => preparedCandles.map((candle) => ({
      time: candle.time as CandlestickData['time'],
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    })),
    [preparedCandles],
  );

  const areaData = useMemo<LineData[]>(
    () => preparedCandles.map((candle) => ({
      time: candle.time as LineData['time'],
      value: candle.close,
    })),
    [preparedCandles],
  );

  const volumeData = useMemo(
    () => preparedCandles.map((candle) => ({
      time: candle.time as LineData['time'],
      value: candle.volume,
      color: candle.close >= candle.open ? 'rgba(34, 197, 94, 0.55)' : 'rgba(239, 68, 68, 0.55)',
    })),
    [preparedCandles],
  );

  const sma20 = useMemo(() => buildSma(preparedCandles, 20), [preparedCandles]);
  const ema50 = useMemo(() => buildEma(preparedCandles, 50), [preparedCandles]);
  const vwap = useMemo(() => buildVwap(preparedCandles), [preparedCandles]);
  const bollinger = useMemo(() => buildBollingerBands(preparedCandles), [preparedCandles]);
  const macd = useMemo(() => buildMacd(preparedCandles), [preparedCandles]);
  const rsi = useMemo(() => buildRsi(preparedCandles), [preparedCandles]);
  const pivotLevels = useMemo(() => buildPivotLevels(preparedCandles), [preparedCandles]);

  const candleLookup = useMemo(
    () => new Map(preparedCandles.map((candle) => [candle.time, candle])),
    [preparedCandles],
  );
  const macdLookup = useMemo(
    () => new Map(macd.macdLine.map((point) => [Number(point.time), point.value])),
    [macd.macdLine],
  );
  const rsiLookup = useMemo(
    () => new Map(rsi.map((point) => [Number(point.time), point.value])),
    [rsi],
  );

  const activeTimeframeKey = `${timeframeUnit}|${timeframeInterval}`;
  const currentTimeframeLabel = useMemo(() => {
    const current = timeframeOptions.find((option) => option.unit === timeframeUnit && option.interval === timeframeInterval);
    return current ? timeframeLabel(current) : `${timeframeInterval} ${timeframeUnit}`;
  }, [timeframeInterval, timeframeOptions, timeframeUnit]);

  const groupedTimeframes = useMemo(
    () => TIMEFRAME_SECTION_ORDER.flatMap((unit) => {
      const options = [...timeframeOptions]
        .filter((option) => option.unit === unit)
        .sort((left, right) => left.interval - right.interval);
      return options.length > 0 ? [{ unit, options }] : [];
    }),
    [timeframeOptions],
  );

  const hoveredCandle = hoveredTime === null
    ? preparedCandles.at(-1)
    : candleLookup.get(hoveredTime) ?? preparedCandles.at(-1);

  const filteredIndicators = useMemo(
    () => INDICATOR_LIBRARY.filter((indicator) => {
      const search = indicatorSearch.trim().toLowerCase();
      if (!search) return true;
      return indicator.label.toLowerCase().includes(search) || indicator.description.toLowerCase().includes(search);
    }),
    [indicatorSearch],
  );

  const showMacdPane = indicators.macd;
  const showRsiPane = indicators.rsi;
  const showMacdChart = showMacdPane && !collapsedPanes.macd;
  const showRsiChart = showRsiPane && !collapsedPanes.rsi;
  const macdPaneHeight = showMacdPane ? (collapsedPanes.macd ? 36 : 118) : 0;
  const rsiPaneHeight = showRsiPane ? (collapsedPanes.rsi ? 36 : 118) : 0;
  const mainChartHeight = Math.max(260, height - macdPaneHeight - rsiPaneHeight);

  const activeIndicatorCount = useMemo(
    () => Object.values(indicators).filter(Boolean).length,
    [indicators],
  );

  const changeValue = hoveredCandle ? hoveredCandle.close - hoveredCandle.open : 0;
  const changePercent = hoveredCandle && hoveredCandle.open !== 0
    ? (changeValue / hoveredCandle.open) * 100
    : 0;

  const handleViewportChange = useCallback(() => setViewportVersion((current) => current + 1), []);

  useProChartInit({
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
    gridVisible: settings.gridVisible,
    watermarkVisible: settings.watermarkVisible,
    crosshairMode: settings.crosshairMode,
    onHoveredTimeChange: setHoveredTime,
    onViewportChange: handleViewportChange,
  });

  useProChartData({
    refs,
    theme,
    instrumentKey,
    currentTimeframeLabel,
    chartStyle,
    priceScalePreset,
    indicators,
    gridVisible: settings.gridVisible,
    watermarkVisible: settings.watermarkVisible,
    crosshairMode: settings.crosshairMode,
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
  });

  useMainSeriesSync(mainSeriesRef, chartStyle, {
    candleSeriesRef,
    barSeriesRef,
    areaSeriesRef,
    lineSeriesRef,
    baselineSeriesRef,
  }, viewportVersion);

  usePersistedProChartStateEffect(chartId, {
      chartStyle,
      colorMode,
      priceScalePreset,
      indicators,
      collapsedPanes,
      compareSeries,
      drawings,
      settings,
  });

  const { compareResults, instrumentSuggestions } = useProChartCompare({
    compareSeries,
    candles,
    instrumentKey,
    timeframeUnit,
    timeframeInterval,
  });

  useCompareLineSeries(priceChartRef, compareResults, viewportVersion);
  const { isFullscreen, toggleFullscreen } = useFullscreenChartShell(shellRef);
  const handleSnapshot = useChartSnapshot(chartId, priceChartRef, priceHostRef);

  const addCompareSeries = () => {
    const nextInstrument = customCompareInstrument.trim() || compareInstrument.trim();
    if (!nextInstrument || compareSeries.some((item) => item.instrumentKey === nextInstrument) || compareSeries.length >= 3) {
      return;
    }
    const color = ['#38bdf8', '#f97316', '#22c55e'][compareSeries.length] ?? '#e879f9';
    setCompareSeries((current) => [...current, {
      id: `${chartId}-${nextInstrument}`,
      instrumentKey: nextInstrument,
      color,
      label: instrumentLabelFrom(nextInstrument),
      visible: true,
    }]);
    setCompareInstrument('');
    setCustomCompareInstrument('');
  };

  const resetChartState = () => {
    setChartStyle('candles');
    setColorMode(defaultColorMode ?? 'dark');
    setPriceScalePreset('normal');
    setIndicators({ ...DEFAULT_INDICATORS, ...defaultIndicators });
    setCollapsedPanes({ macd: false, rsi: false });
    setCompareSeries([]);
    setDrawings([]);
    setSettings(DEFAULT_CHART_SETTINGS);
  };

  return (
    <Box ref={shellRef} sx={{ position: 'relative', bgcolor: theme.shellBg, borderRadius: 2, p: 0.5 }}>
      <ProChartToolbar
        chartId={chartId}
        instrumentKey={instrumentKey}
        currentTimeframeLabel={currentTimeframeLabel}
        activeTimeframeKey={activeTimeframeKey}
        groupedTimeframes={groupedTimeframes}
        chartStyle={chartStyle}
        priceScalePreset={priceScalePreset}
        colorMode={colorMode}
        theme={theme}
        hoveredCandle={hoveredCandle}
        changeValue={changeValue}
        changePercent={changePercent}
        priceChartRef={priceChartRef}
        macdChartRef={macdChartRef}
        rsiChartRef={rsiChartRef}
        timeframeMenuAnchor={timeframeMenuAnchor}
        chartTypeMenuAnchor={chartTypeMenuAnchor}
        onTimeframeChange={onTimeframeChange}
        onChartStyleChange={setChartStyle}
        onPriceScalePresetChange={setPriceScalePreset}
        onColorModeToggle={() => setColorMode((current) => (current === 'dark' ? 'light' : 'dark'))}
        onIndicatorsOpen={() => setIndicatorsOpen(true)}
        onCompareOpen={() => setCompareOpen(true)}
        onDrawingsOpen={() => setDrawingsOpen(true)}
        onSettingsOpen={() => setSettingsOpen(true)}
        onSnapshot={handleSnapshot}
        onFullscreenToggle={() => { void toggleFullscreen(); }}
        onTimeframeMenuOpen={(anchor) => setTimeframeMenuAnchor(anchor)}
        onTimeframeMenuClose={() => setTimeframeMenuAnchor(null)}
        onChartTypeMenuOpen={(anchor) => setChartTypeMenuAnchor(anchor)}
        onChartTypeMenuClose={() => setChartTypeMenuAnchor(null)}
        compareCount={compareSeries.length}
        drawingCount={drawings.length}
        isFullscreen={isFullscreen}
      />
      <ProChartSurfaceMeta theme={theme} compareResults={compareResults} drawings={drawings} />

      <Box sx={{ position: 'relative' }}>
        <ProChartPanes
          mainChartHeight={mainChartHeight}
          priceHostRef={priceHostRef}
          theme={theme}
          colorMode={colorMode}
          loading={loading}
          error={error}
          hasCandles={preparedCandles.length > 0}
          macdPane={{
            show: showMacdPane,
            showChart: showMacdChart,
            paneHeight: macdPaneHeight,
            collapsed: collapsedPanes.macd,
            hostRef: macdHostRef,
            paneKey: 'macd',
            label: 'MACD',
          }}
          rsiPane={{
            show: showRsiPane,
            showChart: showRsiChart,
            paneHeight: rsiPaneHeight,
            collapsed: collapsedPanes.rsi,
            hostRef: rsiHostRef,
            paneKey: 'rsi',
            label: 'RSI',
          }}
          onToggleCollapse={(paneKey) => setCollapsedPanes((current) => ({ ...current, [paneKey]: !current[paneKey] }))}
          onRemovePane={(indicatorKey) => setIndicators((current) => ({ ...current, [indicatorKey]: false }))}
        />

        {preparedCandles.length > 0 && (
          <ProChartDrawingLayer
            theme={theme}
            activeTool={activeTool}
            drawings={drawings}
            mainChartHeight={mainChartHeight}
            preparedCandles={preparedCandles}
            viewportVersion={viewportVersion}
            magnetMode={settings.magnetMode}
            keepDrawing={settings.keepDrawing}
            showToolbar={settings.showDrawingToolbar}
            priceChartRef={priceChartRef}
            mainSeriesRef={mainSeriesRef}
            onActiveToolChange={setActiveTool}
            onDrawingsChange={(updater) => setDrawings((current) => updater(current))}
          />
        )}
      </Box>

      <ProChartDialogs
        colorMode={colorMode}
        theme={theme}
        indicatorsOpen={indicatorsOpen}
        compareOpen={compareOpen}
        settingsOpen={settingsOpen}
        drawingsOpen={drawingsOpen}
        indicators={indicators}
        indicatorSearch={indicatorSearch}
        activeIndicatorCount={activeIndicatorCount}
        filteredIndicators={filteredIndicators}
        compareResults={compareResults}
        instrumentSuggestions={instrumentSuggestions}
        compareInstrument={compareInstrument}
        customCompareInstrument={customCompareInstrument}
        drawings={drawings}
        settings={settings}
        setIndicatorsOpen={setIndicatorsOpen}
        setCompareOpen={setCompareOpen}
        setSettingsOpen={setSettingsOpen}
        setDrawingsOpen={setDrawingsOpen}
        setIndicatorSearch={setIndicatorSearch}
        setCompareInstrument={setCompareInstrument}
        setCustomCompareInstrument={setCustomCompareInstrument}
        setCompareSeries={setCompareSeries}
        setDrawings={setDrawings}
        setIndicators={setIndicators}
        setCollapsedPanes={setCollapsedPanes}
        setSettings={setSettings}
        onAddCompareSeries={addCompareSeries}
        onReset={resetChartState}
      />
    </Box>
  );
};
