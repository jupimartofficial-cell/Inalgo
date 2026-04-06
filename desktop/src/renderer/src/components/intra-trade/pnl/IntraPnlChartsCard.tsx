import { Alert, Box, Card, CardContent, Chip, Collapse, Grid, Stack, Typography } from '@mui/material';
import type { IntraPnlDashboard } from '../../../api/admin';
import { formatPnlRupees } from '../IntraTradeShared';
import { PnlSectionHeader } from './PnlSectionHeader';
import { fmtDate, pnlColor } from './pnlUtils';

const ChartRows = ({ rows }: { rows: Array<{ date: string; value: number; mode: 'LIVE' | 'PAPER' }> }) => {
  const maxAbs = Math.max(1, ...rows.map((p) => Math.abs(p.value)));
  return (
    <Stack spacing={0.6}>
      {rows.map((point) => (
        <Stack key={point.date + '-' + point.mode} direction="row" spacing={1} alignItems="center">
          <Chip size="small" label={point.mode} color={point.mode === 'LIVE' ? 'success' : 'info'} sx={{ minWidth: 50, height: 18, fontSize: '0.65rem' }} />
          <Typography variant="caption" sx={{ minWidth: 60, color: 'text.secondary' }}>{fmtDate(point.date)}</Typography>
          <Box sx={{ flex: 1, height: 10, bgcolor: '#e2e8f0', borderRadius: 1, position: 'relative', overflow: 'hidden' }}>
            <Box sx={{ width: Math.max(2, Math.abs(point.value) / maxAbs * 100) + '%', height: '100%', bgcolor: !(point.value < 0) ? '#15803d' : '#b91c1c', borderRadius: 1 }} />
          </Box>
          <Typography variant="caption" fontWeight={700} sx={{ color: pnlColor(point.value), minWidth: 72, textAlign: 'right', fontSize: '0.72rem' }}>
            {formatPnlRupees(point.value)}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
};

export const IntraPnlChartsCard = ({
  open,
  dashboard,
  onToggle,
}: {
  open: boolean;
  dashboard: IntraPnlDashboard | null;
  onToggle: () => void;
}) => {
  const trend = (dashboard?.dailyTrend ?? []).slice(-14);
  const cumulative = (dashboard?.cumulative ?? []).slice(-14);

  return (
    <Card data-testid="intra-pnl-charts-card">
      <CardContent>
        <PnlSectionHeader title="Performance Charts" open={open} onToggle={onToggle} />
        <Collapse in={open}>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" fontWeight={700} color="text.secondary" gutterBottom>
                Daily P&L Trend
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Scale: latest 14 points, bar width proportional to absolute P&L.
              </Typography>
              {trend.length > 0 ? (
                <ChartRows rows={trend} />
              ) : (
                <Alert severity="info" sx={{ py: 0.5 }}>No trend data. Run monitor/backtest and re-open this page.</Alert>
              )}
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" fontWeight={700} color="text.secondary" gutterBottom>
                Cumulative P&L
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Scale: running cumulative value for the same 14-point window.
              </Typography>
              {cumulative.length > 0 ? (
                <ChartRows rows={cumulative} />
              ) : (
                <Alert severity="info" sx={{ py: 0.5 }}>No cumulative data. Apply broader filters if needed.</Alert>
              )}
            </Grid>
          </Grid>
        </Collapse>
      </CardContent>
    </Card>
  );
};
