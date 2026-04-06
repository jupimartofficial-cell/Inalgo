import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { useState } from 'react';
import {
  generateIntraStrategiesWithAi,
  type BacktestStrategyPayload,
  type IntraStrategyAiCandidate,
  type IntraStrategyAiGenerateResponse,
} from '../../api/admin';
import { PnlValue } from './IntraTradeShared';

const TEMPLATE_LABELS: Record<string, string> = {
  EMA_PULLBACK: 'EMA Pullback',
  ORB_BREAKOUT: 'ORB Breakout',
  GAP_CONTINUATION: 'Gap Continuation',
};

const CandidateCard = ({
  candidate,
  isRecommended,
  onLoad,
}: {
  candidate: IntraStrategyAiCandidate;
  isRecommended: boolean;
  onLoad: (strategy: BacktestStrategyPayload) => void;
}) => {
  const bt = candidate.backtest;
  const winPct = bt && bt.executedTrades && bt.executedTrades > 0
    ? Math.round(((bt.winTrades ?? 0) / bt.executedTrades) * 100)
    : null;

  return (
    <Box sx={{
      border: isRecommended ? '2px solid #2563eb' : '1px solid #e2e8f0',
      borderRadius: 2,
      p: 2,
      bgcolor: isRecommended ? '#eff6ff' : '#fff',
      position: 'relative',
    }}>
      {isRecommended && (
        <Chip
          label="AI Recommended"
          size="small"
          color="primary"
          icon={<AutoAwesomeRoundedIcon />}
          sx={{ position: 'absolute', top: -10, right: 12, fontWeight: 700, fontSize: '0.65rem' }}
        />
      )}
      <Stack spacing={1.5}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Stack spacing={0.5}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Chip size="small" label={`#${candidate.rank}`} variant="outlined" sx={{ fontWeight: 700 }} />
              <Typography variant="body2" fontWeight={800}>{candidate.strategyName}</Typography>
            </Stack>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
              <Chip
                size="small"
                label={TEMPLATE_LABELS[candidate.templateKey] ?? candidate.templateKey}
                sx={{ bgcolor: '#e0e7ff', color: '#3730a3', fontSize: '0.65rem', fontWeight: 700 }}
              />
              <Chip
                size="small"
                icon={candidate.direction === 'BULLISH'
                  ? <TrendingUpRoundedIcon style={{ fontSize: 12 }} />
                  : <TrendingDownRoundedIcon style={{ fontSize: 12 }} />}
                label={candidate.direction}
                sx={{
                  bgcolor: candidate.direction === 'BULLISH' ? '#dcfce7' : '#fee2e2',
                  color: candidate.direction === 'BULLISH' ? '#15803d' : '#b91c1c',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                }}
              />
              {candidate.trendConflict && (
                <Chip
                  size="small"
                  icon={<WarningAmberRoundedIcon style={{ fontSize: 12 }} />}
                  label="Trend Conflict"
                  sx={{ bgcolor: '#fef3c7', color: '#92400e', fontSize: '0.65rem', fontWeight: 700 }}
                />
              )}
            </Stack>
          </Stack>
          <Button size="small" variant={isRecommended ? 'contained' : 'outlined'} onClick={() => onLoad(candidate.strategy)}>
            Load
          </Button>
        </Stack>

        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
          {candidate.rationale}
        </Typography>

        {bt && (
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            <Stack spacing={0}>
              <Typography variant="caption" color="text.secondary">P&L</Typography>
              <PnlValue value={bt.totalPnl ?? null} />
            </Stack>
            <Stack spacing={0}>
              <Typography variant="caption" color="text.secondary">Trades</Typography>
              <Typography variant="body2" fontWeight={700}>{bt.executedTrades ?? 0}</Typography>
            </Stack>
            {winPct !== null && (
              <Stack spacing={0}>
                <Typography variant="caption" color="text.secondary">Win Rate</Typography>
                <Typography variant="body2" fontWeight={700} color={winPct >= 50 ? 'success.main' : 'error.main'}>{winPct}%</Typography>
              </Stack>
            )}
            {bt.realWorldAccuracyPct != null && (
              <Stack spacing={0}>
                <Typography variant="caption" color="text.secondary">Real Accuracy</Typography>
                <Typography variant="body2" fontWeight={700}>{Math.round(bt.realWorldAccuracyPct)}%</Typography>
              </Stack>
            )}
            {candidate.selectionScore != null && (
              <Stack spacing={0}>
                <Typography variant="caption" color="text.secondary">Score</Typography>
                <Typography variant="body2" fontWeight={700}>{Math.round(Number(candidate.selectionScore))}</Typography>
              </Stack>
            )}
          </Stack>
        )}

        {candidate.trendConflict && candidate.trendReason && (
          <Alert severity="warning" sx={{ py: 0.25, fontSize: '0.72rem' }}>{candidate.trendReason}</Alert>
        )}

        {candidate.validation && !candidate.validation.valid && candidate.validation.summaryErrors.length > 0 && (
          <Alert severity="error" sx={{ py: 0.25, fontSize: '0.72rem' }}>{candidate.validation.summaryErrors[0]}</Alert>
        )}
      </Stack>
    </Box>
  );
};

