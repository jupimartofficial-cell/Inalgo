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
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import PauseCircleRoundedIcon from '@mui/icons-material/PauseCircleRounded';
import PlayCircleRoundedIcon from '@mui/icons-material/PlayCircleRounded';
import StopCircleRoundedIcon from '@mui/icons-material/StopCircleRounded';

import type { MigrationJob, MigrationStatus } from '../api/admin';
import {
  DEFAULT_MIGRATION_JOB_TYPE,
  InstrumentBadge,
  StatusIcon,
  TimeframeBadge,
  buildJobKey,
  formatDateTime,
  getJobActionState,
  statusTone,
  toJobStatus,
  type JobAction,
} from './AppShellShared';

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface MigrationStateTableProps {
  statusRows: MigrationStatus[];
  migrationStatusPageRows: MigrationStatus[];
  migrationStatusPage: number;
  migrationStatusRowsPerPage: number;
  jobActionLoading: string | null;
  hasAppliedMigrationFilters: boolean;
  jobsByKey: Map<string, MigrationJob>;
  onMigrationStatusPageChange: (page: number) => void;
  onMigrationStatusRowsPerPageChange: (rowsPerPage: number) => void;
  onJobAction: (job: MigrationJob, action: JobAction) => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export const MigrationStateTable = ({
  statusRows,
  migrationStatusPageRows,
  migrationStatusPage,
  migrationStatusRowsPerPage,
  jobActionLoading,
  hasAppliedMigrationFilters,
  jobsByKey,
  onMigrationStatusPageChange,
  onMigrationStatusRowsPerPageChange,
  onJobAction,
}: MigrationStateTableProps) => (
  <Box>
    <TableContainer component={Paper} sx={{ border: '1px solid', borderColor: 'divider' }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>Instrument</TableCell>
            <TableCell>Timeframe</TableCell>
            <TableCell>Next From Date</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="center">Completed</TableCell>
            <TableCell>Last Run At</TableCell>
            <TableCell>Last Error</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {statusRows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                {hasAppliedMigrationFilters
                  ? 'No migration status rows match the current filters.'
                  : 'No migration state data. Run "Refresh" to load.'}
              </TableCell>
            </TableRow>
          ) : (
            migrationStatusPageRows.map((row) => {
              const jobKey = buildJobKey(
                row.instrumentKey,
                row.timeframeUnit,
                row.timeframeInterval,
                DEFAULT_MIGRATION_JOB_TYPE,
              );
              const linkedJob = jobsByKey.get(jobKey);
              const normalizedStatus = toJobStatus(row.lastRunStatus);
              const inferredStatus = row.completed
                ? 'COMPLETED'
                : ['RUNNING', 'RESUMED', 'PAUSED', 'STOPPED', 'FAILED', 'PENDING'].includes(normalizedStatus)
                  ? normalizedStatus
                  : 'PENDING';
              const actionJob: MigrationJob = linkedJob ?? {
                instrumentKey: row.instrumentKey,
                timeframeUnit: row.timeframeUnit,
                timeframeInterval: row.timeframeInterval,
                jobType: DEFAULT_MIGRATION_JOB_TYPE,
                bootstrapFromDate: row.nextFromDate,
                status: inferredStatus,
                progressPercent: row.completed ? 100 : 0,
                lastError: row.lastError,
                nextFromDate: row.nextFromDate,
                updatedAt: row.updatedAt,
              };
              const actionLoading = jobActionLoading === jobKey;
              const { canStart, canPause, canResume, canStop, startActionLabel } = getJobActionState(actionJob.status);

              return (
                <TableRow key={`${row.instrumentKey}-${row.timeframeUnit}-${row.timeframeInterval}`}>
                  <TableCell><InstrumentBadge instrumentKey={row.instrumentKey} /></TableCell>
                  <TableCell><TimeframeBadge unit={row.timeframeUnit} interval={row.timeframeInterval} /></TableCell>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace" fontSize="0.78rem">
                      {row.nextFromDate}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={row.lastRunStatus}
                      size="small"
                      color={statusTone(row.lastRunStatus)}
                      icon={<StatusIcon status={row.lastRunStatus} />}
                    />
                  </TableCell>
                  <TableCell align="center">
                    {row.completed
                      ? <CheckCircleRoundedIcon color="success" fontSize="small" />
                      : <Typography variant="body2" color="text.secondary">—</Typography>}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {row.lastRunAt ? formatDateTime(row.lastRunAt) : '—'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ maxWidth: 200 }}>
                    {row.lastError ? (
                      <Tooltip title={row.lastError}>
                        <Typography variant="caption" color="error" sx={{ cursor: 'help' }} noWrap display="block">
                          {row.lastError}
                        </Typography>
                      </Tooltip>
                    ) : (
                      <Typography variant="body2" color="text.secondary">—</Typography>
                    )}
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end" flexWrap="wrap">
                      {canStart && (
                        <Button
                          size="small"
                          variant="outlined"
                          color="success"
                          startIcon={actionLoading ? <CircularProgress size={12} /> : <PlayCircleRoundedIcon fontSize="small" />}
                          onClick={() => { void onJobAction(actionJob, 'start'); }}
                          disabled={actionLoading}
                        >
                          {startActionLabel}
                        </Button>
                      )}
                      {canPause && (
                        <Button
                          size="small"
                          variant="outlined"
                          color="warning"
                          startIcon={actionLoading ? <CircularProgress size={12} /> : <PauseCircleRoundedIcon fontSize="small" />}
                          onClick={() => { void onJobAction(actionJob, 'pause'); }}
                          disabled={actionLoading}
                        >
                          Pause
                        </Button>
                      )}
                      {canResume && (
                        <Button
                          size="small"
                          variant="outlined"
                          color="info"
                          startIcon={actionLoading ? <CircularProgress size={12} /> : <AutorenewRoundedIcon fontSize="small" />}
                          onClick={() => { void onJobAction(actionJob, 'resume'); }}
                          disabled={actionLoading}
                        >
                          Resume
                        </Button>
                      )}
                      {canStop && (
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          startIcon={actionLoading ? <CircularProgress size={12} /> : <StopCircleRoundedIcon fontSize="small" />}
                          onClick={() => { void onJobAction(actionJob, 'stop'); }}
                          disabled={actionLoading}
                        >
                          Stop
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
    {statusRows.length > 0 && (
      <Box
        data-testid="migration-status-pagination"
        sx={{ border: '1px solid', borderColor: 'divider', borderTop: 0, borderRadius: '0 0 4px 4px' }}
      >
        <TablePagination
          component="div"
          count={statusRows.length}
          page={migrationStatusPage}
          onPageChange={(_, nextPage) => onMigrationStatusPageChange(nextPage)}
          rowsPerPage={migrationStatusRowsPerPage}
          onRowsPerPageChange={(event) => {
            onMigrationStatusRowsPerPageChange(parseInt(event.target.value, 10));
          }}
          rowsPerPageOptions={[10, 25, 50, 100]}
          labelRowsPerPage="Rows per page"
          showFirstButton
          showLastButton
          sx={{ '& .MuiTablePagination-toolbar': { minHeight: 44 }, '& .MuiTablePagination-displayedRows': { fontSize: '0.78rem' } }}
        />
      </Box>
    )}
  </Box>
);
