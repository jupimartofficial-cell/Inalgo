import {
  Box,
  Button,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import BarChartRoundedIcon from '@mui/icons-material/BarChartRounded';
import CandlestickChartRoundedIcon from '@mui/icons-material/CandlestickChartRounded';
import CameraAltOutlinedIcon from '@mui/icons-material/CameraAltOutlined';
import CompareArrowsRoundedIcon from '@mui/icons-material/CompareArrowsRounded';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import FitScreenRoundedIcon from '@mui/icons-material/FitScreenRounded';
import FullscreenExitRoundedIcon from '@mui/icons-material/FullscreenExitRounded';
import FullscreenRoundedIcon from '@mui/icons-material/FullscreenRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import LayersRoundedIcon from '@mui/icons-material/LayersRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import QueryStatsRoundedIcon from '@mui/icons-material/QueryStatsRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import ShowChartRoundedIcon from '@mui/icons-material/ShowChartRounded';
import TimelineRoundedIcon from '@mui/icons-material/TimelineRounded';
import type { IChartApi } from 'lightweight-charts';
import type { MutableRefObject } from 'react';
import {
  formatCompact,
  formatDecimal,
  instrumentLabelFrom,
  timeframeLabel,
  type ChartColorMode,
  type ChartStyle,
  type ChartVisualTheme,
  type PreparedCandle,
  type PriceScalePreset,
  type TimeframeOption,
} from './ProChartCanvasShared';

export interface GroupedTimeframe {
  unit: string;
  options: TimeframeOption[];
}

export interface ProChartToolbarProps {
  chartId: string;
  instrumentKey: string;
  currentTimeframeLabel: string;
  activeTimeframeKey: string;
  groupedTimeframes: GroupedTimeframe[];
  chartStyle: ChartStyle;
  priceScalePreset: PriceScalePreset;
  colorMode: ChartColorMode;
  theme: ChartVisualTheme;
  hoveredCandle: PreparedCandle | undefined;
  changeValue: number;
  changePercent: number;
  priceChartRef: MutableRefObject<IChartApi | null>;
  macdChartRef: MutableRefObject<IChartApi | null>;
  rsiChartRef: MutableRefObject<IChartApi | null>;
  timeframeMenuAnchor: HTMLElement | null;
  chartTypeMenuAnchor: HTMLElement | null;
  onTimeframeChange: (unit: string, interval: number) => void;
  onChartStyleChange: (style: ChartStyle) => void;
  onPriceScalePresetChange: (preset: PriceScalePreset) => void;
  onColorModeToggle: () => void;
  onIndicatorsOpen: () => void;
  onCompareOpen: () => void;
  onDrawingsOpen: () => void;
  onSettingsOpen: () => void;
  onSnapshot: () => void;
  onFullscreenToggle: () => void;
  onTimeframeMenuOpen: (anchor: HTMLElement) => void;
  onTimeframeMenuClose: () => void;
  onChartTypeMenuOpen: (anchor: HTMLElement) => void;
  onChartTypeMenuClose: () => void;
  compareCount: number;
  drawingCount: number;
  isFullscreen: boolean;
}

const CHART_TYPE_OPTIONS: Array<{ value: ChartStyle; label: string; icon: typeof CandlestickChartRoundedIcon }> = [
  { value: 'bars', label: 'Bars', icon: BarChartRoundedIcon },
  { value: 'baseline', label: 'Baseline', icon: TimelineRoundedIcon },
  { value: 'candles', label: 'Candles', icon: CandlestickChartRoundedIcon },
  { value: 'area', label: 'Area', icon: ShowChartRoundedIcon },
  { value: 'line', label: 'Line', icon: ShowChartRoundedIcon },
];

export const ProChartToolbar = ({
  chartId,
  instrumentKey,
  currentTimeframeLabel,
  activeTimeframeKey,
  groupedTimeframes,
  chartStyle,
  priceScalePreset,
  colorMode,
  theme,
  hoveredCandle,
  changeValue,
  changePercent,
  priceChartRef,
  macdChartRef,
  rsiChartRef,
  timeframeMenuAnchor,
  chartTypeMenuAnchor,
  onTimeframeChange,
  onChartStyleChange,
  onPriceScalePresetChange,
  onColorModeToggle,
  onIndicatorsOpen,
  onCompareOpen,
  onDrawingsOpen,
  onSettingsOpen,
  onSnapshot,
  onFullscreenToggle,
  onTimeframeMenuOpen,
  onTimeframeMenuClose,
  onChartTypeMenuOpen,
  onChartTypeMenuClose,
  compareCount,
  drawingCount,
  isFullscreen,
}: ProChartToolbarProps) => {
  const activeChartTypeOption = CHART_TYPE_OPTIONS.find((option) => option.value === chartStyle) ?? CHART_TYPE_OPTIONS[0];
  const ActiveChartIcon = activeChartTypeOption.icon;

  return (
    <Box
      sx={{
        px: 1.1,
        py: 0.9,
        borderRadius: 2,
        bgcolor: theme.toolbarBg,
        border: `1px solid ${theme.border}`,
        mb: 1,
        overflowX: 'auto',
      }}
    >
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 'max-content', flexWrap: 'nowrap' }}>
        <Button
          size="small"
          variant="text"
          startIcon={<SearchRoundedIcon />}
          sx={{
            color: theme.strongText,
            fontWeight: 700,
            px: 0,
            minWidth: 0,
            justifyContent: 'flex-start',
            whiteSpace: 'nowrap',
          }}
        >
          {instrumentLabelFrom(instrumentKey)}
        </Button>
        <Button
          size="small"
          variant="text"
          endIcon={<KeyboardArrowDownRoundedIcon />}
          onClick={(event) => onTimeframeMenuOpen(event.currentTarget)}
          data-testid={`trading-chart-timeframe-menu-trigger-${chartId}`}
          sx={{
            color: theme.strongText,
            minWidth: 0,
            px: 0.5,
            whiteSpace: 'nowrap',
          }}
        >
          {currentTimeframeLabel}
        </Button>
        <Button
          size="small"
          variant="text"
          startIcon={<ActiveChartIcon fontSize="small" />}
          endIcon={<KeyboardArrowDownRoundedIcon />}
          onClick={(event) => onChartTypeMenuOpen(event.currentTarget)}
          data-testid={`trading-chart-style-menu-trigger-${chartId}`}
          sx={{
            color: theme.strongText,
            minWidth: 0,
            px: 0.5,
            whiteSpace: 'nowrap',
          }}
        >
          {activeChartTypeOption.label}
        </Button>
        <Button
          size="small"
          variant="text"
          startIcon={<CompareArrowsRoundedIcon />}
          onClick={onCompareOpen}
          sx={{ color: theme.strongText, minWidth: 0, px: 0.5, whiteSpace: 'nowrap' }}
        >
          Compare
          {compareCount > 0 ? ` (${compareCount})` : ''}
        </Button>
        <Button
          size="small"
          variant="text"
          startIcon={<LayersRoundedIcon />}
          onClick={onDrawingsOpen}
          sx={{ color: theme.strongText, minWidth: 0, px: 0.5, whiteSpace: 'nowrap' }}
        >
          Objects
          {drawingCount > 0 ? ` (${drawingCount})` : ''}
        </Button>
        <Button
          size="small"
          variant="text"
          startIcon={<QueryStatsRoundedIcon />}
          onClick={onIndicatorsOpen}
          data-testid={`trading-chart-indicators-${chartId}`}
          sx={{
            color: theme.strongText,
            minWidth: 0,
            px: 0.5,
            whiteSpace: 'nowrap',
          }}
        >
          Indicators
        </Button>
        <Button
          size="small"
          variant={priceScalePreset === 'normal' ? 'contained' : 'outlined'}
          onClick={() => onPriceScalePresetChange('normal')}
          sx={{ borderColor: theme.border, color: theme.text, bgcolor: priceScalePreset === 'normal' ? theme.chipBg : 'transparent', boxShadow: 'none', whiteSpace: 'nowrap' }}
        >
          Auto
        </Button>
        <Button
          size="small"
          variant={priceScalePreset === 'log' ? 'contained' : 'outlined'}
          onClick={() => onPriceScalePresetChange('log')}
          sx={{ borderColor: theme.border, color: theme.text, bgcolor: priceScalePreset === 'log' ? theme.chipBg : 'transparent', boxShadow: 'none', whiteSpace: 'nowrap' }}
        >
          Log
        </Button>
        <Button
          size="small"
          variant={priceScalePreset === 'percent' ? 'contained' : 'outlined'}
          onClick={() => onPriceScalePresetChange('percent')}
          sx={{ borderColor: theme.border, color: theme.text, bgcolor: priceScalePreset === 'percent' ? theme.chipBg : 'transparent', boxShadow: 'none', whiteSpace: 'nowrap' }}
        >
          %
        </Button>
        <Button
          size="small"
          variant={priceScalePreset === 'indexed' ? 'contained' : 'outlined'}
          onClick={() => onPriceScalePresetChange('indexed')}
          sx={{ borderColor: theme.border, color: theme.text, bgcolor: priceScalePreset === 'indexed' ? theme.chipBg : 'transparent', boxShadow: 'none', whiteSpace: 'nowrap' }}
        >
          Indexed
        </Button>
        <Tooltip title={colorMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
          <IconButton
            size="small"
            onClick={onColorModeToggle}
            data-testid={`trading-chart-theme-${chartId}`}
            aria-label={colorMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            sx={{ color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 1.5 }}
          >
            {colorMode === 'dark' ? <LightModeRoundedIcon fontSize="small" /> : <DarkModeRoundedIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
        <Tooltip title="Fit visible range">
          <IconButton
            size="small"
            aria-label="Fit visible range"
            onClick={() => {
              priceChartRef.current?.timeScale().fitContent();
              macdChartRef.current?.timeScale().fitContent();
              rsiChartRef.current?.timeScale().fitContent();
            }}
            sx={{ color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 1.5 }}
          >
            <FitScreenRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Chart settings">
          <IconButton
            size="small"
            aria-label="Chart settings"
            onClick={onSettingsOpen}
            sx={{ color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 1.5 }}
          >
            <SettingsRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Take a snapshot">
          <IconButton
            size="small"
            aria-label="Take a snapshot"
            onClick={onSnapshot}
            sx={{ color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 1.5 }}
          >
            <CameraAltOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen mode'}>
          <IconButton
            size="small"
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen mode'}
            onClick={onFullscreenToggle}
            sx={{ color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 1.5 }}
          >
            {isFullscreen ? <FullscreenExitRoundedIcon fontSize="small" /> : <FullscreenRoundedIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
        <Box sx={{ width: 8, flex: '0 0 auto' }} />
        <Typography variant="caption" sx={{ color: theme.mutedText, whiteSpace: 'nowrap' }}>
          O {formatDecimal(hoveredCandle?.open)}
        </Typography>
        <Typography variant="caption" sx={{ color: theme.mutedText, whiteSpace: 'nowrap' }}>
          H {formatDecimal(hoveredCandle?.high)}
        </Typography>
        <Typography variant="caption" sx={{ color: theme.mutedText, whiteSpace: 'nowrap' }}>
          L {formatDecimal(hoveredCandle?.low)}
        </Typography>
        <Typography variant="caption" sx={{ color: theme.strongText, fontWeight: 700, whiteSpace: 'nowrap' }}>
          C {formatDecimal(hoveredCandle?.close)}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: changeValue >= 0 ? '#4ade80' : '#f87171',
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}
        >
          {changeValue >= 0 ? '+' : ''}{formatDecimal(changeValue)} ({changeValue >= 0 ? '+' : ''}{formatDecimal(changePercent)}%)
        </Typography>
        <Typography variant="caption" sx={{ color: theme.mutedText, whiteSpace: 'nowrap' }}>
          Vol {formatCompact(hoveredCandle?.volume)}
        </Typography>
      </Stack>

      <Menu
        anchorEl={timeframeMenuAnchor}
        open={Boolean(timeframeMenuAnchor)}
        onClose={onTimeframeMenuClose}
        PaperProps={{
          sx: {
            mt: 1,
            minWidth: 280,
            maxHeight: 520,
            bgcolor: theme.menuBg,
            color: theme.strongText,
            border: `1px solid ${theme.border}`,
            backgroundImage: 'none',
          },
        }}
      >
        {groupedTimeframes.flatMap((group) => ([
          <ListSubheader
            key={`${group.unit}-header`}
            disableSticky
            sx={{ bgcolor: theme.menuBg, color: theme.mutedText, textTransform: 'uppercase', lineHeight: 2.6 }}
          >
            {group.unit}
          </ListSubheader>,
          ...group.options.map((option) => (
            <MenuItem
              key={`${option.unit}|${option.interval}`}
              selected={activeTimeframeKey === `${option.unit}|${option.interval}`}
              onClick={() => {
                onTimeframeChange(option.unit, option.interval);
                onTimeframeMenuClose();
              }}
              sx={{
                minHeight: 42,
                bgcolor: activeTimeframeKey === `${option.unit}|${option.interval}` ? theme.chipBg : 'transparent',
              }}
            >
              {timeframeLabel(option)}
            </MenuItem>
          )),
        ]))}
      </Menu>

      <Menu
        anchorEl={chartTypeMenuAnchor}
        open={Boolean(chartTypeMenuAnchor)}
        onClose={onChartTypeMenuClose}
        PaperProps={{
          sx: {
            mt: 1,
            minWidth: 240,
            bgcolor: theme.menuBg,
            color: theme.strongText,
            border: `1px solid ${theme.border}`,
            backgroundImage: 'none',
          },
        }}
      >
        {CHART_TYPE_OPTIONS.map((option) => {
          const Icon = option.icon;
          return (
            <MenuItem
              key={option.value}
              selected={chartStyle === option.value}
              onClick={() => {
                onChartStyleChange(option.value);
                onChartTypeMenuClose();
              }}
              sx={{ minHeight: 44, bgcolor: chartStyle === option.value ? theme.chipBg : 'transparent' }}
            >
              <Stack direction="row" spacing={1.2} alignItems="center">
                <Icon fontSize="small" />
                <span>{option.label}</span>
              </Stack>
            </MenuItem>
          );
        })}
      </Menu>
    </Box>
  );
};
