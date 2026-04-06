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
import type { TradingSignalRow } from '../api/admin';
import {
  TRADING_SIGNAL_DIRECTION_OPTIONS,
  TRADING_SIGNAL_TIMEFRAME_OPTIONS,
  formatDateTime,
  formatNumber,
  oneMonthAgo,
  oneWeekAgo,
  threeMonthsAgo,
  todayInputDate,
  type InstrumentOption,
  type TradingSignalFilters,
} from './BacktestPanelShared';

export interface BacktestTradingSignalViewProps {
  rows: TradingSignalRow[];
  totalElements: number;
  page: number;
  rowsPerPage: number;
  loading: boolean;
  filterDraft: TradingSignalFilters;
  instrumentFilterOptions: InstrumentOption[];
  baseInstruments: InstrumentOption[];
  onFilterDraftChange: (updater: (current: TradingSignalFilters) => TradingSignalFilters) => void;
  onApplyFilters: () => void;
  onResetFilters: () => void;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rowsPerPage: number) => void;
}

export const BacktestTradingSignalView = ({
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
}: BacktestTradingSignalViewProps) => {
  return (
    <Card>
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack spacing={0}>
              <Typography variant="h6" fontWeight={700}>Trading Signal</Typography>
              <Typography variant="caption" color="text.secondary">BUY / SELL / HOLD signals used by the Advance Conditions engine</Typography>
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
                <Grid item xs={12} sm={6} md={3}>
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
                <Grid item xs={12} sm={6} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Timeframe</InputLabel>
                    <Select
                      label="Timeframe"
                      value={filterDraft.timeframeKey}
                      inputProps={{ 'aria-label': 'Timeframe' }}
                      onChange={(e) => onFilterDraftChange((c) => ({ ...c, timeframeKey: e.target.value }))}
                    >
                      {TRADING_SIGNAL_TIMEFRAME_OPTIONS.map((t) => (
                        <MenuItem key={t.key || 'all'} value={t.key}>{t.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6} sm={3} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Signal</InputLabel>
                    <Select
                      label="Signal"
                      value={filterDraft.signal}
                      inputProps={{ 'aria-label': 'Signal' }}
                      onChange={(e) => onFilterDraftChange((c) => ({ ...c, signal: e.target.value }))}
                    >
                      {TRADING_SIGNAL_DIRECTION_OPTIONS.map((d) => (
                        <MenuItem key={d.key || 'all'} value={d.key}>{d.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6} sm={3} md={2}>
                  <TextField label="From Date" type="date" size="small" value={filterDraft.fromDate}
                    InputLabelProps={{ shrink: true }} fullWidth
                    onChange={(e) => onFilterDraftChange((c) => ({ ...c, fromDate: e.target.value }))} />
                </Grid>
                <Grid item xs={6} sm={3} md={2}>
                  <TextField label="To Date" type="date" size="small" value={filterDraft.toDate}
                    InputLabelProps={{ shrink: true }} fullWidth
                    onChange={(e) => onFilterDraftChange((c) => ({ ...c, toDate: e.target.value }))} />
                </Grid>
                <Grid item xs={6} sm={3} md={1}>
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
                  <TableCell>Timeframe</TableCell>
                  <TableCell align="right">Prev Close</TableCell>
                  <TableCell align="right">Cur Close</TableCell>
                  <TableCell align="right">DMA 9</TableCell>
                  <TableCell align="right">DMA 26</TableCell>
                  <TableCell align="right">DMA 110</TableCell>
                  <TableCell align="center">Signal</TableCell>
                  <TableCell align="center">First Candle Clr</TableCell>
                  <TableCell>Updated</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} hover sx={{ '& td': { py: 0.5 } }}>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.78rem' }}>{row.signalDate}</TableCell>
                    <TableCell sx={{ fontSize: '0.75rem' }}>{row.instrumentKey}</TableCell>
                    <TableCell sx={{ fontSize: '0.75rem' }}>{`${row.timeframeInterval} ${row.timeframeUnit}`}</TableCell>
                    <TableCell align="right" sx={{ fontSize: '0.75rem' }}>{formatNumber(row.previousClose)}</TableCell>
                    <TableCell align="right" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>{formatNumber(row.currentClose)}</TableCell>
                    <TableCell align="right" sx={{ fontSize: '0.75rem' }}>{formatNumber(row.dma9)}</TableCell>
                    <TableCell align="right" sx={{ fontSize: '0.75rem' }}>{formatNumber(row.dma26)}</TableCell>
                    <TableCell align="right" sx={{ fontSize: '0.75rem' }}>{formatNumber(row.dma110)}</TableCell>
                    <TableCell align="center">
                      <Chip
                        label={row.signal}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          bgcolor: row.signal === 'BUY' ? '#e8f5e9' : row.signal === 'SELL' ? '#ffebee' : '#f5f5f5',
                          color: row.signal === 'BUY' ? '#2e7d32' : row.signal === 'SELL' ? '#c62828' : '#555',
                        }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      {row.firstCandleColor ? (
                        <Chip
                          label={row.firstCandleColor}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            bgcolor: row.firstCandleColor === 'GREEN' ? '#e8f5e9' : '#ffebee',
                            color: row.firstCandleColor === 'GREEN' ? '#2e7d32' : '#c62828',
                          }}
                        />
                      ) : (
                        <Typography variant="caption" color="text.disabled">—</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.72rem', color: '#888' }}>{formatDateTime(row.updatedAt)}</TableCell>
                  </TableRow>
                ))}
                {loading && (
                  <TableRow><TableCell colSpan={11} align="center">Loading…</TableCell></TableRow>
                )}
                {!loading && !rows.length && (
                  <TableRow><TableCell colSpan={11} align="center" sx={{ py: 3, color: 'text.secondary' }}>No signals found for selected filters</TableCell></TableRow>
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
