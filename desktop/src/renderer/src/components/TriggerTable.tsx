import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import PauseCircleRoundedIcon from '@mui/icons-material/PauseCircleRounded';
import PlayCircleRoundedIcon from '@mui/icons-material/PlayCircleRounded';
import StopCircleRoundedIcon from '@mui/icons-material/StopCircleRounded';
import type { AdminTrigger } from '../api/admin';
import {
  findTimeframeLabel,
  formatTriggerDateTime,
  formatTriggerSchedule,
  getInstrumentLabel,
  getJobOption,
  getLifecycleActions,
  getRunStatusIcon,
  getStatusTone,
  getTabLabel,
  type InstrumentOption,
  type TimeframeOption,
  type TriggerAction,
  type TriggerTab,
} from './ManageTriggersShared';

export interface TriggerTableProps {
  items: AdminTrigger[];
  totalElements: number;
  triggersPage: number;
  triggersRowsPerPage: number;
  actionLoadingId: number | null;
  activeFilterChips: string[];
  activeTabOption: { value: TriggerTab; label: string; count: number } | undefined;
  activeTab: TriggerTab;
  summary: {
    filteredTotal: number;
    pausedCount: number;
    failedCount: number;
  };
  baseInstruments: InstrumentOption[];
  baseTimeframes: TimeframeOption[];
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rowsPerPage: number) => void;
  onAction: (trigger: AdminTrigger, action: TriggerAction) => void;
  onEdit: (trigger: AdminTrigger) => void;
  onDelete: (trigger: AdminTrigger) => void;
}

