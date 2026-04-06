import { useState } from 'react';
import {
  Box,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded';
import type { MarketWatchGroup } from '../../api/admin.types';

interface Props {
  group: MarketWatchGroup;
  tileCount: number;
  isDragTarget: boolean;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onAddTile: (groupId: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
}

export function TileGroupHeader({
  group,
  tileCount,
  isDragTarget,
  onRename,
  onDelete,
  onAddTile,
  onDragOver,
  onDrop,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(group.name);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== group.name) onRename(group.id, trimmed);
    else setDraft(group.name);
    setEditing(false);
  };

  return (
    <Box
      onDragOver={onDragOver}
      onDrop={onDrop}
      data-testid={`group-header-${group.id}`}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1.25,
        py: 0.625,
        mb: 1,
        borderRadius: 1.5,
        border: '1px dashed',
        borderColor: isDragTarget ? 'primary.main' : 'divider',
        bgcolor: isDragTarget ? 'primary.50' : 'grey.50',
        transition: 'border-color 120ms, background-color 120ms',
        // Show action buttons only on hover (when not editing)
        '& .group-actions': { opacity: 0, transition: 'opacity 120ms' },
        '&:hover .group-actions': { opacity: 1 },
      }}
    >
      <FolderOpenRoundedIcon sx={{ fontSize: 14, color: isDragTarget ? 'primary.main' : 'text.secondary', flexShrink: 0 }} />

      {editing ? (
        <>
          <TextField
            size="small"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={e => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') { setDraft(group.name); setEditing(false); }
            }}
            autoFocus
            inputProps={{ 'data-testid': `group-name-input-${group.id}` }}
            sx={{ flex: 1, '& .MuiInputBase-input': { py: 0.375, fontSize: 12, fontWeight: 700 } }}
          />
          <IconButton size="small" onClick={commit} sx={{ p: 0.25 }} data-testid={`group-name-confirm-${group.id}`}>
            <CheckRoundedIcon sx={{ fontSize: 12 }} />
          </IconButton>
        </>
      ) : (
        <>
          <Typography
            sx={{ flex: 1, fontSize: 11.5, fontWeight: 700, color: 'text.primary', userSelect: 'none' }}
            data-testid={`group-name-label-${group.id}`}
          >
            {group.name}
          </Typography>
          <Typography sx={{ fontSize: 10, color: 'text.disabled', flexShrink: 0 }}>
            {tileCount} tile{tileCount !== 1 ? 's' : ''}
          </Typography>
          <Stack className="group-actions" direction="row" alignItems="center" spacing={0}>
            <Tooltip title="Rename group">
              <IconButton
                size="small"
                onClick={() => { setDraft(group.name); setEditing(true); }}
                sx={{ p: 0.25 }}
                data-testid={`group-rename-btn-${group.id}`}
              >
                <EditRoundedIcon sx={{ fontSize: 11 }} />
              </IconButton>
            </Tooltip>
          </Stack>
        </>
      )}

      <Tooltip title="Add tile to this group">
        <IconButton
          size="small"
          onClick={() => onAddTile(group.id)}
          sx={{ p: 0.25, flexShrink: 0 }}
          data-testid={`group-add-tile-btn-${group.id}`}
        >
          <AddRoundedIcon sx={{ fontSize: 11 }} />
        </IconButton>
      </Tooltip>

      <Tooltip title="Delete group — tiles become ungrouped">
        <IconButton
          size="small"
          color="error"
          onClick={() => onDelete(group.id)}
          sx={{ p: 0.25, flexShrink: 0 }}
          data-testid={`group-delete-btn-${group.id}`}
        >
          <DeleteRoundedIcon sx={{ fontSize: 11 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