export const IntraAiGenerateDialog = ({
  open,
  token,
  tenantId,
  username,
  baseInstruments,
  baseTimeframes,
  onClose,
  onLoadStrategy,
}: {
  open: boolean;
  token: string;
  tenantId: string;
  username: string;
  baseInstruments: Array<{ key: string; label: string }>;
  baseTimeframes: Array<{ key: string; label: string; unit: string; interval: number }>;
  onClose: () => void;
  onLoadStrategy: (strategy: BacktestStrategyPayload, timeframeUnit: string, timeframeInterval: number) => void;
}) => {
  const [instrumentKey, setInstrumentKey] = useState('NSE_INDEX|Nifty Bank');
  const [timeframeKey, setTimeframeKey] = useState('minutes|5');
  const [candidateCount, setCandidateCount] = useState(3);
  const [lookbackDays, setLookbackDays] = useState(730);
  const [saveAsDrafts, setSaveAsDrafts] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IntraStrategyAiGenerateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedTimeframe = baseTimeframes.find((tf) => tf.key === timeframeKey) ?? baseTimeframes[0];

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await generateIntraStrategiesWithAi(tenantId, token, {
        username,
        instrumentKey,
        candidateCount,
        lookbackDays,
        timeframeUnit: selectedTimeframe?.unit ?? 'minutes',
        timeframeInterval: selectedTimeframe?.interval ?? 5,
        saveAsDrafts,
      });
      setResult(response);
    } catch (err) {
      setError((err as Error).message || 'AI generation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLoad = (strategy: BacktestStrategyPayload) => {
    onLoadStrategy(strategy, selectedTimeframe?.unit ?? 'minutes', selectedTimeframe?.interval ?? 5);
    onClose();
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  const trendColor = result?.latestTrendSignal === 'BUY'
    ? 'success'
    : result?.latestTrendSignal === 'SELL'
    ? 'error'
    : 'default';

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md" scroll="paper">
      <DialogTitle>
        <Stack direction="row" spacing={1} alignItems="center">
          <AutoAwesomeRoundedIcon color="primary" />
          <Typography variant="h6" fontWeight={800}>AI Strategy Generation</Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          Generates 2-3 complex intraday strategies using up to 2 years of BANKNIFTY analytics data, backtests each candidate, and recommends the best one based on market trend.
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2.5}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} flexWrap="wrap" useFlexGap>
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <Typography variant="caption" color="text.secondary" gutterBottom>Instrument</Typography>
              <Select value={instrumentKey} onChange={(e) => setInstrumentKey(e.target.value)} disabled={loading}>
                {baseInstruments.map((opt) => (
                  <MenuItem key={opt.key} value={opt.key}>{opt.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <Typography variant="caption" color="text.secondary" gutterBottom>Timeframe</Typography>
              <Select value={timeframeKey} onChange={(e) => setTimeframeKey(e.target.value)} disabled={loading}>
                {baseTimeframes.map((opt) => (
                  <MenuItem key={opt.key} value={opt.key}>{opt.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <Typography variant="caption" color="text.secondary" gutterBottom>Candidates</Typography>
              <Select value={candidateCount} onChange={(e) => setCandidateCount(Number(e.target.value))} disabled={loading}>
                <MenuItem value={2}>2 strategies</MenuItem>
                <MenuItem value={3}>3 strategies</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <Typography variant="caption" color="text.secondary" gutterBottom>Lookback Window</Typography>
              <Select value={lookbackDays} onChange={(e) => setLookbackDays(Number(e.target.value))} disabled={loading}>
                <MenuItem value={90}>3 months</MenuItem>
                <MenuItem value={180}>6 months</MenuItem>
                <MenuItem value={365}>1 year</MenuItem>
                <MenuItem value={730}>2 years</MenuItem>
              </Select>
            </FormControl>
          </Stack>

          <FormControlLabel
            control={(
              <Checkbox
                checked={saveAsDrafts}
                onChange={(e) => setSaveAsDrafts(e.target.checked)}
                disabled={loading}
                size="small"
              />
            )}
            label={<Typography variant="body2">Save generated strategies as drafts in library</Typography>}
          />

          {loading && (
            <Stack spacing={1} alignItems="center" sx={{ py: 3 }}>
              <CircularProgress size={32} />
              <Typography variant="body2" color="text.secondary">
                Calling OpenAI, backtesting candidates, scoring… this may take 30-90 seconds.
              </Typography>
              <LinearProgress sx={{ width: '100%', borderRadius: 1 }} />
            </Stack>
          )}

          {error && (
            <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>
          )}

          {result && (
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Chip
                  size="small"
                  icon={result.latestTrendSignal === 'BUY'
                    ? <TrendingUpRoundedIcon style={{ fontSize: 14 }} />
                    : result.latestTrendSignal === 'SELL'
                    ? <TrendingDownRoundedIcon style={{ fontSize: 14 }} />
                    : <CheckCircleRoundedIcon style={{ fontSize: 14 }} />}
                  label={`Trend: ${result.latestTrendSignal}`}
                  color={trendColor}
                  sx={{ fontWeight: 700 }}
                />
                <Chip
                  size="small"
                  label={`Source: ${result.generationSource}`}
                  variant="outlined"
                  sx={{ fontSize: '0.65rem' }}
                />
                <Chip
                  size="small"
                  label={`Lookback: ${result.lookbackFromDate} → ${result.lookbackToDate}`}
                  variant="outlined"
                  sx={{ fontSize: '0.65rem' }}
                />
              </Stack>

              <Alert severity="warning" icon={<WarningAmberRoundedIcon fontSize="inherit" />} sx={{ fontSize: '0.75rem', py: 0.5 }}>
                {result.disclaimer}
              </Alert>

              <Divider />

              <Typography variant="subtitle2" fontWeight={800}>
                {result.candidates.length} Strategy Candidate{result.candidates.length !== 1 ? 's' : ''}
                {result.recommendedRank != null && ` — #${result.recommendedRank} recommended`}
              </Typography>

              <Stack spacing={1.5}>
                {result.candidates.map((candidate) => (
                  <CandidateCard
                    key={candidate.rank}
                    candidate={candidate}
                    isRecommended={candidate.rank === result.recommendedRank}
                    onLoad={handleLoad}
                  />
                ))}
              </Stack>
            </Stack>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} disabled={loading}>Close</Button>
        <Button
          variant="contained"
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeRoundedIcon />}
          onClick={() => void handleGenerate()}
          disabled={loading}
        >
          {loading ? 'Generating…' : 'Generate Strategies'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
