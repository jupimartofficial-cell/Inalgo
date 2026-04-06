import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  Switch,
  TableCell,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import { useState, type ChangeEvent, type ReactNode } from 'react';
import type {
  BacktestAdvancedConditionsPayload,
  BacktestLegPayload,
  BacktestResultRow,
  BacktestStrategyPayload,
} from '../api/admin';
import type { TimeframeOption } from './backtestAdvancedConditionUtils';

export type SnackSeverity = 'success' | 'error' | 'info';

export interface InstrumentOption {
  key: string;
  label: string;
}

export interface BacktestPanelProps {
  token: string;
  tenantId: string;
  username: string;
  baseInstruments: InstrumentOption[];
  baseTimeframes: TimeframeOption[];
  activeView: 'pnl' | 'strategy-list' | 'trading-param' | 'trading-signal' | 'market-trend';
  onNavigateToPnl: () => void;
  onNotify: (payload: { msg: string; severity: SnackSeverity }) => void;
}

export type SupportedStrategyType = 'INTRADAY' | 'POSITIONAL';

export interface TradingSignalFilters {
  instrumentKey: string;
  timeframeKey: string;
  signal: string;
  fromDate: string;
  toDate: string;
}

export interface TradingDayParamFilters {
  instrumentKey: string;
  fromDate: string;
  toDate: string;
}

export interface MarketSentimentFilters {
  marketScope: string;
  trendStatus: string;
  fromDate: string;
  toDate: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const padTwoDigits = (value: number) => value.toString().padStart(2, '0');
const toInputDate = (date: Date) =>
  `${date.getFullYear()}-${padTwoDigits(date.getMonth() + 1)}-${padTwoDigits(date.getDate())}`;
const currentTimeInput = () => {
  const now = new Date();
  return `${padTwoDigits(now.getHours())}:${padTwoDigits(now.getMinutes())}`;
};
export const todayInputDate = () => toInputDate(new Date());
const startOfCurrentMonth = () => {
  const now = new Date();
  return toInputDate(new Date(now.getFullYear(), now.getMonth(), 1));
};

export const normalizeStrategyType = (strategyType: BacktestStrategyPayload['strategyType']): SupportedStrategyType =>
  strategyType === 'INTRADAY' ? 'INTRADAY' : 'POSITIONAL';

export const normalizeOverallSettings = (
  overallSettings: BacktestStrategyPayload['overallSettings']
): BacktestStrategyPayload['overallSettings'] => ({
  stopLossEnabled: Boolean(overallSettings?.stopLossEnabled),
  stopLossMode: overallSettings?.stopLossMode ?? 'MAX_LOSS',
  stopLossValue: overallSettings?.stopLossValue ?? 0,
  targetEnabled: Boolean(overallSettings?.targetEnabled),
  targetMode: overallSettings?.targetMode ?? 'MAX_PROFIT',
  targetValue: overallSettings?.targetValue ?? 0,
  trailingEnabled: Boolean(overallSettings?.trailingEnabled),
  trailingMode: overallSettings?.trailingMode ?? 'TRAILING_SL',
  trailingTrigger: overallSettings?.trailingTrigger ?? 0,
  trailingLockProfit: overallSettings?.trailingLockProfit ?? 0,
});

export const normalizeAdvancedConditions = (
  advancedConditions?: BacktestAdvancedConditionsPayload
): BacktestAdvancedConditionsPayload => ({
  enabled: Boolean(advancedConditions?.enabled),
  entry: advancedConditions?.entry ?? null,
  exit: advancedConditions?.exit ?? null,
});

export const normalizeStrategyForMvp = (payload: BacktestStrategyPayload): BacktestStrategyPayload => ({
  ...payload,
  underlyingSource: 'FUTURES',
  strategyType: normalizeStrategyType(payload.strategyType),
  overallSettings: normalizeOverallSettings(payload.overallSettings),
  advancedConditions: normalizeAdvancedConditions(payload.advancedConditions),
});

export const formatTradeTime = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
};

export const formatDateTime = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
};

export const formatPnlNumber = (value?: number) => {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
};

export const formatNumber = (value?: number) => {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
};

export const getPnlColor = (value: number) => (value > 0 ? '#2e7d32' : value < 0 ? '#c62828' : '#555');
const getPnlBg = (value: number) => (value > 0 ? '#f1f8e9' : value < 0 ? '#fff5f5' : 'transparent');

