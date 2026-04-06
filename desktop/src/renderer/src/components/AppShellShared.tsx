import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  LinearProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  TableCell,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';

import AccountCircleRoundedIcon from '@mui/icons-material/AccountCircleRounded';
import AlarmRoundedIcon from '@mui/icons-material/AlarmRounded';
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ClearRoundedIcon from '@mui/icons-material/ClearRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import InfoRoundedIcon from '@mui/icons-material/InfoRounded';
import PauseCircleRoundedIcon from '@mui/icons-material/PauseCircleRounded';
import PlayCircleRoundedIcon from '@mui/icons-material/PlayCircleRounded';
import QueryStatsRoundedIcon from '@mui/icons-material/QueryStatsRounded';
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded';
import ShowChartRoundedIcon from '@mui/icons-material/ShowChartRounded';
import StopCircleRoundedIcon from '@mui/icons-material/StopCircleRounded';
import CandlestickChartRoundedIcon from '@mui/icons-material/CandlestickChartRounded';
import BarChartRoundedIcon from '@mui/icons-material/BarChartRounded';
import TimelineRoundedIcon from '@mui/icons-material/TimelineRounded';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';
import StorageRoundedIcon from '@mui/icons-material/StorageRounded';

import type { ReactNode } from 'react';
import type { Candle, MigrationJob } from '../api/admin';

// ─── Constants ────────────────────────────────────────────────────────────────

export const SIDEBAR_WIDTH = 220;
export const SIDEBAR_COLLAPSED_WIDTH = 84;
export const SESSION_STORAGE_KEY = 'inalgo_admin_session_v1';

export const INSTRUMENTS = [
  { key: 'NSE_INDEX|Nifty 50', label: 'Nifty 50', exchange: 'NSE' },
  { key: 'NSE_INDEX|Nifty Bank', label: 'Nifty Bank', exchange: 'NSE' },
  { key: 'BSE_INDEX|SENSEX', label: 'SENSEX', exchange: 'BSE' },
  { key: 'NSE_FO|51714', label: 'NIFTY FUT 30 MAR 26', exchange: 'NSE' },
  { key: 'NSE_FO|51701', label: 'BANKNIFTY FUT 30 MAR 26', exchange: 'NSE' },
  { key: 'BSE_FO|825565', label: 'SENSEX FUT 25 MAR 26', exchange: 'BSE' },
];

