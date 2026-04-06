import {
  Box,
  Button,
  Card,
  CardContent,
  Collapse,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded';
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import { useState } from 'react';
import type { BacktestResultRow, BacktestRunResponse } from '../api/admin';
import {
  MetricCard,
  ResultRow,
  formatPnlNumber,
  getPnlColor,
} from './BacktestPanelShared';

export interface BacktestResultsPanelProps {
  results: BacktestResultRow[];
  summary: BacktestRunResponse | null;
  strategyName: string;
  startDate: string;
  endDate: string;
}

export const BacktestResultsPanel = ({
  results,
  summary,
  strategyName,
  startDate,
  endDate,
}: BacktestResultsPanelProps) => {
  const [showNotes, setShowNotes] = useState(true);

  const pnlTotal = results.reduce((net, row) => net + Number(row.pnlAmount ?? 0), 0);
  const totalGain = results.reduce((t, row) => t + Math.max(Number(row.pnlAmount ?? 0), 0), 0);
  const totalLoss = results.reduce((t, row) => t + Math.abs(Math.min(Number(row.pnlAmount ?? 0), 0)), 0);
  const winCount = results.filter((row) => Number(row.pnlAmount ?? 0) > 0).length;
  const lossCount = results.filter((row) => Number(row.pnlAmount ?? 0) < 0).length;
  const winRate = results.length > 0 ? (winCount / results.length) * 100 : 0;
  const avgPnl = results.length > 0 ? pnlTotal / results.length : 0;
  const maxWin = results.length > 0 ? Math.max(...results.map((r) => Number(r.pnlAmount ?? 0))) : 0;
  const maxLoss = results.length > 0 ? Math.min(...results.map((r) => Number(r.pnlAmount ?? 0))) : 0;
  const profitFactor = totalLoss > 0 ? totalGain / totalLoss : totalGain > 0 ? Infinity : 0;

  const exportResultsToCsv = () => {
    if (!results.length) return;
    const header = ['Date', 'Expiry', 'Entry Time', 'Entry Price', 'Exit Time', 'Exit Price', 'P&L', 'Summary'];
    const rows = results.map((row) => [
      row.tradeDate ?? '',
      row.expiryLabel ?? '',
      row.entryTs ?? '',
      formatPnlNumber(row.entryUnderlyingPrice),
      row.exitTs ?? '',
      formatPnlNumber(row.exitUnderlyingPrice),
      formatPnlNumber(row.pnlAmount),
      `"${(row.legsSummary ?? '').replace(/"/g, '""')}"`,
    ]);
    const csv = [header, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backtest_${strategyName.replace(/\s+/g, '_')}_${startDate}_to_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!summary && results.length === 0) return null;

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          {/* Metric Cards */}
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="stretch">
            <MetricCard
              label="Total P&L"
              value={`₹ ${formatPnlNumber(pnlTotal)}`}
              valueColor={getPnlColor(pnlTotal)}
              sub={`Trades ${results.length}`}
              icon={pnlTotal >= 0
                ? <TrendingUpRoundedIcon sx={{ fontSize: 14, color: '#2e7d32' }} />
                : <TrendingDownRoundedIcon sx={{ fontSize: 14, color: '#c62828' }} />
              }
            />
            <MetricCard
              label="Win Rate"
              value={`${winRate.toFixed(1)}%`}
              valueColor={winRate >= 50 ? '#2e7d32' : '#e65100'}
              sub={`${winCount}W / ${lossCount}L`}
            />
            <MetricCard
              label="Avg / Trade"
              value={`₹ ${formatPnlNumber(avgPnl)}`}
              valueColor={getPnlColor(avgPnl)}
            />
            <MetricCard
              label="Max Win"
              value={`₹ ${formatPnlNumber(maxWin)}`}
              valueColor="#2e7d32"
            />
            <MetricCard
              label="Max Loss"
              value={`₹ ${formatPnlNumber(maxLoss)}`}
              valueColor="#c62828"
            />
            <MetricCard
              label="Total Gain"
              value={`₹ ${formatPnlNumber(totalGain)}`}
              valueColor="#2e7d32"
            />
            <MetricCard
              label="Total Loss"
              value={`₹ ${formatPnlNumber(totalLoss)}`}
              valueColor="#c62828"
            />
            <MetricCard
              label="Profit Factor"
              value={profitFactor === Infinity ? '∞' : profitFactor.toFixed(2)}
              valueColor={profitFactor >= 1.5 ? '#2e7d32' : profitFactor >= 1 ? '#e65100' : '#c62828'}
              sub="Gain ÷ Loss ratio"
            />
            {summary && (
              <MetricCard
                label="Data Accuracy"
                value={`${formatPnlNumber(summary.realWorldAccuracyPct)}%`}
                sub={`${summary.fallbackPricedTrades ?? 0} fallback trades`}
              />
            )}
          </Stack>

          {/* Win rate bar */}
          {results.length > 0 && (
            <Box>
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                <Typography variant="caption" color="success.main" fontWeight={600}>Wins {winCount}</Typography>
                <Typography variant="caption" color="error.main" fontWeight={600}>Losses {lossCount}</Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={winRate}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  bgcolor: '#ffcdd2',
                  '& .MuiLinearProgress-bar': { bgcolor: '#2e7d32', borderRadius: 4 },
                }}
              />
            </Box>
          )}

          {/* Results table header with export */}
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle2" fontWeight={700} color="text.secondary">
              Trade Log ({results.length} trades)
            </Typography>
            <Tooltip title="Export P&L to CSV">
              <span>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<FileDownloadRoundedIcon sx={{ fontSize: '1rem !important' }} />}
                  onClick={exportResultsToCsv}
                  disabled={!results.length}
                  sx={{ fontSize: '0.72rem', py: 0.25, px: 1 }}
                >
                  Export CSV
                </Button>
              </span>
            </Tooltip>
          </Stack>
          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 440 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ '& th': { fontWeight: 700, fontSize: '0.72rem', bgcolor: '#f5f7fa', color: '#555' } }}>
                  <TableCell>Date</TableCell>
                  <TableCell>Expiry</TableCell>
                  <TableCell>Entry Time</TableCell>
                  <TableCell align="right">Entry ₹</TableCell>
                  <TableCell>Exit Time</TableCell>
                  <TableCell align="right">Exit ₹</TableCell>
                  <TableCell align="right">P&L</TableCell>
                  <TableCell>Legs (click to expand)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {results.map((row, index) => (
                  <ResultRow key={`${row.tradeDate}-${index}`} row={row} index={index} />
                ))}
                {!results.length && (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                      Run backtest to see P&L results
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Notes section */}
          {summary?.notes?.length ? (
            <Box>
              <Button
                size="small"
                variant="text"
                endIcon={showNotes ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
                onClick={() => setShowNotes((v) => !v)}
                sx={{ fontSize: '0.75rem', color: 'text.secondary' }}
              >
                {showNotes ? 'Hide' : 'Show'} {summary.notes.length} execution note{summary.notes.length !== 1 ? 's' : ''}
              </Button>
              <Collapse in={showNotes}>
                <Paper variant="outlined" sx={{ p: 1.5, mt: 0.5, bgcolor: '#fffde7', borderColor: '#fff176', maxHeight: 200, overflow: 'auto' }}>
                  <Stack spacing={0.5}>
                    {summary.notes.map((note, i) => (
                      <Typography key={i} variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.72rem' }}>
                        • {note}
                      </Typography>
                    ))}
                  </Stack>
                </Paper>
              </Collapse>
            </Box>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
};
