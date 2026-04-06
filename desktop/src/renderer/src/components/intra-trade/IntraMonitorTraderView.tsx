import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import ExitToAppRoundedIcon from '@mui/icons-material/ExitToAppRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { useState, type ReactNode } from 'react';
import { formatPnlRupees } from './IntraTradeShared';

export type IntraStatusTone = 'success' | 'warning' | 'error' | 'info' | 'default';

const STATUS_DOT_COLORS: Record<IntraStatusTone, string> = {
  success: '#10b981',
  info: '#3b82f6',
  warning: '#f59e0b',
  error: '#ef4444',
  default: '#64748b',
};
export { IntraMonitorQuickTestLayout } from './IntraMonitorQuickTestLayout';
export { IntraMonitorLiveLayout } from './IntraMonitorLiveLayout';

export type IntraTraderSurfaceMode = 'QUICK_TEST' | 'LIVE_MONITOR';
export type IntraPrimaryActionTone = 'primary' | 'success' | 'warning';

export interface IntraPrimaryAction {
  label: string;
  tone: IntraPrimaryActionTone;
  disabled?: boolean;
  onClick: () => void;
}

export interface IntraPromotionChecklistItem {
  label: string;
  passed: boolean;
  helper: string;
}

export const IntraMonitorModeSwitcher = ({
  value,
  onChange,
}: {
  value: IntraTraderSurfaceMode;
  onChange: (value: IntraTraderSurfaceMode) => void;
}) => (
  <Card variant="outlined" sx={{ bgcolor: '#f8fafc', borderColor: '#cbd5e1' }}>
    <CardContent sx={{ py: 1.25 }}>
      <Tabs
        value={value}
        onChange={(_, next) => onChange(next)}
        sx={{
          minHeight: 40,
          '& .MuiTabs-indicator': { display: 'none' },
          '& .MuiTab-root': { minHeight: 40, borderRadius: 1.5, mr: 1, color: 'text.secondary' },
          '& .Mui-selected': { bgcolor: '#0f172a', color: '#fff !important' },
        }}
      >
        <Tab value="QUICK_TEST" label="Quick Test" />
        <Tab value="LIVE_MONITOR" label="Live Monitor" />
      </Tabs>
    </CardContent>
  </Card>
);

export const IntraMonitorCommandBar = ({
  strategyName,
  modeLabel,
  currentState,
  lastScanLabel,
  marketStatusLabel,
  freshnessLabel,
  openPositionsCount,
  currentMtm,
  primaryAction,
  statusTone = 'default',
}: {
  strategyName: string;
  modeLabel: string;
  currentState: string;
  lastScanLabel: string;
  marketStatusLabel: string;
  freshnessLabel: string;
  openPositionsCount: number;
  currentMtm: number | null;
  primaryAction: IntraPrimaryAction;
  statusTone?: IntraStatusTone;
}) => {
  const dotColor = STATUS_DOT_COLORS[statusTone];
  const isPulsing = statusTone === 'success' || statusTone === 'info';
  return (
    <Card
      variant="outlined"
      sx={{
        position: 'sticky',
        top: 8,
        zIndex: 5,
        borderColor: dotColor,
        borderWidth: 2,
        boxShadow: `0 16px 34px rgba(15, 23, 42, 0.16), 0 0 0 1px ${dotColor}40`,
        background: 'linear-gradient(135deg, #0f172a 0%, #132b4f 55%, #1d4e89 100%)',
      }}
    >
      <CardContent>
        <Stack spacing={1.5}>
          <Typography variant="overline" sx={{ color: 'rgba(255,255,255,0.65)', letterSpacing: 1.6 }}>
            Trading Command Bar
          </Typography>
          {/* ── Traffic-light status banner ── */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              bgcolor: `${dotColor}22`,
              border: `1px solid ${dotColor}55`,
              borderRadius: 1.5,
              px: 1.5,
              py: 0.75,
            }}
          >
            <Box
              sx={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                bgcolor: dotColor,
                flexShrink: 0,
                ...(isPulsing && {
                  '@keyframes trafficPulse': {
                    '0%, 100%': { boxShadow: `0 0 0 0 ${dotColor}80` },
                    '60%': { boxShadow: `0 0 0 7px transparent` },
                  },
                  animation: 'trafficPulse 1.8s ease-out infinite',
                }),
              }}
            />
            <Typography variant="body2" fontWeight={800} sx={{ color: '#fff', fontSize: '0.9rem', flex: 1 }}>
              {currentState}
            </Typography>
            <Chip label={modeLabel} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.68rem' }} />
            <Chip
              label={marketStatusLabel}
              size="small"
              sx={{ bgcolor: marketStatusLabel.includes('Open') ? '#10b981' : 'rgba(255,255,255,0.12)', color: '#fff', fontSize: '0.68rem' }}
            />
          </Box>

          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
            <Stack spacing={0.25}>
              <Typography variant="overline" color="rgba(255,255,255,0.6)" sx={{ letterSpacing: 1.1, lineHeight: 1.2, fontSize: '0.6rem' }}>
                Strategy
              </Typography>
              <Typography variant="h6" fontWeight={800} sx={{ color: '#fff', lineHeight: 1.2 }}>{strategyName}</Typography>
            </Stack>
            <Button
              variant="contained"
              color={primaryAction.tone}
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
              startIcon={
                primaryAction.label === 'Run Paper Test' ? <PlayArrowRoundedIcon />
                  : primaryAction.label.includes('Start Live') ? <RocketLaunchRoundedIcon />
                    : primaryAction.label === 'Resume' ? <PlayArrowRoundedIcon />
                      : primaryAction.label === 'Exit Now' ? <ExitToAppRoundedIcon />
                        : <AssessmentRoundedIcon />
              }
              sx={{ alignSelf: { xs: 'stretch', md: 'center' }, minWidth: 176, boxShadow: '0 10px 22px rgba(15, 23, 42, 0.22)' }}
            >
              {primaryAction.label}
            </Button>
          </Stack>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
            <Metric label="Open positions" value={String(openPositionsCount)} />
            <Metric label="Current MTM" value={formatPnlRupees(currentMtm)} emphasize />
            <Metric label="Last scan" value={lastScanLabel} />
            <Metric label="Data freshness" value={freshnessLabel} />
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
};

