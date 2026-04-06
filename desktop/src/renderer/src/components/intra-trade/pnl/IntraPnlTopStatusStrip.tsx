import { Alert, Chip, Stack, Typography } from '@mui/material';
import type { IntraPnlSummary } from '../../../api/admin';
import { formatPnlRupees } from '../IntraTradeShared';
import type { PnlFilterState } from './pnlTypes';
import { pnlColor } from './pnlUtils';

const describePreset = (preset: PnlFilterState['preset']) => {
  if (preset === 'DAY') return 'Today';
  if (preset === 'WEEK') return 'Week';
  if (preset === 'MONTH') return 'Month';
  return 'Custom';
};

export const IntraPnlTopStatusStrip = ({
  filters,
  summary,
  openExposureCount,
  lastRefreshed,
}: {
  filters: PnlFilterState;
  summary: IntraPnlSummary | null | undefined;
  openExposureCount: number;
  lastRefreshed: Date | null;
}) => {
  const activeFilters = [
    filters.mode !== 'ALL' ? `Mode: ${filters.mode}` : null,
    filters.status !== 'ALL' ? `Status: ${filters.status}` : null,
    `Range: ${describePreset(filters.preset)}`,
    filters.strategyFilter ? `Strategy: ${filters.strategyFilter}` : null,
    filters.instrumentFilter ? `Instrument: ${filters.instrumentFilter}` : null,
    filters.accountFilter ? `Account: ${filters.accountFilter}` : null,
  ].filter(Boolean) as string[];

  const unrealized = summary?.unrealizedPnl ?? 0;
  const exposureLabel = openExposureCount > 0 ? `${openExposureCount} open` : 'No open positions';
  const riskColor = openExposureCount === 0 ? 'default' : unrealized >= 0 ? 'success' : 'error';

  return (
    <Alert
      severity="info"
      icon={false}
      sx={{ border: '1px solid', borderColor: 'divider', bgcolor: '#f8fafc' }}
      data-testid="intra-pnl-status-strip"
    >
      <Stack spacing={1}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={1}>
          <Stack direction="row" gap={1} flexWrap="wrap">
            <Chip size="small" label={exposureLabel} color={riskColor} data-testid="intra-pnl-risk-chip" />
            <Chip
              size="small"
              label={`Unrealized: ${formatPnlRupees(unrealized)}`}
              sx={{ color: pnlColor(unrealized), borderColor: 'divider' }}
              variant="outlined"
            />
          </Stack>
          <Typography variant="caption" color="text.secondary" data-testid="intra-pnl-last-refresh">
            {lastRefreshed ? `Last dashboard refresh: ${lastRefreshed.toLocaleTimeString('en-IN')}` : 'Dashboard not refreshed yet'}
          </Typography>
        </Stack>
        <Stack direction="row" gap={0.75} flexWrap="wrap" data-testid="intra-pnl-active-filters">
          {activeFilters.map((chip) => (
            <Chip key={chip} label={chip} size="small" variant="outlined" />
          ))}
        </Stack>
      </Stack>
    </Alert>
  );
};