export const numberFromInput = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const formatInstrumentLabel = (key: string, instruments: InstrumentOption[]) =>
  instruments.find((i) => i.key === key)?.label ?? key.split('|').pop() ?? key;

export const oneWeekAgo = () => toInputDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
export const oneMonthAgo = () => toInputDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
export const threeMonthsAgo = () => toInputDate(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000));

export const createDefaultSignalFilters = (): TradingSignalFilters => ({
  instrumentKey: '', timeframeKey: '', signal: '', fromDate: oneWeekAgo(), toDate: todayInputDate(),
});
export const createDefaultDayParamFilters = (): TradingDayParamFilters => ({
  instrumentKey: '', fromDate: oneWeekAgo(), toDate: todayInputDate(),
});
export const createDefaultMarketSentimentFilters = (): MarketSentimentFilters => ({
  marketScope: '', trendStatus: '', fromDate: oneWeekAgo(), toDate: todayInputDate(),
});
export const TRADING_SIGNAL_TIMEFRAME_OPTIONS: Array<{ key: string; label: string }> = [
  { key: '', label: 'All timeframes' },
  { key: 'minutes|1', label: '1 minute' },
  { key: 'minutes|5', label: '5 minutes' },
  { key: 'minutes|15', label: '15 minutes' },
  { key: 'minutes|30', label: '30 minutes' },
  { key: 'minutes|60', label: '60 minutes' },
  { key: 'days|1', label: '1 day' },
  { key: 'weeks|1', label: '1 week' },
  { key: 'months|1', label: '1 month' },
];
export const TRADING_SIGNAL_DIRECTION_OPTIONS = [
  { key: '', label: 'All signals' },
  { key: 'BUY', label: 'BUY' },
  { key: 'SELL', label: 'SELL' },
  { key: 'HOLD', label: 'HOLD' },
];
export const MARKET_SENTIMENT_SCOPE_OPTIONS = [
  { key: '', label: 'All markets' },
  { key: 'GLOBAL_NEWS', label: 'Global Market Trend' },
  { key: 'INDIA_NEWS', label: 'Indian Market Trend' },
  { key: 'GIFT_NIFTY', label: 'Gift Nifty' },
  { key: 'SP500', label: 'S&P 500' },
];
export const MARKET_SENTIMENT_STATUS_OPTIONS = [
  { key: '', label: 'All trends' },
  { key: 'BULL', label: 'BULL' },
  { key: 'BEAR', label: 'BEAR' },
  { key: 'NEUTRAL', label: 'NEUTRAL' },
  { key: 'HOLD', label: 'HOLD' },
];

export const parseTimeframeKey = (timeframeKey: string) => {
  if (!timeframeKey) return {};
  const [timeframeUnit, timeframeIntervalRaw] = timeframeKey.split('|');
  const timeframeInterval = Number(timeframeIntervalRaw);
  if (!timeframeUnit || !Number.isFinite(timeframeInterval) || timeframeInterval < 1) return {};
  return { timeframeUnit, timeframeInterval };
};

export const createDefaultLeg = (index: number): BacktestLegPayload => ({
  id: `leg-${index}`,
  segment: 'OPTIONS',
  lots: 1,
  position: 'BUY',
  optionType: 'CALL',
  expiryType: 'WEEKLY',
  strikeType: 'ATM',
  strikeSteps: 0,
  legConditions: { enabled: false, entry: null, exit: null },
});

export const createDefaultStrategy = (instrumentKey: string): BacktestStrategyPayload => ({
  strategyName: '',
  underlyingKey: instrumentKey,
  underlyingSource: 'FUTURES',
  strategyType: 'INTRADAY',
  entryTime: '09:35',
  exitTime: '15:15',
  startDate: startOfCurrentMonth(),
  endDate: todayInputDate(),
  legs: [createDefaultLeg(1)],
  legwiseSettings: {
    squareOffMode: 'PARTIAL',
    trailSlToBreakEven: false,
    trailScope: 'ALL_LEGS',
    noReEntryAfterEnabled: false,
    noReEntryAfterTime: currentTimeInput(),
    overallMomentumEnabled: false,
    overallMomentumMode: 'POINTS',
    overallMomentumValue: 0,
  },
  overallSettings: {
    stopLossEnabled: false,
    stopLossMode: 'MAX_LOSS',
    stopLossValue: 0,
    targetEnabled: false,
    targetMode: 'MAX_PROFIT',
    targetValue: 0,
    trailingEnabled: false,
    trailingMode: 'TRAILING_SL',
    trailingTrigger: 0,
    trailingLockProfit: 0,
  },
  advancedConditions: { enabled: false, entry: null, exit: null },
});

