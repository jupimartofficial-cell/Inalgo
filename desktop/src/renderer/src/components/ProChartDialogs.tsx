import type { Dispatch, SetStateAction } from 'react';
import { ProChartCompareDialog } from './ProChartCompareDialog';
import { ProChartDrawingsDialog } from './ProChartDrawingsDialog';
import { ProChartIndicatorsDialog } from './ProChartIndicatorsDialog';
import { ProChartSettingsDialog } from './ProChartSettingsDialog';
import type {
  ChartColorMode,
  ChartDrawing,
  ChartVisualTheme,
  CompareSeriesConfig,
  CompareSeriesState,
  IndicatorKey,
  ProChartSettingsState,
} from './ProChartCanvasShared';

interface CompareSuggestion {
  instrumentKey: string;
  label: string;
  id: string;
}

export interface ProChartDialogsProps {
  colorMode: ChartColorMode;
  theme: ChartVisualTheme;
  indicatorsOpen: boolean;
  compareOpen: boolean;
  settingsOpen: boolean;
  drawingsOpen: boolean;
  indicators: Record<IndicatorKey, boolean>;
  indicatorSearch: string;
  activeIndicatorCount: number;
  filteredIndicators: Array<{ key: IndicatorKey; label: string; description: string }>;
  compareResults: CompareSeriesState[];
  instrumentSuggestions: CompareSuggestion[];
  compareInstrument: string;
  customCompareInstrument: string;
  drawings: ChartDrawing[];
  settings: ProChartSettingsState;
  setIndicatorsOpen: Dispatch<SetStateAction<boolean>>;
  setCompareOpen: Dispatch<SetStateAction<boolean>>;
  setSettingsOpen: Dispatch<SetStateAction<boolean>>;
  setDrawingsOpen: Dispatch<SetStateAction<boolean>>;
  setIndicatorSearch: Dispatch<SetStateAction<string>>;
  setCompareInstrument: Dispatch<SetStateAction<string>>;
  setCustomCompareInstrument: Dispatch<SetStateAction<string>>;
  setCompareSeries: Dispatch<SetStateAction<CompareSeriesConfig[]>>;
  setDrawings: Dispatch<SetStateAction<ChartDrawing[]>>;
  setIndicators: Dispatch<SetStateAction<Record<IndicatorKey, boolean>>>;
  setCollapsedPanes: Dispatch<SetStateAction<Record<'macd' | 'rsi', boolean>>>;
  setSettings: Dispatch<SetStateAction<ProChartSettingsState>>;
  onAddCompareSeries: () => void;
  onReset: () => void;
}

export const ProChartDialogs = ({
  colorMode,
  theme,
  indicatorsOpen,
  compareOpen,
  settingsOpen,
  drawingsOpen,
  indicators,
  indicatorSearch,
  activeIndicatorCount,
  filteredIndicators,
  compareResults,
  instrumentSuggestions,
  compareInstrument,
  customCompareInstrument,
  drawings,
  settings,
  setIndicatorsOpen,
  setCompareOpen,
  setSettingsOpen,
  setDrawingsOpen,
  setIndicatorSearch,
  setCompareInstrument,
  setCustomCompareInstrument,
  setCompareSeries,
  setDrawings,
  setIndicators,
  setCollapsedPanes,
  setSettings,
  onAddCompareSeries,
  onReset,
}: ProChartDialogsProps) => (
  <>
    <ProChartIndicatorsDialog
      open={indicatorsOpen}
      colorMode={colorMode}
      theme={theme}
      indicators={indicators}
      indicatorSearch={indicatorSearch}
      activeIndicatorCount={activeIndicatorCount}
      filteredIndicators={filteredIndicators}
      onClose={() => setIndicatorsOpen(false)}
      onSearchChange={setIndicatorSearch}
      onIndicatorToggle={(key, enabled) => {
        setIndicators((current) => ({ ...current, [key]: enabled }));
        if (key === 'macd' || key === 'rsi') {
          setCollapsedPanes((current) => ({ ...current, [key]: false }));
        }
      }}
    />
    <ProChartCompareDialog
      open={compareOpen}
      theme={theme}
      compareSeries={compareResults}
      suggestions={instrumentSuggestions}
      customInstrument={customCompareInstrument}
      selectedInstrument={compareInstrument}
      onClose={() => setCompareOpen(false)}
      onCustomInstrumentChange={setCustomCompareInstrument}
      onSelectedInstrumentChange={setCompareInstrument}
      onAdd={onAddCompareSeries}
      onToggleVisibility={(id, visible) => setCompareSeries((current) => current.map((item) => (item.id === id ? { ...item, visible } : item)))}
      onRemove={(id) => setCompareSeries((current) => current.filter((item) => item.id !== id))}
    />
    <ProChartSettingsDialog
      open={settingsOpen}
      theme={theme}
      settings={settings}
      onClose={() => setSettingsOpen(false)}
      onToggle={(key, value) => setSettings((current) => ({ ...current, [key]: value }))}
      onCrosshairModeChange={(value) => setSettings((current) => ({ ...current, crosshairMode: value }))}
      onReset={onReset}
    />
    <ProChartDrawingsDialog
      open={drawingsOpen}
      theme={theme}
      drawings={drawings}
      onClose={() => setDrawingsOpen(false)}
      onToggleVisibility={(id, visible) => setDrawings((current) => current.map((drawing) => (drawing.id === id ? { ...drawing, visible } : drawing)))}
      onToggleLocked={(id) => setDrawings((current) => current.map((drawing) => (drawing.id === id ? { ...drawing, locked: !drawing.locked } : drawing)))}
      onRemove={(id) => setDrawings((current) => current.filter((drawing) => drawing.id !== id))}
    />
  </>
);