export const TriggerTable = ({
  items,
  totalElements,
  triggersPage,
  triggersRowsPerPage,
  actionLoadingId,
  activeFilterChips,
  activeTabOption,
  activeTab,
  summary,
  baseInstruments,
  baseTimeframes,
  onPageChange,
  onRowsPerPageChange,
  onAction,
  onEdit,
  onDelete,
}: TriggerTableProps) => (
  <Box sx={{ px: { xs: 2, md: 3 }, pb: { xs: 2, md: 3 } }}>
    <Box sx={{ px: 0, pt: 2.5, pb: 1.5 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={1.25}>
        <Box>
          <Typography variant="subtitle1" fontWeight={700}>Configured Trigger Browser</Typography>
          <Typography variant="body2" color="text.secondary">
            Showing page {triggersPage + 1} for {getTabLabel(activeTabOption, activeTab)}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
          <Chip label={`Filtered ${summary.filteredTotal}`} size="small" />
          <Chip label={`Paused ${summary.pausedCount}`} size="small" color="warning" />
          <Chip label={`Failed ${summary.failedCount}`} size="small" color={summary.failedCount > 0 ? 'error' : 'default'} />
        </Stack>
      </Stack>
    </Box>

    <TableContainer component={Paper} sx={{ border: '1px solid', borderColor: 'divider' }}>
      <Table
        size="small"
        sx={{
          '& .MuiTableHead-root .MuiTableCell-root': {
            whiteSpace: 'nowrap',
            fontWeight: 700,
          },
          '& .MuiTableBody-root .MuiTableCell-root': {
            verticalAlign: 'top',
          },
        }}
      >
        <TableHead>
          <TableRow>
            <TableCell>Job</TableCell>
            <TableCell>Instrument</TableCell>
            <TableCell>Timeframe</TableCell>
            <TableCell>Schedule</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Last Result</TableCell>
            <TableCell>Next Run</TableCell>
            <TableCell>Last Run</TableCell>
            <TableCell>Last Error</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {totalElements === 0 ? (
            <TableRow>
              <TableCell colSpan={10} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                {activeFilterChips.length === 0
                  ? `No ${getTabLabel(activeTabOption, activeTab).toLowerCase()} configured yet. Use the form above to create one.`
                  : 'No jobs match the current filters. Clear or adjust the filters to widen the view.'}
              </TableCell>
            </TableRow>
          ) : (
            items.map((trigger) => {
              const actions = getLifecycleActions(trigger.status);
              const job = getJobOption(trigger.jobKey);
              const loadingAction = actionLoadingId === trigger.id;
              return (
                <TableRow key={trigger.id} hover>
                  <TableCell sx={{ minWidth: 220 }}>
                    <Stack spacing={0.6}>
                      <Typography variant="body2" fontWeight={700}>{job.label}</Typography>
                      <Stack direction="row" spacing={0.75} flexWrap="wrap" gap={0.75}>
                        <Chip label={trigger.jobNatureLabel ?? job.label} size="small" variant="outlined" />
                        {trigger.oneTime ? <Chip label="One-time" size="small" color="secondary" variant="outlined" /> : null}
                      </Stack>
                      <Typography variant="caption" color="text.secondary">{job.description}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Stack spacing={0.25}>
                      <Typography variant="body2" fontWeight={700}>
                        {getInstrumentLabel(baseInstruments, trigger.instrumentKey)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {baseInstruments.find((instrument) => instrument.key === trigger.instrumentKey)?.exchange ?? 'NSE/BSE'}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    {findTimeframeLabel(baseTimeframes, trigger.timeframeUnit, trigger.timeframeInterval)}
                  </TableCell>
                  <TableCell>{formatTriggerSchedule(trigger)}</TableCell>
                  <TableCell>
                    <Chip
                      label={trigger.status}
                      size="small"
                      color={getStatusTone(trigger.status)}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={trigger.lastRunStatus}
                      size="small"
                      color={getStatusTone(trigger.lastRunStatus)}
                      icon={getRunStatusIcon(trigger.lastRunStatus)}
                    />
                  </TableCell>
                  <TableCell>{formatTriggerDateTime(trigger.nextRunAt)}</TableCell>
                  <TableCell>{formatTriggerDateTime(trigger.lastRunAt)}</TableCell>
                  <TableCell sx={{ maxWidth: 220 }}>
                    {trigger.lastError ? (
                      <Tooltip title={trigger.lastError}>
                        <Typography variant="caption" color="error" noWrap display="block">
                          {trigger.lastError}
                        </Typography>
                      </Tooltip>
                    ) : '—'}
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end" flexWrap="wrap">
                      {actions.canStart && (
                        <Button
                          size="small"
                          variant="outlined"
                          color="success"
                          startIcon={loadingAction ? <CircularProgress size={12} /> : <PlayCircleRoundedIcon fontSize="small" />}
                          onClick={() => { onAction(trigger, 'start'); }}
                          disabled={loadingAction}
                        >
                          Start
                        </Button>
                      )}
                      {actions.canPause && (
                        <Button
                          size="small"
                          variant="outlined"
                          color="warning"
                          startIcon={loadingAction ? <CircularProgress size={12} /> : <PauseCircleRoundedIcon fontSize="small" />}
                          onClick={() => { onAction(trigger, 'pause'); }}
                          disabled={loadingAction}
                        >
                          Pause
                        </Button>
                      )}
                      {actions.canResume && (
                        <Button
                          size="small"
                          variant="outlined"
                          color="info"
                          startIcon={loadingAction ? <CircularProgress size={12} /> : <AutorenewRoundedIcon fontSize="small" />}
                          onClick={() => { onAction(trigger, 'resume'); }}
                          disabled={loadingAction}
                        >
                          Resume
                        </Button>
                      )}
                      {actions.canStop && (
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          startIcon={loadingAction ? <CircularProgress size={12} /> : <StopCircleRoundedIcon fontSize="small" />}
                          onClick={() => { onAction(trigger, 'stop'); }}
                          disabled={loadingAction}
                        >
                          Stop
                        </Button>
                      )}
                      {actions.canEdit && (
                        <Button
                          size="small"
                          variant="outlined"
                          color="secondary"
                          startIcon={loadingAction ? <CircularProgress size={12} /> : <EditRoundedIcon fontSize="small" />}
                          onClick={() => onEdit(trigger)}
                          disabled={loadingAction}
                        >
                          Edit
                        </Button>
                      )}
                      {actions.canDelete && (
                        <Button
                          size="small"
                          variant="outlined"
                          color="inherit"
                          startIcon={loadingAction ? <CircularProgress size={12} /> : <DeleteOutlineRoundedIcon fontSize="small" />}
                          onClick={() => { onDelete(trigger); }}
                          disabled={loadingAction}
                        >
                          Delete
                        </Button>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </TableContainer>

    {totalElements > 0 && (
      <Box
        data-testid="configured-triggers-pagination"
        sx={{ border: '1px solid', borderColor: 'divider', borderTop: 0, borderRadius: '0 0 4px 4px' }}
      >
        <TablePagination
          component="div"
          count={totalElements}
          page={triggersPage}
          onPageChange={(_, nextPage) => onPageChange(nextPage)}
          rowsPerPage={triggersRowsPerPage}
          onRowsPerPageChange={(event) => {
            onRowsPerPageChange(parseInt(event.target.value, 10));
          }}
          rowsPerPageOptions={[10, 25, 50, 100]}
          labelRowsPerPage="Triggers per page"
          showFirstButton
          showLastButton
          sx={{ '& .MuiTablePagination-toolbar': { minHeight: 44 }, '& .MuiTablePagination-displayedRows': { fontSize: '0.78rem' } }}
        />
      </Box>
    )}
  </Box>
);
