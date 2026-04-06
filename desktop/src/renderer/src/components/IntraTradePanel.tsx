import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded';
import RadioButtonCheckedRoundedIcon from '@mui/icons-material/RadioButtonCheckedRounded';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  checkIntraTradeTrend,
  createBacktestStrategy,
  deleteIntraTradeExecution,
  exitIntraTradeExecution,
  fetchBacktestStrategies,
  fetchIntraTradeExecution,
  fetchIntraTradeExecutions,
  refreshIntraTradeExecution,
  runIntraTradeExecution,
  updateIntraTradeExecution,
  updateBacktestStrategy,
  type BacktestLegPayload,
  type BacktestRunResponse,
  type BacktestStrategyPayload,
  type BacktestStrategyResponse,
  type IntraTradeExecutionResponse,
  type IntraTradeExecutionSummary,
  type IntraTradeMode,
  type IntraTradeRunPayload,
} from '../api/admin';
import { BacktestResultsPanel } from './BacktestResultsPanel';
import { BacktestStrategyForm } from './BacktestStrategyForm';
import {
  createDefaultLeg,
  createDefaultStrategy,
  normalizeStrategyForMvp,
  oneMonthAgo,
  parseTimeframeKey,
  type BacktestPanelProps,
} from './BacktestPanelShared';
import { IntraTradeExecutionHistory } from './intra-trade/IntraTradeExecutionHistory';
import { IntraTradeMarketWatchBoard } from './intra-trade/IntraTradeMarketWatchBoard';

// ─── Mode configuration ────────────────────────────────────────────────────────

const MODE_CONFIG: Record<IntraTradeMode, { label: string; detail: string; color: string; bg: string; border: string }> = {
  LIVE: {
    label: 'Real-Time Live',
    detail: 'Evaluates today\'s intraday session and places real orders via Upstox broker API.',
    color: '#15803d',
    bg: '#dcfce7',
    border: '#86efac',
  },
  PAPER: {
    label: 'Real-Time Paper',
    detail: 'Simulates live execution logic without placing real orders. Same timing as Live mode.',
    color: '#1d4ed8',
    bg: '#dbeafe',
    border: '#93c5fd',
  },
  BACKTEST: {
    label: 'Historical Backtest',
    detail: 'Runs the strategy across the configured date range using historical data.',
    color: '#7c3aed',
    bg: '#ede9fe',
    border: '#c4b5fd',
  },
};

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  WAITING_ENTRY: { color: '#b45309', bg: '#fffbeb', label: 'Waiting Entry' },
  ENTERED:       { color: '#15803d', bg: '#dcfce7', label: 'In Position' },
  EXITED:        { color: '#475569', bg: '#f1f5f9', label: 'Exited' },
  COMPLETED:     { color: '#7c3aed', bg: '#ede9fe', label: 'Completed' },
  FAILED:        { color: '#b91c1c', bg: '#fee2e2', label: 'Failed' },
};

const REFRESH_OPTIONS = [
  { value: 15, label: '15s' },
  { value: 30, label: '30s' },
  { value: 60, label: '1m' },
  { value: 120, label: '2m' },
  { value: 300, label: '5m' },
];

const toTimeframeKey = (unit: string, interval: number) => `${unit}|${interval}`;

const formatPnl = (pnl?: number) => {
  if (pnl == null) return '—';
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'always' }).format(pnl);
};

// ─── Execution status card ─────────────────────────────────────────────────────

