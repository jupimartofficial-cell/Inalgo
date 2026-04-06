import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  TablePagination,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';

import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import ClearRoundedIcon from '@mui/icons-material/ClearRounded';
import FilterAltRoundedIcon from '@mui/icons-material/FilterAltRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded';

import type { MigrationJob, MigrationStatus, UpstoxTokenStatus } from '../api/admin';
import {
  INSTRUMENTS,
  JobCard,
  buildJobKey,
  formatDateTime,
  statusTone,
  type JobAction,
} from './AppShellShared';
import { MigrationStateTable } from './MigrationStateTable';

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface MigrationSectionProps {
  statusRows: MigrationStatus[];
  jobs: MigrationJob[];
  migrationTab: number;
  migrationInstrumentKey: string;
  statusUnit: string;
  statusInterval: string;
  migrationLoading: boolean;
  runtimeJobsPage: number;
  runtimeJobsRowsPerPage: number;
  migrationStatusPage: number;
  migrationStatusRowsPerPage: number;
  jobActionLoading: string | null;
  autoRefresh: boolean;
  upstoxToken: string;
  upstoxTokenStatus: UpstoxTokenStatus | null;
  upstoxTokenLoading: boolean;
  upstoxTokenSaving: boolean;
  migrationError: string;
  hasAppliedMigrationFilters: boolean;
  runtimeJobsPageRows: MigrationJob[];
  migrationStatusPageRows: MigrationStatus[];
  jobsByKey: Map<string, MigrationJob>;
  onAutoRefreshToggle: () => void;
  onRefresh: () => void;
  onMigrationTabChange: (tab: number) => void;
  onMigrationInstrumentKeyChange: (value: string) => void;
  onStatusUnitChange: (value: string) => void;
  onStatusIntervalChange: (value: string) => void;
  onApplyMigrationFilters: () => void;
  onClearMigrationFilters: () => void;
  onRuntimeJobsPageChange: (page: number) => void;
  onRuntimeJobsRowsPerPageChange: (rowsPerPage: number) => void;
  onMigrationStatusPageChange: (page: number) => void;
  onMigrationStatusRowsPerPageChange: (rowsPerPage: number) => void;
  onJobAction: (job: MigrationJob, action: JobAction) => void;
  onUpstoxTokenChange: (value: string) => void;
  onUpdateUpstoxToken: () => void;
  onRefreshUpstoxTokenStatus: () => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export const MigrationSection = ({
  statusRows,
  jobs,
  migrationTab,
  migrationInstrumentKey,
  statusUnit,
  statusInterval,
  migrationLoading,
  runtimeJobsPage,
  runtimeJobsRowsPerPage,
  migrationStatusPage,
  migrationStatusRowsPerPage,
  jobActionLoading,
  autoRefresh,
  upstoxToken,
  upstoxTokenStatus,
  upstoxTokenLoading,
  upstoxTokenSaving,
  migrationError,
  hasAppliedMigrationFilters,
  runtimeJobsPageRows,
  migrationStatusPageRows,
  jobsByKey,
  onAutoRefreshToggle,
  onRefresh,
  onMigrationTabChange,
  onMigrationInstrumentKeyChange,
  onStatusUnitChange,
  onStatusIntervalChange,
  onApplyMigrationFilters,
  onClearMigrationFilters,
  onRuntimeJobsPageChange,
  onRuntimeJobsRowsPerPageChange,
  onMigrationStatusPageChange,
  onMigrationStatusRowsPerPageChange,
  onJobAction,
  onUpstoxTokenChange,
  onUpdateUpstoxToken,
  onRefreshUpstoxTokenStatus,
}: MigrationSectionProps) => {
  const runningJobs = jobs.filter((j) => j.status === 'RUNNING' || j.status === 'RESUMED');

  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1.5}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Migration Jobs</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage data ingestion jobs across all instruments and timeframes
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
          <Tooltip title={autoRefresh ? 'Disable auto-refresh' : 'Enable 5s auto-refresh'}>
            <Button
              variant={autoRefresh ? 'contained' : 'outlined'}
              size="small"
              color="secondary"
              startIcon={<AutorenewRoundedIcon sx={{ animation: autoRefresh ? 'spin 2s linear infinite' : 'none', '@keyframes spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } } }} />}
              onClick={onAutoRefreshToggle}
            >
              Auto-Refresh
            </Button>
          </Tooltip>
          <Button
            variant="outlined"
            size="small"
            startIcon={migrationLoading ? <CircularProgress size={14} /> : <RefreshRoundedIcon />}
            onClick={onRefresh}
            disabled={migrationLoading}
          >
            Refresh
          </Button>
        </Stack>
      </Stack>

      {migrationError && (
        <Alert severity="error" sx={{ py: 0.5 }}>
          {migrationError}
        </Alert>
      )}

      {/* Upstox token */}
      <Card>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.75 }}>
                Upstox Access Token
              </Typography>
              <TextField
                fullWidth
                size="small"
                type="password"
                placeholder="Paste the latest Upstox token"
                value={upstoxToken}
                onChange={(e) => onUpstoxTokenChange(e.target.value)}
              />
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                variant="contained"
                size="small"
                onClick={onUpdateUpstoxToken}
                disabled={upstoxTokenSaving || upstoxTokenLoading}
              >
                {upstoxTokenSaving ? <CircularProgress size={16} color="inherit" /> : 'Update Token'}
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={onRefreshUpstoxTokenStatus}
                disabled={upstoxTokenLoading}
              >
                {upstoxTokenLoading ? <CircularProgress size={16} /> : 'Refresh Status'}
              </Button>
            </Stack>
            <Stack spacing={0.5} sx={{ minWidth: 180 }}>
              <Typography variant="caption" color="text.secondary">
                Status
              </Typography>
              <Chip
                size="small"
                color={upstoxTokenStatus?.configured ? 'success' : 'warning'}
                label={upstoxTokenStatus?.configured ? 'Configured' : 'Not Configured'}
                sx={{ width: 'fit-content' }}
              />
              {upstoxTokenStatus?.updatedAt && (
                <Typography variant="caption" color="text.secondary">
                  Updated: {formatDateTime(upstoxTokenStatus.updatedAt)}
                </Typography>
              )}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* Filter row */}
      <Card>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
            <FilterAltRoundedIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
            <FormControl size="small" sx={{ minWidth: 220 }} data-testid="migration-instrument-filter">
              <InputLabel shrink>Instrument</InputLabel>
              <Select
                native
                value={migrationInstrumentKey}
                onChange={(e) => onMigrationInstrumentKeyChange(e.target.value)}
                label="Instrument"
                inputProps={{ 'aria-label': 'Instrument' }}
              >
                <option value="">All Instruments</option>
                {INSTRUMENTS.map((instrument) => (
                  <option key={instrument.key} value={instrument.key}>
                    {instrument.label}
                  </option>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Filter Unit</InputLabel>
              <Select value={statusUnit} onChange={(e) => onStatusUnitChange(e.target.value)} label="Filter Unit">
                <MenuItem value="">All Units</MenuItem>
                <MenuItem value="minutes">Minutes</MenuItem>
                <MenuItem value="days">Days</MenuItem>
                <MenuItem value="weeks">Weeks</MenuItem>
                <MenuItem value="months">Months</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Interval"
              type="number"
              size="small"
              value={statusInterval}
              onChange={(e) => onStatusIntervalChange(e.target.value)}
              sx={{ width: 100 }}
            />
            <Button size="small" variant="outlined" onClick={onApplyMigrationFilters}>
              Apply Filters
            </Button>
            {(migrationInstrumentKey || statusUnit || statusInterval) && (
              <IconButton size="small" onClick={onClearMigrationFilters}>
                <ClearRoundedIcon fontSize="small" />
              </IconButton>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Tabs value={migrationTab} onChange={(_, v) => onMigrationTabChange(v)} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
        <Tab label={
          <Stack direction="row" spacing={0.75} alignItems="center">
            <span>Runtime Jobs</span>
            {runningJobs.length > 0 && (
              <Badge badgeContent={runningJobs.length} color="info" sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', height: 16, minWidth: 16 } }} />
            )}
          </Stack>
        } />
        <Tab label={
          <Stack direction="row" spacing={0.75} alignItems="center">
            <span>Migration State</span>
            <Badge badgeContent={statusRows.length} color="primary" sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', height: 16, minWidth: 16 } }} />
          </Stack>
        } />
      </Tabs>

      {/* Runtime Jobs tab */}
      {migrationTab === 0 && (
        <Box>
          {jobs.length === 0 ? (
            <Paper sx={{ p: 6, textAlign: 'center', border: '2px dashed', borderColor: 'divider' }}>
              <RocketLaunchRoundedIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
              <Typography variant="h6" color="text.secondary">
                {hasAppliedMigrationFilters ? 'No migration jobs match current filters' : 'No migration jobs running'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {hasAppliedMigrationFilters
                  ? 'Adjust the migration filters or clear them to view all configured jobs.'
                  : 'No configured migration jobs were found for this tenant.'}
              </Typography>
            </Paper>
          ) : (
            <Grid container spacing={2}>
              {runtimeJobsPageRows.map((job) => (
                <Grid
                  item
                  xs={12}
                  sm={6}
                  lg={4}
                  key={buildJobKey(job.instrumentKey, job.timeframeUnit, job.timeframeInterval, job.jobType)}
                >
                  <JobCard
                    job={job}
                    onAction={onJobAction}
                    loading={jobActionLoading === buildJobKey(job.instrumentKey, job.timeframeUnit, job.timeframeInterval, job.jobType)}
                  />
                </Grid>
              ))}
            </Grid>
          )}

          {jobs.length > 0 && (
            <Card sx={{ mt: 2, bgcolor: '#f8fafc' }}>
              <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Stack direction="row" spacing={2} flexWrap="wrap" gap={1}>
                  {(['RUNNING', 'RESUMED', 'PAUSED', 'STOPPED', 'COMPLETED', 'FAILED'] as const).map((s) => {
                    const count = jobs.filter((j) => j.status === s).length;
                    if (count === 0) return null;
                    return (
                      <Stack key={s} direction="row" spacing={0.5} alignItems="center">
                        <Chip label={`${s}: ${count}`} size="small" color={statusTone(s)} />
                      </Stack>
                    );
                  })}
                </Stack>
              </CardContent>
            </Card>
          )}
          {jobs.length > 0 && (
            <Box data-testid="runtime-jobs-pagination" sx={{ mt: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              <TablePagination
                component="div"
                count={jobs.length}
                page={runtimeJobsPage}
                onPageChange={(_, nextPage) => onRuntimeJobsPageChange(nextPage)}
                rowsPerPage={runtimeJobsRowsPerPage}
                onRowsPerPageChange={(event) => {
                  onRuntimeJobsRowsPerPageChange(parseInt(event.target.value, 10));
                }}
                rowsPerPageOptions={[6, 12, 18, 24]}
                labelRowsPerPage="Jobs per page"
                showFirstButton
                showLastButton
                sx={{ '& .MuiTablePagination-toolbar': { minHeight: 44 }, '& .MuiTablePagination-displayedRows': { fontSize: '0.78rem' } }}
              />
            </Box>
          )}
        </Box>
      )}

      {/* Migration State tab */}
      {migrationTab === 1 && (
        <MigrationStateTable
          statusRows={statusRows}
          migrationStatusPageRows={migrationStatusPageRows}
          migrationStatusPage={migrationStatusPage}
          migrationStatusRowsPerPage={migrationStatusRowsPerPage}
          jobActionLoading={jobActionLoading}
          hasAppliedMigrationFilters={hasAppliedMigrationFilters}
          jobsByKey={jobsByKey}
          onMigrationStatusPageChange={onMigrationStatusPageChange}
          onMigrationStatusRowsPerPageChange={onMigrationStatusRowsPerPageChange}
          onJobAction={onJobAction}
        />
      )}
    </Stack>
  );
};