/** @deprecated Use IntraMonitorEmergencyFooter instead */
export const IntraMonitorEmergencyCard = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  return (
    <Card variant="outlined" sx={{ borderColor: '#fecaca', bgcolor: '#fff7f7' }}>
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack spacing={0.25}>
              <Typography variant="subtitle1" fontWeight={800} color="error.main">Emergency Controls</Typography>
              <Typography variant="body2" color="text.secondary">Collapsed by default to keep normal trading actions separate.</Typography>
            </Stack>
            <IconButton size="small" onClick={() => setOpen((prev) => !prev)}>
              <ExpandMoreRoundedIcon sx={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </IconButton>
          </Stack>
          <Collapse in={open}>{children}</Collapse>
        </Stack>
      </CardContent>
    </Card>
  );
};

/**
 * Fix #4 — Emergency controls pinned to the bottom of the viewport.
 * Always visible in Live Monitor mode so the trader never hunts for them.
 */
export const IntraMonitorEmergencyFooter = ({ children }: { children: ReactNode }) => (
  <Box
    sx={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 1300,
      bgcolor: '#fff5f5',
      borderTop: '2px solid #fca5a5',
      px: 2,
      py: 0.75,
      boxShadow: '0 -4px 16px rgba(239,68,68,0.12)',
    }}
  >
    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mr: 0.5 }}>
        <WarningAmberRoundedIcon sx={{ fontSize: 15, color: 'error.main' }} />
        <Typography variant="caption" fontWeight={800} color="error.main" sx={{ whiteSpace: 'nowrap' }}>
          Emergency
        </Typography>
      </Stack>
      {children}
    </Stack>
  </Box>
);

export const IntraPromotionDialog = ({
  open,
  strategyName,
  checklist,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  strategyName: string;
  checklist: IntraPromotionChecklistItem[];
  onCancel: () => void;
  onConfirm: () => void;
}) => {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Promote To Live</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Alert severity="warning">
            You are promoting <strong>{strategyName || 'the selected strategy'}</strong> from paper validation to live monitoring. Broker routing is still not part of this screen.
          </Alert>
          {checklist.map((item) => (
            <Alert key={item.label} severity={item.passed ? 'success' : 'warning'}>
              <strong>{item.label}</strong>: {item.helper}
            </Alert>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="contained" color="success" onClick={onConfirm}>Start Live</Button>
      </DialogActions>
    </Dialog>
  );
};

const Metric = ({ label, value, emphasize = false }: { label: string; value: string; emphasize?: boolean }) => (
  <Box sx={{ minWidth: 0, flex: 1, borderRadius: 1.5, px: 1.5, py: 1.25, bgcolor: emphasize ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.16)' }}>
    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.72)' }}>{label}</Typography>
    <Typography variant="body2" fontWeight={800} noWrap sx={{ color: '#fff' }}>{value}</Typography>
  </Box>
);
