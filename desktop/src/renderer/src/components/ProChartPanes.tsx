import {
  Box,
  CircularProgress,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import type { MutableRefObject } from 'react';
import type { ChartColorMode, ChartVisualTheme, IndicatorKey } from './ProChartCanvasShared';

export interface PaneConfig {
  show: boolean;
  showChart: boolean;
  paneHeight: number;
  collapsed: boolean;
  hostRef: MutableRefObject<HTMLDivElement | null>;
  paneKey: 'macd' | 'rsi';
  label: string;
}

export interface ProChartPanesProps {
  mainChartHeight: number;
  priceHostRef: MutableRefObject<HTMLDivElement | null>;
  theme: ChartVisualTheme;
  colorMode: ChartColorMode;
  loading: boolean;
  error?: string;
  hasCandles: boolean;
  macdPane: PaneConfig;
  rsiPane: PaneConfig;
  onToggleCollapse: (paneKey: 'macd' | 'rsi') => void;
  onRemovePane: (indicatorKey: IndicatorKey) => void;
}

interface SinglePaneProps {
  pane: PaneConfig;
  theme: ChartVisualTheme;
  onToggleCollapse: (paneKey: 'macd' | 'rsi') => void;
  onRemovePane: (indicatorKey: IndicatorKey) => void;
}

const SinglePane = ({ pane, theme, onToggleCollapse, onRemovePane }: SinglePaneProps) => (
  <>
    <Divider sx={{ borderColor: theme.border }} />
    <Box sx={{ position: 'relative', height: pane.paneHeight, width: '100%' }}>
      <Stack
        direction="row"
        spacing={0.5}
        alignItems="center"
        justifyContent="space-between"
        sx={{
          position: 'absolute',
          top: 6,
          right: 8,
          left: 8,
          zIndex: 2,
        }}
      >
        <Typography variant="caption" sx={{ color: theme.mutedText, fontWeight: 700 }}>
          {pane.label}
        </Typography>
        <Stack direction="row" spacing={0.5}>
          <Tooltip title={pane.collapsed ? 'Show pane' : 'Hide pane'}>
            <IconButton
              size="small"
              onClick={(event) => {
                event.stopPropagation();
                onToggleCollapse(pane.paneKey);
              }}
              sx={{ color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 1.25, bgcolor: theme.toolbarBg }}
            >
              {pane.collapsed ? <VisibilityRoundedIcon fontSize="small" /> : <VisibilityOffRoundedIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Remove pane">
            <IconButton
              size="small"
              onClick={(event) => {
                event.stopPropagation();
                onRemovePane(pane.paneKey);
              }}
              sx={{ color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 1.25, bgcolor: theme.toolbarBg }}
            >
              <DeleteOutlineRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
      {pane.showChart && <Box ref={pane.hostRef} sx={{ height: 118, width: '100%' }} />}
    </Box>
  </>
);

export const ProChartPanes = ({
  mainChartHeight,
  priceHostRef,
  theme,
  colorMode,
  loading,
  error,
  hasCandles,
  macdPane,
  rsiPane,
  onToggleCollapse,
  onRemovePane,
}: ProChartPanesProps) => (
  <Box sx={{ position: 'relative' }}>
    <Box
      sx={{
        borderRadius: 2,
        overflow: 'hidden',
        border: `1px solid ${theme.border}`,
        bgcolor: theme.surfaceBg,
      }}
    >
      <Box ref={priceHostRef} sx={{ height: mainChartHeight, width: '100%' }} />
      {macdPane.show && (
        <SinglePane
          pane={macdPane}
          theme={theme}
          onToggleCollapse={onToggleCollapse}
          onRemovePane={onRemovePane}
        />
      )}
      {rsiPane.show && (
        <SinglePane
          pane={rsiPane}
          theme={theme}
          onToggleCollapse={onToggleCollapse}
          onRemovePane={onRemovePane}
        />
      )}
    </Box>

    {!loading && !hasCandles && (
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: theme.overlayBg,
          backdropFilter: 'blur(2px)',
          color: theme.text,
          px: 2,
          textAlign: 'center',
          borderRadius: 2,
        }}
      >
        <Typography variant="body2">
          {error || 'No candle data available for the current selection'}
        </Typography>
      </Box>
    )}

    {loading && (
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: colorMode === 'dark' ? 'rgba(2,6,23,0.52)' : 'rgba(248,250,252,0.68)',
          backdropFilter: 'blur(1px)',
          borderRadius: 2,
        }}
      >
        <CircularProgress size={30} sx={{ color: '#38bdf8' }} />
      </Box>
    )}
  </Box>
);
