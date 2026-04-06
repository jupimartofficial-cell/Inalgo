import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
  Grid,
} from '@mui/material';
import { useState } from 'react';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded';
import TrendingFlatRoundedIcon from '@mui/icons-material/TrendingFlatRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import type {
  IntraEmergencyActionRequest,
  IntraEventLogItem,
  IntraMarketSummary,
  IntraPositionSnapshot,
  IntraRuntimeSummary,
} from '../../api/admin';
import { PnlValue, friendlyRuntimeStatus, REFRESH_OPTIONS } from './IntraTradeShared';

export const IntraMonitorMarketSummaryCard = ({ marketSummary }: { marketSummary: IntraMarketSummary | null }) => {
  const [expanded, setExpanded] = useState(true);
  const isOpen = marketSummary?.sessionStatus === 'Open';
  const trend = marketSummary?.marketTrend ?? '';
  const TrendIcon = trend === 'UPTREND' ? TrendingUpRoundedIcon : trend === 'DOWNTREND' ? TrendingDownRoundedIcon : TrendingFlatRoundedIcon;
  const trendColor = trend === 'UPTREND' ? '#15803d' : trend === 'DOWNTREND' ? '#b91c1c' : '#64748b';

  return (
    <Card variant="outlined" sx={{ borderColor: isOpen ? '#86efac' : 'divider', bgcolor: isOpen ? '#f0fdf4' : undefined }}>
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle1" fontWeight={800}>Market Status</Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              {marketSummary != null && (
                <Chip
                  label={isOpen ? 'MARKET OPEN' : 'MARKET CLOSED'}
                  color={isOpen ? 'success' : 'default'}
                  size="small"
                  sx={{ fontWeight: 800 }}
                />
              )}
              <IconButton size="small" onClick={() => setExpanded(!expanded)}>
                <ExpandMoreRoundedIcon sx={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </IconButton>
            </Stack>
          </Stack>
          <Collapse in={expanded}>
            {marketSummary == null ? (
              <Typography variant="body2" color="text.secondary">Loading market data…</Typography>
            ) : (
              <Grid container spacing={1.5} alignItems="center">
                <Grid item xs={12} md={3}>
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <TrendIcon sx={{ fontSize: 20, color: trendColor }} />
                    <Stack spacing={0}>
                      <Typography variant="caption" color="text.secondary">Market Trend</Typography>
                      <Typography variant="body2" fontWeight={700} sx={{ color: trendColor }}>
                        {trend === 'UPTREND' ? 'Bullish' : trend === 'DOWNTREND' ? 'Bearish' : trend || '—'}
                      </Typography>
                    </Stack>
                  </Stack>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Stack spacing={0}>
                    <Typography variant="caption" color="text.secondary">Data Freshness</Typography>
                    <Typography variant="body2" fontWeight={600} sx={{ color: marketSummary.stale ? '#b45309' : 'text.primary' }}>
                      {marketSummary.stale ? '⚠ Stale' : `Updated ${marketSummary.freshnessSeconds}s ago`}
                    </Typography>
                  </Stack>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Stack direction="row" flexWrap="wrap" gap={0.75}>
                    {marketSummary.indexValues.map((idx) => (
                      <Chip key={idx.instrumentKey} variant="outlined" size="small" label={idx.label + ': ' + (idx.value == null ? '—' : idx.value)} sx={{ fontWeight: 600 }} />
                    ))}
                  </Stack>
                </Grid>
              </Grid>
            )}
          </Collapse>
        </Stack>
      </CardContent>
    </Card>
  );
};

