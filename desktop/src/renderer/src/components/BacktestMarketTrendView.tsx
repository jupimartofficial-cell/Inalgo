import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
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
  Tooltip,
  Typography,
} from '@mui/material';
import CloseRounded from '@mui/icons-material/CloseRounded';
import RefreshRounded from '@mui/icons-material/RefreshRounded';
import RssFeedRounded from '@mui/icons-material/RssFeedRounded';
import { useState } from 'react';
import type { MarketSentimentRow, NewsFeedPreviewResponse } from '../api/admin';
import {
  MARKET_SENTIMENT_SCOPE_OPTIONS,
  MARKET_SENTIMENT_STATUS_OPTIONS,
  formatDateTime,
  formatNumber,
  oneMonthAgo,
  oneWeekAgo,
  threeMonthsAgo,
  todayInputDate,
  type MarketSentimentFilters,
} from './BacktestPanelShared';

export interface BacktestMarketTrendViewProps {
  rows: MarketSentimentRow[];
  totalElements: number;
  page: number;
  rowsPerPage: number;
  loading: boolean;
  refreshing?: boolean;
  previewLoading?: boolean;
  previewData?: NewsFeedPreviewResponse | null;
  filterDraft: MarketSentimentFilters;
  onFilterDraftChange: (updater: (current: MarketSentimentFilters) => MarketSentimentFilters) => void;
  onApplyFilters: () => void;
  onResetFilters: () => void;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rowsPerPage: number) => void;
  onRefreshNow?: () => void;
  onLoadPreview?: (scope: string) => void;
}

const trendTone = (trendStatus: string) => {
  if (trendStatus === 'BULL') return { bg: '#e8f5e9', fg: '#2e7d32' };
  if (trendStatus === 'BEAR') return { bg: '#ffebee', fg: '#c62828' };
  if (trendStatus === 'HOLD') return { bg: '#fff8e1', fg: '#b26a00' };
  return { bg: '#f5f5f5', fg: '#555' };
};

const evalTypeTone = (evalType: string) => {
  if (evalType === 'WEB_SEARCH') return { bg: '#e3f2fd', fg: '#1565c0', label: 'WEB' };
  if (evalType === 'TECHNICAL') return { bg: '#f3e5f5', fg: '#6a1b9a', label: 'TECH' };
  return { bg: '#fafafa', fg: '#555', label: evalType };
};

const PREVIEW_SCOPE_OPTIONS = [
  { value: 'GLOBAL_NEWS', label: 'Global News' },
  { value: 'INDIA_NEWS', label: 'India News' },
];

const excludeReasonLabel = (reason: string | undefined) => {
  if (reason === 'no-date') return 'No date';
  if (reason === 'too-old') return 'Too old';
  if (reason === 'no-signal') return 'No keywords matched';
  return reason ?? '';
};