// ─── Sub-components ────────────────────────────────────────────────────────────

export const MetricCard = ({
  label,
  value,
  valueColor,
  sub,
  icon,
}: {
  label: string;
  value: string;
  valueColor?: string;
  sub?: string;
  icon?: ReactNode;
}) => (
  <Paper
    variant="outlined"
    sx={{
      px: 2,
      py: 1.5,
      flex: '1 1 130px',
      minWidth: 110,
      borderRadius: 2,
      bgcolor: '#fafcff',
    }}
  >
    <Stack spacing={0.25}>
      <Stack direction="row" spacing={0.5} alignItems="center">
        {icon}
        <Typography variant="caption" color="text.secondary" fontWeight={500} sx={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {label}
        </Typography>
      </Stack>
      <Typography variant="h6" fontWeight={800} sx={{ color: valueColor ?? 'text.primary', lineHeight: 1.2, fontSize: '1.1rem' }}>
        {value}
      </Typography>
      {sub && (
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
          {sub}
        </Typography>
      )}
    </Stack>
  </Paper>
);

export const RiskControlRow = ({
  label,
  enabled,
  value,
  onToggle,
  onValueChange,
  hint,
}: {
  label: string;
  enabled: boolean;
  value: number;
  onToggle: (v: boolean) => void;
  onValueChange: (v: number) => void;
  hint?: string;
}) => {
  const normalizedLabel = label === 'Trailing SL' ? 'Trailing Stop Loss' : label;
  const valueFieldLabel =
    label === 'Stop Loss'
      ? 'SL Value'
      : label === 'Trailing SL'
        ? 'Trailing SL Value'
        : 'Target Value';

  return (
  <Stack
    direction="row"
    alignItems="center"
    spacing={1.5}
    sx={{
      px: 1.5,
      py: 0.75,
      border: '1px solid',
      borderColor: enabled ? 'primary.light' : 'divider',
      borderRadius: 1.5,
      bgcolor: enabled ? '#f0f7ff' : '#fafafa',
      transition: 'all 0.2s',
    }}
  >
    <Switch
      size="small"
      checked={enabled}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onToggle(e.target.checked)}
      inputProps={{ 'aria-label': `Enable ${normalizedLabel}` }}
      color={label.includes('Stop') ? 'error' : label.includes('Target') ? 'success' : 'warning'}
    />
    <Typography
      variant="body2"
      fontWeight={600}
      sx={{ minWidth: 90, color: enabled ? 'text.primary' : 'text.disabled' }}
    >
      {label}
    </Typography>
    <TextField
      label={valueFieldLabel}
      size="small"
      type="number"
      value={value}
      disabled={!enabled}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onValueChange(numberFromInput(e.target.value))}
      inputProps={{ 'aria-label': valueFieldLabel }}
      InputLabelProps={{ shrink: true }}
      InputProps={{
        endAdornment: <InputAdornment position="end"><Typography variant="caption" color="text.secondary">pts</Typography></InputAdornment>,
        inputProps: { min: 0, step: 0.5, style: { width: 70 } },
      }}
      sx={{ maxWidth: 130 }}
      helperText={hint}
    />
  </Stack>
  );
};

