import { Card, CardContent, Collapse, Grid, LinearProgress, Stack, Typography } from '@mui/material';
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import type { IntraPnlSummary } from '../../../api/admin';
import { formatPnlRupees } from '../IntraTradeShared';
import { PnlSectionHeader } from './PnlSectionHeader';
import { pnlBg, pnlColor } from './pnlUtils';

export const IntraPnlSummaryCard = ({
  open,
  summary,
  onToggle,
}: {
  open: boolean;
  summary: IntraPnlSummary | null | undefined;
  onToggle: () => void;
}) => (
  <Card data-testid="intra-pnl-summary-card">
    <CardContent>
      <PnlSectionHeader title="P&L Summary" open={open} onToggle={onToggle} />
      <Collapse in={open}>
        <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
          {([
            { label: 'Total P&L', value: summary?.totalPnl, format: 'pnl' },
            { label: "Today's P&L", value: summary?.todayPnl, format: 'pnl' },
            { label: 'Realized P&L', value: summary?.realizedPnl, format: 'pnl' },
            { label: 'Unrealized P&L', value: summary?.unrealizedPnl, format: 'pnl' },
            { label: 'Win Rate', value: summary?.winRate, format: 'pct' },
            { label: 'Avg Gain / Trade', value: summary?.avgGain, format: 'pnl' },
            { label: 'Avg Loss / Trade', value: summary?.avgLoss, format: 'pnl' },
            { label: 'Max Drawdown', value: summary?.maxDrawdown, format: 'risk' },
          ] as { label: string; value: number | undefined; format: 'pnl' | 'pct' | 'risk' }[]).map(({ label, value, format }) => {
            const isPnl = format === 'pnl';
            const isRisk = format === 'risk';
            const color = isRisk ? '#b45309' : isPnl && value != null ? pnlColor(value) : 'text.primary';
            const bg = isRisk ? '#fffbeb' : isPnl ? pnlBg(value ?? 0) : undefined;
            const displayValue = value == null ? '—' : (isPnl || isRisk) ? formatPnlRupees(value) : value.toFixed(1) + '%';
            return (
              <Grid item xs={6} sm={4} md={3} key={label}>
                <Card variant="outlined" sx={{ bgcolor: bg, height: '100%' }}>
                  <CardContent sx={{ minHeight: 104, pb: '12px !important' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, lineHeight: 1.3 }}>{label}</Typography>
                      {isPnl && value != null && value !== 0 && (
                        value > 0
                          ? <TrendingUpRoundedIcon sx={{ fontSize: 15, color: '#15803d' }} />
                          : <TrendingDownRoundedIcon sx={{ fontSize: 15, color: '#b91c1c' }} />
                      )}
                    </Stack>
                    <Typography variant="h6" fontWeight={800} sx={{ color, mt: 0.25, fontSize: '1rem' }}>{displayValue}</Typography>
                    {format === 'pct' && value != null && (
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(100, Math.max(0, value))}
                        sx={{ mt: 0.75, height: 4, borderRadius: 2, bgcolor: '#e2e8f0', '& .MuiLinearProgress-bar': { bgcolor: !(value < 50) ? '#15803d' : '#b91c1c' } }}
                      />
                    )}
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </Collapse>
    </CardContent>
  </Card>
);