export const IntraMonitorRuntimesCard = ({
  modeTab,
  runtimeRows,
  positionRows,
  autoRefreshInterval,
  onAutoRefreshIntervalChange,
  onModeTabChange,
  onPauseResume,
  onExit,
  onPartial,
  onView,
}: {
  modeTab: 'PAPER' | 'LIVE';
  runtimeRows: IntraRuntimeSummary[];
  positionRows: IntraPositionSnapshot[];
  autoRefreshInterval: number;
  onAutoRefreshIntervalChange: (val: number) => void;
  onModeTabChange: (mode: 'PAPER' | 'LIVE') => void;
  onPauseResume: (row: IntraRuntimeSummary) => void;
  onExit: (row: IntraRuntimeSummary) => void;
  onPartial: (row: IntraRuntimeSummary) => void;
  onView: () => void;
}) => {
  const [expanded, setExpanded] = useState(true);

  return (
    <Card>
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={1}>
            <Typography variant="subtitle1" fontWeight={800}>Running Strategies</Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Tabs value={modeTab} onChange={(_, v) => onModeTabChange(v)}>
                <Tab value="PAPER" label="Paper" />
                <Tab value="LIVE" label="Live" />
              </Tabs>
              <FormControl size="small">
                <Select
                  value={autoRefreshInterval}
                  onChange={(e) => onAutoRefreshIntervalChange(Number(e.target.value))}
                  sx={{ fontSize: '0.78rem', height: 28, minWidth: 70, '& .MuiSelect-select': { py: '2px', px: '8px', pr: '24px !important' } }}
                >
                  {REFRESH_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: '0.78rem' }}>{opt.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <IconButton size="small" onClick={() => setExpanded(!expanded)}>
                <ExpandMoreRoundedIcon sx={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </IconButton>
            </Stack>
          </Stack>

          <Collapse in={expanded}>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Strategy</TableCell>
                    <TableCell>Instrument</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Entry Time</TableCell>
                    <TableCell align="right">Lots</TableCell>
                    <TableCell align="right">Entry Price</TableCell>
                    <TableCell align="right">Exit Price</TableCell>
                    <TableCell align="right">Pos. P&amp;L</TableCell>
                    <TableCell>Signal</TableCell>
                    <TableCell align="right">MTM / P&amp;L</TableCell>
                    <TableCell>SL / Target</TableCell>
                    <TableCell>Next Action</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {runtimeRows.map((row) => {
                    const statusInfo = friendlyRuntimeStatus(row.status);
                    const mtm = row.currentMtm ?? 0;
                    const rowBg = row.status === 'ENTERED' && mtm > 0 ? '#f0fdf4' : row.status === 'ENTERED' && mtm < 0 ? '#fef2f2' : undefined;
                    const rPositions = positionRows.filter(p => p.runtimeId === row.runtimeId);
                    const totalLots = rPositions.reduce((sum, p) => sum + p.quantityLots, 0);
                    const posRealPnl = rPositions.reduce((sum, p) => sum + (p.unrealizedPnl ?? 0) + (p.realizedPnl ?? 0), 0);
                    const avgEntry = totalLots > 0
                      ? rPositions.reduce((sum, p) => sum + (p.entryPrice ?? 0) * p.quantityLots, 0) / totalLots
                      : null;
                    const exitPrice: number | null = (() => {
                      if (row.status === 'EXITED' && avgEntry != null && totalLots > 0) {
                        return avgEntry + posRealPnl / totalLots;
                      }
                      if ((row.status === 'ENTERED' || row.status === 'PARTIAL_EXIT') && rPositions.length > 0) {
                        return rPositions[0]?.currentPrice ?? null;
                      }
                      return null;
                    })();
                    return (
                      <TableRow key={row.runtimeId} hover sx={{ bgcolor: rowBg }}>
                        <TableCell sx={{ fontWeight: 600 }}>{row.strategyName}</TableCell>
                        <TableCell>{row.instrument}</TableCell>
                        <TableCell><Chip size="small" label={statusInfo.label} color={statusInfo.color} /></TableCell>
                        <TableCell>{row.entryTime ? new Date(row.entryTime).toLocaleTimeString('en-IN') : '—'}</TableCell>
                        <TableCell align="right">{totalLots > 0 ? totalLots : '—'}</TableCell>
                        <TableCell align="right">{avgEntry != null ? `₹${avgEntry.toFixed(2)}` : '—'}</TableCell>
                        <TableCell align="right">{exitPrice != null ? `₹${exitPrice.toFixed(2)}` : '—'}</TableCell>
                        <TableCell align="right"><PnlValue value={rPositions.length > 0 ? posRealPnl : null} /></TableCell>
                        <TableCell>{row.currentSignal ?? '—'}</TableCell>
                        <TableCell align="right"><PnlValue value={row.currentMtm} /></TableCell>
                        <TableCell>{(row.slState ?? 'NA') + ' / ' + (row.targetState ?? 'NA')}</TableCell>
                        <TableCell>{row.nextExpectedAction ?? '—'}</TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <Button size="small" variant="outlined" onClick={() => onPauseResume(row)}>
                              {row.status === 'PAUSED' ? 'Resume' : 'Pause'}
                            </Button>
                            <Button size="small" color="warning" variant="outlined" onClick={() => onExit(row)}>
                              Exit
                            </Button>
                            <Button size="small" color="secondary" variant="outlined" onClick={() => onPartial(row)}>
                              Partial
                            </Button>
                            <Button size="small" onClick={onView}>P&amp;L</Button>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {runtimeRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={13} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                        No strategies running in {modeTab === 'PAPER' ? 'Paper Test' : 'Live Trade'} mode. Select a strategy and click "Run Strategy" above.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Box>
          </Collapse>
        </Stack>
      </CardContent>
    </Card>
  );
};

export const IntraMonitorPositionsCard = ({
  positionRows,
  onExit,
  onPartial,
  onManualWatch,
}: {
  positionRows: IntraPositionSnapshot[];
  onExit: (row: IntraPositionSnapshot) => void;
  onPartial: (row: IntraPositionSnapshot) => void;
  onManualWatch: (row: IntraPositionSnapshot) => void;
}) => {
  const [expanded, setExpanded] = useState(true);

  return (
    <Card>
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle1" fontWeight={800}>Active Positions</Typography>
            <IconButton size="small" onClick={() => setExpanded(!expanded)}>
              <ExpandMoreRoundedIcon sx={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </IconButton>
          </Stack>
          <Collapse in={expanded}>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Instrument</TableCell>
                    <TableCell>Qty / lots</TableCell>
                    <TableCell>Entry</TableCell>
                    <TableCell>Current</TableCell>
                    <TableCell align="right">Entry Value</TableCell>
                    <TableCell align="right">Cur. Value</TableCell>
                    <TableCell align="right">Unrealized</TableCell>
                    <TableCell align="right">Realized</TableCell>
                    <TableCell>SL</TableCell>
                    <TableCell>Target</TableCell>
                    <TableCell>Strategy</TableCell>
                    <TableCell>Time in trade</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {positionRows.map((row) => {
                    const unrealized = row.unrealizedPnl ?? 0;
                    const rowBg = unrealized > 0 ? '#f0fdf4' : unrealized < 0 ? '#fef2f2' : undefined;
                    const mins = Math.round((row.timeInTradeSeconds ?? 0) / 60);
                    const timeLabel = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
                    const entryValue = (row.entryPrice != null && row.quantityLots > 0) ? row.entryPrice * row.quantityLots : null;
                    const curValue = (row.currentPrice != null && row.quantityLots > 0) ? row.currentPrice * row.quantityLots : null;
                    return (
                      <TableRow key={row.positionId} sx={{ bgcolor: rowBg }}>
                        <TableCell sx={{ fontWeight: 600 }}>{row.instrument}</TableCell>
                        <TableCell>{row.quantityLots}</TableCell>
                        <TableCell>{row.entryPrice != null ? `₹${row.entryPrice}` : '—'}</TableCell>
                        <TableCell>{row.currentPrice != null ? `₹${row.currentPrice}` : '—'}</TableCell>
                        <TableCell align="right">{entryValue != null ? `₹${entryValue.toLocaleString('en-IN')}` : '—'}</TableCell>
                        <TableCell align="right">{curValue != null ? `₹${curValue.toLocaleString('en-IN')}` : '—'}</TableCell>
                        <TableCell align="right"><PnlValue value={row.unrealizedPnl} /></TableCell>
                        <TableCell align="right"><PnlValue value={row.realizedPnl} /></TableCell>
                        <TableCell>{row.sl != null ? `₹${row.sl}` : '—'}</TableCell>
                        <TableCell>{row.target != null ? `₹${row.target}` : '—'}</TableCell>
                        <TableCell>{row.strategyName}</TableCell>
                        <TableCell>{timeLabel}</TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <Button size="small" color="warning" variant="outlined" onClick={() => onExit(row)}>Exit</Button>
                            <Button size="small" color="secondary" variant="outlined" onClick={() => onPartial(row)}>Partial</Button>
                            <Button size="small" variant="outlined" onClick={() => onManualWatch(row)}>Watch</Button>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {positionRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={13} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                        No open positions right now.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Box>
          </Collapse>
        </Stack>
      </CardContent>
    </Card>
  );
};

export const IntraMonitorEmergencyAndEventCard = ({
  runtimeRows,
  eventFilter,
  eventRows,
  onEventFilterChange,
  onEmergency,
}: {
  runtimeRows: IntraRuntimeSummary[];
  eventFilter: string;
  eventRows: IntraEventLogItem[];
  onEventFilterChange: (value: string) => void;
  onEmergency: (payload: IntraEmergencyActionRequest) => void;
}) => {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<'SQUARE_OFF_ALL' | 'EXIT_ALL_LIVE' | null>(null);
  const [expanded, setExpanded] = useState(true);

  const handleDangerClick = (action: 'SQUARE_OFF_ALL' | 'EXIT_ALL_LIVE') => {
    setPendingAction(action);
    setConfirmOpen(true);
  };

  const handleConfirm = () => {
    if (pendingAction === 'SQUARE_OFF_ALL') {
      onEmergency({ action: 'SQUARE_OFF_ALL', confirmLiveAction: true, liveAcknowledgement: 'CONFIRM LIVE', reason: 'Emergency square off all' });
    } else if (pendingAction === 'EXIT_ALL_LIVE') {
      onEmergency({ action: 'EXIT_ALL_LIVE', confirmLiveAction: true, liveAcknowledgement: 'CONFIRM LIVE', reason: 'Exit all live runs' });
    }
    setConfirmOpen(false);
    setPendingAction(null);
  };

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }}>
            <Typography variant="subtitle1" fontWeight={800}>Emergency Controls</Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="caption" color="text.secondary">Use these only in exceptional situations — all actions are logged.</Typography>
              <IconButton size="small" onClick={() => setExpanded(!expanded)}>
                <ExpandMoreRoundedIcon sx={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </IconButton>
            </Stack>
          </Stack>

          <Collapse in={expanded}>
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} flexWrap="wrap" useFlexGap>
                <Button color="error" variant="contained" onClick={() => handleDangerClick('SQUARE_OFF_ALL')}>
                  🚨 Square Off All
                </Button>
                <Button color="warning" variant="outlined" onClick={() => onEmergency({ action: 'EXIT_ALL_PAPER', reason: 'Exit all paper runs' })}>
                  Exit All Paper
                </Button>
                <Button color="warning" variant="outlined" onClick={() => handleDangerClick('EXIT_ALL_LIVE')}>
                  Exit All Live
                </Button>
                <Button variant="outlined" onClick={() => onEmergency({ action: 'PAUSE_ALL', reason: 'Pause all strategies' })}>
                  Pause All
                </Button>
              </Stack>

              <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ fontWeight: 800, color: 'error.main' }}>⚠️ Confirm Emergency Action</DialogTitle>
                <DialogContent>
                  <Alert severity="error" sx={{ mb: 1.5 }}>
                    {pendingAction === 'SQUARE_OFF_ALL'
                      ? 'This will immediately square off ALL open live and paper positions. This cannot be undone.'
                      : 'This will exit ALL running live strategy instances. This cannot be undone.'}
                  </Alert>
                  <Typography variant="body2">Are you absolutely sure you want to proceed?</Typography>
                </DialogContent>
                <DialogActions>
                  <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
                  <Button variant="contained" color="error" onClick={handleConfirm}>Yes, Proceed</Button>
                </DialogActions>
              </Dialog>

              <Divider />

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} justifyContent="space-between">
                <Typography variant="subtitle1" fontWeight={800}>Event / Signal Log</Typography>
                <TextField
                  size="small"
                  label="Filter event type"
                  value={eventFilter}
                  onChange={(event) => onEventFilterChange(event.target.value)}
                  sx={{ minWidth: { md: 280 } }}
                />
              </Stack>
              <Box sx={{ maxHeight: 320, overflow: 'auto' }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Time</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Mode</TableCell>
                      <TableCell>Message</TableCell>
                      <TableCell>Reason</TableCell>
                      <TableCell>Actor</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {eventRows.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell>{new Date(event.eventTime).toLocaleTimeString()}</TableCell>
                        <TableCell>{event.eventType}</TableCell>
                        <TableCell>{event.mode ?? '—'}</TableCell>
                        <TableCell>{event.message}</TableCell>
                        <TableCell>{event.reason ?? '—'}</TableCell>
                        <TableCell>{event.actor}</TableCell>
                      </TableRow>
                    ))}
                    {eventRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} align="center">No events captured yet.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Box>
            </Stack>
          </Collapse>
        </Stack>
      </CardContent>
    </Card>
  );
};
