import {
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';

import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import QueryStatsRoundedIcon from '@mui/icons-material/QueryStatsRounded';
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';

import type { MigrationJob, MigrationStatus } from '../api/admin';
import {
  INSTRUMENTS,
  InstrumentBadge,
  StatCard,
  TIMEFRAME_OPTIONS,
} from './AppShellShared';

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface DashboardSectionProps {
  statusRows: MigrationStatus[];
  jobs: MigrationJob[];
  totalElements: number;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export const DashboardSection = ({ statusRows, jobs, totalElements }: DashboardSectionProps) => {
  const runningJobs = jobs.filter((j) => j.status === 'RUNNING' || j.status === 'RESUMED');
  const completedStreams = statusRows.filter((r) => r.completed).length;
  const failedStreams = statusRows.filter((r) => r.lastRunStatus?.toLowerCase().includes('fail')).length;

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" fontWeight={700}>Dashboard</Typography>
        <Typography variant="body2" color="text.secondary">
          Platform overview — InAlgo Trade Data Console
        </Typography>
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            icon={<RocketLaunchRoundedIcon />}
            label="Migration Streams"
            value={statusRows.length}
            color="#1a3a6b"
            subtext={`${completedStreams} completed`}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            icon={<TrendingUpRoundedIcon />}
            label="Active Jobs"
            value={runningJobs.length}
            color="#0ea5e9"
            subtext={`${jobs.length} total jobs`}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            icon={<QueryStatsRoundedIcon />}
            label="Historical Candles"
            value={totalElements.toLocaleString()}
            color="#10b981"
            subtext="in current view"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            icon={failedStreams > 0 ? <ErrorRoundedIcon /> : <CheckCircleRoundedIcon />}
            label="Failed Streams"
            value={failedStreams}
            color={failedStreams > 0 ? '#ef4444' : '#10b981'}
            subtext={failedStreams > 0 ? 'Needs attention' : 'All healthy'}
          />
        </Grid>
      </Grid>

      {/* Quick Instrument Status */}
      <Card>
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
            Instruments Overview
          </Typography>
          <Grid container spacing={2}>
            {INSTRUMENTS.map((inst) => {
              const instStreams = statusRows.filter((r) => r.instrumentKey === inst.key);
              const instCompleted = instStreams.filter((r) => r.completed).length;
              return (
                <Grid item xs={12} md={4} key={inst.key}>
                  <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                      <InstrumentBadge instrumentKey={inst.key} />
                      <Chip
                        label={`${instCompleted}/${instStreams.length}`}
                        size="small"
                        color={instCompleted === instStreams.length && instStreams.length > 0 ? 'success' : 'default'}
                      />
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={instStreams.length > 0 ? (instCompleted / instStreams.length) * 100 : 0}
                      color="success"
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      {instCompleted} of {instStreams.length} timeframes completed
                    </Typography>
                  </Box>
                </Grid>
              );
            })}
          </Grid>
        </CardContent>
      </Card>

      {/* Timeframe summary */}
      <Card>
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
            Timeframe Coverage
          </Typography>
          <Grid container spacing={1}>
            {TIMEFRAME_OPTIONS.map((tf) => {
              const tfStreams = statusRows.filter((r) => r.timeframeUnit === tf.unit && r.timeframeInterval === tf.interval);
              const tfCompleted = tfStreams.filter((r) => r.completed).length;
              return (
                <Grid item xs={6} sm={4} md={3} key={`${tf.unit}-${tf.interval}`}>
                  <Box sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1.5, textAlign: 'center' }}>
                    <Chip
                      label={tf.label}
                      size="small"
                      color={tfCompleted === tfStreams.length && tfStreams.length > 0 ? 'success' : tfCompleted > 0 ? 'info' : 'default'}
                      sx={{ mb: 0.5 }}
                    />
                    <Typography variant="caption" display="block" color="text.secondary">
                      {tfCompleted}/{tfStreams.length} done
                    </Typography>
                  </Box>
                </Grid>
              );
            })}
          </Grid>
        </CardContent>
      </Card>
    </Stack>
  );
};
