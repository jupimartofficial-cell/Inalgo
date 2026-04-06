import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CancelRoundedIcon from '@mui/icons-material/CancelRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import { useCallback, useState } from 'react';
import { fetchTrendAccuracy } from '../../api/admin';
import type { DailyAccuracyRow, ScopeAccuracy, TrendAccuracyReport, WindowAccuracy } from '../../api/admin.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const pctColor = (pct: number) =>
  pct >= 65 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626';

const directionColor = (d: string) =>
  d === 'BULL' ? '#16a34a' : d === 'BEAR' ? '#dc2626' : '#64748b';

const fmt1 = (n: number | null | undefined) =>
  n == null ? '—' : `${n.toFixed(1)}%`;

const num = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const nullableNum = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const str = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const bool = (value: unknown): boolean => value === true;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value != null && typeof value === 'object';

function normalizeDailyRow(value: unknown): DailyAccuracyRow {
  const row = isRecord(value) ? value : {};
  return {
    tradeDate: str(row.tradeDate),
    predictedTrend: typeof row.predictedTrend === 'string' ? row.predictedTrend : null,
    aiPrediction: typeof row.aiPrediction === 'string' ? row.aiPrediction : null,
    avgConfidence: num(row.avgConfidence),
    snapCount: num(row.snapCount),
    startPrice: num(row.startPrice ?? row.prevClose),
    endPrice: num(row.endPrice ?? row.closePrice),
    changePct: num(row.changePct),
    actualDirection: str(row.actualDirection),
    trendCorrect: bool(row.trendCorrect),
    aiCorrect: bool(row.aiCorrect),
  };
}

function normalizeWindow(value: unknown, fallbackKey: string, fallbackLabel: string, fallbackPeriod: string): WindowAccuracy {
  const window = isRecord(value) ? value : {};
  const rows = Array.isArray(window.dailyRows) ? window.dailyRows.map(normalizeDailyRow) : [];
  return {
    windowKey: str(window.windowKey, fallbackKey),
    windowLabel: str(window.windowLabel, fallbackLabel),
    referencePeriod: str(window.referencePeriod, fallbackPeriod),
    snapshotDays: num(window.snapshotDays),
    totalDays: num(window.totalDays),
    trendCorrect: num(window.trendCorrect),
    trendAccuracyPct: num(window.trendAccuracyPct),
    aiCorrect: num(window.aiCorrect),
    aiAccuracyPct: num(window.aiAccuracyPct),
    trendBullPrecision: nullableNum(window.trendBullPrecision),
    trendBearPrecision: nullableNum(window.trendBearPrecision),
    aiBullPrecision: nullableNum(window.aiBullPrecision),
    aiBearPrecision: nullableNum(window.aiBearPrecision),
    dailyRows: rows,
  };
}

function normalizeScope(value: unknown, fallbackScope: string): ScopeAccuracy {
  const scope = isRecord(value) ? value : {};
  const rows = Array.isArray(scope.dailyRows) ? scope.dailyRows.map(normalizeDailyRow) : [];
  const fallbackWindows: Array<{ key: string; label: string; period: string }> = [
    { key: 'OPEN', label: 'Market Open', period: '09:15-09:30' },
    { key: 'MIDDLE', label: 'Market Middle', period: '11:30-14:30' },
    { key: 'CLOSE', label: 'Market Close', period: '14:30-15:30' },
  ];
  const windows = Array.isArray(scope.windows)
    ? scope.windows.map((window, index) =>
      normalizeWindow(
        window,
        fallbackWindows[index]?.key ?? 'WINDOW',
        fallbackWindows[index]?.label ?? 'Window',
        fallbackWindows[index]?.period ?? ''
      ))
    : [];
  return {
    scope: str(scope.scope, fallbackScope),
    benchmark: str(scope.benchmark, 'NSE_INDEX|Nifty 50'),
    snapshotDays: num(scope.snapshotDays),
    totalDays: num(scope.totalDays),
    trendCorrect: num(scope.trendCorrect),
    trendAccuracyPct: num(scope.trendAccuracyPct),
    aiCorrect: num(scope.aiCorrect),
    aiAccuracyPct: num(scope.aiAccuracyPct),
    trendBullPrecision: nullableNum(scope.trendBullPrecision),
    trendBearPrecision: nullableNum(scope.trendBearPrecision),
    aiBullPrecision: nullableNum(scope.aiBullPrecision),
    aiBearPrecision: nullableNum(scope.aiBearPrecision),
    dailyRows: rows,
    windows,
  };
}

