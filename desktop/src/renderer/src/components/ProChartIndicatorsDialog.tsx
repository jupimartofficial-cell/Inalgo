import {
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import {
  INDICATOR_LIBRARY,
  type ChartColorMode,
  type ChartVisualTheme,
  type IndicatorKey,
} from './ProChartCanvasShared';

export interface ProChartIndicatorsDialogProps {
  open: boolean;
  colorMode: ChartColorMode;
  theme: ChartVisualTheme;
  indicators: Record<IndicatorKey, boolean>;
  indicatorSearch: string;
  activeIndicatorCount: number;
  filteredIndicators: typeof INDICATOR_LIBRARY;
  onClose: () => void;
  onSearchChange: (value: string) => void;
  onIndicatorToggle: (key: IndicatorKey, enabled: boolean) => void;
}

export const ProChartIndicatorsDialog = ({
  open,
  colorMode,
  theme,
  indicators,
  indicatorSearch,
  activeIndicatorCount,
  filteredIndicators,
  onClose,
  onSearchChange,
  onIndicatorToggle,
}: ProChartIndicatorsDialogProps) => (
  <Dialog
    open={open}
    onClose={onClose}
    fullWidth
    maxWidth="sm"
    PaperProps={{
      sx: {
        bgcolor: theme.menuBg,
        color: theme.strongText,
        border: `1px solid ${theme.border}`,
        backgroundImage: 'none',
      },
    }}
  >
    <DialogTitle sx={{ pb: 1.5 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Stack direction="row" spacing={1} alignItems="center">
          <TuneRoundedIcon fontSize="small" />
          <Typography variant="h6">Indicators</Typography>
        </Stack>
        <Chip size="small" label={`${activeIndicatorCount} active`} color="info" variant="outlined" />
      </Stack>
    </DialogTitle>
    <DialogContent sx={{ pt: 0.5 }}>
      <TextField
        fullWidth
        size="small"
        placeholder="Search indicators"
        value={indicatorSearch}
        onChange={(event) => onSearchChange(event.target.value)}
        sx={{
          mb: 1.5,
          '& .MuiOutlinedInput-root': {
            color: theme.strongText,
            bgcolor: colorMode === 'dark' ? 'rgba(15,23,42,0.7)' : 'rgba(248,250,252,0.8)',
          },
        }}
      />
      <List disablePadding>
        {filteredIndicators.map((indicator, index) => (
          <Box key={indicator.key}>
            {index > 0 && <Divider sx={{ borderColor: theme.border }} />}
            <ListItemButton
              onClick={() => onIndicatorToggle(indicator.key, !indicators[indicator.key])}
              sx={{ px: 0.5, py: 1 }}
            >
              <ListItemText
                primary={indicator.label}
                secondary={indicator.description}
                primaryTypographyProps={{ sx: { color: theme.strongText, fontWeight: 600 } }}
                secondaryTypographyProps={{ sx: { color: theme.mutedText } }}
              />
              <Switch
                edge="end"
                checked={indicators[indicator.key]}
                onChange={() => onIndicatorToggle(indicator.key, !indicators[indicator.key])}
              />
            </ListItemButton>
          </Box>
        ))}
      </List>
    </DialogContent>
  </Dialog>
);
