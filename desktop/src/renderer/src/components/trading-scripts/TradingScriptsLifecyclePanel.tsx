import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  LinearProgress,
  Paper,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import PublishRoundedIcon from '@mui/icons-material/PublishRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CancelRoundedIcon from '@mui/icons-material/CancelRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded';
import type {
  TradingScriptBacktestSummary,
  TradingScriptCompileResponse,
  TradingScriptStatus,
  TradingScriptVersion,
} from '../../api/admin';
import { formatDateTime } from '../AppShellShared';

const STATUS_TONE: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  DRAFT: 'default',
  COMPILED: 'info',
  PAPER_READY: 'warning',
  LIVE_READY: 'success',
  ARCHIVED: 'default',
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  COMPILED: 'Compiled',
  PAPER_READY: 'Paper Ready',
  LIVE_READY: 'Live Ready',
  ARCHIVED: 'Archived',
};

const formatMoney = (value?: number) =>
  value == null ? '—' : new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value);

const formatPercent = (value?: number) => (value == null ? '—' : `${value.toFixed(1)}%`);

const compileTone = (compile?: TradingScriptCompileResponse | null): 'default' | 'success' | 'warning' | 'error' => {
  if (!compile) return 'default';
  if (compile.valid) return 'success';
  if (compile.diagnostics.some((item) => item.severity?.toLowerCase() === 'error')) return 'error';
  return 'warning';
};

const EligibilityRow = ({ label, met, detail }: { label: string; met: boolean; detail?: string }) => (
  <Stack direction="row" alignItems="flex-start" spacing={1}>
    {met
      ? <CheckCircleRoundedIcon color="success" sx={{ fontSize: 18, mt: 0.1, flexShrink: 0 }} />
      : <CancelRoundedIcon color="error" sx={{ fontSize: 18, mt: 0.1, flexShrink: 0 }} />}
    <Stack>
      <Typography variant="caption" fontWeight={600} color={met ? 'success.main' : 'error.main'}>
        {label}
      </Typography>
      {detail && (
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
          {detail}
        </Typography>
      )}
    </Stack>
  </Stack>
);

