import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import RadioButtonCheckedRoundedIcon from '@mui/icons-material/RadioButtonCheckedRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import { useState } from 'react';
import type { IntraTradeExecutionResponse, IntraTradeMode } from '../../api/admin';

export const INTRA_MODE_CONFIG: Record<IntraTradeMode, { label: string; detail: string; color: string; bg: string; border: string }> = {
  LIVE: {
    label: 'Real-Time Live',
    detail: 'Evaluates today\'s intraday session using the selected live trading context.',
    color: '#15803d',
    bg: '#dcfce7',
    border: '#86efac',
  },
  PAPER: {
    label: 'Real-Time Paper',
    detail: 'Simulates live execution logic without routing broker orders.',
    color: '#1d4ed8',
    bg: '#dbeafe',
    border: '#93c5fd',
  },
  BACKTEST: {
    label: 'Historical Backtest',
    detail: 'Runs the selected strategy across the configured historical range.',
    color: '#7c3aed',
    bg: '#ede9fe',
    border: '#c4b5fd',
  },
};

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  WAITING_ENTRY: { color: '#b45309', bg: '#fffbeb', label: 'Waiting Entry' },
  ENTERED: { color: '#15803d', bg: '#dcfce7', label: 'In Position' },
  EXITED: { color: '#475569', bg: '#f1f5f9', label: 'Exited' },
  COMPLETED: { color: '#7c3aed', bg: '#ede9fe', label: 'Completed' },
  FAILED: { color: '#b91c1c', bg: '#fee2e2', label: 'Failed' },
};

export const REFRESH_OPTIONS = [
  { value: 5, label: '5s' },
  { value: 10, label: '10s' },
  { value: 15, label: '15s' },
  { value: 30, label: '30s' },
  { value: 60, label: '1m' },
  { value: 120, label: '2m' },
  { value: 300, label: '5m' },
];

export const toTimeframeKey = (unit: string, interval: number) => `${unit}|${interval}`;

export const formatSignedPnl = (pnl?: number) => {
  if (pnl == null) return '—';
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: 'always',
  }).format(pnl);
};

export const formatPnlRupees = (pnl?: number | null) => {
  if (pnl == null) return '—';
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    signDisplay: 'always',
  }).format(pnl);
  return '₹' + formatted;
};

export const friendlyStrategyStatus = (status: string): { label: string; color: 'warning' | 'info' | 'success' | 'default' } => {
  switch (status) {
    case 'DRAFT': return { label: 'In Progress', color: 'warning' };
    case 'PAPER_READY': return { label: 'Ready to Test', color: 'info' };
    case 'LIVE_READY': return { label: 'Ready to Trade', color: 'success' };
    case 'ARCHIVED': return { label: 'Archived', color: 'default' };
    default: return { label: status, color: 'default' };
  }
};

export const friendlyRuntimeStatus = (status: string): { label: string; color: 'default' | 'success' | 'warning' | 'error' | 'info' } => {
  switch (status) {
    case 'WAITING': return { label: 'Waiting for Signal', color: 'info' };
    case 'ENTERED': return { label: 'In Trade', color: 'success' };
    case 'PARTIAL_EXIT': return { label: 'Partial Exit', color: 'warning' };
    case 'EXITED': return { label: 'Exited', color: 'default' };
    case 'PAUSED': return { label: 'Paused', color: 'warning' };
    case 'ERROR': return { label: 'Error', color: 'error' };
    default: return { label: status, color: 'default' };
  }
};

export const PnlValue = ({ value, variant = 'body2' }: { value?: number | null; variant?: 'caption' | 'body2' | 'h6' }) => {
  const color = value == null ? 'text.secondary' : value > 0 ? '#15803d' : value < 0 ? '#b91c1c' : 'text.secondary';
  return (
    <Typography variant={variant} fontWeight={700} sx={{ color }}>
      {formatPnlRupees(value)}
    </Typography>
  );
};

export type LiveGuardResult = {
  confirmLiveAction: boolean;
  liveAcknowledgement: string;
  reason: string;
};

