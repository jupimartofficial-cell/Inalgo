import { PriceScaleMode, type CandlestickData, type HistogramData, type LineData, type Time } from 'lightweight-charts';
import type { Candle } from '../api/admin';

export type ChartStyle = 'candles' | 'bars' | 'area' | 'line' | 'baseline';
export type PriceScalePreset = 'normal' | 'log' | 'percent' | 'indexed';
export type IndicatorKey = 'volume' | 'ema' | 'sma' | 'vwap' | 'bollinger' | 'pivots' | 'macd' | 'rsi';
export type ChartColorMode = 'dark' | 'light';
export type CrosshairPreset = 'magnet' | 'normal';
export type DrawingTool = 'cursor' | 'trendLine' | 'horizontalLine' | 'verticalLine' | 'rectangle' | 'text' | 'measure';
export type DrawableTool = Exclude<DrawingTool, 'cursor'>;

export interface TimeframeOption {
  unit: string;
  interval: number;
  label: string;
}

export interface ProChartCanvasProps {
  chartId: string;
  candles: Candle[];
  height: number;
  loading: boolean;
  error?: string;
  instrumentKey: string;
  timeframeUnit: string;
  timeframeInterval: number;
  timeframeOptions: TimeframeOption[];
  onTimeframeChange: (unit: string, interval: number) => void;
  defaultIndicators?: Partial<Record<IndicatorKey, boolean>>;
  defaultColorMode?: ChartColorMode;
}

