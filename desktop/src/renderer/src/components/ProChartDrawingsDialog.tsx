import {
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  Switch,
  Tooltip,
  Typography,
} from '@mui/material';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import LockOpenRoundedIcon from '@mui/icons-material/LockOpenRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import type { ChartDrawing, ChartVisualTheme } from './ProChartCanvasShared';

export interface ProChartDrawingsDialogProps {
  open: boolean;
  theme: ChartVisualTheme;
  drawings: ChartDrawing[];
  onClose: () => void;
  onToggleVisibility: (id: string, visible: boolean) => void;
  onToggleLocked: (id: string) => void;
  onRemove: (id: string) => void;
}

export const ProChartDrawingsDialog = ({
  open,
  theme,
  drawings,
  onClose,
  onToggleVisibility,
  onToggleLocked,
  onRemove,
}: ProChartDrawingsDialogProps) => (
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
    <DialogTitle>Drawings List</DialogTitle>
    <DialogContent>
      {drawings.length === 0 ? (
        <Typography variant="body2" sx={{ color: theme.mutedText }}>
          Drawings created from the left toolbar appear here. Use this list to hide, lock, or remove chart annotations.
        </Typography>
      ) : (
        <List disablePadding sx={{ border: `1px solid ${theme.border}`, borderRadius: 2 }}>
          {drawings.map((drawing, index) => (
            <Stack key={drawing.id}>
              {index > 0 && <Divider sx={{ borderColor: theme.border }} />}
              <ListItem
                secondaryAction={(
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Switch
                      edge="end"
                      checked={drawing.visible}
                      onChange={(_, checked) => onToggleVisibility(drawing.id, checked)}
                    />
                    <Tooltip title={drawing.locked ? 'Unlock drawing' : 'Lock drawing'}>
                      <IconButton edge="end" onClick={() => onToggleLocked(drawing.id)}>
                        {drawing.locked ? <LockRoundedIcon fontSize="small" /> : <LockOpenRoundedIcon fontSize="small" />}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Remove drawing">
                      <IconButton edge="end" onClick={() => onRemove(drawing.id)} disabled={drawing.locked}>
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
                        label={drawing.type}
                        size="small"
                        sx={{ bgcolor: drawing.color, color: '#0f172a', fontWeight: 700 }}
                      />
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {drawing.label}
                      </Typography>
                    </Stack>
                  )}
                />
              </ListItem>
            </Stack>
          ))}
        </List>
      )}
    </DialogContent>
  </Dialog>
);