export const TIMEFRAME_OPTIONS = [
  { unit: 'minutes', interval: 1,  label: '1 Min' },
  { unit: 'minutes', interval: 5,  label: '5 Min' },
  { unit: 'minutes', interval: 15, label: '15 Min' },
  { unit: 'minutes', interval: 30, label: '30 Min' },
  { unit: 'minutes', interval: 60, label: '60 Min' },
  { unit: 'days',    interval: 1,  label: '1 Day' },
  { unit: 'weeks',   interval: 1,  label: '1 Week' },
  { unit: 'months',  interval: 1,  label: '1 Month' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

export type CandleSortKey = keyof Pick<Candle, 'candleTs' | 'openPrice' | 'highPrice' | 'lowPrice' | 'closePrice' | 'volume'>;
export type SortDir = 'asc' | 'desc';

export type NavSection = 'dashboard' | 'migration' | 'triggers' | 'history' | 'optionchain' | 'trading' | 'trading-scripts' | 'intra' | 'backtest' | 'market-signals' | 'trading-desk';
export type TradingDeskSubSection = 'advanced-trading';
export type IntraSubSection = 'intra-strategies' | 'intra-monitor' | 'intra-pnl';
export type BacktestSubSection = 'pnl' | 'strategy-list';
export type MarketSignalsSubSection = 'trading-param' | 'trading-signal' | 'market-trend' | 'market-watch';

export interface PersistedSession {
  tenantId: string;
  username: string;
  token: string;
  section: NavSection;
  intraSubSection?: IntraSubSection;
  backtestSubSection: BacktestSubSection;
  marketSignalsSubSection?: MarketSignalsSubSection;
  tradingDeskSubSection?: TradingDeskSubSection;
  sidebarCollapsed?: boolean;
  pinnedNavItemKeys?: string[];
  expandedNavGroup?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const formatDateTime = (value: string) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium' });
};

export const formatDate = (value: string) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-IN', { dateStyle: 'medium' });
};

const padTwoDigits = (value: number) => value.toString().padStart(2, '0');

const toDateTimeLocalValue = (date: Date, hours: number, minutes: number) => {
  const normalized = new Date(date);
  normalized.setHours(hours, minutes, 0, 0);
  return `${normalized.getFullYear()}-${padTwoDigits(normalized.getMonth() + 1)}-${padTwoDigits(normalized.getDate())}T${padTwoDigits(hours)}:${padTwoDigits(minutes)}`;
};

export const getDefaultHistoryRange = () => {
  const today = new Date();
  return {
    from: toDateTimeLocalValue(today, 0, 0),
    to: toDateTimeLocalValue(today, 15, 15),
  };
};

export const toIsoOrUndefined = (value: string) => {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
};

export const isSessionExpiredError = (message: string) => {
  const normalized = message.toLowerCase();
  return normalized.includes('session expired') || normalized.includes('session invalid') || normalized.includes('missing admin authorization token');
};

export type StatusColor = 'success' | 'info' | 'error' | 'warning' | 'default';
export const DEFAULT_MIGRATION_JOB_TYPE = 'CANDLE_SYNC';

export const statusTone = (status: string): StatusColor => {
  const s = status.toLowerCase();
  if (s.includes('success') || s.includes('complete') || s.includes('completed')) return 'success';
  if (s.includes('running') || s.includes('progress') || s.includes('resumed')) return 'info';
  if (s.includes('fail') || s.includes('error')) return 'error';
  if (s.includes('pause') || s.includes('stop') || s.includes('stopped')) return 'warning';
  if (s.includes('pending')) return 'default';
  return 'default';
};

export type JobAction = 'start' | 'pause' | 'resume' | 'stop';

const normalizeJobType = (jobType: string | undefined) =>
  jobType?.trim().toUpperCase() || DEFAULT_MIGRATION_JOB_TYPE;

export const buildJobKey = (instrumentKey: string, timeframeUnit: string, timeframeInterval: number, jobType?: string) =>
  `${instrumentKey}|${timeframeUnit}|${timeframeInterval}|${normalizeJobType(jobType)}`;

export const migrationJobTypeLabel = (jobType: string | undefined) => {
  const normalized = normalizeJobType(jobType);
  if (normalized === 'TRADING_ANALYTICS_BACKFILL') return 'Analytics Backfill';
  if (normalized === 'CANDLE_SYNC') return 'Candle Sync';
  return normalized.replace(/_/g, ' ');
};

export const getJobActionState = (status: string | undefined) => {
  const normalizedStatus = toJobStatus(status);
  const canStart = ['PENDING', 'STOPPED', 'FAILED', 'COMPLETED'].includes(normalizedStatus);
  const canPause = normalizedStatus === 'RUNNING';
  const canResume = normalizedStatus === 'PAUSED';
  const canStop = normalizedStatus === 'RUNNING' || normalizedStatus === 'PAUSED' || normalizedStatus === 'PENDING';
  const startActionLabel = normalizedStatus === 'COMPLETED'
    ? 'Sync'
    : normalizedStatus === 'FAILED'
      ? 'Retry'
      : 'Start';

  return { normalizedStatus, canStart, canPause, canResume, canStop, startActionLabel };
};

export const toJobStatus = (status: string | undefined) => status?.trim().toUpperCase() ?? '';

export const StatusIcon = ({ status }: { status: string }) => {
  const tone = statusTone(status);
  const iconProps = { fontSize: 'small' as const, sx: { verticalAlign: 'middle' } };
  if (tone === 'success') return <CheckCircleRoundedIcon {...iconProps} color="success" />;
  if (tone === 'info') return <InfoRoundedIcon {...iconProps} color="info" />;
  if (tone === 'error') return <ErrorRoundedIcon {...iconProps} color="error" />;
  if (tone === 'warning') return <WarningRoundedIcon {...iconProps} color="warning" />;
  return <InfoRoundedIcon {...iconProps} sx={{ ...iconProps.sx, color: 'text.secondary' }} />;
};

export const InstrumentBadge = ({ instrumentKey }: { instrumentKey: string }) => {
  const inst = INSTRUMENTS.find((i) => i.key === instrumentKey);
  return (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <Chip
        label={inst?.exchange ?? instrumentKey.split('|')[0]}
        size="small"
        sx={{
          height: 16,
          fontSize: '0.6rem',
          fontWeight: 700,
          bgcolor: inst?.exchange === 'BSE' ? '#fff7ed' : '#eff6ff',
          color: inst?.exchange === 'BSE' ? '#c2410c' : '#1d4ed8',
          border: '1px solid',
          borderColor: inst?.exchange === 'BSE' ? '#fed7aa' : '#bfdbfe',
        }}
      />
      <Typography variant="body2" fontWeight={600} sx={{ whiteSpace: 'nowrap' }}>
        {inst?.label ?? instrumentKey}
      </Typography>
    </Stack>
  );
};

export const TimeframeBadge = ({ unit, interval }: { unit: string; interval: number }) => {
  const tf = TIMEFRAME_OPTIONS.find((t) => t.unit === unit && t.interval === interval);
  return (
    <Chip
      label={tf?.label ?? `${interval} ${unit}`}
      size="small"
      variant="outlined"
      sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600 }}
    />
  );
};

