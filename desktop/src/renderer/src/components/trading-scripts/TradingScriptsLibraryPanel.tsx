import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import ArchiveRoundedIcon from '@mui/icons-material/ArchiveRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ClearRoundedIcon from '@mui/icons-material/ClearRounded';
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded';
import type { TradingScriptLibraryItem, TradingScriptSort, TradingScriptStatus } from '../../api/admin';
import { formatDateTime, TIMEFRAME_OPTIONS } from '../AppShellShared';

const STATUS_TONE: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  DRAFT: 'default',
  COMPILED: 'info',
  PAPER_READY: 'warning',
  LIVE_READY: 'success',
  ARCHIVED: 'default',
  PENDING: 'default',
  SUCCESS: 'success',
  FAILED: 'error',
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  COMPILED: 'Compiled',
  PAPER_READY: 'Paper Ready',
  LIVE_READY: 'Live Ready',
  ARCHIVED: 'Archived',
  PENDING: 'Pending',
  SUCCESS: 'Success',
  FAILED: 'Failed',
};

const formatMoney = (value?: number) =>
  value == null ? '—' : new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value);

const formatPercent = (value?: number) => (value == null ? '—' : `${value.toFixed(1)}%`);

export const TradingScriptsLibraryPanel = ({
  items,
  currentScriptId,
  loading,
  search,
  setSearch,
  status,
  setStatus,
  instrument,
  setInstrument,
  timeframe,
  setTimeframe,
  compileStatus,
  setCompileStatus,
  sort,
  setSort,
  baseInstruments,
  onRefresh,
  onLoad,
  onDuplicate,
  onArchive,
  onDelete,
}: {
  items: TradingScriptLibraryItem[];
  currentScriptId: number | null;
  loading: boolean;
  search: string;
  setSearch: (value: string) => void;
  status: TradingScriptStatus | '';
  setStatus: (value: TradingScriptStatus | '') => void;
  instrument: string;
  setInstrument: (value: string) => void;
  timeframe: string;
  setTimeframe: (value: string) => void;
  compileStatus: string;
  setCompileStatus: (value: string) => void;
  sort: TradingScriptSort;
  setSort: (value: TradingScriptSort) => void;
  baseInstruments: Array<{ key: string; label: string; exchange: string }>;
  onRefresh: () => void;
  onLoad: (item: TradingScriptLibraryItem) => void;
  onDuplicate: (item: TradingScriptLibraryItem) => void;
  onArchive: (item: TradingScriptLibraryItem) => void;
  onDelete: (item: TradingScriptLibraryItem) => void;
}) => {
  const hasFilters = !!(search || status || instrument || timeframe || compileStatus);

  const clearFilters = () => {
    setSearch('');
    setStatus('');
    setInstrument('');
    setTimeframe('');
    setCompileStatus('');
  };

  return (
    <Card sx={{ flex: { xl: '0 0 34%' }, minWidth: 0 }}>
      <CardContent sx={{ p: '14px !important' }}>
        <Stack spacing={1.25}>

          {/* Header */}
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="h6" fontWeight={700}>Script Library</Typography>
              {items.length > 0 && (
                <Chip
                  size="small"
                  label={`${items.length} script${items.length === 1 ? '' : 's'}`}
                  variant="outlined"
                  sx={{ height: 20, fontSize: '0.68rem' }}
                />
              )}
            </Stack>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              {hasFilters && (
                <Tooltip title="Clear all filters">
                  <IconButton size="small" onClick={clearFilters} color="warning">
                    <ClearRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="Refresh library">
                <span>
                  <IconButton size="small" onClick={onRefresh} disabled={loading}>
                    <RefreshRoundedIcon fontSize="small" sx={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          </Stack>

          {/* Search */}
          <TextField
            size="small"
            placeholder="Search scripts…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
              endAdornment: search ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearch('')}>
                    <ClearRoundedIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
          />

          {/* Filters row 1 */}
          <Stack direction="row" spacing={1}>
            <FormControl size="small" fullWidth>
              <InputLabel>Status</InputLabel>
              <Select label="Status" value={status} onChange={(event) => setStatus(event.target.value as TradingScriptStatus | '')}>
                <MenuItem value=""><em>All statuses</em></MenuItem>
                {(['DRAFT', 'COMPILED', 'PAPER_READY', 'LIVE_READY', 'ARCHIVED'] as const).map((item) => (
                  <MenuItem key={item} value={item}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Chip size="small" label={STATUS_LABEL[item]} color={STATUS_TONE[item]} sx={{ height: 18, fontSize: '0.68rem' }} />
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel>Compile</InputLabel>
              <Select label="Compile" value={compileStatus} onChange={(event) => setCompileStatus(event.target.value)}>
                <MenuItem value=""><em>All compile states</em></MenuItem>
                <MenuItem value="PENDING"><Chip size="small" label="Pending" sx={{ height: 18, fontSize: '0.68rem' }} /></MenuItem>
                <MenuItem value="SUCCESS"><Chip size="small" label="Success" color="success" sx={{ height: 18, fontSize: '0.68rem' }} /></MenuItem>
                <MenuItem value="FAILED"><Chip size="small" label="Failed" color="error" sx={{ height: 18, fontSize: '0.68rem' }} /></MenuItem>
              </Select>
            </FormControl>
          </Stack>

          {/* Filters row 2 */}
          <Stack direction="row" spacing={1}>
            <FormControl size="small" fullWidth>
              <InputLabel>Instrument</InputLabel>
              <Select label="Instrument" value={instrument} onChange={(event) => setInstrument(event.target.value)}>
                <MenuItem value=""><em>All instruments</em></MenuItem>
                {baseInstruments.map((item) => (
                  <MenuItem key={item.key} value={item.key}>
                    <Stack>
                      <Typography variant="body2">{item.label}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>{item.exchange}</Typography>
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel>Timeframe</InputLabel>
              <Select label="Timeframe" value={timeframe} onChange={(event) => setTimeframe(event.target.value)}>
                <MenuItem value=""><em>All timeframes</em></MenuItem>
                {TIMEFRAME_OPTIONS.map((item) => (
                  <MenuItem key={`${item.unit}|${item.interval}`} value={`${item.unit}|${item.interval}`}>
                    {item.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          {/* Sort */}
          <FormControl size="small" fullWidth>
            <InputLabel>Sort by</InputLabel>
            <Select label="Sort by" value={sort} onChange={(event) => setSort(event.target.value as TradingScriptSort)}>
              <MenuItem value="RECENT_EDITED">Recently Edited</MenuItem>
              <MenuItem value="NAME">Name (A → Z)</MenuItem>
              <MenuItem value="PERFORMANCE">Best Performance</MenuItem>
            </Select>
          </FormControl>

          {/* Active filter chips */}
          {hasFilters && (
            <Stack direction="row" flexWrap="wrap" spacing={0.5} useFlexGap>
              {search && <Chip size="small" label={`"${search}"`} onDelete={() => setSearch('')} />}
              {status && <Chip size="small" label={STATUS_LABEL[status] ?? status} color={STATUS_TONE[status]} onDelete={() => setStatus('')} />}
              {instrument && <Chip size="small" label={baseInstruments.find((i) => i.key === instrument)?.label ?? instrument} onDelete={() => setInstrument('')} />}
              {timeframe && <Chip size="small" label={TIMEFRAME_OPTIONS.find((i) => `${i.unit}|${i.interval}` === timeframe)?.label ?? timeframe} onDelete={() => setTimeframe('')} />}
              {compileStatus && <Chip size="small" label={STATUS_LABEL[compileStatus] ?? compileStatus} color={STATUS_TONE[compileStatus]} onDelete={() => setCompileStatus('')} />}
            </Stack>
          )}

          {/* Table */}
          <Paper variant="outlined" sx={{ overflow: 'hidden', borderRadius: 1.5 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#f8f9fa', fontSize: '0.72rem' }}>Script</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#f8f9fa', fontSize: '0.72rem' }}>State</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#f8f9fa', fontSize: '0.72rem' }}>P&L / Accuracy</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, bgcolor: '#f8f9fa', fontSize: '0.72rem' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => {
                  const isActive = currentScriptId === item.id;
                  const pnlPositive = (item.latestPerformancePnl ?? 0) >= 0;
                  return (
                    <TableRow
                      key={item.id}
                      hover
                      selected={isActive}
                      sx={{
                        bgcolor: isActive ? 'primary.50' : undefined,
                        '&.Mui-selected': { bgcolor: '#e3f2fd' },
                        '&.Mui-selected:hover': { bgcolor: '#bbdefb' },
                      }}
                    >
                      {/* Script name + meta */}
                      <TableCell sx={{ minWidth: 180 }}>
                        <Stack spacing={0.25}>
                          <Stack direction="row" alignItems="center" spacing={0.5}>
                            {isActive && (
                              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.main', flexShrink: 0 }} />
                            )}
                            <Button
                              variant="text"
                              size="small"
                              sx={{ justifyContent: 'flex-start', px: 0, py: 0, minHeight: 0, fontWeight: 700, fontSize: '0.78rem', lineHeight: 1.3 }}
                              onClick={() => onLoad(item)}
                            >
                              {item.scriptName}
                            </Button>
                          </Stack>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                            {baseInstruments.find((i) => i.key === item.instrumentKey)?.label ?? item.instrumentKey}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                            {item.timeframeInterval} {item.timeframeUnit} · v{item.version}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.62rem' }}>
                            {item.lastModifiedAt ? formatDateTime(item.lastModifiedAt) : '—'}
                          </Typography>
                        </Stack>
                      </TableCell>

                      {/* Status chips */}
                      <TableCell>
                        <Stack spacing={0.4}>
                          <Chip size="small" label={STATUS_LABEL[item.status] ?? item.status} color={STATUS_TONE[item.status]} sx={{ height: 18, fontSize: '0.65rem', fontWeight: 600 }} />
                          <Chip size="small" label={STATUS_LABEL[item.compileStatus] ?? item.compileStatus} color={STATUS_TONE[item.compileStatus]} variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
                        </Stack>
                      </TableCell>

                      {/* Performance */}
                      <TableCell>
                        {item.latestPerformancePnl != null ? (
                          <Stack spacing={0.25}>
                            <Stack direction="row" alignItems="center" spacing={0.25}>
                              {pnlPositive
                                ? <TrendingUpRoundedIcon sx={{ fontSize: 14, color: 'success.main' }} />
                                : <TrendingDownRoundedIcon sx={{ fontSize: 14, color: 'error.main' }} />}
                              <Typography
                                variant="caption"
                                fontWeight={700}
                                color={pnlPositive ? 'success.main' : 'error.main'}
                                sx={{ fontSize: '0.75rem' }}
                              >
                                ₹{formatMoney(item.latestPerformancePnl)}
                              </Typography>
                            </Stack>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                              {item.latestExecutedTrades ?? 0} trades
                            </Typography>
                            <Typography variant="caption" fontWeight={600} color={
                              (item.latestRealWorldAccuracyPct ?? 0) >= 55 ? 'success.main' :
                              (item.latestRealWorldAccuracyPct ?? 0) >= 40 ? 'warning.main' : 'error.main'
                            } sx={{ fontSize: '0.68rem' }}>
                              {formatPercent(item.latestRealWorldAccuracyPct)} acc
                            </Typography>
                          </Stack>
                        ) : (
                          <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.68rem' }}>
                            No backtest
                          </Typography>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.25} justifyContent="flex-end">
                          <Tooltip title="Load into editor">
                            <IconButton size="small" color="primary" onClick={() => onLoad(item)}>
                              <FolderOpenRoundedIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Duplicate script">
                            <IconButton size="small" onClick={() => onDuplicate(item)}>
                              <ContentCopyRoundedIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Archive script">
                            <IconButton size="small" color="warning" onClick={() => onArchive(item)}>
                              <ArchiveRoundedIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete script permanently">
                            <IconButton size="small" color="error" onClick={() => onDelete(item)}>
                              <DeleteRoundedIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <Stack alignItems="center" spacing={1} sx={{ py: 3 }}>
                        {loading ? (
                          <Typography variant="body2" color="text.secondary">Loading library…</Typography>
                        ) : hasFilters ? (
                          <>
                            <Typography variant="body2" color="text.secondary">No scripts match the current filters.</Typography>
                            <Button size="small" onClick={clearFilters}>Clear filters</Button>
                          </>
                        ) : (
                          <>
                            <Typography variant="body2" color="text.secondary">No scripts yet.</Typography>
                            <Typography variant="caption" color="text.disabled">
                              Save a draft to add your first trading script.
                            </Typography>
                          </>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>

          {items.length > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'right' }}>
              Showing {items.length} script{items.length === 1 ? '' : 's'}
              {hasFilters ? ' (filtered)' : ''}
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};
