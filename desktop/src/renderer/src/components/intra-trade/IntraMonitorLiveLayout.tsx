import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControl,
  LinearProgress,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TablePagination,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import type React from 'react';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import ExitToAppRoundedIcon from '@mui/icons-material/ExitToAppRounded';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import SyncRoundedIcon from '@mui/icons-material/SyncRounded';
import type { IntraEventLogItem, IntraPositionSnapshot, IntraRuntimeSummary } from '../../api/admin';
import { PnlValue, REFRESH_OPTIONS, formatPnlRupees, friendlyRuntimeStatus } from './IntraTradeShared';
import { formatLastScan } from './intraMonitorHelpers';

export const IntraMonitorLiveLayout = ({
  runtimeStatusFilter,
  onRuntimeStatusFilterChange,
  runtimes,
  selectedRuntimeId,
  onSelectRuntime,
  runtimePage,
  runtimeRowsPerPage,
  runtimeTotal,
  onRuntimePageChange,
  onRuntimeRowsPerPageChange,
  selectedRuntime,
  selectedRuntimePositions,
  positionPage,
  positionRowsPerPage,
  positionTotal,
  onPositionPageChange,
  onPositionRowsPerPageChange,
  selectedRuntimeEvents,
  eventFilter,
  onEventFilterChange,
  eventPage,
  eventRowsPerPage,
  eventTotal,
  onEventPageChange,
  onEventRowsPerPageChange,
  autoRefreshInterval,
  onAutoRefreshIntervalChange,
  autoRefreshCountdown,
  onResume,
  onPause,
  onExit,
  onPartial,
  onOpenPnl,
  onPositionExit,
  onPositionPartial,
  onPositionWatch,
}: {
  runtimeStatusFilter: string;
  onRuntimeStatusFilterChange: (value: string) => void;
  runtimes: IntraRuntimeSummary[];
  selectedRuntimeId: number | null;
  onSelectRuntime: (runtimeId: number) => void;
  runtimePage: number;
  runtimeRowsPerPage: number;
  runtimeTotal: number;
  onRuntimePageChange: (page: number) => void;
  onRuntimeRowsPerPageChange: (rows: number) => void;
  selectedRuntime: IntraRuntimeSummary | null;
  selectedRuntimePositions: IntraPositionSnapshot[];
  positionPage: number;
  positionRowsPerPage: number;
  positionTotal: number;
  onPositionPageChange: (page: number) => void;
  onPositionRowsPerPageChange: (rows: number) => void;
  selectedRuntimeEvents: IntraEventLogItem[];
  eventFilter: string;
  onEventFilterChange: (value: string) => void;
  eventPage: number;
  eventRowsPerPage: number;
  eventTotal: number;
  onEventPageChange: (page: number) => void;
  onEventRowsPerPageChange: (rows: number) => void;
  autoRefreshInterval: number;
  onAutoRefreshIntervalChange: (value: number) => void;
  autoRefreshCountdown: number;
  onResume: () => void;
  onPause: () => void;
  onExit: () => void;
  onPartial: () => void;
  onOpenPnl: () => void;
  onPositionExit: (positionId: number) => void;
  onPositionPartial: (positionId: number) => void;
  onPositionWatch: (positionId: number) => void;
}) => (
  <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems="stretch">
    <Card variant="outlined" sx={{ width: { xs: '100%', lg: 400 }, flexShrink: 0, position: { lg: 'sticky' }, top: 148, alignSelf: 'flex-start' }}>
      <CardContent sx={{ p: 0 }}>
        <Stack spacing={0}>
          <Box sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight={800}>Active Live Strategies</Typography>
            <Typography variant="body2" color="text.secondary">
              The left list stays scanable. Open one runtime to review positions, events, and actions.
            </Typography>
          </Box>
          <Divider />
          <Stack spacing={1} sx={{ p: 2 }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <Select value={runtimeStatusFilter} onChange={(event) => onRuntimeStatusFilterChange(event.target.value)}>
                  <MenuItem value="ACTIVE">Active only</MenuItem>
                  <MenuItem value="PAUSED">Paused</MenuItem>
                  <MenuItem value="EXITED">Exited</MenuItem>
                  <MenuItem value="ALL">All statuses</MenuItem>
                </Select>
              </FormControl>
              <Tooltip title={`Auto-refresh every ${autoRefreshInterval}s · next in ${autoRefreshCountdown}s`}>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <SyncRoundedIcon sx={{ fontSize: 14, color: '#3b82f6' }} />
                  <FormControl size="small" sx={{ minWidth: 80 }}>
                    <Select value={autoRefreshInterval} onChange={(event) => onAutoRefreshIntervalChange(Number(event.target.value))}>
                      {REFRESH_OPTIONS.map((option) => (
                        <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>
              </Tooltip>
            </Stack>
            <Box>
              <LinearProgress
                variant="determinate"
                value={((autoRefreshInterval - autoRefreshCountdown) / autoRefreshInterval) * 100}
                sx={{ height: 3, borderRadius: 999, bgcolor: '#e2e8f0', '& .MuiLinearProgress-bar': { bgcolor: '#3b82f6' } }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.62rem' }}>
                Next refresh in {autoRefreshCountdown}s
              </Typography>
            </Box>
          </Stack>
          <Divider />
          <List disablePadding sx={{ minHeight: 420 }}>
            {runtimes.map((row) => {
              const status = friendlyRuntimeStatus(row.status);
              return (
                <ListItemButton
                  key={row.runtimeId}
                  selected={row.runtimeId === selectedRuntimeId}
                  onClick={() => onSelectRuntime(row.runtimeId)}
                  sx={{
                    px: 2,
                    py: 1.5,
                    alignItems: 'flex-start',
                    borderLeft: '3px solid transparent',
                    '&.Mui-selected': { bgcolor: '#ecfeff', borderLeftColor: '#0891b2' },
                    '&.Mui-selected:hover': { bgcolor: '#cffafe' },
                  }}
                >
                  <ListItemText
                    primaryTypographyProps={{ component: 'div' }}
                    secondaryTypographyProps={{ component: 'div' }}
                    primary={
                      <Stack direction="row" justifyContent="space-between" spacing={1}>
                        <Typography variant="body2" fontWeight={800}>{row.strategyName}</Typography>
                        <Button size="small" variant="outlined">Open</Button>
                      </Stack>
                    }
                    secondary={
                      <Stack spacing={0.75} sx={{ mt: 0.5 }}>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                          <Chip size="small" label={status.label} color={status.color} />
                          <PnlValue value={row.currentMtm} variant="body2" />
                        </Stack>
                        <Typography variant="caption" color="text.secondary">Refreshed {formatLastScan(row.refreshedAt)}</Typography>
                      </Stack>
                    }
                  />
                </ListItemButton>
              );
            })}
            {runtimes.length === 0 && (
              <Box sx={{ p: 3 }}>
                <Alert severity="info">No live runtimes matched the current filter.</Alert>
              </Box>
            )}
          </List>
          <TablePagination
            component="div"
            count={runtimeTotal}
            page={runtimePage}
            rowsPerPage={runtimeRowsPerPage}
            onPageChange={(_, nextPage) => onRuntimePageChange(nextPage)}
            onRowsPerPageChange={(event) => onRuntimeRowsPerPageChange(Number(event.target.value))}
            rowsPerPageOptions={[5, 10, 20]}
          />
        </Stack>
      </CardContent>
    </Card>

    <Stack spacing={2} sx={{ flex: 1, minWidth: 0 }}>
      <Card variant="outlined" sx={{ borderColor: '#bae6fd', bgcolor: '#f8fdff' }}>
        <CardContent>
          {selectedRuntime ? (
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1}>
                <Stack spacing={0.5}>
                  <Typography variant="subtitle1" fontWeight={800}>Selected Runtime</Typography>
                  <Typography variant="h6" fontWeight={800}>{selectedRuntime.strategyName}</Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip label={friendlyRuntimeStatus(selectedRuntime.status).label} color={friendlyRuntimeStatus(selectedRuntime.status).color} />
                    <Chip label={selectedRuntime.instrument} variant="outlined" />
                    <Chip label={formatPnlRupees(selectedRuntime.currentMtm)} variant="outlined" />
                  </Stack>
                </Stack>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {selectedRuntime.status === 'PAUSED' ? (
                    <Button variant="contained" startIcon={<PlayArrowRoundedIcon />} onClick={onResume}>Resume</Button>
                  ) : (
                    <Button variant="outlined" startIcon={<PauseRoundedIcon />} onClick={onPause}>Pause</Button>
                  )}
                  <Button variant="outlined" color="warning" startIcon={<AutoAwesomeRoundedIcon />} onClick={onPartial}>Partial Exit</Button>
                  <Button variant="contained" color="warning" startIcon={<ExitToAppRoundedIcon />} onClick={onExit}>Exit Now</Button>
                  <Button variant="outlined" onClick={onOpenPnl}>View P&amp;L</Button>
                </Stack>
              </Stack>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
                <Metric label="Current signal" value={selectedRuntime.currentSignal ?? 'Unknown'} />
                <Metric label="Last refresh" value={formatLastScan(selectedRuntime.refreshedAt)} />
                <Metric label="Freshness" value={selectedRuntime.freshnessSeconds + 's'} />
                <Metric label="Next action" value={selectedRuntime.nextExpectedAction ?? 'None'} />
              </Stack>
            </Stack>
          ) : (
            <Alert severity="info">Select one runtime from the left list to inspect positions and actions.</Alert>
          )}
        </CardContent>
      </Card>

      {/* Fix #3 — Positions + Audit Trail merged into one split card */}
      <Card variant="outlined" sx={{ borderColor: '#e2e8f0', bgcolor: '#fcfdff' }}>
        <CardContent>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            divider={<Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', md: 'block' } }} />}
          >
            {/* ── Left half: Open Live Positions ── */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack spacing={1.5}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="subtitle1" fontWeight={800}>
                    Open Positions
                    {positionTotal > 0 && (
                      <Chip label={positionTotal} size="small" color="primary" sx={{ ml: 1, height: 18, fontSize: '0.65rem' }} />
                    )}
                  </Typography>
                </Stack>
                <Stack spacing={1} sx={{ maxHeight: 360, overflowY: 'auto' }}>
                  {selectedRuntimePositions.map((position) => (
                    <Box key={position.positionId} sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5, p: 1.25, bgcolor: '#fff' }}>
                      <Stack spacing={0.75}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                          <Stack spacing={0}>
                            <Typography variant="body2" fontWeight={800}>{position.instrument}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {position.quantityLots} lots · Entry {position.entryPrice == null ? '—' : '₹' + position.entryPrice}
                            </Typography>
                          </Stack>
                          <PnlValue value={(position.unrealizedPnl ?? 0) + (position.realizedPnl ?? 0)} />
                        </Stack>
                        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                          <Button size="small" variant="outlined" color="warning" sx={{ fontSize: '0.68rem', py: 0.25 }} onClick={() => onPositionPartial(position.positionId)}>Partial</Button>
                          <Button size="small" variant="outlined" sx={{ fontSize: '0.68rem', py: 0.25 }} onClick={() => onPositionWatch(position.positionId)}>Watch</Button>
                          <Button size="small" variant="contained" color="warning" sx={{ fontSize: '0.68rem', py: 0.25 }} onClick={() => onPositionExit(position.positionId)}>Exit</Button>
                        </Stack>
                      </Stack>
                    </Box>
                  ))}
                  {selectedRuntimePositions.length === 0 && (
                    <Alert severity="info" sx={{ fontSize: '0.78rem' }}>No open positions for the selected runtime.</Alert>
                  )}
                </Stack>
                {positionTotal > positionRowsPerPage && (
                  <TablePagination
                    component="div"
                    count={positionTotal}
                    page={positionPage}
                    rowsPerPage={positionRowsPerPage}
                    onPageChange={(_, nextPage) => onPositionPageChange(nextPage)}
                    onRowsPerPageChange={(event) => onPositionRowsPerPageChange(Number(event.target.value))}
                    rowsPerPageOptions={[5, 10]}
                    sx={{ '& .MuiTablePagination-toolbar': { minHeight: 40 }, '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': { fontSize: '0.72rem' } }}
                  />
                )}
              </Stack>
            </Box>

            {/* ── Right half: Audit Trail ── */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack spacing={1.5}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1} flexWrap="wrap">
                  <Typography variant="subtitle1" fontWeight={800}>Audit Trail</Typography>
                  <TextField
                    size="small"
                    label="Filter events"
                    value={eventFilter}
                    onChange={(e) => onEventFilterChange(e.target.value)}
                    sx={{ minWidth: 160, '& .MuiInputBase-root': { fontSize: '0.78rem' } }}
                  />
                </Stack>
                <Stack spacing={0.75} sx={{ maxHeight: 360, overflowY: 'auto' }}>
                  {selectedRuntimeEvents.map((event) => (
                    <Box key={event.id} sx={{ borderLeft: '3px solid #cbd5e1', pl: 1.25, py: 0.5 }}>
                      <Stack direction="row" justifyContent="space-between" spacing={0.5}>
                        <Stack spacing={0}>
                          <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.78rem' }}>{event.eventType}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>{event.message}</Typography>
                        </Stack>
                        <Stack spacing={0} alignItems="flex-end" sx={{ flexShrink: 0 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem', whiteSpace: 'nowrap' }}>{formatLastScan(event.eventTime)}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>{event.actor}</Typography>
                        </Stack>
                      </Stack>
                    </Box>
                  ))}
                  {selectedRuntimeEvents.length === 0 && (
                    <Alert severity="info" sx={{ fontSize: '0.78rem' }}>No events matched the current filters.</Alert>
                  )}
                </Stack>
                {eventTotal > eventRowsPerPage && (
                  <TablePagination
                    component="div"
                    count={eventTotal}
                    page={eventPage}
                    rowsPerPage={eventRowsPerPage}
                    onPageChange={(_, nextPage) => onEventPageChange(nextPage)}
                    onRowsPerPageChange={(event) => onEventRowsPerPageChange(Number(event.target.value))}
                    rowsPerPageOptions={[5, 10]}
                    sx={{ '& .MuiTablePagination-toolbar': { minHeight: 40 }, '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': { fontSize: '0.72rem' } }}
                  />
                )}
              </Stack>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  </Stack>
);

const Metric = ({ label, value }: { label: string; value: string }) => (
  <Box sx={{ minWidth: 0, flex: 1, borderRadius: 1.5, px: 1.5, py: 1.25, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography variant="body2" fontWeight={800} noWrap>{value}</Typography>
  </Box>
);