function normalizeReport(value: unknown): TrendAccuracyReport | null {
  if (!isRecord(value)) return null;
  const indiaRaw = value.indiaNews ?? value.india ?? value.india_news;
  const globalRaw = value.globalNews ?? value.global ?? value.global_news;
  if (!indiaRaw || !globalRaw) return null;
  return {
    computedAt: str(value.computedAt ?? value.computed_at, new Date().toISOString()),
    lookbackDays: num(value.lookbackDays ?? value.lookback_days, 60),
    candleIntervalMinutes: num(value.candleIntervalMinutes ?? value.candle_interval_minutes, 15),
    indiaNews: normalizeScope(indiaRaw, 'INDIA_NEWS'),
    globalNews: normalizeScope(globalRaw, 'GLOBAL_NEWS'),
  };
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Box sx={{ textAlign: 'center', minWidth: 90 }}>
      <Typography sx={{ fontSize: 8.5, color: 'text.disabled', textTransform: 'uppercase', mb: 0.25 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 18, fontWeight: 800, lineHeight: 1.1, fontFeatureSettings: '"tnum"' }}>
        {value}
      </Typography>
      {sub && (
        <Typography sx={{ fontSize: 9, color: 'text.secondary', mt: 0.25 }}>{sub}</Typography>
      )}
    </Box>
  );
}

// ─── Scope accuracy summary ───────────────────────────────────────────────────

const MIN_RELIABLE_DAYS = 5;

function WindowStats({ window }: { window: WindowAccuracy }) {
  const [expanded, setExpanded] = useState(false);
  const trendAccuracyPct = num(window?.trendAccuracyPct);
  const aiAccuracyPct = num(window?.aiAccuracyPct);
  const totalDays = num(window?.totalDays);
  const snapshotDays = num(window?.snapshotDays);
  const trendCorrect = num(window?.trendCorrect);
  const aiCorrect = num(window?.aiCorrect);
  const rows = Array.isArray(window?.dailyRows) ? window.dailyRows : [];
  const isDataSparse = totalDays < MIN_RELIABLE_DAYS;
  const unmatchedDays = snapshotDays - totalDays;

  return (
    <Paper variant="outlined" sx={{ borderRadius: 1.5, overflow: 'hidden' }}>
      {/* Header */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ px: 1.5, py: 0.875, bgcolor: 'grey.50', borderBottom: '1px solid', borderBottomColor: 'divider' }}
      >
        <AssessmentRoundedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
        <Typography sx={{ fontWeight: 700, fontSize: 11, flex: 1 }}>
          {window.windowLabel}
        </Typography>
        <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>
          reference: {window.referencePeriod} IST · {snapshotDays} snapshot days · {totalDays} matched
        </Typography>
      </Stack>

      {/* Sparse data notice */}
      {isDataSparse && (
        <Box sx={{ px: 1.5, py: 0.75, bgcolor: '#fffbeb', borderBottom: '1px solid', borderBottomColor: '#fde68a' }}>
          <Typography sx={{ fontSize: 9.5, color: '#92400e' }}>
            <strong>Collecting data</strong> — only {snapshotDays} snapshot day{snapshotDays !== 1 ? 's' : ''} collected so far
            {unmatchedDays > 0 ? ` (${unmatchedDays} currently have no benchmark Nifty candle match yet)` : ''}.
            Accuracy becomes meaningful after {MIN_RELIABLE_DAYS}+ matched trading days.
          </Typography>
        </Box>
      )}

      {/* KPI row */}
      <Stack direction="row" spacing={0} divider={<Divider orientation="vertical" flexItem />}
        sx={{ px: 2, py: 1.25 }}>
        <Box sx={{ flex: 1, textAlign: 'center' }}>
          <Typography sx={{ fontSize: 8.5, color: 'text.disabled', textTransform: 'uppercase', mb: 0.25 }}>
            Trend accuracy
          </Typography>
          <Typography sx={{ fontSize: 22, fontWeight: 800, color: pctColor(trendAccuracyPct), lineHeight: 1.1 }}>
            {trendAccuracyPct.toFixed(1)}%
          </Typography>
          <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>
            {trendCorrect} / {totalDays} matched days
          </Typography>
        </Box>

        <Box sx={{ flex: 1, textAlign: 'center' }}>
          <Typography sx={{ fontSize: 8.5, color: 'text.disabled', textTransform: 'uppercase', mb: 0.25 }}>
            AI trend accuracy
          </Typography>
          <Typography sx={{ fontSize: 22, fontWeight: 800, color: pctColor(aiAccuracyPct), lineHeight: 1.1 }}>
            {aiAccuracyPct.toFixed(1)}%
          </Typography>
          <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>
            {aiCorrect} / {totalDays} matched days
          </Typography>
        </Box>

        <Stack sx={{ flex: 1, px: 1 }} spacing={0.5} justifyContent="center">
          <Stack direction="row" justifyContent="space-between">
            <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>Trend Bull precision</Typography>
            <Typography sx={{ fontSize: 9, fontWeight: 700, color: pctColor(window.trendBullPrecision ?? 0) }}>
              {fmt1(window.trendBullPrecision)}
            </Typography>
          </Stack>
          <Stack direction="row" justifyContent="space-between">
            <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>Trend Bear precision</Typography>
            <Typography sx={{ fontSize: 9, fontWeight: 700, color: pctColor(window.trendBearPrecision ?? 0) }}>
              {fmt1(window.trendBearPrecision)}
            </Typography>
          </Stack>
          <Stack direction="row" justifyContent="space-between">
            <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>AI Bull precision</Typography>
            <Typography sx={{ fontSize: 9, fontWeight: 700, color: pctColor(window.aiBullPrecision ?? 0) }}>
              {fmt1(window.aiBullPrecision)}
            </Typography>
          </Stack>
          <Stack direction="row" justifyContent="space-between">
            <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>AI Bear precision</Typography>
            <Typography sx={{ fontSize: 9, fontWeight: 700, color: pctColor(window.aiBearPrecision ?? 0) }}>
              {fmt1(window.aiBearPrecision)}
            </Typography>
          </Stack>
        </Stack>
      </Stack>

      {/* Daily detail toggle */}
      <Box sx={{ px: 1.5, pb: 1 }}>
        <Button size="small" variant="text" sx={{ fontSize: 9, py: 0.25 }}
          onClick={() => setExpanded(e => !e)}>
          {expanded ? 'Hide daily breakdown' : `Show ${rows.length} daily rows`}
        </Button>

        {expanded && <DailyTable rows={rows} />}
      </Box>
    </Paper>
  );
}

