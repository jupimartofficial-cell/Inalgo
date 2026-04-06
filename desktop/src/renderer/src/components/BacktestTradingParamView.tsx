import {
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import type { TradingDayParamRow } from '../api/admin';
import {
  formatNumber,
  oneMonthAgo,
  oneWeekAgo,
  threeMonthsAgo,
  todayInputDate,
  type InstrumentOption,
  type TradingDayParamFilters,
} from './BacktestPanelShared';

export interface BacktestTradingParamViewProps {
  rows: TradingDayParamRow[];
  totalElements: number;
  page: number;
  rowsPerPage: number;
  loading: boolean;
  filterDraft: TradingDayParamFilters;
  instrumentFilterOptions: InstrumentOption[];
  baseInstruments: InstrumentOption[];
  onFilterDraftChange: (updater: (current: TradingDayParamFilters) => TradingDayParamFilters) => void;
  onApplyFilters: () => void;
  onResetFilters: () => void;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rowsPerPage: number) => void;
}

export const BacktestTradingParamView = ({
  rows,
  totalElements,
  page,
  rowsPerPage,
  loading,
  filterDraft,
  instrumentFilterOptions,
  baseInstruments: _baseInstruments,
  onFilterDraftChange,
  onApplyFilters,
  onResetFilters,
  onPageChange,
  onRowsPerPageChange,
}: BacktestTradingParamViewProps) => {
  const normalizeBooleanish = (value: unknown) => {
    if (value == null) return '—';
    const normalized = String(value).trim().toLowerCase();
    if (normalized === 'true' || normalized === 'yes') return 'Yes';
    if (normalized === 'false' || normalized === 'no') return 'No';
    return String(value);
  };

  return (
    <Card>
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack spacing={0}>
              <Typography variant="h6" fontWeight={700}>Trading Param</Typography>
              <Typography variant="caption" color="text.secondary">ORB, Gap, Open/Close data for each trade date</Typography>
            </Stack>
            <Chip label={loading ? 'Loading…' : `${totalElements} rows`} size="small" variant="outlined" />
          </Stack>

          <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Stack spacing={1.25}>
              {/* Quick date presets */}
              <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ minWidth: 44 }}>Quick:</Typography>
                {[
                  { label: 'Today', fromFn: todayInputDate, toFn: todayInputDate },
                  { label: '1W', fromFn: oneWeekAgo, toFn: todayInputDate },
                  { label: '1M', fromFn: oneMonthAgo, toFn: todayInputDate },
                  { label: '3M', fromFn: threeMonthsAgo, toFn: todayInputDate },
                ].map(({ label, fromFn, toFn }) => (
                  <Chip
                    key={label}
                    label={label}
                    size="small"
                    clickable
                    variant={filterDraft.toDate === todayInputDate() && filterDraft.fromDate === fromFn() ? 'filled' : 'outlined'}
                    color="primary"
                    onClick={() => onFilterDraftChange((c) => ({ ...c, fromDate: fromFn(), toDate: toFn() }))}
                    sx={{ fontSize: '0.72rem', height: 22 }}
                  />
                ))}
              </Stack>
              <Grid container spacing={1.5} alignItems="flex-end">
                <Grid item xs={12} sm={4} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Index</InputLabel>
                    <Select
                      label="Index"
                      value={filterDraft.instrumentKey}
                      inputProps={{ 'aria-label': 'Index' }}
                      onChange={(e) => onFilterDraftChange((c) => ({ ...c, instrumentKey: e.target.value }))}
                    >
                      {instrumentFilterOptions.map((i) => (
                        <MenuItem key={i.key || 'all'} value={i.key}>{i.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6} sm={3} md={3}>
                  <TextField label="From Date" type="date" size="small" value={filterDraft.fromDate}
                    InputLabelProps={{ shrink: true }} fullWidth
                    onChange={(e) => onFilterDraftChange((c) => ({ ...c, fromDate: e.target.value }))} />
                </Grid>
                <Grid item xs={6} sm={3} md={3}>
                  <TextField label="To Date" type="date" size="small" value={filterDraft.toDate}
                    InputLabelProps={{ shrink: true }} fullWidth
                    onChange={(e) => onFilterDraftChange((c) => ({ ...c, toDate: e.target.value }))} />
                </Grid>
                <Grid item xs={6} sm={2} md={3}>
                  <Stack direction="row" spacing={0.75}>
                    <Button size="small" variant="contained" onClick={onApplyFilters} fullWidth sx={{ minWidth: 64 }}>Apply Filters</Button>
                    <Button size="small" variant="outlined" onClick={onResetFilters} sx={{ minWidth: 56 }}>Reset Filters</Button>
                  </Stack>
                </Grid>
              </Grid>
            </Stack>
          </Paper>

          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 520 }}>
            <Table size="small" stickyHeader>
              <TableHead sx={{ '& th': { fontWeight: 700, fontSize: '0.72rem', bgcolor: '#f5f7fa', color: '#555' } }}>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Index</TableCell>
                  <TableCell align="right">ORB High</TableCell>
                  <TableCell align="right">ORB Low</TableCell>
                  <TableCell align="center">Breakout</TableCell>
                  <TableCell align="center">Breakdown</TableCell>
                  <TableCell align="right">Open</TableCell>
                  <TableCell align="right">Close</TableCell>
                  <TableCell align="right">Prev High</TableCell>
                  <TableCell align="right">Prev Low</TableCell>
                  <TableCell align="right">Prev Close</TableCell>
                  <TableCell align="right">Gap %</TableCell>
                  <TableCell>Gap Type</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} hover sx={{ '& td': { py: 0.5 } }}>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.78rem' }}>{row.tradeDate}</TableCell>
                    <TableCell sx={{ fontSize: '0.75rem' }}>{row.instrumentKey}</TableCell>
                    <TableCell align="right" sx={{ fontSize: '0.75rem', color: '#2e7d32', fontWeight: 500 }}>{formatNumber(row.orbHigh)}</TableCell>
                    <TableCell align="right" sx={{ fontSize: '0.75rem', color: '#c62828', fontWeight: 500 }}>{formatNumber(row.orbLow)}</TableCell>
                    <TableCell align="center" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>{normalizeBooleanish(row.orbBreakout)}</TableCell>
                    <TableCell align="center" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>{normalizeBooleanish(row.orbBreakdown)}</TableCell>
                    <TableCell align="right" sx={{ fontSize: '0.75rem' }}>{formatNumber(row.todayOpen)}</TableCell>
                    <TableCell align="right" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>{formatNumber(row.todayClose)}</TableCell>
                    <TableCell align="right" sx={{ fontSize: '0.75rem' }}>{formatNumber(row.prevHigh)}</TableCell>
                    <TableCell align="right" sx={{ fontSize: '0.75rem' }}>{formatNumber(row.prevLow)}</TableCell>
                    <TableCell align="right" sx={{ fontSize: '0.75rem' }}>{formatNumber(row.prevClose)}</TableCell>
                    <TableCell align="right" sx={{ fontSize: '0.75rem', fontWeight: 600, color: (row.gapPct ?? 0) >= 0 ? '#2e7d32' : '#c62828' }}>
                      {row.gapPct != null ? `${formatNumber(row.gapPct)}%` : '—'}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.75rem', fontWeight: 600 }}>{row.gapType ?? '—'}</TableCell>
                  </TableRow>
                ))}
                {loading && (
                  <TableRow><TableCell colSpan={13} align="center">Loading…</TableCell></TableRow>
                )}
                {!loading && !rows.length && (
                  <TableRow><TableCell colSpan={13} align="center" sx={{ py: 3, color: 'text.secondary' }}>No trading param rows found</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={totalElements}
            page={page}
            onPageChange={(_, p) => onPageChange(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => { onRowsPerPageChange(Number(e.target.value)); onPageChange(0); }}
            rowsPerPageOptions={[10, 25, 50, 100]}
            showFirstButton showLastButton
          />
        </Stack>
      </CardContent>
    </Card>
  );
};