export const TradingScriptsLifecyclePanel = ({
  activeTab,
  setActiveTab,
  versions,
  selectedVersion,
  onLoadVersion,
  backtest,
  compile,
  status,
  publishing,
  onPublish,
}: {
  activeTab: number;
  setActiveTab: (value: number) => void;
  versions: TradingScriptVersion[];
  selectedVersion: number | null;
  onLoadVersion: (version: number) => void;
  backtest: TradingScriptBacktestSummary | null;
  compile: TradingScriptCompileResponse | null;
  status: TradingScriptStatus | 'DRAFT';
  publishing: boolean;
  onPublish: (target: 'PAPER_READY' | 'LIVE_READY') => void;
}) => {
  const pnlPositive = (backtest?.totalPnl ?? 0) >= 0;
  const accuracy = backtest?.realWorldAccuracyPct ?? 0;
  const winCount = backtest?.winTrades ?? 0;
  const lossCount = backtest?.lossTrades ?? 0;
  const totalTrades = (winCount + lossCount) || 1;

  const paperGates = [
    { label: 'Compile succeeded', met: compile?.compileStatus === 'SUCCESS', detail: `Status: ${compile?.compileStatus ?? 'PENDING'}` },
    { label: 'Backtest run with results', met: backtest != null, detail: backtest ? `${backtest.executedTrades ?? 0} trades executed` : 'Run backtest to unlock' },
    { label: 'Paper eligible (strategy type)', met: compile?.paperEligible === true, detail: compile?.paperEligible ? 'Strategy type supports paper mode' : 'Intraday strategy required' },
  ];

  const liveGates = [
    ...paperGates,
    { label: 'Promoted to Paper Ready', met: status === 'PAPER_READY' || status === 'LIVE_READY', detail: `Current status: ${STATUS_LABEL[status] ?? status}` },
    { label: 'Live eligible (timeframe + scope)', met: compile?.liveEligible === true, detail: compile?.liveEligible ? 'Minute timeframe + OPTIONS_ONLY scope confirmed' : 'Requires minute timeframe and options-only scope' },
  ];

  return (
    <Card>
      <CardContent sx={{ p: '12px !important' }}>
        <Tabs
          value={activeTab}
          onChange={(_, nextValue) => setActiveTab(nextValue)}
          sx={{ minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0, fontSize: '0.78rem' } }}
        >
          <Tab icon={<HistoryRoundedIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="History" />
          <Tab icon={<AssessmentRoundedIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Backtest" />
          <Tab icon={<RocketLaunchRoundedIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Publish" />
        </Tabs>
        <Divider sx={{ mb: 1.5 }} />

        {/* ── Version History ── */}
        {activeTab === 0 && (
          <Stack spacing={1}>
            {versions.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                Save or load a script to inspect version history.
              </Typography>
            )}
            {versions.map((version) => {
              const tone = compileTone(version.compile);
              const isLoaded = selectedVersion === version.version;
              return (
                <Paper
                  key={version.id}
                  variant="outlined"
                  sx={{
                    p: 1,
                    borderRadius: 1.5,
                    borderColor: isLoaded ? 'primary.main' : undefined,
                    bgcolor: isLoaded ? 'primary.50' : undefined,
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                    <Stack spacing={0.25}>
                      <Stack direction="row" alignItems="center" spacing={0.75}>
                        <Typography variant="caption" fontWeight={700}>
                          v{version.version}
                        </Typography>
                        {isLoaded && (
                          <Chip size="small" label="Loaded" color="primary" sx={{ height: 16, fontSize: '0.6rem' }} />
                        )}
                        <Chip size="small" label={version.compile.compileStatus} color={tone} variant={tone === 'success' ? 'filled' : 'outlined'} sx={{ height: 16, fontSize: '0.6rem' }} />
                      </Stack>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                        Created {version.createdAt ? formatDateTime(version.createdAt) : '—'}
                      </Typography>
                      {version.compiledAt && (
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                          Compiled {formatDateTime(version.compiledAt)}
                        </Typography>
                      )}
                    </Stack>
                    <Tooltip title={isLoaded ? 'Already loaded' : 'Load this version into the editor'}>
                      <span>
                        <Button
                          size="small"
                          variant={isLoaded ? 'contained' : 'outlined'}
                          disabled={isLoaded}
                          onClick={() => onLoadVersion(version.version)}
                          sx={{ minWidth: 60, py: 0.25 }}
                        >
                          {isLoaded ? 'Active' : 'Load'}
                        </Button>
                      </span>
                    </Tooltip>
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        )}

        {/* ── Backtest Summary ── */}
        {activeTab === 1 && (
          <Stack spacing={1.5}>
            {!backtest && (
              <Alert severity="info" sx={{ py: 0.5 }}>
                Run a backtest to populate real-data performance metrics for this compiled version.
              </Alert>
            )}

            {backtest && (
              <>
                {/* P&L headline */}
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    bgcolor: pnlPositive ? '#f1f8e9' : '#ffebee',
                    borderColor: pnlPositive ? '#81c784' : '#e57373',
                    borderRadius: 2,
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={1}>
                    {pnlPositive
                      ? <TrendingUpRoundedIcon color="success" />
                      : <TrendingDownRoundedIcon color="error" />}
                    <Stack>
                      <Typography variant="caption" color="text.secondary">Total P&L</Typography>
                      <Typography
                        variant="h5"
                        fontWeight={800}
                        color={pnlPositive ? 'success.dark' : 'error.dark'}
                      >
                        ₹{formatMoney(backtest.totalPnl)}
                      </Typography>
                    </Stack>
                    {backtest.averagePnl != null && (
                      <Stack sx={{ ml: 'auto' }}>
                        <Typography variant="caption" color="text.secondary">Avg P&L / trade</Typography>
                        <Typography variant="body1" fontWeight={700} color={backtest.averagePnl >= 0 ? 'success.main' : 'error.main'}>
                          ₹{formatMoney(backtest.averagePnl)}
                        </Typography>
                      </Stack>
                    )}
                  </Stack>
                </Paper>

                {/* Win / Loss bar */}
                <Stack spacing={0.5}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="caption" fontWeight={700}>Win Rate</Typography>
                    <Typography variant="caption" fontWeight={700} color={accuracy >= 55 ? 'success.main' : accuracy >= 40 ? 'warning.main' : 'error.main'}>
                      {formatPercent(accuracy)}
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(100, accuracy)}
                    color={accuracy >= 55 ? 'success' : accuracy >= 40 ? 'warning' : 'error'}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="caption" color="success.main">{winCount} wins</Typography>
                    <Typography variant="caption" color="error.main">{lossCount} losses</Typography>
                  </Stack>
                </Stack>

                {/* Win / Loss visual bar */}
                <Box sx={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                  <Box sx={{ flex: winCount / totalTrades, bgcolor: 'success.main', minWidth: winCount ? 4 : 0 }} />
                  <Box sx={{ flex: lossCount / totalTrades, bgcolor: 'error.main', minWidth: lossCount ? 4 : 0 }} />
                </Box>

                {/* Metrics grid */}
                <Stack direction="row" flexWrap="wrap" spacing={1} useFlexGap>
                  {[
                    ['Trades', String(backtest.executedTrades ?? '—')],
                    ['Wins', String(backtest.winTrades ?? '—')],
                    ['Losses', String(backtest.lossTrades ?? '—')],
                    ['Mkt priced', String(backtest.marketPricedTrades ?? '—')],
                    ['Fallback', String(backtest.fallbackPricedTrades ?? '—')],
                  ].map(([label, value]) => (
                    <Paper key={label} variant="outlined" sx={{ p: 1, flex: '1 1 80px', textAlign: 'center', borderRadius: 1.5 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>{label}</Typography>
                      <Typography variant="body2" fontWeight={700}>{value}</Typography>
                    </Paper>
                  ))}
                </Stack>

                {/* Notes */}
                {backtest.notes?.length ? (
                  <Paper variant="outlined" sx={{ p: 1, bgcolor: '#fffde7', borderColor: '#f9a825' }}>
                    <Typography variant="caption" fontWeight={700} color="warning.dark">Backtest Notes</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                      {backtest.notes.join(' · ')}
                    </Typography>
                  </Paper>
                ) : null}
              </>
            )}
          </Stack>
        )}

        {/* ── Publish State ── */}
        {activeTab === 2 && (
          <Stack spacing={1.5}>
            {/* Current state badge */}
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="caption" fontWeight={700} color="text.secondary">Current state:</Typography>
              <Chip label={STATUS_LABEL[status] ?? status} color={STATUS_TONE[status]} size="small" />
            </Stack>

            <Divider />

            {/* Paper gates */}
            <Stack spacing={0.75}>
              <Typography variant="caption" fontWeight={800} color="text.primary">
                Paper Ready — Prerequisites
              </Typography>
              {paperGates.map((gate) => (
                <EligibilityRow key={gate.label} label={gate.label} met={gate.met} detail={gate.detail} />
              ))}
              <Button
                variant="outlined"
                size="small"
                startIcon={<PublishRoundedIcon />}
                disabled={publishing || !paperGates.every((g) => g.met)}
                onClick={() => onPublish('PAPER_READY')}
                color="warning"
                sx={{ alignSelf: 'flex-start', mt: 0.5 }}
              >
                {publishing ? 'Publishing…' : 'Publish Paper Ready'}
              </Button>
            </Stack>

            <Divider />

            {/* Live gates */}
            <Stack spacing={0.75}>
              <Typography variant="caption" fontWeight={800} color="text.primary">
                Live Ready — Prerequisites
              </Typography>
              {liveGates.map((gate) => (
                <EligibilityRow key={gate.label} label={gate.label} met={gate.met} detail={gate.detail} />
              ))}
              <Tooltip
                title={!liveGates.every((g) => g.met) ? 'All prerequisites must be satisfied before going live' : ''}
                placement="top"
              >
                <span style={{ alignSelf: 'flex-start' }}>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<RocketLaunchRoundedIcon />}
                    disabled={publishing || !liveGates.every((g) => g.met)}
                    onClick={() => onPublish('LIVE_READY')}
                    color="success"
                    sx={{ mt: 0.5 }}
                  >
                    {publishing ? 'Publishing…' : 'Publish Live Ready'}
                  </Button>
                </span>
              </Tooltip>
            </Stack>

            <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.68rem' }}>
              Live publish is gated behind compile success, backtest results, paper promotion, intraday minute timeframe, and options-only scope.
            </Typography>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};
