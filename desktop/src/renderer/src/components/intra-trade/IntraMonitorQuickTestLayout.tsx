import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControl,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Popover,
  Select,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TablePagination,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import LaunchRoundedIcon from '@mui/icons-material/LaunchRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded';
import StopCircleRoundedIcon from '@mui/icons-material/StopCircleRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { useState } from 'react';
import type { IntraStrategyLibraryItem, IntraTradeExecutionSummary, IntraTradeMode } from '../../api/admin';
import { INTRA_MODE_CONFIG, PnlValue, friendlyStrategyStatus, formatPnlRupees } from './IntraTradeShared';
import type { IntraPromotionChecklistItem } from './IntraMonitorTraderView';
import { formatLastScan } from './intraMonitorHelpers';

export const IntraMonitorQuickTestLayout = ({
  strategySearch,
  onStrategySearchChange,
  strategyStatusFilter,
  onStrategyStatusFilterChange,
  strategies,
  selectedStrategyId,
  onSelectStrategy,
  strategyPage,
  strategyRowsPerPage,
  strategyTotal,
  onStrategyPageChange,
  onStrategyRowsPerPageChange,
  selectedStrategy,
  selectedMode,
  onModeChange,
  scanInstrumentKey,
  onScanInstrumentChange,
  scanTimeframeKey,
  onScanTimeframeChange,
  instrumentOptions,
  timeframeOptions,
  historicalStartDate,
  historicalEndDate,
  onHistoricalStartDateChange,
  onHistoricalEndDateChange,
  pagedValidationRuns,
  paperRunPage,
  paperRunRowsPerPage,
  paperRunTotal,
  onPaperRunPageChange,
  onPaperRunRowsPerPageChange,
  paperRunModeFilter,
  onPaperRunModeFilterChange,
  selectedExecutionSummary,
  onOpenPnl,
  onRunSelectedMode,
  onPromoteToLive,
  promotionChecklist,
  loadingStrategies,
  activeQuickTestStep,
  onStopRun,
  onDeleteRun,
}: {
  strategySearch: string;
  onStrategySearchChange: (value: string) => void;
  strategyStatusFilter: string;
  onStrategyStatusFilterChange: (value: string) => void;
  strategies: IntraStrategyLibraryItem[];
  selectedStrategyId: number | null;
  onSelectStrategy: (strategyId: number) => void;
  strategyPage: number;
  strategyRowsPerPage: number;
  strategyTotal: number;
  onStrategyPageChange: (page: number) => void;
  onStrategyRowsPerPageChange: (rows: number) => void;
  selectedStrategy: IntraStrategyLibraryItem | null;
  selectedMode: IntraTradeMode;
  onModeChange: (mode: IntraTradeMode) => void;
  scanInstrumentKey: string;
  onScanInstrumentChange: (value: string) => void;
  scanTimeframeKey: string;
  onScanTimeframeChange: (value: string) => void;
  instrumentOptions: Array<{ key: string; label: string }>;
  timeframeOptions: Array<{ key: string; label: string }>;
  historicalStartDate: string;
  historicalEndDate: string;
  onHistoricalStartDateChange: (value: string) => void;
  onHistoricalEndDateChange: (value: string) => void;
  pagedValidationRuns: IntraTradeExecutionSummary[];
  paperRunPage: number;
  paperRunRowsPerPage: number;
  paperRunTotal: number;
  onPaperRunPageChange: (page: number) => void;
  onPaperRunRowsPerPageChange: (rows: number) => void;
  paperRunModeFilter: string;
  onPaperRunModeFilterChange: (value: string) => void;
  selectedExecutionSummary: IntraTradeExecutionSummary | null;
  onOpenPnl: () => void;
  onRunSelectedMode: () => void;
  onPromoteToLive: () => void;
  promotionChecklist: IntraPromotionChecklistItem[];
  loadingStrategies: boolean;
  /** 0 = pick strategy, 1 = configure & run, 2 = review & go live */
  activeQuickTestStep: number;
  onStopRun: (runId: number, status: string) => void;
  onDeleteRun: (runId: number) => void;
}) => {
  const passedCount = promotionChecklist.filter((item) => item.passed).length;
  const failedItems = promotionChecklist.filter((item) => !item.passed);
  const allPromotionReady = failedItems.length === 0;
  const [readinessAnchor, setReadinessAnchor] = useState<HTMLElement | null>(null);

  return (
  <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems="stretch">
    <Card variant="outlined" sx={{ width: { xs: '100%', lg: 420 }, flexShrink: 0, position: { lg: 'sticky' }, top: 148, alignSelf: 'flex-start' }}>
      <CardContent sx={{ p: 0 }}>
        <Stack spacing={0}>
          <Box sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight={800}>Saved Strategies</Typography>
            <Typography variant="body2" color="text.secondary">
              Open one strategy, paper test it, then promote when the checklist is green.
            </Typography>
          </Box>
          <Divider />
          <Stack spacing={1.5} sx={{ p: 2 }}>
            <TextField size="small" label="Search strategies" value={strategySearch} onChange={(event) => onStrategySearchChange(event.target.value)} />
            <FormControl size="small">
              <Select value={strategyStatusFilter} onChange={(event) => onStrategyStatusFilterChange(event.target.value)}>
                <MenuItem value="ACTIVE">Active only</MenuItem>
                <MenuItem value="ALL">All statuses</MenuItem>
                <MenuItem value="PAPER_READY">Paper ready</MenuItem>
                <MenuItem value="LIVE_READY">Live ready</MenuItem>
                <MenuItem value="DRAFT">Draft</MenuItem>
                <MenuItem value="ARCHIVED">Archived</MenuItem>
              </Select>
            </FormControl>
          </Stack>
          <Divider />
          <List disablePadding sx={{ minHeight: 360 }}>
            {strategies.map((row) => {
              const status = friendlyStrategyStatus(row.status);
              return (
                <ListItemButton
                  key={row.id}
                  selected={row.id === selectedStrategyId}
                  onClick={() => onSelectStrategy(row.id)}
                  sx={{
                    px: 2,
                    py: 1.5,
                    alignItems: 'flex-start',
                    borderLeft: '3px solid transparent',
                    '&.Mui-selected': { bgcolor: '#eff6ff', borderLeftColor: '#2563eb' },
                    '&.Mui-selected:hover': { bgcolor: '#dbeafe' },
                  }}
                >
                  <ListItemText
                    primaryTypographyProps={{ component: 'div' }}
                    secondaryTypographyProps={{ component: 'div' }}
                    primary={
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                        <Typography variant="body2" fontWeight={800}>{row.strategyName}</Typography>
                        <Button size="small" variant="outlined">Open</Button>
                      </Stack>
                    }
                    secondary={
                      <Stack spacing={1} sx={{ mt: 0.5 }}>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                          <Chip size="small" label={status.label} color={status.color} />
                          <Chip size="small" variant="outlined" label={row.instrumentKey} />
                          <Chip size="small" variant="outlined" label={row.timeframeInterval + ' ' + row.timeframeUnit} />
                        </Stack>
                        <Typography variant="caption" color="text.secondary">Last edited {formatLastScan(row.lastModifiedAt)}</Typography>
                      </Stack>
                    }
                  />
                </ListItemButton>
              );
            })}
            {strategies.length === 0 && (
              <Box sx={{ p: 3 }}>
                <Alert severity={loadingStrategies ? 'info' : 'warning'}>
                  {loadingStrategies ? 'Loading strategies...' : 'No strategies matched the current filters.'}
                </Alert>
              </Box>
            )}
          </List>
          <TablePagination
            component="div"
            count={strategyTotal}
            page={strategyPage}
            rowsPerPage={strategyRowsPerPage}
            onPageChange={(_, nextPage) => onStrategyPageChange(nextPage)}
            onRowsPerPageChange={(event) => onStrategyRowsPerPageChange(Number(event.target.value))}
            rowsPerPageOptions={[5, 10, 20]}
          />
        </Stack>
      </CardContent>
    </Card>

    <Stack spacing={2} sx={{ flex: 1, minWidth: 0 }}>
      {/* ── Fix #2: Guided 3-step workflow stepper ── */}
      <Card variant="outlined" sx={{ borderColor: '#cbd5e1', bgcolor: '#f8fafc' }}>
        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Stack spacing={0.5}>
            <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1, fontSize: '0.6rem', letterSpacing: 1.2 }}>
              Quick Test Workflow
            </Typography>
            <Stepper activeStep={activeQuickTestStep} sx={{ '& .MuiStepLabel-label': { fontSize: '0.78rem' } }}>
              <Step completed={activeQuickTestStep > 0}>
                <StepLabel
                  StepIconProps={{ sx: { fontSize: 20 } }}
                  optional={activeQuickTestStep === 0
                    ? <Typography variant="caption" color="primary.main">← Start here</Typography>
                    : undefined}
                >
                  Pick Strategy
                </StepLabel>
              </Step>
              <Step completed={activeQuickTestStep > 1}>
                <StepLabel
                  StepIconProps={{ sx: { fontSize: 20 } }}
                  optional={activeQuickTestStep === 1
                    ? <Typography variant="caption" color="primary.main">← Now here</Typography>
                    : undefined}
                >
                  Configure &amp; Run
                </StepLabel>
              </Step>
              <Step>
                <StepLabel
                  StepIconProps={{ sx: { fontSize: 20 } }}
                  optional={activeQuickTestStep === 2
                    ? <Typography variant="caption" color="success.main">← Ready to promote</Typography>
                    : undefined}
                >
                  Review &amp; Go Live
                </StepLabel>
              </Step>
            </Stepper>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ borderColor: '#cbd5e1', bgcolor: '#fcfdff' }}>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1}>
              <Stack spacing={0.5}>
                <Typography variant="subtitle1" fontWeight={800}>Paper Test Setup</Typography>
                <Typography variant="body2" color="text.secondary">
                  Compact paper-first setup with one-click testing and a direct promotion path to live.
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Button variant="outlined" startIcon={<AssessmentRoundedIcon />} onClick={onOpenPnl}>View P&amp;L</Button>
                {/* Fix #5 — readiness score + popover on the promote button */}
                {selectedMode === 'LIVE' ? (
                  <>
                    <Tooltip
                      title={allPromotionReady ? 'All checks passed — ready to go live' : 'Warnings found. Click the arrow to review before promotion.'}
                      arrow
                    >
                      <span>
                        <Button
                          variant="contained"
                          color="success"
                          startIcon={<RocketLaunchRoundedIcon />}
                          onClick={onPromoteToLive}
                          endIcon={
                            <Chip
                              label={`${passedCount}/${promotionChecklist.length}`}
                              size="small"
                              icon={allPromotionReady
                                ? <CheckCircleRoundedIcon style={{ fontSize: 12, color: '#fff' }} />
                                : <WarningAmberRoundedIcon style={{ fontSize: 12, color: '#fff' }} />}
                              sx={{
                                bgcolor: 'rgba(255,255,255,0.25)',
                                color: '#fff',
                                fontSize: '0.62rem',
                                height: 20,
                                fontWeight: 700,
                                '& .MuiChip-icon': { ml: '4px' },
                              }}
                            />
                          }
                        >
                          Promote Live Strategy
                        </Button>
                      </span>
                    </Tooltip>
                    <Button
                      size="small"
                      variant="outlined"
                      color={allPromotionReady ? 'success' : 'warning'}
                      onClick={(e) => setReadinessAnchor(e.currentTarget)}
                      sx={{ minWidth: 0, px: 1 }}
                    >
                      {allPromotionReady
                        ? <CheckCircleRoundedIcon sx={{ fontSize: 18, color: 'success.main' }} />
                        : <WarningAmberRoundedIcon sx={{ fontSize: 18, color: 'warning.main' }} />}
                    </Button>
                    <Popover
                      open={Boolean(readinessAnchor)}
                      anchorEl={readinessAnchor}
                      onClose={() => setReadinessAnchor(null)}
                      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                    >
                      <Box sx={{ p: 2, maxWidth: 320 }}>
                        <Typography variant="subtitle2" fontWeight={800} gutterBottom>
                          Go Live Readiness — {passedCount}/{promotionChecklist.length}
                        </Typography>
                        <Stack spacing={1}>
                          {promotionChecklist.map((item) => (
                            <Stack key={item.label} direction="row" spacing={1} alignItems="flex-start">
                              {item.passed
                                ? <CheckCircleRoundedIcon sx={{ fontSize: 16, color: 'success.main', mt: '2px', flexShrink: 0 }} />
                                : <WarningAmberRoundedIcon sx={{ fontSize: 16, color: 'warning.main', mt: '2px', flexShrink: 0 }} />}
                              <Stack spacing={0}>
                                <Typography variant="body2" fontWeight={700}>{item.label}</Typography>
                                <Typography variant="caption" color="text.secondary">{item.helper}</Typography>
                              </Stack>
                            </Stack>
                          ))}
                        </Stack>
                      </Box>
                    </Popover>
                  </>
                ) : (
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<PlayArrowRoundedIcon />}
                    onClick={onRunSelectedMode}
                    disabled={selectedStrategy == null}
                  >
                    {selectedMode === 'BACKTEST' ? 'Run Historical Test' : 'Run Paper Test'}
                  </Button>
                )}
              </Stack>
            </Stack>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <Select value={selectedMode} onChange={(event) => onModeChange(event.target.value as IntraTradeMode)}>
                  <MenuItem value="PAPER">Real-Time Paper</MenuItem>
                  <MenuItem value="BACKTEST">Historical Backtest</MenuItem>
                  <MenuItem value="LIVE">Real-Time Live</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 240 }}>
                <Select value={scanInstrumentKey} onChange={(event) => onScanInstrumentChange(event.target.value)}>
                  {instrumentOptions.map((option) => (
                    <MenuItem key={option.key} value={option.key}>{option.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 170 }}>
                <Select value={scanTimeframeKey} onChange={(event) => onScanTimeframeChange(event.target.value)}>
                  {timeframeOptions.map((option) => (
                    <MenuItem key={option.key} value={option.key}>{option.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
            {selectedMode === 'BACKTEST' && (
              <Stack spacing={1}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
                  <TextField
                    size="small"
                    type="date"
                    label="Start date"
                    value={historicalStartDate}
                    onChange={(event) => onHistoricalStartDateChange(event.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ minWidth: 180 }}
                  />
                  <TextField
                    size="small"
                    type="date"
                    label="End date"
                    value={historicalEndDate}
                    onChange={(event) => onHistoricalEndDateChange(event.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ minWidth: 180 }}
                  />
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {INTRA_MODE_CONFIG.BACKTEST.detail}
                </Typography>
              </Stack>
            )}
            {selectedStrategy ? (
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip label={selectedStrategy.strategyName} color="primary" variant="outlined" />
                  <Chip label={friendlyStrategyStatus(selectedStrategy.status).label} color={friendlyStrategyStatus(selectedStrategy.status).color} />
                  {selectedStrategy.paperEligible && <Chip label="Paper eligible" color="info" size="small" />}
                  {selectedStrategy.liveEligible && <Chip label="Live eligible" color="success" size="small" />}
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  Latest performance {formatPnlRupees(selectedStrategy.latestPerformancePnl ?? null)} across {selectedStrategy.latestExecutedTrades ?? 0} trades.
                </Typography>
              </Stack>
            ) : (
              <Alert severity="info">Choose a strategy from the left list to start paper testing.</Alert>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ borderColor: '#dbeafe', bgcolor: '#f8fbff' }}>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1}>
              <Stack spacing={0.5}>
                <Typography variant="subtitle1" fontWeight={800}>Paper Validation Runs</Typography>
                <Typography variant="body2" color="text.secondary">
                  Paper and backtest runs — use these to measure accuracy before promoting to live.
                </Typography>
              </Stack>
              {selectedExecutionSummary && (
                <Button size="small" variant="outlined" onClick={onOpenPnl} endIcon={<LaunchRoundedIcon />}>View Latest Result</Button>
              )}
            </Stack>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <Select value={paperRunModeFilter} onChange={(event) => onPaperRunModeFilterChange(event.target.value)}>
                  <MenuItem value="ALL">All modes</MenuItem>
                  <MenuItem value="PAPER">Real-Time Paper</MenuItem>
                  <MenuItem value="BACKTEST">Historical Backtest</MenuItem>
                </Select>
              </FormControl>
              <Typography variant="caption" color="text.secondary">
                {paperRunTotal} run{paperRunTotal !== 1 ? 's' : ''} total
              </Typography>
            </Stack>
            <Stack spacing={1.25}>
              {pagedValidationRuns.map((run) => {
                const modeCfg = INTRA_MODE_CONFIG[run.mode as IntraTradeMode];
                return (
                  <Box key={run.id} sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5, p: 1.5, bgcolor: '#fff' }}>
                    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1}>
                      <Stack spacing={0.5}>
                        <Typography variant="body2" fontWeight={800}>{run.strategyName}</Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                          <Chip size="small" label={run.status} />
                          {modeCfg && (
                            <Chip
                              size="small"
                              label={modeCfg.label}
                              sx={{ bgcolor: modeCfg.bg, color: modeCfg.color, border: `1px solid ${modeCfg.border}`, fontWeight: 700, fontSize: '0.65rem' }}
                            />
                          )}
                          <Chip size="small" variant="outlined" label={formatLastScan(run.evaluatedAt)} />
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {run.scanInstrumentKey} · {run.scanTimeframeInterval} {run.scanTimeframeUnit}
                        </Typography>
                      </Stack>
                      <Stack spacing={0.5} alignItems={{ xs: 'flex-start', md: 'flex-end' }}>
                        <PnlValue value={run.totalPnl} />
                        <Typography variant="caption" color="text.secondary">{run.executedTrades} trade{run.executedTrades !== 1 ? 's' : ''}</Typography>
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                          {(run.status === 'WAITING_ENTRY' || run.status === 'ENTERED') && (
                            <Tooltip title="Stop this run">
                              <Button
                                size="small"
                                variant="outlined"
                                color="warning"
                                startIcon={<StopCircleRoundedIcon sx={{ fontSize: 14 }} />}
                                sx={{ fontSize: '0.65rem', py: 0.25, px: 0.75 }}
                                onClick={() => onStopRun(run.id, run.status)}
                              >
                                Stop
                              </Button>
                            </Tooltip>
                          )}
                          {run.status !== 'WAITING_ENTRY' && run.status !== 'ENTERED' && (
                            <Tooltip title="Delete this run">
                              <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                startIcon={<DeleteRoundedIcon sx={{ fontSize: 14 }} />}
                                sx={{ fontSize: '0.65rem', py: 0.25, px: 0.75 }}
                                onClick={() => onDeleteRun(run.id)}
                              >
                                Delete
                              </Button>
                            </Tooltip>
                          )}
                        </Stack>
                      </Stack>
                    </Stack>
                  </Box>
                );
              })}
              {pagedValidationRuns.length === 0 && (
                <Alert severity="info">
                  {paperRunTotal === 0
                    ? 'Run a paper test or backtest to populate the validation evidence list.'
                    : 'No runs matched the current filter.'}
                </Alert>
              )}
            </Stack>
            <TablePagination
              component="div"
              count={paperRunTotal}
              page={paperRunPage}
              rowsPerPage={paperRunRowsPerPage}
              onPageChange={(_, nextPage) => onPaperRunPageChange(nextPage)}
              onRowsPerPageChange={(event) => { onPaperRunPageChange(0); onPaperRunRowsPerPageChange(Number(event.target.value)); }}
              rowsPerPageOptions={[5, 10, 20]}
            />
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ borderColor: allPromotionReady ? '#86efac' : '#fde68a', bgcolor: allPromotionReady ? '#f0fdf4' : '#fffbeb' }}>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={1}>
              <Stack spacing={0.25}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="subtitle1" fontWeight={800}>Go Live Readiness</Typography>
                  <Chip
                    label={`${passedCount} / ${promotionChecklist.length} checks`}
                    size="small"
                    color={allPromotionReady ? 'success' : 'warning'}
                    icon={allPromotionReady ? <CheckCircleRoundedIcon /> : <WarningAmberRoundedIcon />}
                    sx={{ fontWeight: 700 }}
                  />
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {allPromotionReady ? 'All checks passed. You can promote to live.' : 'Warnings are shown below for review before promoting.'}
                </Typography>
              </Stack>
              <Button
                variant="contained"
                color="success"
                startIcon={<RocketLaunchRoundedIcon />}
                onClick={onPromoteToLive}
              >
                Promote Live Strategy
              </Button>
            </Stack>
            <Stack spacing={1}>
              {promotionChecklist.map((item) => (
                <Alert key={item.label} severity={item.passed ? 'success' : 'warning'} icon={item.passed ? <CheckCircleRoundedIcon fontSize="inherit" /> : <WarningAmberRoundedIcon fontSize="inherit" />}>
                  <strong>{item.label}</strong>: {item.helper}
                </Alert>
              ))}
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  </Stack>
  );
};