export const LiveGuardDialog = ({
  open,
  isLive,
  actionLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  isLive: boolean;
  actionLabel: string;
  onConfirm: (result: LiveGuardResult) => void;
  onCancel: () => void;
}) => {
  const [reason, setReason] = useState('');
  const [ackInput, setAckInput] = useState('');

  const handleConfirm = () => {
    if (reason.trim().length === 0) return;
    if (isLive && ackInput.trim().toUpperCase() !== 'CONFIRM LIVE') return;
    onConfirm({
      confirmLiveAction: isLive,
      liveAcknowledgement: isLive ? 'CONFIRM LIVE' : 'PAPER',
      reason: reason.trim(),
    });
    setReason('');
    setAckInput('');
  };

  const handleCancel = () => {
    setReason('');
    setAckInput('');
    onCancel();
  };

  const ackOk = !isLive || ackInput.trim().toUpperCase() === 'CONFIRM LIVE';
  const canConfirm = reason.trim().length > 0 && ackOk;

  return (
    <Dialog open={open} onClose={handleCancel} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>
        {isLive ? '⚠️ Live Trade Action' : 'Confirm Action'}: {actionLabel}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {isLive && (
            <Alert severity="warning" sx={{ fontSize: '0.82rem' }}>
              This action affects a <strong>live trade</strong>. It will be logged for audit. Make sure you intend to proceed.
            </Alert>
          )}
          <TextField
            label="Reason (required)"
            size="small"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            fullWidth
            autoFocus
            placeholder={isLive ? 'e.g. Market reversal signal observed' : 'e.g. paper test intervention'}
          />
          {isLive && (
            <TextField
              label='Type "CONFIRM LIVE" to proceed'
              size="small"
              value={ackInput}
              onChange={(e) => setAckInput(e.target.value)}
              fullWidth
              error={ackInput.length > 0 && !ackOk}
              helperText={ackInput.length > 0 && !ackOk ? 'Must type exactly: CONFIRM LIVE' : ''}
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel}>Cancel</Button>
        <Button
          variant="contained"
          color={isLive ? 'error' : 'primary'}
          onClick={handleConfirm}
          disabled={!canConfirm}
        >
          {isLive ? 'Confirm Live Action' : 'Confirm'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export const IntraExecutionStatusCard = ({
  execution,
  refreshInterval,
  onRefreshIntervalChange,
  refreshing,
  onRefresh,
  autoRefreshActive,
  onToggleAutoRefresh,
  showControls = true,
}: {
  execution: IntraTradeExecutionResponse;
  refreshInterval: number;
  onRefreshIntervalChange: (value: number) => void;
  refreshing: boolean;
  onRefresh: () => void;
  autoRefreshActive: boolean;
  onToggleAutoRefresh: () => void;
  showControls?: boolean;
}) => {
  const statusCfg = STATUS_CONFIG[execution.status] ?? STATUS_CONFIG.WAITING_ENTRY;
  const pnl = execution.result?.totalPnl ?? 0;
  const pnlPositive = pnl > 0;
  const pnlNegative = pnl < 0;
  const modeCfg = INTRA_MODE_CONFIG[execution.mode as IntraTradeMode] ?? INTRA_MODE_CONFIG.PAPER;
  const isLiveOrPaper = execution.mode === 'LIVE' || execution.mode === 'PAPER';

  return (
    <Card variant="outlined" sx={{ borderColor: `${statusCfg.color}40`, bgcolor: statusCfg.bg }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Stack spacing={1.5}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <Chip
                label={modeCfg.label}
                size="small"
                sx={{
                  height: 22,
                  fontWeight: 800,
                  fontSize: '0.68rem',
                  bgcolor: modeCfg.bg,
                  color: modeCfg.color,
                  border: `1px solid ${modeCfg.border}`,
                }}
              />
              <Box
                sx={{
                  px: 1.25,
                  py: 0.25,
                  borderRadius: 999,
                  bgcolor: statusCfg.color,
                  color: '#fff',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {execution.status === 'ENTERED' && <RadioButtonCheckedRoundedIcon sx={{ fontSize: 10 }} />}
                {statusCfg.label}
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                {execution.strategyName}
              </Typography>
            </Stack>

            <Stack direction="row" spacing={0.5} alignItems="center">
              {pnlPositive && <TrendingUpRoundedIcon sx={{ fontSize: 18, color: '#15803d' }} />}
              {pnlNegative && <TrendingDownRoundedIcon sx={{ fontSize: 18, color: '#b91c1c' }} />}
              <Typography
                variant="h6"
                fontWeight={800}
                sx={{ fontSize: '1.1rem', color: pnlPositive ? '#15803d' : pnlNegative ? '#b91c1c' : '#475569', lineHeight: 1 }}
              >
                ₹{formatSignedPnl(pnl)}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.66rem' }}>
                {execution.result?.executedTrades ?? 0} trade{(execution.result?.executedTrades ?? 0) !== 1 ? 's' : ''}
              </Typography>
            </Stack>
          </Stack>

          {execution.statusMessage && (
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
              {execution.statusMessage}
            </Typography>
          )}

          {showControls && isLiveOrPaper && (
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" gap={0.75}>
              <Tooltip title={autoRefreshActive ? 'Auto-refresh is on' : 'Auto-refresh is paused'}>
                <Button
                  size="small"
                  variant={autoRefreshActive ? 'contained' : 'outlined'}
                  color={autoRefreshActive ? 'success' : 'inherit'}
                  onClick={onToggleAutoRefresh}
                  startIcon={autoRefreshActive ? <StopRoundedIcon /> : <PlayArrowRoundedIcon />}
                  sx={{ fontSize: '0.72rem', height: 28, minWidth: 0 }}
                >
                  {autoRefreshActive ? 'Live' : 'Paused'}
                </Button>
              </Tooltip>
              <FormControl size="small" sx={{ minWidth: 64 }}>
                <Select
                  value={refreshInterval}
                  onChange={(event) => onRefreshIntervalChange(Number(event.target.value))}
                  sx={{ fontSize: '0.72rem', height: 28, '& .MuiSelect-select': { py: '2px', px: '6px', pr: '20px !important' } }}
                >
                  {REFRESH_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value} sx={{ fontSize: '0.78rem' }}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                size="small"
                variant="outlined"
                startIcon={refreshing ? undefined : <RefreshRoundedIcon />}
                onClick={onRefresh}
                disabled={refreshing}
                sx={{ fontSize: '0.72rem', height: 28, minWidth: 0 }}
              >
                {refreshing ? 'Updating…' : 'Refresh Now'}
              </Button>
            </Stack>
          )}

          {execution.result?.realWorldAccuracyPct != null && Number(execution.result.realWorldAccuracyPct) < 100 && (
            <Alert severity="warning" sx={{ py: 0.5, fontSize: '0.75rem' }}>
              Pricing accuracy {execution.result.realWorldAccuracyPct}% — some legs used fallback pricing.
            </Alert>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};