export const HistorySectionCard = ({
  title,
  icon,
  collapsed,
  onToggle,
  children,
  extra,
}: {
  title: string;
  icon: ReactNode;
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
  extra?: ReactNode;
}) => (
  <Card>
    <Box
      sx={{
        px: 2.5,
        py: 1.6,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: collapsed ? 'none' : '1px solid',
        borderColor: 'divider',
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        {icon}
        <Typography variant="subtitle2" color="text.secondary">{title}</Typography>
      </Stack>
      <Stack direction="row" spacing={1} alignItems="center">
        {extra}
        <IconButton size="small" onClick={onToggle} aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}>
          {collapsed ? <ExpandMoreRoundedIcon fontSize="small" /> : <ExpandLessRoundedIcon fontSize="small" />}
        </IconButton>
      </Stack>
    </Box>
    <Collapse in={!collapsed}>
      {children}
    </Collapse>
  </Card>
);

// ─── Stat Card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  color?: string;
  subtext?: string;
}

export const StatCard = ({ icon, label, value, color = '#1a3a6b', subtext }: StatCardProps) => (
  <Card sx={{ height: '100%' }}>
    <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <Box
          sx={{
            p: 1.2,
            borderRadius: 2,
            bgcolor: `${color}14`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Box sx={{ color, display: 'flex' }}>{icon}</Box>
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" color="text.secondary" noWrap>
            {label}
          </Typography>
          <Typography variant="h5" fontWeight={700} sx={{ color, lineHeight: 1.2, mt: 0.3 }}>
            {value}
          </Typography>
          {subtext && (
            <Typography variant="caption" color="text.secondary" noWrap>
              {subtext}
            </Typography>
          )}
        </Box>
      </Stack>
    </CardContent>
  </Card>
);

// ─── Job Card ──────────────────────────────────────────────────────────────────

interface JobCardProps {
  job: MigrationJob;
  onAction: (job: MigrationJob, action: JobAction) => void;
  loading?: boolean;
}

export const JobCard = ({ job, onAction, loading }: JobCardProps) => {
  const tone = statusTone(job.status);
  const borderColor: Record<StatusColor | 'default', string> = {
    success: '#10b981',
    info: '#3b82f6',
    error: '#ef4444',
    warning: '#f59e0b',
    default: '#94a3b8',
  };
  const progressColor: Record<StatusColor | 'default', 'success' | 'info' | 'error' | 'warning' | 'inherit'> = {
    success: 'success',
    info: 'info',
    error: 'error',
    warning: 'warning',
    default: 'inherit',
  };

  const { canStart, canPause, canResume, canStop, startActionLabel } = getJobActionState(job.status);

  return (
    <Card
      sx={{
        borderLeft: `3px solid ${borderColor[tone]}`,
        transition: 'box-shadow 0.2s',
        '&:hover': { boxShadow: '0 4px 12px rgba(0,0,0,0.1)' },
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Stack spacing={1.2}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={0.5}>
            <InstrumentBadge instrumentKey={job.instrumentKey} />
            <Chip
              label={job.status}
              size="small"
              color={tone}
              icon={<StatusIcon status={job.status} />}
              sx={{ fontWeight: 700 }}
            />
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" gap={0.5}>
            <TimeframeBadge unit={job.timeframeUnit} interval={job.timeframeInterval} />
            <Chip
              label={migrationJobTypeLabel(job.jobType)}
              size="small"
              variant="outlined"
              color={normalizeJobType(job.jobType) === 'TRADING_ANALYTICS_BACKFILL' ? 'secondary' : 'default'}
              sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700 }}
            />
            {job.nextFromDate && (
              <Typography variant="caption" color="text.secondary">
                Next: {job.nextFromDate}
              </Typography>
            )}
            {job.updatedAt && (
              <Typography variant="caption" color="text.secondary">
                · {formatDateTime(job.updatedAt)}
              </Typography>
            )}
          </Stack>

          <Box>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                Progress
              </Typography>
              <Typography variant="caption" fontWeight={700} color={`${progressColor[tone]}.main`}>
                {job.progressPercent}%
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={job.progressPercent}
              color={progressColor[tone]}
              sx={{ borderRadius: 4 }}
            />
          </Box>

          {job.lastError && (
            <Alert severity="error" sx={{ py: 0, fontSize: '0.72rem' }}>
              {job.lastError}
            </Alert>
          )}

          <Stack direction="row" spacing={0.75} justifyContent="flex-end">
            {canStart && (
              <Tooltip title={`${startActionLabel} job`}>
                <span>
                  <Button
                    size="small"
                    variant="outlined"
                    color="success"
                    startIcon={loading ? <CircularProgress size={12} /> : <PlayCircleRoundedIcon />}
                    onClick={() => onAction(job, 'start')}
                    disabled={loading}
                    sx={{ minWidth: 0 }}
                  >
                    {startActionLabel}
                  </Button>
                </span>
              </Tooltip>
            )}
            {canPause && (
              <Tooltip title="Pause job">
                <span>
                  <Button
                    size="small"
                    variant="outlined"
                    color="warning"
                    startIcon={loading ? <CircularProgress size={12} /> : <PauseCircleRoundedIcon />}
                    onClick={() => onAction(job, 'pause')}
                    disabled={loading}
                    sx={{ minWidth: 0 }}
                  >
                    Pause
                  </Button>
                </span>
              </Tooltip>
            )}
            {canResume && (
              <Tooltip title="Resume job">
                <span>
                  <Button
                    size="small"
                    variant="outlined"
                    color="info"
                    startIcon={loading ? <CircularProgress size={12} /> : <AutorenewRoundedIcon />}
                    onClick={() => onAction(job, 'resume')}
                    disabled={loading}
                    sx={{ minWidth: 0 }}
                  >
                    Resume
                  </Button>
                </span>
              </Tooltip>
            )}
            {canStop && (
              <Tooltip title="Stop job permanently">
                <span>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={loading ? <CircularProgress size={12} /> : <StopCircleRoundedIcon />}
                    onClick={() => onAction(job, 'stop')}
                    disabled={loading}
                    sx={{ minWidth: 0 }}
                  >
                    Stop
                  </Button>
                </span>
              </Tooltip>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
};

// ─── Sidebar ───────────────────────────────────────────────────────────────────


export { navItems, SidebarContent, type NavGroupKey, type NavItemKey, type SidebarProps } from './AppSidebar';
