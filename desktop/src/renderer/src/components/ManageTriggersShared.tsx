import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';
import type {
  AdminTrigger,
  TriggerBrowserResponse,
  TriggerFacetOption,
  TriggerTimeframeFacetOption,
} from '../api/admin';

export type NotifyPayload = { msg: string; severity: 'success' | 'error' | 'info' } | null;

export type InstrumentOption = {
  key: string;
  label: string;
  exchange: string;
};

export type TimeframeOption = {
  unit: string;
  interval: number;
  label: string;
};

export type TriggerJob = 'CANDLE_SYNC' | 'TRADING_SIGNAL_REFRESH' | 'TRADING_DAY_PARAM_REFRESH' | 'MARKET_SENTIMENT_REFRESH' | 'GLOBAL_INDEX_REFRESH';
export type TriggerAction = 'start' | 'pause' | 'resume' | 'stop';
export type TriggerType = 'SPECIFIC_DATE_TIME' | 'MINUTES_TIMER' | 'HOUR_TIMER' | 'DAY_TIMER' | 'WEEK_TIMER' | 'MONTH_TIMER';
export type TriggerTab = 'CANDLE_SYNC' | 'OTHERS';

export const ALL_FILTER_VALUE = 'ALL';
export const DEFAULT_TRIGGER_TAB: TriggerTab = 'CANDLE_SYNC';
export const DEFAULT_FILTER_INSTRUMENT_KEY = 'NSE_INDEX|Nifty 50';
export const MARKET_SENTIMENT_INSTRUMENT_KEY = 'SYSTEM|MARKET_TREND';
export const MARKET_SENTIMENT_INSTRUMENT: InstrumentOption = {
  key: MARKET_SENTIMENT_INSTRUMENT_KEY,
  label: 'Market Trend System',
  exchange: 'SYSTEM',
};
export const GLOBAL_INDEX_INSTRUMENT_KEY = 'SYSTEM|GLOBAL_INDEX';
export const GLOBAL_INDEX_INSTRUMENT: InstrumentOption = {
  key: GLOBAL_INDEX_INSTRUMENT_KEY,
  label: 'Global Index System',
  exchange: 'SYSTEM',
};
export const DEFAULT_JOB_NATURE_BY_TAB: Record<TriggerTab, string> = {
  CANDLE_SYNC: 'CANDLE_INTRADAY',
  OTHERS: ALL_FILTER_VALUE,
};
export const EMPTY_TRIGGER_BROWSER: TriggerBrowserResponse = {
  items: [],
  totalElements: 0,
  page: 0,
  size: 25,
  tabs: [],
  instruments: [],
  timeframes: [],
  jobNatures: [],
  summary: {
    totalInTab: 0,
    filteredTotal: 0,
    runningCount: 0,
    pausedCount: 0,
    failedCount: 0,
    oneTimeCount: 0,
    attentionCount: 0,
  },
};

export const JOB_OPTIONS: {
  value: TriggerJob;
  label: string;
  description: string;
  requiresTimeframe: boolean;
  preview: string;
}[] = [
  {
    value: 'CANDLE_SYNC',
    label: 'Candle sync',
    description: 'Keeps the candle stream refreshed for one instrument and timeframe.',
    requiresTimeframe: true,
    preview: 'Uses the selected instrument and timeframe to pull the next candle sync chunk.',
  },
  {
    value: 'TRADING_SIGNAL_REFRESH',
    label: 'Trading signal',
    description: 'Updates daily EMA 9/26/110 signal rows for one instrument and timeframe.',
    requiresTimeframe: true,
    preview: 'Uses the selected timeframe candles to compute previous close, current close, EMA values, and BUY/SELL/HOLD.',
  },
  {
    value: 'TRADING_DAY_PARAM_REFRESH',
    label: 'Trading day params',
    description: 'Updates daily ORB high/low and breakout or breakdown flags for one instrument.',
    requiresTimeframe: false,
    preview: 'Uses the 9:15-9:30 AM IST 15 Min candle plus the latest intraday minute close automatically.',
  },
  {
    value: 'MARKET_SENTIMENT_REFRESH',
    label: 'Market trend',
    description: 'Refreshes global and India news-based market trend snapshots.',
    requiresTimeframe: false,
    preview: 'Runs the news sentiment pipeline and updates global and India market trend values.',
  },
  {
    value: 'GLOBAL_INDEX_REFRESH',
    label: 'Global index sync',
    description: 'Refreshes Gift Nifty and S&P 500 technical trend snapshots using EMA analysis.',
    requiresTimeframe: false,
    preview: 'Fetches Gift Nifty and S&P 500 price data and computes EMA 9/21/110 trend signals.',
  },
];

export const TRIGGER_TYPE_OPTIONS: { value: TriggerType; label: string }[] = [
  { value: 'SPECIFIC_DATE_TIME', label: 'Specific date and time' },
  { value: 'MINUTES_TIMER', label: 'Minutes timer' },
  { value: 'HOUR_TIMER', label: 'Hour timer' },
  { value: 'DAY_TIMER', label: 'Day timer' },
  { value: 'WEEK_TIMER', label: 'Week timer' },
  { value: 'MONTH_TIMER', label: 'Month timer' },
];

