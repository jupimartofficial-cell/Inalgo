import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import type { ChartVisualTheme, CrosshairPreset, ProChartSettingsState } from './ProChartCanvasShared';

export interface ProChartSettingsDialogProps {
  open: boolean;
  theme: ChartVisualTheme;
  settings: ProChartSettingsState;
  onClose: () => void;
  onToggle: (key: keyof Omit<ProChartSettingsState, 'crosshairMode'>, value: boolean) => void;
  onCrosshairModeChange: (value: CrosshairPreset) => void;
  onReset: () => void;
}

export const ProChartSettingsDialog = ({
  open,
  theme,
  settings,
  onClose,
  onToggle,
  onCrosshairModeChange,
  onReset,
}: ProChartSettingsDialogProps) => (
  <Dialog
    open={open}
    onClose={onClose}
    maxWidth="xs"
    fullWidth
    PaperProps={{
      sx: {
        bgcolor: theme.menuBg,
        color: theme.strongText,
        border: `1px solid ${theme.border}`,
      },
    }}
  >
    <DialogTitle>Chart Settings</DialogTitle>
    <DialogContent>
      <Stack spacing={1.25}>
        <Typography variant="body2" sx={{ color: theme.mutedText }}>
          Tune the shared chart shell so Historical Data and Trading Window use the same interaction model.
        </Typography>
        <Divider sx={{ borderColor: theme.border }} />
        <FormControlLabel
          control={<Switch checked={settings.gridVisible} onChange={(_, checked) => onToggle('gridVisible', checked)} />}
          label="Show price grid"
        />
        <FormControlLabel
          control={<Switch checked={settings.watermarkVisible} onChange={(_, checked) => onToggle('watermarkVisible', checked)} />}
          label="Show watermark"
        />
        <FormControlLabel
          control={<Switch checked={settings.showDrawingToolbar} onChange={(_, checked) => onToggle('showDrawingToolbar', checked)} />}
          label="Show drawings toolbar"
        />
        <FormControlLabel
          control={<Switch checked={settings.magnetMode} onChange={(_, checked) => onToggle('magnetMode', checked)} />}
          label="Snap drawings to candle OHLC"
        />
        <FormControlLabel
          control={<Switch checked={settings.keepDrawing} onChange={(_, checked) => onToggle('keepDrawing', checked)} />}
          label="Keep active drawing tool after placement"
        />
        <Divider sx={{ borderColor: theme.border }} />
        <Stack spacing={0.5}>
          <Typography variant="subtitle2">Crosshair mode</Typography>
          <RadioGroup
            value={settings.crosshairMode}
            onChange={(event) => onCrosshairModeChange(event.target.value as CrosshairPreset)}
          >
            <FormControlLabel value="magnet" control={<Radio />} label="Magnet" />
            <FormControlLabel value="normal" control={<Radio />} label="Free cursor" />
          </RadioGroup>
        </Stack>
      </Stack>
    </DialogContent>
    <DialogActions sx={{ px: 3, pb: 2 }}>
      <Button color="inherit" onClick={onReset}>Reset</Button>
      <Button variant="contained" onClick={onClose}>Close</Button>
    </DialogActions>
  </Dialog>
);