export interface PreparedCandle {
  time: number;
  labelTime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PivotLevel {
  label: string;
  value: number;
  color: string;
}
export interface CompareSeriesConfig {
  id: string;
  instrumentKey: string;
  color: string;
  label?: string;
  visible: boolean;
}
export interface CompareSeriesState extends CompareSeriesConfig {
  loading: boolean;
  error?: string;
  points: LineData[];
}
export interface TrendLineDrawing {
  id: string;
  type: 'trendLine';
  label: string;
  color: string;
  visible: boolean;
  locked: boolean;
  startTime: number;
  startPrice: number;
  endTime: number;
  endPrice: number;
}
export interface HorizontalLineDrawing {
  id: string;
  type: 'horizontalLine';
  label: string;
  color: string;
  visible: boolean;
  locked: boolean;
  price: number;
}
export interface VerticalLineDrawing {
  id: string;
  type: 'verticalLine';
  label: string;
  color: string;
  visible: boolean;
  locked: boolean;
  time: number;
}
export interface RectangleDrawing {
  id: string;
  type: 'rectangle';
  label: string;
  color: string;
  visible: boolean;
  locked: boolean;
  startTime: number;
  startPrice: number;
  endTime: number;
  endPrice: number;
}
export interface TextDrawing {
  id: string;
  type: 'text';
  label: string;
  color: string;
  visible: boolean;
  locked: boolean;
  time: number;
  price: number;
  text: string;
}
export interface MeasureDrawing {
  id: string;
  type: 'measure';
  label: string;
  color: string;
  visible: boolean;
  locked: boolean;
  startTime: number;
  startPrice: number;
  endTime: number;
  endPrice: number;
}
export type ChartDrawing = TrendLineDrawing | HorizontalLineDrawing | VerticalLineDrawing | RectangleDrawing | TextDrawing | MeasureDrawing;
export interface ProChartSettingsState {
  gridVisible: boolean;
  watermarkVisible: boolean;
  showDrawingToolbar: boolean;
  magnetMode: boolean;
  keepDrawing: boolean;
  crosshairMode: CrosshairPreset;
}
export interface PersistedProChartState {
  chartStyle?: ChartStyle;
  colorMode?: ChartColorMode;
  priceScalePreset?: PriceScalePreset;
  indicators?: Partial<Record<IndicatorKey, boolean>>;
  collapsedPanes?: Partial<Record<'macd' | 'rsi', boolean>>;
  compareSeries?: CompareSeriesConfig[];
  drawings?: ChartDrawing[];
  settings?: Partial<ProChartSettingsState>;
}
export interface ChartVisualTheme {
  shellBg: string;
  toolbarBg: string;
  surfaceBg: string;
  chartBg: string;
  menuBg: string;
  text: string;
  strongText: string;
  mutedText: string;
  border: string;
  grid: string;
  crosshair: string;
  labelBg: string;
  overlayBg: string;
  watermark: string;
  chipBg: string;
  chipText: string;
}

export const DEFAULT_INDICATORS: Record<IndicatorKey, boolean> = {
  volume: true,
  ema: true,
  sma: false,
  vwap: true,
  bollinger: true,
  pivots: true,
  macd: true,
  rsi: true,
};

export const CHART_THEMES: Record<ChartColorMode, ChartVisualTheme> = {
  dark: {
    shellBg: '#020817',
    toolbarBg: '#020817',
    surfaceBg: '#0b1120',
    chartBg: '#0f172a',
    menuBg: '#0f172a',
    text: '#cbd5e1',
    strongText: '#f8fafc',
    mutedText: '#94a3b8',
    border: 'rgba(148,163,184,0.18)',
    grid: 'rgba(100,116,139,0.14)',
    crosshair: 'rgba(148,163,184,0.45)',
    labelBg: '#111827',
    overlayBg: 'rgba(2,6,23,0.78)',
    watermark: 'rgba(148,163,184,0.10)',
    chipBg: 'rgba(59,130,246,0.18)',
    chipText: '#bfdbfe',
  },
  light: {
    shellBg: '#f8fafc',
    toolbarBg: '#ffffff',
    surfaceBg: '#ffffff',
    chartBg: '#ffffff',
    menuBg: '#ffffff',
    text: '#334155',
    strongText: '#0f172a',
    mutedText: '#64748b',
    border: 'rgba(15,23,42,0.10)',
    grid: 'rgba(148,163,184,0.24)',
    crosshair: 'rgba(100,116,139,0.52)',
    labelBg: '#e2e8f0',
    overlayBg: 'rgba(248,250,252,0.86)',
    watermark: 'rgba(100,116,139,0.12)',
    chipBg: 'rgba(37,99,235,0.10)',
    chipText: '#1d4ed8',
  },
};

export const TIMEFRAME_SECTION_ORDER = ['seconds', 'minutes', 'hours', 'days', 'weeks', 'months'];

export const INDICATOR_LIBRARY: Array<{ key: IndicatorKey; label: string; description: string }> = [
  { key: 'volume', label: 'Volume', description: 'Color-coded volume histogram on the price pane.' },
  { key: 'ema', label: 'EMA 50', description: 'Medium-term trend line for faster directional bias.' },
  { key: 'sma', label: 'SMA 20', description: 'Short-term moving average for pullback structure.' },
  { key: 'vwap', label: 'VWAP', description: 'Session value reference used heavily for intraday execution.' },
  { key: 'bollinger', label: 'Bollinger Bands', description: 'Volatility envelopes around the 20-period mean.' },
  { key: 'pivots', label: 'Pivot Levels', description: 'Professional support and resistance ladder with P/R/S levels.' },
  { key: 'macd', label: 'MACD', description: 'Momentum pane with MACD line, signal line, and histogram.' },
  { key: 'rsi', label: 'RSI 14', description: 'Oscillator pane with 30/50/70 reference levels.' },
];

export const toChartTime = (ts: string): CandlestickData['time'] => Math.floor(new Date(ts).getTime() / 1000) as CandlestickData['time'];

export const getTimeKey = (time: Time | number | undefined) => {
  if (typeof time === 'number') return Math.round(time);
  return null;
};

export const instrumentLabelFrom = (instrumentKey: string) => instrumentKey.split('|').at(-1) ?? instrumentKey;

export const DRAWING_TOOL_OPTIONS: Array<{ value: DrawingTool; label: string }> = [
  { value: 'cursor', label: 'Cursor' },
  { value: 'trendLine', label: 'Trend Line' },
  { value: 'horizontalLine', label: 'Horizontal' },
  { value: 'verticalLine', label: 'Vertical' },
  { value: 'rectangle', label: 'Zone' },
  { value: 'text', label: 'Text' },
  { value: 'measure', label: 'Measure' },
];

export const COMPARE_SERIES_COLORS = ['#38bdf8', '#f97316', '#22c55e', '#e879f9', '#facc15', '#ef4444'];

export const DEFAULT_CHART_SETTINGS: ProChartSettingsState = {
  gridVisible: true,
  watermarkVisible: true,
  showDrawingToolbar: true,
  magnetMode: true,
  keepDrawing: false,
  crosshairMode: 'magnet',
};

export const createLocalId = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;

export const createDrawingLabel = (type: ChartDrawing['type'], count: number) => {
  if (type === 'trendLine') return `Trend Line ${count}`;
  if (type === 'horizontalLine') return `Horizontal ${count}`;
  if (type === 'verticalLine') return `Vertical ${count}`;
  if (type === 'rectangle') return `Zone ${count}`;
  if (type === 'text') return `Text ${count}`;
  return `Measure ${count}`;
};

export const clampNumber = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const formatDecimal = (value: number | undefined, digits = 2) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '--';
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

export const formatCompact = (value: number | undefined) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '--';
  return new Intl.NumberFormat('en-IN', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value);
};

