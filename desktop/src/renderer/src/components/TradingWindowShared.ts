import type { TradingPreferencesPayload } from '../api/admin';

export type SnackSeverity = 'success' | 'error' | 'info';

export interface InstrumentOption {
  key: string;
  label: string;
  exchange?: string;
}

export interface TimeframeOption {
  unit: string;
  interval: number;
  label: string;
}

export interface TradingWindowProps {
  token: string;
  tenantId: string;
  username: string;
  baseInstruments: InstrumentOption[];
  baseTimeframes: TimeframeOption[];
  onNotify: (payload: { msg: string; severity: SnackSeverity }) => void;
}

export type ChartLayout = 'split' | 'wide' | 'full';

export interface TradingChartConfig {
  id: string;
  instrumentKey: string;
  timeframeUnit: string;
  timeframeInterval: number;
  lookbackDays: number;
  height: number;
  layout: ChartLayout;
}

export interface TradingTabConfig {
  id: string;
  name: string;
  charts: TradingChartConfig[];
}

export const MAX_TABS = 5;
export const MIN_CHARTS = 2;
export const MAX_CHARTS = 10;
export const DEFAULT_LOOKBACK_DAYS = 30;
export const CUSTOM_INSTRUMENT = '__CUSTOM__';
export const MAX_CHART_FETCH_SIZE = 500;

export const createLocalId = () => Math.random().toString(36).slice(2, 10);

export const normalizeUnit = (unit: string) => unit.trim().toLowerCase();

export const formatTimeframeLabel = (unit: string, interval: number, options: TimeframeOption[]) => {
  const found = options.find((option) => normalizeUnit(option.unit) === normalizeUnit(unit) && option.interval === interval);
  return found?.label ?? `${interval} ${unit}`;
};

export const createDefaultChart = (
  instrumentKey: string,
  timeframeUnit: string,
  timeframeInterval: number,
  layout: ChartLayout = 'split',
): TradingChartConfig => ({
  id: createLocalId(),
  instrumentKey,
  timeframeUnit,
  timeframeInterval,
  lookbackDays: DEFAULT_LOOKBACK_DAYS,
  height: 330,
  layout,
});

export const createDefaultTab = (
  index: number,
  instruments: InstrumentOption[],
  timeframes: TimeframeOption[],
): TradingTabConfig => {
  const defaultInstrument = instruments[0]?.key ?? 'NSE_INDEX|Nifty 50';
  const nextInstrument = instruments[1]?.key ?? defaultInstrument;
  const defaultTimeframe = timeframes[0] ?? { unit: 'minutes', interval: 1, label: '1 Min' };
  const nextTimeframe = timeframes[1] ?? defaultTimeframe;
  return {
    id: createLocalId(),
    name: `Desk ${index}`,
    charts: [
      createDefaultChart(defaultInstrument, defaultTimeframe.unit, defaultTimeframe.interval, 'split'),
      createDefaultChart(nextInstrument, nextTimeframe.unit, nextTimeframe.interval, 'split'),
    ],
  };
};

export const mergeInstrumentOptions = (...groups: InstrumentOption[][]): InstrumentOption[] => {
  const optionMap = new Map<string, InstrumentOption>();
  groups.flat().forEach((option) => {
    if (!option.key.trim()) return;
    if (optionMap.has(option.key)) return;
    optionMap.set(option.key, option);
  });
  return [...optionMap.values()].sort((a, b) => a.label.localeCompare(b.label));
};

export const mergeTimeframeOptions = (...groups: TimeframeOption[][]): TimeframeOption[] => {
  const optionMap = new Map<string, TimeframeOption>();
  groups.flat().forEach((option) => {
    if (!option.unit.trim() || option.interval < 1) return;
    const key = `${normalizeUnit(option.unit)}|${option.interval}`;
    if (optionMap.has(key)) return;
    optionMap.set(key, option);
  });
  return [...optionMap.values()].sort((a, b) => {
    if (a.interval !== b.interval) return a.interval - b.interval;
    return a.unit.localeCompare(b.unit);
  });
};

export const clampNumber = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const buildPreferencesPayload = (tabs: TradingTabConfig[], activeTabIndex: number): TradingPreferencesPayload => ({
  activeTabIndex: clampNumber(activeTabIndex, 0, Math.max(0, tabs.length - 1)),
  tabs: tabs.map((tab, tabIndex) => ({
    name: tab.name.trim() || `Desk ${tabIndex + 1}`,
    charts: tab.charts.map((chart, chartIndex) => ({
      id: chart.id || `${tab.id}-${chartIndex + 1}`,
      instrumentKey: chart.instrumentKey.trim(),
      timeframeUnit: normalizeUnit(chart.timeframeUnit),
      timeframeInterval: clampNumber(chart.timeframeInterval, 1, 1440),
      lookbackDays: clampNumber(chart.lookbackDays, 1, 3650),
      height: clampNumber(chart.height, 200, 1000),
      layout: chart.layout,
    })),
  })),
});

export const hydratePreferencesState = (
  payload: TradingPreferencesPayload,
): { tabs: TradingTabConfig[]; activeTabIndex: number } => {
  const tabs = payload.tabs.slice(0, MAX_TABS).map((tab, tabIndex) => ({
    id: createLocalId(),
    name: tab.name.trim() || `Desk ${tabIndex + 1}`,
    charts: tab.charts.slice(0, MAX_CHARTS).map((chart) => ({
      id: chart.id || createLocalId(),
      instrumentKey: chart.instrumentKey,
      timeframeUnit: normalizeUnit(chart.timeframeUnit),
      timeframeInterval: clampNumber(chart.timeframeInterval, 1, 1440),
      lookbackDays: clampNumber(chart.lookbackDays, 1, 3650),
      height: clampNumber(chart.height, 260, 1000),
      layout: chart.layout,
    })),
  }));

  const normalizedTabs = tabs
    .filter((tab) => tab.charts.length >= MIN_CHARTS)
    .map((tab) => ({ ...tab, charts: tab.charts.slice(0, MAX_CHARTS) }));

  return {
    tabs: normalizedTabs,
    activeTabIndex: clampNumber(payload.activeTabIndex, 0, Math.max(0, normalizedTabs.length - 1)),
  };
};