const ExecutionStatusCard = ({
  execution,
  refreshInterval,
  onRefreshIntervalChange,
  refreshing,
  onRefresh,
  autoRefreshActive,
  onToggleAutoRefresh,
}: {
  execution: IntraTradeExecutionResponse;
  refreshInterval: number;
  onRefreshIntervalChange: (v: number) => void;
  refreshing: boolean;
  onRefresh: () => void;
  autoRefreshActive: boolean;
  onToggleAutoRefresh: () => void;
}) => {
  const statusCfg = STATUS_CONFIG[execution.status] ?? STATUS_CONFIG.WAITING_ENTRY;
  const pnl = execution.result?.totalPnl ?? 0;
  const pnlPositive = typeof pnl === 'number' ? pnl > 0 : Number(pnl) > 0;
  const pnlNegative = typeof pnl === 'number' ? pnl < 0 : Number(pnl) < 0;
  const modeCfg = MODE_CONFIG[execution.mode as IntraTradeMode] ?? MODE_CONFIG.PAPER;
  const isLiveOrPaper = execution.mode === 'LIVE' || execution.mode === 'PAPER';

  return (
    <Card variant="outlined" sx={{ borderColor: statusCfg.color + '40', bgcolor: statusCfg.bg }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Stack spacing={1.5}>
          {/* Mode + Status row */}
          <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <Chip
                label={modeCfg.label}
                size="small"
                sx={{ height: 22, fontWeight: 800, fontSize: '0.68rem', bgcolor: modeCfg.bg, color: modeCfg.color, border: `1px solid ${modeCfg.border}` }}
              />
              <Box
                sx={{
                  px: 1.25, py: 0.25, borderRadius: 999,
                  bgcolor: statusCfg.color,
                  color: '#fff',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  display: 'flex', alignItems: 'center', gap: '4px',
                }}
              >
                {execution.status === 'ENTERED' && <RadioButtonCheckedRoundedIcon sx={{ fontSize: 10 }} />}
                {statusCfg.label}
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                {execution.strategyName}
              </Typography>
            </Stack>

            {/* P&L display */}
            <Stack direction="row" spacing={0.5} alignItems="center">
              {pnlPositive && <TrendingUpRoundedIcon sx={{ fontSize: 18, color: '#15803d' }} />}
              {pnlNegative && <TrendingDownRoundedIcon sx={{ fontSize: 18, color: '#b91c1c' }} />}
              <Typography
                variant="h6"
                fontWeight={800}
                sx={{ fontSize: '1.1rem', color: pnlPositive ? '#15803d' : pnlNegative ? '#b91c1c' : '#475569', lineHeight: 1 }}
              >
                ₹{formatPnl(typeof pnl === 'number' ? pnl : Number(pnl))}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.66rem' }}>
                {execution.result?.executedTrades ?? 0} trade{(execution.result?.executedTrades ?? 0) !== 1 ? 's' : ''}
              </Typography>
            </Stack>
          </Stack>

          {/* Status message */}
          {execution.statusMessage && (
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
              {execution.statusMessage}
            </Typography>
          )}

          {/* Auto-refresh controls (LIVE/PAPER only) */}
          {isLiveOrPaper && (
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" gap={0.75}>
              <Tooltip title={autoRefreshActive ? 'Auto-refresh is ON — click to pause' : 'Auto-refresh paused — click to start'}>
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
                  onChange={(e) => onRefreshIntervalChange(Number(e.target.value))}
                  sx={{ fontSize: '0.72rem', height: 28, '& .MuiSelect-select': { py: '2px', px: '6px', pr: '20px !important' } }}
                >
                  {REFRESH_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: '0.78rem' }}>{opt.label}</MenuItem>
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

          {/* Accuracy warning */}
          {execution.result?.realWorldAccuracyPct != null && Number(execution.result.realWorldAccuracyPct) < 100 && (
            <Alert severity="warning" sx={{ py: 0.5, fontSize: '0.75rem' }}>
              Pricing accuracy {execution.result.realWorldAccuracyPct}% — some legs used synthetic fallback pricing.
            </Alert>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

// ─── Main Panel ────────────────────────────────────────────────────────────────

export const IntraTradePanel = ({
  token,
  tenantId,
  username,
  baseInstruments,
  baseTimeframes,
  onNotify,
}: Omit<BacktestPanelProps, 'activeView' | 'onNavigateToPnl'>) => {
  const initialInstrument = baseInstruments[0]?.key ?? 'NSE_INDEX|Nifty 50';
  const [strategyId, setStrategyId] = useState<number | null>(null);
  const [strategy, setStrategy] = useState<BacktestStrategyPayload>(() => ({
    ...createDefaultStrategy(initialInstrument),
    startDate: oneMonthAgo(),
  }));
  const [savedStrategies, setSavedStrategies] = useState<BacktestStrategyResponse[]>([]);
  const [executionMode, setExecutionMode] = useState<IntraTradeMode>('PAPER');
  const [scanInstrumentKey, setScanInstrumentKey] = useState(initialInstrument);
  const [scanTimeframeKey, setScanTimeframeKey] = useState('minutes|5');
  const [executions, setExecutions] = useState<IntraTradeExecutionSummary[]>([]);
  const [executionTotalElements, setExecutionTotalElements] = useState(0);
  const [executionPage, setExecutionPage] = useState(0);
  const [executionRowsPerPage, setExecutionRowsPerPage] = useState(5);
  const [selectedExecution, setSelectedExecution] = useState<IntraTradeExecutionResponse | null>(null);
  const [editingExecutionId, setEditingExecutionId] = useState<number | null>(null);
  const [loadingStrategies, setLoadingStrategies] = useState(false);
  const [loadingExecutions, setLoadingExecutions] = useState(false);
  const [savingStrategy, setSavingStrategy] = useState(false);
  const [runningExecution, setRunningExecution] = useState(false);
  const [refreshingExecution, setRefreshingExecution] = useState(false);
  const [deletingExecutionId, setDeletingExecutionId] = useState<number | null>(null);
  const [exitingExecutionId, setExitingExecutionId] = useState<number | null>(null);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(30);
  const [autoRefreshActive, setAutoRefreshActive] = useState(false);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const modeCfg = MODE_CONFIG[executionMode];

  const timeframeOptions = useMemo(
    () => executionMode === 'BACKTEST' ? baseTimeframes : baseTimeframes.filter((tf) => tf.unit === 'minutes'),
    [baseTimeframes, executionMode]
  );

  useEffect(() => {
    if (!timeframeOptions.some((opt) => toTimeframeKey(opt.unit, opt.interval) === scanTimeframeKey)) {
      const fallback = timeframeOptions[0];
      if (fallback) setScanTimeframeKey(toTimeframeKey(fallback.unit, fallback.interval));
    }
  }, [scanTimeframeKey, timeframeOptions]);

  useEffect(() => {
    if (executionMode !== 'BACKTEST' && strategy.strategyType !== 'INTRADAY') {
      setStrategy((current) => ({ ...current, strategyType: 'INTRADAY' }));
      onNotify({ msg: 'Strategy type set to INTRADAY for Live/Paper mode', severity: 'info' });
    }
  }, [executionMode, strategy.strategyType, onNotify]);

  // Auto-refresh selected LIVE/PAPER execution independent of planner mode.
  useEffect(() => {
    if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    const selectedIsLiveOrPaper = selectedExecution?.mode === 'LIVE' || selectedExecution?.mode === 'PAPER';
    if (autoRefreshActive && selectedExecution && selectedIsLiveOrPaper) {
      autoRefreshRef.current = setInterval(() => {
        void (async () => {
          try {
            const response = await refreshIntraTradeExecution(tenantId, token, selectedExecution.id, username);
            setSelectedExecution(response);
            setExecutions((prev) =>
              prev.map((e) => e.id === response.id
                ? { ...e, status: response.status, totalPnl: response.result.totalPnl, executedTrades: response.result.executedTrades, evaluatedAt: response.evaluatedAt, statusMessage: response.statusMessage }
                : e)
            );
          } catch {
            // silent — don't spam notifications on auto-refresh
          }
        })();
      }, autoRefreshInterval * 1000);
    }
    return () => { if (autoRefreshRef.current) clearInterval(autoRefreshRef.current); };
  }, [autoRefreshActive, autoRefreshInterval, selectedExecution, tenantId, token, username]);

  // Stop auto-refresh only when no LIVE/PAPER execution is selected.
  useEffect(() => {
    const selectedIsLiveOrPaper = selectedExecution?.mode === 'LIVE' || selectedExecution?.mode === 'PAPER';
    if (!selectedExecution || !selectedIsLiveOrPaper) {
      setAutoRefreshActive(false);
    }
  }, [selectedExecution]);

  const reloadStrategies = useCallback(async () => {
    setLoadingStrategies(true);
    try {
      const response = await fetchBacktestStrategies(tenantId, token, username, 0, 100);
      setSavedStrategies(response.content);
    } catch (error) {
      onNotify({ msg: (error as Error).message || 'Unable to load saved strategies', severity: 'error' });
    } finally {
      setLoadingStrategies(false);
    }
  }, [onNotify, tenantId, token, username]);

  const reloadExecutions = useCallback(async (pageArg = executionPage, sizeArg = executionRowsPerPage) => {
    setLoadingExecutions(true);
    try {
      const response = await fetchIntraTradeExecutions(tenantId, token, username, pageArg, sizeArg);
      setExecutions(response.content);
      setExecutionTotalElements(response.totalElements);
    } catch (error) {
      onNotify({ msg: (error as Error).message || 'Unable to load saved Intra Trade runs', severity: 'error' });
    } finally {
      setLoadingExecutions(false);
    }
  }, [executionPage, executionRowsPerPage, onNotify, tenantId, token, username]);

  useEffect(() => {
    void reloadStrategies();
    void reloadExecutions();
  }, [reloadExecutions, reloadStrategies]);

  const updateStrategyField = <K extends keyof BacktestStrategyPayload>(key: K, value: BacktestStrategyPayload[K]) => {
    setStrategy((current) => ({ ...current, [key]: value }));
    if (key === 'underlyingKey' && typeof value === 'string') setScanInstrumentKey(value);
  };

  const addLeg = () => setStrategy((current) => ({
    ...current,
    legs: [...current.legs, createDefaultLeg(current.legs.length + 1)],
  }));

  const updateLeg = (legIndex: number, patch: Partial<BacktestLegPayload>) =>
    setStrategy((current) => ({
      ...current,
      legs: current.legs.map((leg, index) => (index === legIndex ? { ...leg, ...patch } : leg)),
    }));

  const deleteLeg = (legIndex: number) =>
    setStrategy((current) => ({ ...current, legs: current.legs.filter((_, index) => index !== legIndex) }));

  const resetForm = () => {
    setStrategyId(null);
    setEditingExecutionId(null);
    setStrategy({ ...createDefaultStrategy(scanInstrumentKey), startDate: oneMonthAgo() });
    setSelectedExecution(null);
    setAutoRefreshActive(false);
  };

  const loadSavedStrategy = (row: BacktestStrategyResponse) => {
    const normalized = normalizeStrategyForMvp(row.strategy);
    setStrategyId(row.id);
    setEditingExecutionId(null);
    setStrategy(normalized);
    setScanInstrumentKey(normalized.underlyingKey);
    onNotify({ msg: `Loaded "${row.strategyName}"`, severity: 'info' });
  };

  const loadSavedExecutionIntoPlanner = (execution: IntraTradeExecutionResponse) => {
    setEditingExecutionId(execution.id);
    setSelectedExecution(execution);
    setStrategyId(execution.strategyId ?? null);
    setStrategy(normalizeStrategyForMvp(execution.strategy));
    setScanInstrumentKey(execution.scanInstrumentKey);
    setScanTimeframeKey(toTimeframeKey(execution.scanTimeframeUnit, execution.scanTimeframeInterval));
    setExecutionMode(execution.mode);
    setAutoRefreshActive(execution.mode !== 'BACKTEST' && execution.status === 'ENTERED');
  };

  const buildRunPayload = (): IntraTradeRunPayload | null => {
    const timeframe = parseTimeframeKey(scanTimeframeKey);
    if (!timeframe.timeframeUnit || !timeframe.timeframeInterval) {
      onNotify({ msg: 'Select a scan timeframe', severity: 'error' });
      return null;
    }
    return {
      username,
      strategyId,
      mode: executionMode,
      scanInstrumentKey,
      scanTimeframeUnit: timeframe.timeframeUnit,
      scanTimeframeInterval: timeframe.timeframeInterval,
      strategy: { ...strategy, underlyingKey: scanInstrumentKey },
    };
  };

  const confirmTrendConflict = async (actionLabel: string, payload: IntraTradeRunPayload) => {
    if (payload.mode === 'BACKTEST') {
      return true;
    }
    const warning = await checkIntraTradeTrend(tenantId, token, payload);
    if (!warning.hasConflict) {
      return true;
    }
    return window.confirm(`${warning.message}\n\nContinue to ${actionLabel}?`);
  };

  const handleSaveStrategy = async () => {
    if (!strategy.strategyName.trim()) {
      onNotify({ msg: 'Strategy name is required', severity: 'error' });
      return;
    }
    const payload = buildRunPayload();
    if (!payload) return;
    setSavingStrategy(true);
    try {
      const canProceed = await confirmTrendConflict('save this strategy', payload);
      if (!canProceed) return;
      const strategyPayload = { username, strategy: payload.strategy };
      if (strategyId == null) {
        const response = await createBacktestStrategy(tenantId, token, strategyPayload);
        setStrategyId(response.id);
        setSavedStrategies((current) => [response, ...current.filter((row) => row.id !== response.id)]);
        onNotify({ msg: 'Strategy saved', severity: 'success' });
      } else {
        const response = await updateBacktestStrategy(tenantId, token, strategyId, strategyPayload);
        setSavedStrategies((current) => current.map((row) => (row.id === response.id ? response : row)));
        onNotify({ msg: 'Strategy updated', severity: 'success' });
      }
      await reloadStrategies();
    } catch (error) {
      onNotify({ msg: (error as Error).message || 'Unable to save strategy', severity: 'error' });
    } finally {
      setSavingStrategy(false);
    }
  };

  const handleRunExecution = async () => {
    const payload = buildRunPayload();
    if (!payload) return;
    setRunningExecution(true);
    try {
      const canProceed = await confirmTrendConflict(editingExecutionId == null ? 'execute this run' : 'update and execute this saved run', payload);
      if (!canProceed) return;
      const response = editingExecutionId == null
        ? await runIntraTradeExecution(tenantId, token, payload)
        : await updateIntraTradeExecution(tenantId, token, editingExecutionId, payload);
      setSelectedExecution(response);
      await reloadExecutions(0, executionRowsPerPage);
      setExecutionPage(0);
      setEditingExecutionId(response.id);
      if (executionMode !== 'BACKTEST') setAutoRefreshActive(true);
      onNotify({ msg: editingExecutionId == null ? `${modeCfg.label} run saved` : 'Saved run updated', severity: 'success' });
    } catch (error) {
      onNotify({ msg: (error as Error).message || 'Unable to run Intra Trade execution', severity: 'error' });
    } finally {
      setRunningExecution(false);
    }
  };

  const handleSelectExecution = async (executionId: number) => {
    try {
      const response = await fetchIntraTradeExecution(tenantId, token, executionId, username);
      setSelectedExecution(response);
      setExecutionMode(response.mode);
    } catch (error) {
      onNotify({ msg: (error as Error).message || 'Unable to open saved execution', severity: 'error' });
    }
  };

  const handleEditExecution = async (executionId: number) => {
    try {
      const response = await fetchIntraTradeExecution(tenantId, token, executionId, username);
      loadSavedExecutionIntoPlanner(response);
      onNotify({ msg: `Loaded saved run "${response.strategyName}" for editing`, severity: 'info' });
    } catch (error) {
      onNotify({ msg: (error as Error).message || 'Unable to edit saved execution', severity: 'error' });
    }
  };

  const handleRefreshSelectedExecution = async () => {
    if (!selectedExecution) return;
    setRefreshingExecution(true);
    try {
      const response = await refreshIntraTradeExecution(tenantId, token, selectedExecution.id, username);
      setSelectedExecution(response);
      await reloadExecutions();
      onNotify({ msg: 'Execution refreshed', severity: 'success' });
    } catch (error) {
      onNotify({ msg: (error as Error).message || 'Unable to refresh execution', severity: 'error' });
    } finally {
      setRefreshingExecution(false);
    }
  };

  const handleExitExecution = async (executionId: number) => {
    if (!window.confirm('Exit this position immediately using the latest completed scan candle?')) {
      return;
    }
    setExitingExecutionId(executionId);
    try {
      const response = await exitIntraTradeExecution(tenantId, token, executionId, username);
      if (selectedExecution?.id === executionId) {
        setSelectedExecution(response);
      }
      await reloadExecutions();
      onNotify({ msg: 'Position exited immediately', severity: 'success' });
    } catch (error) {
      onNotify({ msg: (error as Error).message || 'Unable to exit the position', severity: 'error' });
    } finally {
      setExitingExecutionId(null);
    }
  };

  const handleDeleteExecution = async (executionId: number) => {
    if (!window.confirm('Delete this saved run?')) {
      return;
    }
    setDeletingExecutionId(executionId);
    try {
      await deleteIntraTradeExecution(tenantId, token, executionId, username);
      if (selectedExecution?.id === executionId) {
        setSelectedExecution(null);
      }
      if (editingExecutionId === executionId) {
        setEditingExecutionId(null);
      }
      await reloadExecutions();
      onNotify({ msg: 'Saved run deleted', severity: 'success' });
    } catch (error) {
      onNotify({ msg: (error as Error).message || 'Unable to delete saved run', severity: 'error' });
    } finally {
      setDeletingExecutionId(null);
    }
  };

  return (
    <Stack spacing={2}>
      {/* ─── Header ──────────────────────────────────────────────────── */}
	      <Card
        variant="outlined"
        sx={{
          background: `linear-gradient(135deg, ${modeCfg.bg} 0%, #fff 60%)`,
          borderColor: modeCfg.border,
          borderLeft: `4px solid ${modeCfg.color}`,
        }}
      >
        <CardContent sx={{ py: 1.75, '&:last-child': { pb: 1.75 } }}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={1.5}>
            <Stack spacing={0.5}>
              <Stack direction="row" spacing={1} alignItems="center">
                <BoltRoundedIcon sx={{ color: modeCfg.color, fontSize: 22 }} />
                <Typography variant="h5" fontWeight={900} sx={{ color: '#0f172a', letterSpacing: -0.5 }}>
                  Intra Trade
                </Typography>
                <Chip
                  label={modeCfg.label}
                  size="small"
                  sx={{ fontWeight: 800, fontSize: '0.7rem', bgcolor: modeCfg.bg, color: modeCfg.color, border: `1px solid ${modeCfg.border}` }}
                />
                <Chip label="Options Only" size="small" color="warning" variant="outlined" sx={{ fontSize: '0.68rem' }} />
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {modeCfg.detail}
              </Typography>
            </Stack>
	            <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent={{ xs: 'flex-start', md: 'flex-end' }} gap={0.75}>
	              <Button variant="outlined" size="small" onClick={resetForm} sx={{ height: 34 }}>New</Button>
	              <Button
	                variant="outlined"
	                size="small"
	                startIcon={<SaveRoundedIcon />}
	                onClick={handleSaveStrategy}
	                disabled={savingStrategy}
	                sx={{ height: 34 }}
	              >
	                {savingStrategy ? 'Saving…' : 'Save Strategy'}
	              </Button>
	              <Button
	                variant="contained"
	                size="small"
	                startIcon={<PlayArrowRoundedIcon />}
	                onClick={handleRunExecution}
	                disabled={runningExecution}
	                sx={{ height: 34, bgcolor: modeCfg.color, '&:hover': { bgcolor: modeCfg.color, filter: 'brightness(0.9)' } }}
	              >
	                {runningExecution ? 'Running…' : editingExecutionId == null ? `Run ${modeCfg.label}` : `Update ${modeCfg.label}`}
	              </Button>
	            </Stack>
	          </Stack>
	        </CardContent>
	      </Card>

        {editingExecutionId !== null && (
          <Alert severity="info" sx={{ mt: 1 }}>
            Editing saved run `#{editingExecutionId}`. Running now updates that saved run in place.
          </Alert>
        )}

      {/* ─── Execution config bar ────────────────────────────────────── */}
      <Card variant="outlined">
        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Grid container spacing={1.5} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Saved Strategy</InputLabel>
                <Select
                  label="Saved Strategy"
                  value={strategyId ?? ''}
                  onChange={(e) => {
                    const nextId = Number(e.target.value);
                    const matched = savedStrategies.find((row) => row.id === nextId);
                    if (matched) loadSavedStrategy(matched);
                  }}
                >
                  <MenuItem value=""><em>New strategy</em></MenuItem>
                  {savedStrategies.map((row) => (
                    <MenuItem key={row.id} value={row.id}>{row.strategyName}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2.5}>
              <FormControl fullWidth size="small">
                <InputLabel>Mode</InputLabel>
                <Select
                  label="Mode"
                  value={executionMode}
                  onChange={(e) => setExecutionMode(e.target.value as IntraTradeMode)}
                  renderValue={(v) => (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: MODE_CONFIG[v as IntraTradeMode].color }} />
                      {MODE_CONFIG[v as IntraTradeMode].label}
                    </Box>
                  )}
                >
                  {(Object.entries(MODE_CONFIG) as [IntraTradeMode, typeof MODE_CONFIG[IntraTradeMode]][]).map(([key, cfg]) => (
                    <MenuItem key={key} value={key}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: cfg.color }} />
                        <Box>
                          <Typography variant="body2" fontWeight={600}>{cfg.label}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>{cfg.detail}</Typography>
                        </Box>
                      </Stack>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2.5}>
              <FormControl fullWidth size="small">
                <InputLabel>Scan Instrument</InputLabel>
                <Select
                  label="Scan Instrument"
                  value={scanInstrumentKey}
                  onChange={(e) => {
                    const next = e.target.value;
                    setScanInstrumentKey(next);
                    setStrategy((current) => ({ ...current, underlyingKey: next }));
                  }}
                >
                  {baseInstruments.map((instrument) => (
                    <MenuItem key={instrument.key} value={instrument.key}>{instrument.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Scan Timeframe</InputLabel>
                <Select
                  label="Scan Timeframe"
                  value={scanTimeframeKey}
                  onChange={(e) => setScanTimeframeKey(e.target.value)}
                >
                  {timeframeOptions.map((tf) => (
                    <MenuItem key={toTimeframeKey(tf.unit, tf.interval)} value={toTimeframeKey(tf.unit, tf.interval)}>
                      {tf.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: modeCfg.bg, border: `1px solid ${modeCfg.border}`, textAlign: 'center' }}>
                <Typography variant="caption" fontWeight={800} sx={{ color: modeCfg.color, fontSize: '0.7rem' }}>
                  {executionMode === 'BACKTEST' ? 'Historical range' : 'Today\'s session only'}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* ─── Main content ─────────────────────────────────────────────── */}
      <Grid container spacing={2}>
        {/* Left: strategy builder + results */}
        <Grid item xs={12} lg={8}>
          <Stack spacing={2}>
            <BacktestStrategyForm
              strategy={strategy}
              baseInstruments={baseInstruments}
              baseTimeframes={baseTimeframes}
              onUpdateField={updateStrategyField}
              onSetStrategy={setStrategy}
              onAddLeg={addLeg}
              onUpdateLeg={updateLeg}
              onDeleteLeg={deleteLeg}
            />

            {selectedExecution && (
              <ExecutionStatusCard
                execution={selectedExecution}
                refreshInterval={autoRefreshInterval}
                onRefreshIntervalChange={setAutoRefreshInterval}
                refreshing={refreshingExecution}
                onRefresh={handleRefreshSelectedExecution}
                autoRefreshActive={autoRefreshActive}
                onToggleAutoRefresh={() => setAutoRefreshActive((v) => !v)}
              />
            )}

            <BacktestResultsPanel
              results={selectedExecution?.result.rows ?? []}
              summary={selectedExecution?.result ?? null}
              strategyName={(selectedExecution?.strategy.strategyName ?? strategy.strategyName) || 'intra_trade'}
              startDate={selectedExecution?.strategy.startDate ?? strategy.startDate}
              endDate={selectedExecution?.strategy.endDate ?? strategy.endDate}
            />
          </Stack>
        </Grid>

        {/* Right: market watch */}
        <Grid item xs={12} lg={4}>
          <IntraTradeMarketWatchBoard
            token={token}
            tenantId={tenantId}
            username={username}
            onNotify={onNotify}
          />
        </Grid>
      </Grid>

      {/* ─── Execution history ────────────────────────────────────────── */}
	      <IntraTradeExecutionHistory
	        executions={executions}
	        totalElements={executionTotalElements}
	        page={executionPage}
	        rowsPerPage={executionRowsPerPage}
	        loading={loadingExecutions || loadingStrategies}
	        selectedExecutionId={selectedExecution?.id ?? null}
	        onSelectExecution={(executionId) => { void handleSelectExecution(executionId); }}
          onAddRun={resetForm}
          onEditExecution={(executionId) => { void handleEditExecution(executionId); }}
          onDeleteExecution={(executionId) => { void handleDeleteExecution(executionId); }}
          onExitExecution={(executionId) => { void handleExitExecution(executionId); }}
	        onRefreshList={() => { void reloadExecutions(); }}
	        onPageChange={(pageValue) => {
	          setExecutionPage(pageValue);
	          void reloadExecutions(pageValue, executionRowsPerPage);
	        }}
        onRowsPerPageChange={(rowsPerPageValue) => {
          setExecutionRowsPerPage(rowsPerPageValue);
	          setExecutionPage(0);
	          void reloadExecutions(0, rowsPerPageValue);
	        }}
          deletingExecutionId={deletingExecutionId}
          exitingExecutionId={exitingExecutionId}
	      />
	    </Stack>
	  );
	};