// P&L result row with expandable leg details
export const ResultRow = ({
  row,
  index,
}: {
  row: BacktestResultRow;
  index: number;
}) => {
  const [expanded, setExpanded] = useState(false);
  const hasLegs = row.legs && row.legs.length > 0;

  return (
    <>
      <TableRow
        hover
        sx={{
          bgcolor: getPnlBg(row.pnlAmount),
          cursor: hasLegs ? 'pointer' : 'default',
          '& td': { py: 0.75 },
        }}
        onClick={() => hasLegs && setExpanded((v) => !v)}
      >
        <TableCell sx={{ fontWeight: 600, color: '#444', fontSize: '0.78rem' }}>{row.tradeDate}</TableCell>
        <TableCell sx={{ fontSize: '0.75rem', color: '#666' }}>{row.expiryLabel}</TableCell>
        <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.75rem' }}>{formatTradeTime(row.entryTs)}</TableCell>
        <TableCell sx={{ fontWeight: 500, fontSize: '0.78rem' }}>{formatPnlNumber(row.entryUnderlyingPrice)}</TableCell>
        <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.75rem' }}>{formatTradeTime(row.exitTs)}</TableCell>
        <TableCell sx={{ fontWeight: 500, fontSize: '0.78rem' }}>{formatPnlNumber(row.exitUnderlyingPrice)}</TableCell>
        <TableCell align="right">
          <Stack direction="row" alignItems="center" justifyContent="flex-end" spacing={0.5}>
            {row.pnlAmount > 0 ? (
              <TrendingUpRoundedIcon sx={{ fontSize: 14, color: '#2e7d32' }} />
            ) : row.pnlAmount < 0 ? (
              <TrendingDownRoundedIcon sx={{ fontSize: 14, color: '#c62828' }} />
            ) : null}
            <Typography
              variant="body2"
              fontWeight={800}
              sx={{ color: getPnlColor(row.pnlAmount), fontSize: '0.82rem' }}
            >
              {row.pnlAmount >= 0 ? '+' : ''}{formatPnlNumber(row.pnlAmount)}
            </Typography>
          </Stack>
        </TableCell>
        <TableCell sx={{ fontSize: '0.72rem', color: '#666', maxWidth: 200 }}>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="caption" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
              {row.legsSummary}
            </Typography>
            {hasLegs && (
              <IconButton size="small" sx={{ p: 0 }}>
                {expanded ? <ExpandLessRoundedIcon sx={{ fontSize: 14 }} /> : <ExpandMoreRoundedIcon sx={{ fontSize: 14 }} />}
              </IconButton>
            )}
          </Stack>
        </TableCell>
      </TableRow>

      {hasLegs && (
        <TableRow sx={{ bgcolor: '#f8f9fb' }}>
          <TableCell colSpan={8} sx={{ py: 0, px: 2 }}>
            <Collapse in={expanded} timeout="auto" unmountOnExit>
              <Box sx={{ py: 1.5 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ mb: 0.75, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Leg Details — {row.tradeDate}
                </Typography>
                <Grid container spacing={1}>
                  {row.legs.map((leg) => (
                    <Grid item key={leg.legId} xs={12} sm={6} md={4} lg={3}>
                      <Paper
                        variant="outlined"
                        sx={{
                          px: 1.5,
                          py: 1,
                          bgcolor: leg.pnlAmount >= 0 ? '#f6fff6' : '#fff5f5',
                          borderColor: leg.pnlAmount >= 0 ? '#c8e6c9' : '#ffcdd2',
                          borderRadius: 1.5,
                        }}
                      >
                        <Stack spacing={0.25}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="caption" fontWeight={700} color="text.secondary">
                              {leg.legLabel}
                            </Typography>
                            <Typography
                              variant="caption"
                              fontWeight={800}
                              sx={{ color: getPnlColor(leg.pnlAmount) }}
                            >
                              {leg.pnlAmount >= 0 ? '+' : ''}{formatPnlNumber(leg.pnlAmount)}
                            </Typography>
                          </Stack>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                            {leg.instrumentKey?.split('|').pop() ?? leg.instrumentKey}
                            {leg.strikePrice ? ` @ ${leg.strikePrice}` : ''}
                            {leg.expiryDate ? ` (Exp: ${leg.expiryDate})` : ''}
                          </Typography>
                          <Stack direction="row" spacing={1}>
                            <Typography variant="caption" sx={{ fontSize: '0.68rem' }}>
                              Entry: <strong>{formatPnlNumber(leg.entryPrice)}</strong>
                            </Typography>
                            <Typography variant="caption" sx={{ fontSize: '0.68rem' }}>
                              Exit: <strong>{formatPnlNumber(leg.exitPrice)}</strong>
                            </Typography>
                            <Typography variant="caption" sx={{ fontSize: '0.68rem' }}>
                              Lots: <strong>{leg.lots}</strong>
                            </Typography>
                          </Stack>
                        </Stack>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────────
