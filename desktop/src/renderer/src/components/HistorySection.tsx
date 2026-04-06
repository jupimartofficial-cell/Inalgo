import {
  Alert,
  Box,
  Button,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
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
  TableSortLabel,
  TextField,
  Typography,
} from '@mui/material';

import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import BarChartRoundedIcon from '@mui/icons-material/BarChartRounded';
import CandlestickChartRoundedIcon from '@mui/icons-material/CandlestickChartRounded';
import FilterAltOffRoundedIcon from '@mui/icons-material/FilterAltOffRounded';
import FilterAltRoundedIcon from '@mui/icons-material/FilterAltRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';

import type { Candle } from '../api/admin';
import {
  HistorySectionCard,
  INSTRUMENTS,
  InstrumentBadge,
  TIMEFRAME_OPTIONS,
  TimeframeBadge,
  formatDateTime,
  type CandleSortKey,
  type SortDir,
} from './AppShellShared';
import { ProChartCanvas } from './ProChartCanvas';

// ─── Types ─────────────────────────────────────────────────────────────────────

const candleColumns: { key: CandleSortKey; label: string; align?: 'right' }[] = [
  { key: 'candleTs',   label: 'Timestamp' },
  { key: 'openPrice',  label: 'Open',   align: 'right' },
  { key: 'highPrice',  label: 'High',   align: 'right' },
  { key: 'lowPrice',   label: 'Low',    align: 'right' },
  { key: 'closePrice', label: 'Close',  align: 'right' },
  { key: 'volume',     label: 'Volume', align: 'right' },
];

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface HistorySectionProps {
  historyRows: Candle[];
  totalElements: number;
  totalPages: number;
  page: number;
  rowsPerPage: number;
  historyLoading: boolean;
  historyChartRows: Candle[];
  historyChartLoading: boolean;
  historyChartError: string;
  instrumentKey: string;
  historyUnit: string;
  historyInterval: string;
  from: string;
  to: string;
  sortBy: CandleSortKey;
  sortDirection: SortDir;
  filterApplied: boolean;
  historyFiltersCollapsed: boolean;
  historyChartCollapsed: boolean;
  selectedHistoryInstrument: { key: string; label: string; exchange: string } | undefined;
  selectedHistoryTimeframe: { unit: string; interval: number; label: string } | undefined;
  onInstrumentKeyChange: (value: string) => void;
  onHistoryUnitChange: (value: string) => void;
  onHistoryIntervalChange: (value: string) => void;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onApplyFilters: () => void;
  onClearFilters: () => void;
  onHistoryFiltersToggle: () => void;
  onHistoryChartToggle: () => void;
  onHistoryChartTimeframeChange: (unit: string, interval: number) => void;
  onSort: (column: CandleSortKey) => void;
  onPageChange: (page: number, rowsPerPage: number) => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export const HistorySection = ({
  historyRows,
  totalElements,
  totalPages,
  page,
  rowsPerPage,
  historyLoading,
  historyChartRows,
  historyChartLoading,
  historyChartError,
  instrumentKey,
  historyUnit,
  historyInterval,
  from,
  to,
  sortBy,
  sortDirection,
  filterApplied,
  historyFiltersCollapsed,
  historyChartCollapsed,
  selectedHistoryInstrument,
  selectedHistoryTimeframe,
  onInstrumentKeyChange,
  onHistoryUnitChange,
  onHistoryIntervalChange,
  onFromChange,
  onToChange,
  onApplyFilters,
  onClearFilters,
  onHistoryFiltersToggle,
  onHistoryChartToggle,
  onHistoryChartTimeframeChange,
  onSort,
  onPageChange,
}: HistorySectionProps) => (
  <Stack spacing={2.5}>
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1}>
      <Box>
        <Typography variant="h5" fontWeight={700}>Historical Data</Typography>
        <Typography variant="body2" color="text.secondary">
          Browse OHLCV candle data by instrument, timeframe, and date range
        </Typography>
      </Box>
      {historyRows.length > 0 && (
        <Chip
          icon={<AssessmentRoundedIcon />}
          label={`${totalElements.toLocaleString()} candles`}
          color="primary"
          variant="outlined"
        />
      )}
    </Stack>

    <HistorySectionCard
      title="Filters"
      icon={<FilterAltRoundedIcon sx={{ color: 'text.secondary', fontSize: 18 }} />}
      collapsed={historyFiltersCollapsed}
      onToggle={onHistoryFiltersToggle}
    >
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Stack spacing={2}>
          <Grid container spacing={1.5}>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Instrument</InputLabel>
                <Select value={instrumentKey} onChange={(e) => onInstrumentKeyChange(e.target.value)} label="Instrument">
                  <MenuItem value=""><em>All Instruments</em></MenuItem>
                  {INSTRUMENTS.map((inst) => (
                    <MenuItem key={inst.key} value={inst.key}>
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        <Chip label={inst.exchange} size="small" sx={{ height: 16, fontSize: '0.6rem', fontWeight: 700 }} />
                        <span>{inst.label}</span>
                      </Stack>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={4.5}>
              <TextField
                label="From"
                type="datetime-local"
                size="small"
                fullWidth
                value={from}
                onChange={(e) => onFromChange(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4.5}>
              <TextField
                label="To"
                type="datetime-local"
                size="small"
                fullWidth
                value={to}
                onChange={(e) => onToChange(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" gap={1}>
            <Button
              variant="contained"
              startIcon={historyLoading ? <CircularProgress size={14} color="inherit" /> : <SearchRoundedIcon />}
              onClick={onApplyFilters}
              disabled={historyLoading}
              sx={{ background: 'linear-gradient(135deg, #1a3a6b 0%, #2d5499 100%)' }}
            >
              Apply Filters
            </Button>
            {filterApplied && (
              <Button
                variant="outlined"
                color="inherit"
                startIcon={<FilterAltOffRoundedIcon />}
                onClick={onClearFilters}
                size="small"
              >
                Clear Filters
              </Button>
            )}
            <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5}>
              {TIMEFRAME_OPTIONS.map((tf) => (
                <Chip
                  key={`${tf.unit}-${tf.interval}`}
                  label={tf.label}
                  size="small"
                  clickable
                  variant={historyUnit === tf.unit && historyInterval === String(tf.interval) ? 'filled' : 'outlined'}
                  color={historyUnit === tf.unit && historyInterval === String(tf.interval) ? 'primary' : 'default'}
                  onClick={() => {
                    onHistoryUnitChange(tf.unit);
                    onHistoryIntervalChange(String(tf.interval));
                  }}
                />
              ))}
            </Stack>
          </Stack>
        </Stack>
      </CardContent>
    </HistorySectionCard>

    <HistorySectionCard
      title="Chart"
      icon={<CandlestickChartRoundedIcon sx={{ color: 'text.secondary', fontSize: 18 }} />}
      collapsed={historyChartCollapsed}
      onToggle={onHistoryChartToggle}
      extra={(
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" justifyContent="flex-end">
          {selectedHistoryInstrument && (
            <Chip size="small" label={selectedHistoryInstrument.label} variant="outlined" />
          )}
          {selectedHistoryTimeframe && (
            <Chip size="small" label={selectedHistoryTimeframe.label} color="primary" variant="outlined" />
          )}
        </Stack>
      )}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        {!filterApplied ? (
          <Alert severity="info" variant="outlined">
            Choose an instrument and timeframe, then click `Apply Filters` to load the chart and candle grid.
          </Alert>
        ) : !instrumentKey || !selectedHistoryTimeframe ? (
          <Alert severity="warning" variant="outlined">
            Select a single instrument and timeframe to render the Historical Data chart.
          </Alert>
        ) : (
          <ProChartCanvas
            key={`historical-data-chart-${instrumentKey}-${selectedHistoryTimeframe.unit}-${selectedHistoryTimeframe.interval}-${from}-${to}`}
            chartId="historical-data-chart"
            candles={historyChartRows}
            height={420}
            loading={historyChartLoading}
            error={historyChartError}
            instrumentKey={instrumentKey}
            timeframeUnit={selectedHistoryTimeframe.unit}
            timeframeInterval={selectedHistoryTimeframe.interval}
            timeframeOptions={TIMEFRAME_OPTIONS}
            onTimeframeChange={onHistoryChartTimeframeChange}
            defaultColorMode="light"
            defaultIndicators={{
              volume: true,
              ema: true,
              sma: false,
              vwap: false,
              bollinger: false,
              pivots: false,
              macd: false,
              rsi: false,
            }}
          />
        )}
      </CardContent>
    </HistorySectionCard>

    {/* Info bar */}
    {filterApplied && (
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={0.5}>
        <Typography variant="body2" color="text.secondary">
          {historyLoading ? (
            <CircularProgress size={12} sx={{ mr: 0.5 }} />
          ) : (
            <>
              {totalElements > 0
                ? `Showing ${historyRows.length.toLocaleString()} of ${totalElements.toLocaleString()} candles`
                : 'No candles found'}
              {totalPages > 1 ? ` · Page ${page + 1} of ${totalPages}` : ''}
            </>
          )}
        </Typography>
        {historyRows.length > 0 && (
          <Stack direction="row" spacing={0.5}>
            {instrumentKey && <Chip label={INSTRUMENTS.find((i) => i.key === instrumentKey)?.label ?? instrumentKey} size="small" onDelete={() => onInstrumentKeyChange('')} />}
            {historyUnit && historyInterval && (
              <Chip
                label={TIMEFRAME_OPTIONS.find((t) => t.unit === historyUnit && t.interval === Number(historyInterval))?.label ?? `${historyInterval} ${historyUnit}`}
                size="small"
                onDelete={() => { onHistoryUnitChange(''); onHistoryIntervalChange(''); }}
              />
            )}
          </Stack>
        )}
      </Stack>
    )}

    {/* Data grid */}
    {filterApplied && (
      <Paper sx={{ border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
        {historyLoading && <LinearProgress />}
        <TableContainer sx={{ maxHeight: 'calc(100vh - 420px)', minHeight: 200 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ minWidth: 160 }}>Instrument</TableCell>
                <TableCell sx={{ minWidth: 90 }}>Timeframe</TableCell>
                {candleColumns.map(({ key, label, align }) => (
                  <TableCell
                    key={key}
                    align={align}
                    sortDirection={sortBy === key ? sortDirection : false}
                    sx={{ minWidth: key === 'candleTs' ? 170 : key === 'volume' ? 110 : 90, whiteSpace: 'nowrap' }}
                  >
                    <TableSortLabel
                      active={sortBy === key}
                      direction={sortBy === key ? sortDirection : 'asc'}
                      onClick={() => onSort(key)}
                    >
                      {label}
                    </TableSortLabel>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {historyRows.length === 0 && !historyLoading ? (
                <TableRow>
                  <TableCell colSpan={candleColumns.length + 2} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                    No candles found for the selected filters
                  </TableCell>
                </TableRow>
              ) : (
                historyRows.map((row, idx) => {
                  const prevRow = historyRows[idx - 1];
                  const priceChange = prevRow ? Number(row.closePrice) - Number(prevRow.closePrice) : 0;
                  const isUp = priceChange >= 0;
                  return (
                    <TableRow
                      key={`${row.instrumentKey}-${row.timeframeUnit}-${row.timeframeInterval}-${row.candleTs}`}
                      sx={{
                        '&:nth-of-type(even)': { bgcolor: '#fafbfc' },
                        '&:hover': { bgcolor: '#f0f4ff !important' },
                      }}
                    >
                      <TableCell><InstrumentBadge instrumentKey={row.instrumentKey} /></TableCell>
                      <TableCell><TimeframeBadge unit={row.timeframeUnit} interval={row.timeframeInterval} /></TableCell>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace" fontSize="0.76rem" noWrap>
                          {formatDateTime(row.candleTs)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontFamily="monospace" fontSize="0.78rem">
                          {Number(row.openPrice).toFixed(2)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontFamily="monospace" fontSize="0.78rem" sx={{ color: 'success.dark', fontWeight: 600 }}>
                          {Number(row.highPrice).toFixed(2)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontFamily="monospace" fontSize="0.78rem" sx={{ color: 'error.dark', fontWeight: 600 }}>
                          {Number(row.lowPrice).toFixed(2)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          fontFamily="monospace"
                          fontSize="0.78rem"
                          fontWeight={700}
                          sx={{ color: idx === 0 ? 'text.primary' : isUp ? 'success.dark' : 'error.dark' }}
                        >
                          {Number(row.closePrice).toFixed(2)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color="text.secondary" fontFamily="monospace" fontSize="0.76rem">
                          {row.volume != null ? Number(row.volume).toLocaleString() : '—'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
        {totalElements > 0 && (
          <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
            <TablePagination
              component="div"
              count={totalElements}
              page={page}
              onPageChange={(_, newPage) => onPageChange(newPage, rowsPerPage)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => onPageChange(0, parseInt(e.target.value, 10))}
              rowsPerPageOptions={[10, 25, 50, 100, 200]}
              showFirstButton
              showLastButton
              sx={{ '& .MuiTablePagination-toolbar': { minHeight: 44 }, '& .MuiTablePagination-displayedRows': { fontSize: '0.78rem' } }}
            />
          </Box>
        )}
      </Paper>
    )}

    {!filterApplied && (
      <Paper sx={{ p: 6, textAlign: 'center', border: '2px dashed', borderColor: 'divider' }}>
        <BarChartRoundedIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
        <Typography variant="h6" color="text.secondary">Select filters to view candle data</Typography>
        <Typography variant="body2" color="text.secondary">
          Choose an instrument and timeframe, then click "Apply Filters"
        </Typography>
      </Paper>
    )}
  </Stack>
);