export const INTERVAL_OPTIONS: Record<Exclude<TriggerType, 'SPECIFIC_DATE_TIME'>, { value: number; label: string }[]> = {
  MINUTES_TIMER: [
    { value: 1, label: 'Every minute' },
    { value: 2, label: 'Every 2 minutes' },
    { value: 3, label: 'Every 3 minutes' },
    { value: 4, label: 'Every 4 minutes' },
    { value: 5, label: 'Every 5 minutes' },
    { value: 6, label: 'Every 6 minutes' },
    { value: 7, label: 'Every 7 minutes' },
    { value: 10, label: 'Every 10 minutes' },
    { value: 15, label: 'Every 15 minutes' },
    { value: 30, label: 'Every 30 minutes' },
  ],
  HOUR_TIMER: [
    { value: 1, label: 'Every hour' },
    { value: 2, label: 'Every 2 hours' },
    { value: 4, label: 'Every 4 hours' },
    { value: 6, label: 'Every 6 hours' },
    { value: 8, label: 'Every 8 hours' },
    { value: 12, label: 'Every 12 hours' },
  ],
  DAY_TIMER: [
    { value: 1, label: 'Every day' },
    { value: 2, label: 'Every 2 days' },
    { value: 5, label: 'Every 5 days' },
    { value: 7, label: 'Every 7 days' },
  ],
  WEEK_TIMER: [
    { value: 1, label: 'Every week' },
    { value: 2, label: 'Every 2 weeks' },
    { value: 4, label: 'Every 4 weeks' },
  ],
  MONTH_TIMER: [
    { value: 1, label: 'Every month' },
    { value: 3, label: 'Every 3 months' },
    { value: 6, label: 'Every 6 months' },
    { value: 12, label: 'Every 12 months' },
  ],
};

export const DEFAULT_TAB_OPTIONS: TriggerFacetOption[] = [
  { value: 'CANDLE_SYNC', label: 'Candle sync Jobs', count: 0 },
  { value: 'OTHERS', label: 'Others', count: 0 },
];

export const formatTriggerDateTime = (value?: string | null) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium' });
};

export const createDefaultDateTimeInput = () => {
  const base = new Date();
  const local = new Date(base.getTime() - base.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

export const toDateTimeInputValue = (value?: string) => {
  if (!value) return createDefaultDateTimeInput();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return createDefaultDateTimeInput();
  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

export const isSessionExpiredError = (message: string) => {
  const normalized = message.toLowerCase();
  return normalized.includes('session expired') || normalized.includes('session invalid') || normalized.includes('missing admin authorization token');
};

export const getStatusTone = (status: string) => {
  const normalized = status.toLowerCase();
  if (normalized.includes('success')) return 'success';
  if (normalized.includes('running')) return 'info';
  if (normalized.includes('fail') || normalized.includes('error')) return 'error';
  if (normalized.includes('pause') || normalized.includes('stop')) return 'warning';
  return 'default';
};

export const getRunStatusIcon = (status: string) => {
  const normalized = status.toLowerCase();
  if (normalized.includes('success')) return <CheckCircleRoundedIcon fontSize="small" color="success" />;
  if (normalized.includes('running')) return <AutorenewRoundedIcon fontSize="small" color="info" />;
  if (normalized.includes('fail')) return <ErrorRoundedIcon fontSize="small" color="error" />;
  if (normalized.includes('pause') || normalized.includes('stop')) return <WarningRoundedIcon fontSize="small" color="warning" />;
  return <AccessTimeRoundedIcon fontSize="small" color="disabled" />;
};

export const formatTriggerSchedule = (trigger: Pick<AdminTrigger, 'triggerType' | 'intervalValue' | 'scheduledAt'>) => {
  if (trigger.triggerType === 'SPECIFIC_DATE_TIME') {
    return trigger.scheduledAt ? `Specific date/time · ${formatTriggerDateTime(trigger.scheduledAt)}` : 'Specific date/time';
  }
  const options = INTERVAL_OPTIONS[trigger.triggerType as Exclude<TriggerType, 'SPECIFIC_DATE_TIME'>];
  return options?.find((option) => option.value === trigger.intervalValue)?.label ?? `${trigger.intervalValue ?? 0} cadence`;
};

export const getLifecycleActions = (status: string) => {
  const normalized = status.trim().toUpperCase();
  return {
    canStart: normalized === 'STOPPED',
    canPause: normalized === 'RUNNING',
    canResume: normalized === 'PAUSED',
    canStop: normalized === 'RUNNING' || normalized === 'PAUSED',
    canEdit: normalized !== 'RUNNING',
    canDelete: normalized !== 'RUNNING',
  };
};

export const getJobOption = (jobKey?: string) =>
  JOB_OPTIONS.find((option) => option.value === jobKey) ?? JOB_OPTIONS[0];

export const getInstrumentLabel = (baseInstruments: InstrumentOption[], instrumentKey: string) =>
  baseInstruments.find((instrument) => instrument.key === instrumentKey)?.label ?? instrumentKey;

export const getTabLabel = (tab: TriggerFacetOption | undefined, tabValue: TriggerTab) =>
  tab?.label ?? (tabValue === 'CANDLE_SYNC' ? 'Candle sync Jobs' : 'Others');

export const findTimeframeLabel = (
  baseTimeframes: TimeframeOption[],
  timeframeUnit?: string,
  timeframeInterval?: number,
  fallbackLabel?: string
) => {
  if (!timeframeUnit || timeframeInterval == null) return fallbackLabel ?? 'No timeframe';
  return baseTimeframes.find((timeframe) => timeframe.unit === timeframeUnit && timeframe.interval === timeframeInterval)?.label
    ?? fallbackLabel
    ?? `${timeframeInterval} ${timeframeUnit}`;
};

export const getDefaultFilterState = (tab: TriggerTab) => ({
  instrumentKey: DEFAULT_FILTER_INSTRUMENT_KEY,
  timeframeKey: ALL_FILTER_VALUE,
  jobNatureKey: DEFAULT_JOB_NATURE_BY_TAB[tab],
});