export const emaValues = (values: number[], period: number) => {
  if (values.length < period) return new Array<number | null>(values.length).fill(null);
  const output = new Array<number | null>(values.length).fill(null);
  const multiplier = 2 / (period + 1);
  const seed = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  output[period - 1] = seed;
  let current = seed;
  for (let index = period; index < values.length; index += 1) {
    current = (values[index] - current) * multiplier + current;
    output[index] = current;
  }
  return output;
};

export const buildSma = (candles: PreparedCandle[], period: number) => {
  if (candles.length < period) return [];
  const output: LineData[] = [];
  let rolling = 0;
  for (let index = 0; index < candles.length; index += 1) {
    rolling += candles[index].close;
    if (index >= period) {
      rolling -= candles[index - period].close;
    }
    if (index >= period - 1) {
      output.push({
        time: candles[index].time as LineData['time'],
        value: Number((rolling / period).toFixed(3)),
      });
    }
  }
  return output;
};

export const buildEma = (candles: PreparedCandle[], period: number) =>
  emaValues(candles.map((candle) => candle.close), period)
    .map((value, index) => (
      value === null
        ? null
        : { time: candles[index].time as LineData['time'], value: Number(value.toFixed(3)) }
    ))
    .filter((point): point is LineData => point !== null);

export const buildVwap = (candles: PreparedCandle[]) => {
  let cumulativePriceVolume = 0;
  let cumulativeVolume = 0;
  let currentSession = '';
  return candles.flatMap((candle) => {
    const nextSession = candle.labelTime.slice(0, 10);
    if (nextSession !== currentSession) {
      currentSession = nextSession;
      cumulativePriceVolume = 0;
      cumulativeVolume = 0;
    }
    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    cumulativePriceVolume += typicalPrice * candle.volume;
    cumulativeVolume += candle.volume;
    if (cumulativeVolume === 0) return [];
    return [{
      time: candle.time as LineData['time'],
      value: Number((cumulativePriceVolume / cumulativeVolume).toFixed(3)),
    }];
  });
};

export const buildBollingerBands = (candles: PreparedCandle[], period = 20, multiplier = 2) => {
  if (candles.length < period) {
    return { upper: [] as LineData[], basis: [] as LineData[], lower: [] as LineData[] };
  }
  const upper: LineData[] = [];
  const basis: LineData[] = [];
  const lower: LineData[] = [];
  for (let index = period - 1; index < candles.length; index += 1) {
    const slice = candles.slice(index - period + 1, index + 1).map((candle) => candle.close);
    const mean = slice.reduce((sum, value) => sum + value, 0) / period;
    const variance = slice.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / period;
    const deviation = Math.sqrt(variance);
    basis.push({ time: candles[index].time as LineData['time'], value: Number(mean.toFixed(3)) });
    upper.push({
      time: candles[index].time as LineData['time'],
      value: Number((mean + (deviation * multiplier)).toFixed(3)),
    });
    lower.push({
      time: candles[index].time as LineData['time'],
      value: Number((mean - (deviation * multiplier)).toFixed(3)),
    });
  }
  return { upper, basis, lower };
};

