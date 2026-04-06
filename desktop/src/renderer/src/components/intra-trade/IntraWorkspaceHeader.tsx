import { Card, CardContent, Chip, Grid, Stack, Typography } from '@mui/material';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import type { ReactNode } from 'react';
import { useIntraWorkspace } from './IntraWorkspaceContext';
import { INTRA_MODE_CONFIG } from './IntraTradeShared';

const ContextItem = ({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) => (
  <Stack direction="row" spacing={1.25} alignItems="flex-start">
    <Stack
      alignItems="center"
      justifyContent="center"
      sx={{ width: 30, height: 30, borderRadius: 1.5, bgcolor: '#eff6ff', color: '#1d4ed8', flexShrink: 0 }}
    >
      {icon}
    </Stack>
    <Stack spacing={0.2} minWidth={0}>
      <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={700} noWrap>
        {value}
      </Typography>
    </Stack>
  </Stack>
);

export const IntraWorkspaceHeader = () => {
  const {
    workspaceLabel,
    tradeMode,
    brokerExchangeLabel,
    timezoneLabel,
    marketSessionLabel,
    scanInstrumentKey,
    scanTimeframeKey,
    baseInstruments,
  } = useIntraWorkspace();

  const modeConfig = INTRA_MODE_CONFIG[tradeMode];
  const instrumentLabel = baseInstruments.find((item) => item.key === scanInstrumentKey)?.label ?? scanInstrumentKey;
  const [timeframeUnit, timeframeInterval] = scanTimeframeKey.split('|');

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={1.5}>
            <Stack spacing={0.4}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="h5" fontWeight={800}>Intra Workspace</Typography>
                <Chip
                  label={modeConfig.label}
                  size="small"
                  sx={{ bgcolor: modeConfig.bg, color: modeConfig.color, border: `1px solid ${modeConfig.border}`, fontWeight: 800 }}
                />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Build, run, and review intraday strategies without losing trading context between pages.
              </Typography>
            </Stack>
            <Chip
              label={`${instrumentLabel} · ${timeframeInterval} ${timeframeUnit}`}
              color="primary"
              variant="outlined"
            />
          </Stack>

          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <ContextItem icon={<AccountTreeRoundedIcon sx={{ fontSize: 18 }} />} label="Workspace" value={workspaceLabel} />
            </Grid>
            <Grid item xs={12} md={4}>
              <ContextItem icon={<BoltRoundedIcon sx={{ fontSize: 18 }} />} label="Trade Mode" value={modeConfig.label} />
            </Grid>
            <Grid item xs={12} md={4}>
              <ContextItem icon={<SwapHorizRoundedIcon sx={{ fontSize: 18 }} />} label="Broker / Exchange" value={brokerExchangeLabel} />
            </Grid>
            <Grid item xs={12} md={4}>
              <ContextItem icon={<PublicRoundedIcon sx={{ fontSize: 18 }} />} label="Timezone" value={timezoneLabel} />
            </Grid>
            <Grid item xs={12} md={8}>
              <ContextItem icon={<ScheduleRoundedIcon sx={{ fontSize: 18 }} />} label="Market Session" value={marketSessionLabel} />
            </Grid>
          </Grid>
        </Stack>
      </CardContent>
    </Card>
  );
};
