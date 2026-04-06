import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import type { ChartVisualTheme, CompareSeriesState } from './ProChartCanvasShared';

export interface CompareSuggestion {
  instrumentKey: string;
  label: string;
  id: string;
}

export interface ProChartCompareDialogProps {
  open: boolean;
  theme: ChartVisualTheme;
  compareSeries: CompareSeriesState[];
  suggestions: CompareSuggestion[];
  customInstrument: string;
  selectedInstrument: string;
  onClose: () => void;
  onCustomInstrumentChange: (value: string) => void;
  onSelectedInstrumentChange: (value: string) => void;
  onAdd: () => void;
  onToggleVisibility: (id: string, visible: boolean) => void;
  onRemove: (id: string) => void;
}

export const ProChartCompareDialog = ({
  open,
  theme,
  compareSeries,
  suggestions,
  customInstrument,
  selectedInstrument,
  onClose,
  onCustomInstrumentChange,
  onSelectedInstrumentChange,
  onAdd,
  onToggleVisibility,
  onRemove,
}: ProChartCompareDialogProps) => (
  <Dialog
    open={open}
    onClose={onClose}
    maxWidth="sm"
    fullWidth
    PaperProps={{
      sx: {
        bgcolor: theme.menuBg,
        color: theme.strongText,
        border: `1px solid ${theme.border}`,
      },
    }}
  >
    <DialogTitle sx={{ pb: 1 }}>Compare Symbols</DialogTitle>
    <DialogContent sx={{ pt: 1 }}>
      <Stack spacing={2}>
        <Stack spacing={1.25}>
          <Typography variant="body2" sx={{ color: theme.mutedText }}>
            Overlay additional symbols rebased to the active chart’s opening level for relative-strength comparison.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Select
              size="small"
              value={selectedInstrument}
              onChange={(event) => onSelectedInstrumentChange(event.target.value)}
              displayEmpty
              fullWidth
            >
              <MenuItem value=""><em>Pick a known symbol</em></MenuItem>
              {suggestions.map((option) => (
                <MenuItem key={option.id} value={option.instrumentKey}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
            <Button
              variant="contained"
              startIcon={<AddRoundedIcon />}
              onClick={onAdd}
              sx={{ whiteSpace: 'nowrap' }}
            >
              Add
            </Button>
          </Stack>
          <TextField
            size="small"
            label="Custom instrument key"
            value={customInstrument}
            onChange={(event) => onCustomInstrumentChange(event.target.value)}
            placeholder="NSE_INDEX|Nifty Bank"
            fullWidth
          />
        </Stack>

        <Divider sx={{ borderColor: theme.border }} />

        {compareSeries.length === 0 ? (
          <Box
            sx={{
              borderRadius: 2,
              px: 2,
              py: 1.5,
              border: `1px dashed ${theme.border}`,
              color: theme.mutedText,
            }}
          >
            Add up to three overlays. Comparison lines use independent colors and stay aligned with the active timeframe.
          </Box>
        ) : (
          <List disablePadding sx={{ border: `1px solid ${theme.border}`, borderRadius: 2 }}>
            {compareSeries.map((item, index) => (
              <Box key={item.id}>
                {index > 0 && <Divider sx={{ borderColor: theme.border }} />}
                <ListItem
                  secondaryAction={(
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Tooltip title={item.visible ? 'Hide overlay' : 'Show overlay'}>
                        <Switch
                          edge="end"
                          checked={item.visible}
                          onChange={(_, checked) => onToggleVisibility(item.id, checked)}
                        />
                      </Tooltip>
                      <Tooltip title="Remove overlay">
                        <IconButton edge="end" onClick={() => onRemove(item.id)}>
                          <DeleteOutlineRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  )}
                >
                  <ListItemText
                    primary={(
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip
                          label={item.label}
                          size="small"
                          sx={{
                            bgcolor: item.color,
                            color: '#0f172a',
                            fontWeight: 700,
                          }}
                        />
                        {item.loading && <Typography variant="caption">Loading…</Typography>}
                        {item.error && (
                          <Typography variant="caption" sx={{ color: '#f87171' }}>
                            {item.error}
                          </Typography>
                        )}
                      </Stack>
                    )}
                    secondary={item.instrumentKey}
                  />
                </ListItem>
              </Box>
            ))}
          </List>
        )}
      </Stack>
    </DialogContent>
  </Dialog>
);