export const buildMacd = (candles: PreparedCandle[]) => {
  const closes = candles.map((candle) => candle.close);
  const fast = emaValues(closes, 12);
  const slow = emaValues(closes, 26);
  const macdValues = closes.map((_, index) => (
    fast[index] !== null && slow[index] !== null ? fast[index]! - slow[index]! : null
  ));
  const signalSeed = macdValues.filter((value): value is number => value !== null);
  const signalSparse = emaValues(signalSeed, 9);
  let signalIndex = 0;

  const macdLine: LineData[] = [];
  const signalLine: LineData[] = [];
  const histogram: HistogramData[] = [];

  for (let index = 0; index < candles.length; index += 1) {
    const macdValue = macdValues[index];
    if (macdValue === null) continue;
    const signalValue = signalSparse[signalIndex];
    signalIndex += 1;
    macdLine.push({
      time: candles[index].time as LineData['time'],
      value: Number(macdValue.toFixed(4)),
    });
    if (signalValue !== null) {
      const normalizedSignal = Number(signalValue.toFixed(4));
      signalLine.push({
        time: candles[index].time as LineData['time'],
        value: normalizedSignal,
      });
      const histogramValue = Number((macdValue - signalValue).toFixed(4));
      histogram.push({
        time: candles[index].time as HistogramData['time'],
        value: histogramValue,
        color: histogramValue >= 0 ? 'rgba(34, 197, 94, 0.55)' : 'rgba(239, 68, 68, 0.55)',
      });
    }
  }

  return { macdLine, signalLine, histogram };
};

export const buildRsi = (candles: PreparedCandle[], period = 14) => {
  if (candles.length <= period) return [];
  const gains: number[] = [];
  const losses: number[] = [];
  for (let index = 1; index < candles.length; index += 1) {
    const change = candles[index].close - candles[index - 1].close;
    gains.push(Math.max(change, 0));
    losses.push(Math.max(-change, 0));
  }

  let avgGain = gains.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  const output: LineData[] = [];

  const seedRs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  output.push({
    time: candles[period].time as LineData['time'],
    value: Number((100 - (100 / (1 + seedRs))).toFixed(2)),
  });

  for (let index = period; index < gains.length; index += 1) {
    avgGain = ((avgGain * (period - 1)) + gains[index]) / period;
    avgLoss = ((avgLoss * (period - 1)) + losses[index]) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    output.push({
      time: candles[index + 1].time as LineData['time'],
      value: Number((100 - (100 / (1 + rs))).toFixed(2)),
    });
  }

  return output;
};

export const buildPivotLevels = (candles: PreparedCandle[]): PivotLevel[] => {
  if (candles.length === 0) return [];
  const grouped = new Map<string, PreparedCandle[]>();
  candles.forEach((candle) => {
    const key = candle.labelTime.slice(0, 10);
    const group = grouped.get(key) ?? [];
    group.push(candle);
    grouped.set(key, group);
  });
  const sessions = [...grouped.keys()].sort();
  const referenceSession = sessions.length > 1 ? sessions[sessions.length - 2] : sessions[sessions.length - 1];
  const referenceCandles = grouped.get(referenceSession) ?? [];
  if (referenceCandles.length === 0) return [];

  const high = Math.max(...referenceCandles.map((candle) => candle.high));
  const low = Math.min(...referenceCandles.map((candle) => candle.low));
  const close = referenceCandles[referenceCandles.length - 1].close;
  const pivot = (high + low + close) / 3;
  const range = high - low;

  const p = Number(pivot.toFixed(2));
  const r1 = Number(((2 * pivot) - low).toFixed(2));
  const s1 = Number(((2 * pivot) - high).toFixed(2));
  const r2 = Number((pivot + range).toFixed(2));
  const s2 = Number((pivot - range).toFixed(2));
  const r3 = Number((high + (2 * (pivot - low))).toFixed(2));
  const s3 = Number((low - (2 * (high - pivot))).toFixed(2));

  return [
    { label: 'R3', value: r3, color: '#f97316' },
    { label: 'R2', value: r2, color: '#fb923c' },
    { label: 'R1', value: r1, color: '#f59e0b' },
    { label: 'P', value: p, color: '#38bdf8' },
    { label: 'S1', value: s1, color: '#22c55e' },
    { label: 'S2', value: s2, color: '#16a34a' },
    { label: 'S3', value: s3, color: '#15803d' },
  ];
};

export const priceScaleModeFrom = (preset: PriceScalePreset) => {
  if (preset === 'log') return PriceScaleMode.Logarithmic;
  if (preset === 'percent') return PriceScaleMode.Percentage;
  if (preset === 'indexed') return PriceScaleMode.IndexedTo100;
  return PriceScaleMode.Normal;
};

export const timeframeLabel = (option: TimeframeOption) => option.label || `${option.interval} ${option.unit}`;