function ScopeStats({ acc }: { acc: ScopeAccuracy }) {
  const benchmark = str(acc?.benchmark, 'NSE_INDEX|Nifty 50');
  const windows = Array.isArray(acc?.windows) ? acc.windows : [];
  return (
    <Stack spacing={1}>
      <Typography sx={{ fontWeight: 700, fontSize: 11 }}>
        {acc.scope === 'INDIA_NEWS' ? 'India News' : 'Global News'} · benchmark: {benchmark}
      </Typography>
      {windows.map((window) => (
        <WindowStats key={`${acc.scope}-${window.windowKey}`} window={window} />
      ))}
    </Stack>
  );
}

// ─── Daily breakdown table ────────────────────────────────────────────────────

function DailyTable({ rows }: { rows: DailyAccuracyRow[] }) {
  return (
    <Box sx={{ overflowX: 'auto', mt: 0.5 }}>
      <Table size="small" sx={{ fontSize: 9 }}>
        <TableHead>
          <TableRow sx={{ '& th': { fontSize: 8.5, fontWeight: 700, color: 'text.secondary', py: 0.5 } }}>
            <TableCell>Date</TableCell>
            <TableCell>Predicted</TableCell>
            <TableCell>AI</TableCell>
            <TableCell align="right">Conf %</TableCell>
            <TableCell align="right">Snaps</TableCell>
            <TableCell align="right">Start</TableCell>
            <TableCell align="right">End</TableCell>
            <TableCell align="right">Change %</TableCell>
            <TableCell>Actual</TableCell>
            <TableCell align="center">Trend ✓</TableCell>
            <TableCell align="center">AI ✓</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map(r => (
            <TableRow key={r.tradeDate}
              sx={{ '& td': { fontSize: 9, py: 0.375 }, bgcolor: r.trendCorrect && r.aiCorrect ? '#f0fdf4' : undefined }}>
              <TableCell sx={{ fontWeight: 600 }}>{r.tradeDate}</TableCell>
              <TableCell>
                <DirectionChip value={r.predictedTrend} />
              </TableCell>
              <TableCell>
                <DirectionChip value={r.aiPrediction} />
              </TableCell>
              <TableCell align="right">{r.avgConfidence}</TableCell>
              <TableCell align="right" sx={{ color: 'text.secondary' }}>{r.snapCount}</TableCell>
              <TableCell align="right" sx={{ fontFeatureSettings: '"tnum"' }}>
                {r.startPrice?.toFixed(2) ?? '—'}
              </TableCell>
              <TableCell align="right" sx={{ fontFeatureSettings: '"tnum"' }}>
                {r.endPrice?.toFixed(2) ?? '—'}
              </TableCell>
              <TableCell align="right"
                sx={{ color: (r.changePct ?? 0) >= 0 ? '#16a34a' : '#dc2626', fontWeight: 700, fontFeatureSettings: '"tnum"' }}>
                {r.changePct != null ? `${r.changePct >= 0 ? '+' : ''}${r.changePct.toFixed(2)}%` : '—'}
              </TableCell>
              <TableCell>
                <DirectionChip value={r.actualDirection} />
              </TableCell>
              <TableCell align="center">
                {r.trendCorrect
                  ? <CheckCircleRoundedIcon sx={{ fontSize: 13, color: '#16a34a' }} />
                  : <CancelRoundedIcon sx={{ fontSize: 13, color: '#dc2626' }} />}
              </TableCell>
              <TableCell align="center">
                {r.aiCorrect
                  ? <CheckCircleRoundedIcon sx={{ fontSize: 13, color: '#16a34a' }} />
                  : <CancelRoundedIcon sx={{ fontSize: 13, color: '#dc2626' }} />}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

function DirectionChip({ value }: { value: string | null | undefined }) {
  if (!value) return <Typography sx={{ fontSize: 9, color: 'text.disabled' }}>—</Typography>;
  return (
    <Chip label={value} size="small"
      sx={{
        height: 16,
        fontSize: 8.5,
        fontWeight: 700,
        bgcolor: `${directionColor(value)}18`,
        color: directionColor(value),
        '& .MuiChip-label': { px: 0.625 },
      }} />
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function MarketWatchAccuracyPanel({
  tenantId,
  token,
}: {
  tenantId: string;
  token: string;
}) {
  const [lookback, setLookback] = useState(60);
  const [candleInterval, setCandleInterval] = useState<5 | 15>(15);
  const [report, setReport] = useState<TrendAccuracyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (days: number, interval: 5 | 15) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTrendAccuracy(tenantId, token, days, interval);
      const normalized = normalizeReport(data);
      if (!normalized) {
        throw new Error('Accuracy response was empty or invalid. Please refresh and try again.');
      }
      setReport(normalized);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load accuracy report');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [tenantId, token]);

  return (
    <Stack spacing={1.5}>
      {/* Toolbar */}
      <Stack direction="row" alignItems="center" spacing={1}>
        <Typography sx={{ fontWeight: 700, fontSize: 12, flex: 1 }}>
          Trend Prediction Accuracy
        </Typography>
        <FormControl size="small" sx={{ minWidth: 110 }}>
          <Select value={lookback} onChange={e => setLookback(Number(e.target.value))}
            sx={{ fontSize: 11, height: 28 }}>
            <MenuItem value={30}>Last 30 days</MenuItem>
            <MenuItem value={60}>Last 60 days</MenuItem>
            <MenuItem value={90}>Last 90 days</MenuItem>
            <MenuItem value={180}>Last 180 days</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <Select value={candleInterval} onChange={e => setCandleInterval(Number(e.target.value) as 5 | 15)}
            sx={{ fontSize: 11, height: 28 }}>
            <MenuItem value={5}>5 min candle</MenuItem>
            <MenuItem value={15}>15 min candle</MenuItem>
          </Select>
        </FormControl>
        <Tooltip title="Compute accuracy">
          <Button variant="contained" size="small" startIcon={<RefreshRoundedIcon />}
            disabled={loading} onClick={() => load(lookback, candleInterval)}
            sx={{ height: 28, fontSize: 10 }}>
            {loading ? 'Loading…' : 'Run'}
          </Button>
        </Tooltip>
      </Stack>

      {/* Description */}
      <Typography sx={{ fontSize: 9.5, color: 'text.secondary' }}>
        Computes window-wise trend accuracy using dominant predictions within each period and benchmark Nifty movement
        from selected candle timeframe. Windows: Open (09:15-09:30), Middle (11:30-14:30), Close (14:30-15:30) IST.
      </Typography>

      {error && (
        <Typography sx={{ fontSize: 10, color: 'error.main' }}>{error}</Typography>
      )}

      {loading && (
        <Stack alignItems="center" py={3}>
          <CircularProgress size={24} />
        </Stack>
      )}

      {report && !loading && (
        <Stack spacing={1.5}>
          <Typography sx={{ fontSize: 9, color: 'text.disabled' }}>
            Computed at {new Date(report.computedAt).toLocaleTimeString()} · lookback {report.lookbackDays} days · candle {report.candleIntervalMinutes}m
          </Typography>
          <ScopeStats acc={report.indiaNews} />
          <ScopeStats acc={report.globalNews} />
        </Stack>
      )}

      {!report && !loading && !error && (
        <Typography sx={{ fontSize: 10, color: 'text.disabled', textAlign: 'center', py: 3 }}>
          Click Run to compute accuracy over the selected lookback window.
        </Typography>
      )}
    </Stack>
  );
}
