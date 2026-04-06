import {
  Alert,
  Button,
  Card,
  CardContent,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import type {
  IntraStrategyLibraryItem,
  IntraTradeMode,
} from '../../api/admin';
import type { InstrumentOption } from '../BacktestPanelShared';
import type { TimeframeOption } from '../backtestAdvancedConditionUtils';
import { INTRA_MODE_CONFIG, toTimeframeKey } from './IntraTradeShared';

export const IntraMonitorRunSetupCard = ({
  strategyId,
  savedStrategies,
  loadingStrategies,
  tradeMode,
  scanInstrumentKey,
  scanTimeframeKey,
  baseInstruments,
  timeframeOptions,
  runningExecution,
  refreshingExecution,
  canRefresh,
  onNavigateStrategies,
  onNavigatePnl,
  onSelectStrategy,
  onTradeModeChange,
  onScanInstrumentChange,
  onScanTimeframeChange,
  onRun,
  onRefresh,
}: {
  strategyId: number | null;
  savedStrategies: IntraStrategyLibraryItem[];
  loadingStrategies: boolean;
  tradeMode: IntraTradeMode;
  scanInstrumentKey: string;
  scanTimeframeKey: string;
  baseInstruments: InstrumentOption[];
  timeframeOptions: TimeframeOption[];
  runningExecution: boolean;
  refreshingExecution: boolean;
  canRefresh: boolean;
  onNavigateStrategies: () => void;
  onNavigatePnl: () => void;
  onSelectStrategy: (strategyId: number) => void;
  onTradeModeChange: (mode: IntraTradeMode) => void;
  onScanInstrumentChange: (instrumentKey: string) => void;
  onScanTimeframeChange: (timeframeKey: string) => void;
  onRun: () => void;
  onRefresh: () => void;
}) => (
  <Card>
    <CardContent>
      <Stack spacing={2}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
          <Stack spacing={0.25}>
            <Typography variant="h5" fontWeight={800}>Intra Monitor</Typography>
            <Typography variant="body2" color="text.secondary">
              Monitor running strategies and active positions with safe live intervention controls.
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button variant="outlined" size="small" onClick={onNavigateStrategies}>
              Edit Intra Strategies
            </Button>
            <Button variant="contained" size="small" endIcon={<ArrowForwardRoundedIcon />} onClick={onNavigatePnl}>
              Open Intra P&amp;L
            </Button>
          </Stack>
        </Stack>

        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel id="intra-monitor-saved-strategy-label">Saved Strategy</InputLabel>
              <Select
                labelId="intra-monitor-saved-strategy-label"
                label="Saved Strategy"
                value={strategyId == null ? '' : String(strategyId)}
                onChange={(event) => onSelectStrategy(Number(event.target.value))}
                disabled={loadingStrategies}
              >
                {savedStrategies.map((row) => (
                  <MenuItem key={row.id} value={row.id}>
                    {row.strategyName} ({row.status})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2.5}>
            <FormControl fullWidth size="small">
              <InputLabel id="intra-monitor-mode-label">Trade Mode</InputLabel>
              <Select
                labelId="intra-monitor-mode-label"
                label="Trade Mode"
                value={tradeMode}
                onChange={(event) => onTradeModeChange(event.target.value as IntraTradeMode)}
              >
                {(['PAPER', 'LIVE', 'BACKTEST'] as IntraTradeMode[]).map((mode) => (
                  <MenuItem key={mode} value={mode}>
                    {INTRA_MODE_CONFIG[mode].label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel id="intra-monitor-instrument-label">Scan Instrument</InputLabel>
              <Select
                labelId="intra-monitor-instrument-label"
                label="Scan Instrument"
                value={scanInstrumentKey}
                onChange={(event) => onScanInstrumentChange(event.target.value)}
              >
                {baseInstruments.map((instrument) => (
                  <MenuItem key={instrument.key} value={instrument.key}>
                    {instrument.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2.5}>
            <FormControl fullWidth size="small">
              <InputLabel id="intra-monitor-timeframe-label">Scan Timeframe</InputLabel>
              <Select
                labelId="intra-monitor-timeframe-label"
                label="Scan Timeframe"
                value={scanTimeframeKey}
                onChange={(event) => onScanTimeframeChange(event.target.value)}
              >
                {timeframeOptions.map((timeframe) => (
                  <MenuItem key={toTimeframeKey(timeframe.unit, timeframe.interval)} value={toTimeframeKey(timeframe.unit, timeframe.interval)}>
                    {timeframe.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        <Alert severity={tradeMode === 'LIVE' ? 'warning' : 'info'}>
          {INTRA_MODE_CONFIG[tradeMode].detail}
        </Alert>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
          <Button variant="contained" startIcon={<PlayArrowRoundedIcon />} onClick={onRun} disabled={runningExecution}>
            {runningExecution ? 'Running…' : 'Run Strategy'}
          </Button>
          <Button variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={onRefresh} disabled={!canRefresh || refreshingExecution}>
            {refreshingExecution ? 'Refreshing…' : 'Refresh Selected Run'}
          </Button>
        </Stack>
      </Stack>
    </CardContent>
  </Card>
);