export const BacktestMarketTrendView = ({
  rows,
  totalElements,
  page,
  rowsPerPage,
  loading,
  refreshing = false,
  previewLoading = false,
  previewData = null,
  filterDraft,
  onFilterDraftChange,
  onApplyFilters,
  onResetFilters,
  onPageChange,
  onRowsPerPageChange,
  onRefreshNow,
  onLoadPreview,
}: BacktestMarketTrendViewProps) => {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewScope, setPreviewScope] = useState('GLOBAL_NEWS');

  const handleOpenPreview = (scope: string) => {
    setPreviewOpen(true);
    onLoadPreview?.(scope);
  };

  const handlePreviewScopeChange = (scope: string) => {
    setPreviewScope(scope);
    onLoadPreview?.(scope);
  };

  return (
    <Card>
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
            <Stack spacing={0}>
              <Typography variant="h6" fontWeight={700}>Market Trend</Typography>
              <Typography variant="caption" color="text.secondary">Global, India, Gift Nifty, and S&amp;P 500 snapshots refreshed every 5 minutes</Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Tooltip title="Preview raw RSS articles and scoring for a feed scope">
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<RssFeedRounded />}
                  onClick={() => handleOpenPreview(previewScope)}
                  disabled={previewLoading}
                >
                  Preview Feed
                </Button>
              </Tooltip>
              <Tooltip title="Fetch all sources now and save a new snapshot">
                <Button
                  size="small"
                  variant="contained"
                  startIcon={refreshing ? <CircularProgress size={14} color="inherit" /> : <RefreshRounded />}
                  onClick={onRefreshNow}
                  disabled={refreshing || !onRefreshNow}
                >
                  {refreshing ? 'Refreshing…' : 'Refresh Now'}
                </Button>
              </Tooltip>
              <Chip label={loading ? 'Loading…' : `${totalElements} rows`} size="small" variant="outlined" />
            </Stack>
          </Stack>

          <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Stack spacing={1.25}>
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
                    <InputLabel>Market</InputLabel>
                    <Select
                      label="Market"
                      value={filterDraft.marketScope}
                      inputProps={{ 'aria-label': 'Market' }}
                      onChange={(e) => onFilterDraftChange((c) => ({ ...c, marketScope: e.target.value }))}
                    >
                      {MARKET_SENTIMENT_SCOPE_OPTIONS.map((option) => (
                        <MenuItem key={option.key || 'all'} value={option.key}>{option.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Trend</InputLabel>
                    <Select
                      label="Trend"
                      value={filterDraft.trendStatus}
                      inputProps={{ 'aria-label': 'Trend' }}
                      onChange={(e) => onFilterDraftChange((c) => ({ ...c, trendStatus: e.target.value }))}
                    >
                      {MARKET_SENTIMENT_STATUS_OPTIONS.map((option) => (
                        <MenuItem key={option.key || 'all'} value={option.key}>{option.label}</MenuItem>
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
                <Grid item xs={12} sm={12} md={3}>
                  <Stack direction="row" spacing={0.75}>
                    <Button size="small" variant="contained" onClick={onApplyFilters} fullWidth sx={{ minWidth: 64 }}>Apply Filters</Button>
                    <Button size="small" variant="outlined" onClick={onResetFilters} sx={{ minWidth: 56 }}>Reset Filters</Button>
                  </Stack>
                </Grid>
              </Grid>
            </Stack>
          </Paper>

          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 560 }}>
            <Table size="small" stickyHeader>
              <TableHead sx={{ '& th': { fontWeight: 700, fontSize: '0.72rem', bgcolor: '#f5f7fa', color: '#555' } }}>
                <TableRow>
                  <TableCell>Snapshot</TableCell>
                  <TableCell>Market</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell align="center">Trend</TableCell>
                  <TableCell align="right">Current</TableCell>
                  <TableCell align="right">EMA 9</TableCell>
                  <TableCell align="right">EMA 21</TableCell>
                  <TableCell align="right">EMA 110</TableCell>
                  <TableCell align="center">Sources</TableCell>
                  <TableCell>AI Analyse</TableCell>
                  <TableCell>Reason</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => {
                  const tone = trendTone(row.trendStatus);
                  return (
                    <TableRow key={row.id} hover sx={{ '& td': { py: 0.75, verticalAlign: 'top' } }}>
                      <TableCell sx={{ fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{formatDateTime(row.snapshotAt)}</TableCell>
                      <TableCell>
                        <Stack spacing={0.35}>
                          <Typography variant="body2" fontWeight={700}>{row.marketName}</Typography>
                          <Typography variant="caption" color="text.secondary">{row.marketScope}</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        {(() => { const t = evalTypeTone(row.evaluationType); return (
                          <Chip label={t.label} size="small"
                            sx={{ height: 18, fontSize: '0.64rem', fontWeight: 700, bgcolor: t.bg, color: t.fg }} />
                        ); })()}
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={row.trendStatus}
                          size="small"
                          sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700, bgcolor: tone.bg, color: tone.fg }}
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.72rem', fontWeight: 700 }}>{formatNumber(row.currentValue)}</TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.72rem' }}>{formatNumber(row.ema9)}</TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.72rem' }}>{formatNumber(row.ema21)}</TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.72rem' }}>{formatNumber(row.ema110)}</TableCell>
                      <TableCell align="center" sx={{ fontSize: '0.72rem' }}>{`${row.sourceCount}/${row.evidenceCount}`}</TableCell>
                      <TableCell sx={{ minWidth: 180 }}>
                        {row.aiAnalysis ? (
                          <Stack spacing={0.35}>
                            <Chip
                              label={row.aiAnalysis}
                              size="small"
                              sx={{
                                height: 20,
                                width: 'fit-content',
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                bgcolor: trendTone(row.aiAnalysis).bg,
                                color: trendTone(row.aiAnalysis).fg,
                              }}
                            />
                            <Typography variant="caption" color="text.secondary">
                              {row.aiModel}{row.aiConfidence != null ? ` · ${row.aiConfidence}%` : ''}
                            </Typography>
                            <Typography variant="body2" sx={{ fontSize: '0.74rem', lineHeight: 1.35 }}>
                              {row.aiReason}
                            </Typography>
                          </Stack>
                        ) : (
                          <Typography variant="caption" color="text.secondary">Not available</Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ minWidth: 320 }}>
                        {row.evaluationType === 'WEB_SEARCH' ? (
                          <Stack spacing={0.5}>
                            <Typography variant="body2" sx={{ fontSize: '0.74rem', lineHeight: 1.45, color: '#333' }}>{row.reason}</Typography>
                            {row.sourceNames && (
                              <Stack spacing={0.2}>
                                {row.sourceNames.split(' | ').map((h, i) => (
                                  <Typography key={i} variant="caption" sx={{ fontSize: '0.68rem', color: '#1565c0', display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
                                    <Box component="span" sx={{ color: '#90a4ae', flexShrink: 0 }}>›</Box>{h}
                                  </Typography>
                                ))}
                              </Stack>
                            )}
                          </Stack>
                        ) : (
                          <Stack spacing={0.35}>
                            <Typography variant="caption" color="text.secondary">{row.sourceNames || '—'}</Typography>
                            <Typography variant="body2" sx={{ fontSize: '0.76rem', lineHeight: 1.45 }}>{row.reason}</Typography>
                          </Stack>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {loading && (
                  <TableRow><TableCell colSpan={11} align="center">Loading…</TableCell></TableRow>
                )}
                {!loading && !rows.length && (
                  <TableRow><TableCell colSpan={11} align="center" sx={{ py: 3, color: 'text.secondary' }}>No market-trend rows found for selected filters</TableCell></TableRow>
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

      {/* ── News Feed Preview Dialog ─────────────────────────────────────────── */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack spacing={0}>
              <Typography fontWeight={700}>News Feed Preview</Typography>
              <Typography variant="caption" color="text.secondary">
                Live article fetch — shows what each RSS source returns and how each article is scored
              </Typography>
            </Stack>
            <IconButton size="small" onClick={() => setPreviewOpen(false)}><CloseRounded /></IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Scope</InputLabel>
                <Select label="Scope" value={previewScope} onChange={(e) => handlePreviewScopeChange(e.target.value)}>
                  {PREVIEW_SCOPE_OPTIONS.map((o) => (
                    <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              {previewData && (
                <Stack spacing={0.25}>
                  {previewData.webSearchMode && (
                    <Paper variant="outlined" sx={{ px: 1.25, py: 0.75, bgcolor: '#e3f2fd', borderColor: '#90caf9' }}>
                      <Typography variant="caption" sx={{ color: '#1565c0', fontWeight: 600 }}>
                        AI Web Search mode is active — the scheduler uses OpenAI web_search_preview for real-time news.
                        RSS feeds below are shown for diagnostic comparison only.
                      </Typography>
                    </Paper>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    Fetched: {previewData.fetchedAt ? new Date(previewData.fetchedAt).toLocaleString() : '—'}
                    {' · '}Lookback: {previewData.newsLookbackHours}h
                  </Typography>
                </Stack>
              )}
              {previewLoading && <CircularProgress size={20} />}
            </Stack>

            {previewData?.feeds.map((feed) => (
              <Paper key={feed.name} variant="outlined" sx={{ p: 1.5 }}>
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Typography variant="body2" fontWeight={700}>{feed.name}</Typography>
                    <Chip
                      label={feed.status}
                      size="small"
                      color={feed.status === 'OK' ? 'success' : 'error'}
                      sx={{ height: 18, fontSize: '0.66rem' }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {feed.totalFetched} fetched · {feed.includedCount} scored
                    </Typography>
                  </Stack>
                  {feed.error && (
                    <Typography variant="caption" color="error.main" sx={{ fontFamily: 'monospace' }}>{feed.error}</Typography>
                  )}
                  {feed.articles.length > 0 && (
                    <TableContainer sx={{ maxHeight: 300 }}>
                      <Table size="small" stickyHeader>
                        <TableHead sx={{ '& th': { fontWeight: 700, fontSize: '0.68rem', bgcolor: '#f5f7fa' } }}>
                          <TableRow>
                            <TableCell sx={{ width: 60 }}>Status</TableCell>
                            <TableCell sx={{ width: 130 }}>Published</TableCell>
                            <TableCell>Title / Source</TableCell>
                            <TableCell sx={{ width: 50 }} align="center">Score</TableCell>
                            <TableCell sx={{ width: 200 }}>Tags / Reason</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {feed.articles.map((article, idx) => (
                            <TableRow key={idx} sx={{ opacity: article.included ? 1 : 0.55 }}>
                              <TableCell>
                                <Chip
                                  label={article.included ? 'scored' : 'skip'}
                                  size="small"
                                  sx={{
                                    height: 18,
                                    fontSize: '0.64rem',
                                    bgcolor: article.included ? '#e8f5e9' : '#f5f5f5',
                                    color: article.included ? '#2e7d32' : '#777',
                                  }}
                                />
                              </TableCell>
                              <TableCell sx={{ fontSize: '0.68rem', whiteSpace: 'nowrap' }}>
                                {article.publishedAt ? new Date(article.publishedAt).toLocaleString() : '—'}
                              </TableCell>
                              <TableCell>
                                <Stack spacing={0.2}>
                                  <Typography
                                    variant="body2"
                                    sx={{ fontSize: '0.72rem', lineHeight: 1.3 }}
                                    component={article.link ? 'a' : 'span'}
                                    href={article.link || undefined}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    color={article.link ? 'primary.main' : 'text.primary'}
                                  >
                                    {article.title}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">{article.sourceName}</Typography>
                                </Stack>
                              </TableCell>
                              <TableCell align="center">
                                {article.included && (
                                  <Typography
                                    variant="body2"
                                    fontWeight={700}
                                    sx={{ fontSize: '0.72rem', color: article.score > 0 ? '#2e7d32' : article.score < 0 ? '#c62828' : '#555' }}
                                  >
                                    {article.score > 0 ? `+${article.score}` : article.score}
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell sx={{ fontSize: '0.68rem' }}>
                                {article.included
                                  ? article.tags.join(', ')
                                  : <Box component="span" sx={{ color: 'text.disabled' }}>{excludeReasonLabel(article.excludeReason)}</Box>
                                }
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </Stack>
              </Paper>
            ))}

            {!previewLoading && !previewData && (
              <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
                Select a scope above to preview the latest RSS articles
              </Typography>
            )}
          </Stack>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
