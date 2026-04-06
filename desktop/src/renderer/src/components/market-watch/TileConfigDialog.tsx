import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormHelperText,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useEffect, useState } from 'react';
import type { MarketWatchSource, MarketWatchTileConfig } from '../../api/admin.types';
import { INSTRUMENTS, TIMEFRAME_OPTIONS } from '../AppShellShared';
import {
  DEFAULT_PRIMARY_FIELD,
  FIELD_OPTIONS,
  LONG_TEXT_FIELD_KEYS,
  MARKET_SCOPES,
  SOURCE_META,
} from './catalog';

const EMPTY_TILE: MarketWatchTileConfig = {
  id: '',
  title: '',
  source: 'TRADING_SIGNAL',
  instrumentKey: INSTRUMENTS[0]?.key ?? '',
  timeframeUnit: 'minutes',
  timeframeInterval: 15,
  marketScope: 'INDIA_NEWS',
  primaryField: DEFAULT_PRIMARY_FIELD.TRADING_SIGNAL,
};

export function TileConfigDialog({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: MarketWatchTileConfig | null;
  onClose: () => void;
  onSave: (tile: MarketWatchTileConfig) => void;
}) {
  const [form, setForm] = useState<MarketWatchTileConfig>(EMPTY_TILE);

  const fieldOptions     = FIELD_OPTIONS[form.source];
  const selectedField    = fieldOptions.find(o => o.key === form.primaryField);
  const isLongTextField  = selectedField ? LONG_TEXT_FIELD_KEYS.has(selectedField.key) : false;

  useEffect(() => {
    if (!open) return;
    const next = initial ?? { ...EMPTY_TILE, id: crypto.randomUUID() };
    setForm({ ...next, primaryField: next.primaryField ?? DEFAULT_PRIMARY_FIELD[next.source] });
  }, [initial, open]);

  // Reset primaryField when source changes if the current field isn't valid
  useEffect(() => {
    if (!fieldOptions.some(o => o.key === form.primaryField)) {
      setForm(prev => ({ ...prev, primaryField: DEFAULT_PRIMARY_FIELD[prev.source] }));
    }
  }, [fieldOptions, form.primaryField]);

  const update = <K extends keyof MarketWatchTileConfig>(key: K, value: MarketWatchTileConfig[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const needsInstrument = form.source !== 'MARKET_SENTIMENT';
  const needsTimeframe  = form.source === 'TRADING_SIGNAL' || form.source === 'CANDLE';
  const needsScope      = form.source === 'MARKET_SENTIMENT';
  const meta            = SOURCE_META[form.source];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography fontWeight={700}>
              {initial ? 'Edit Tile' : 'Add Market Watch Tile'}
            </Typography>
            <Chip
              label={meta.label}
              size="small"
              sx={{ bgcolor: `${meta.color}18`, color: meta.color, fontWeight: 700, height: 20, fontSize: 10 }}
            />
          </Stack>
          <IconButton size="small" onClick={onClose}>
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        <Stack spacing={2} mt={0.5}>
          {/* Optional title */}
          <TextField
            label="Tile title (optional)"
            value={form.title}
            onChange={e => update('title', e.target.value)}
            placeholder="Auto-generated from source + field if left blank"
            size="small"
            fullWidth
          />

          {/* Source */}
          <FormControl size="small" fullWidth>
            <InputLabel>Data source</InputLabel>
            <Select
              label="Data source"
              value={form.source}
              onChange={e => {
                const source = e.target.value as MarketWatchSource;
                setForm(prev => ({ ...prev, source, primaryField: DEFAULT_PRIMARY_FIELD[source] }));
              }}
            >
              {Object.entries(SOURCE_META).map(([key, s]) => (
                <MenuItem key={key} value={key}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box
                      sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: s.color, flexShrink: 0 }}
                    />
                    <span>{s.label}</span>
                  </Stack>
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>
              Each source maps to a real DB table; latest row is fetched on every refresh.
            </FormHelperText>
          </FormControl>

          {/* Instrument */}
          {needsInstrument && (
            <FormControl size="small" fullWidth>
              <InputLabel>Instrument</InputLabel>
              <Select
                label="Instrument"
                value={form.instrumentKey ?? ''}
                onChange={e => update('instrumentKey', e.target.value)}
              >
                {INSTRUMENTS.map(o => (
                  <MenuItem key={o.key} value={o.key}>{o.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Timeframe */}
          {needsTimeframe && (
            <FormControl size="small" fullWidth>
              <InputLabel>Timeframe</InputLabel>
              <Select
                label="Timeframe"
                value={`${form.timeframeUnit}|${form.timeframeInterval}`}
                onChange={e => {
                  const [unit, interval] = String(e.target.value).split('|');
                  setForm(prev => ({ ...prev, timeframeUnit: unit, timeframeInterval: Number(interval) }));
                }}
              >
                {TIMEFRAME_OPTIONS.map(o => (
                  <MenuItem key={`${o.unit}|${o.interval}`} value={`${o.unit}|${o.interval}`}>
                    {o.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Market scope */}
          {needsScope && (
            <FormControl size="small" fullWidth>
              <InputLabel>Market scope</InputLabel>
              <Select
                label="Market scope"
                value={form.marketScope ?? ''}
                onChange={e => update('marketScope', e.target.value)}
              >
                {MARKET_SCOPES.map(o => (
                  <MenuItem key={o.key} value={o.key}>{o.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Primary column */}
          <FormControl size="small" fullWidth>
            <InputLabel>Primary column (large display)</InputLabel>
            <Select
              label="Primary column (large display)"
              value={form.primaryField ?? DEFAULT_PRIMARY_FIELD[form.source]}
              onChange={e => update('primaryField', e.target.value)}
            >
              {fieldOptions.map(o => (
                <MenuItem key={o.key} value={o.key}>
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <span>{o.label}</span>
                    {LONG_TEXT_FIELD_KEYS.has(o.key) && (
                      <Chip label="text" size="small" sx={{ height: 16, fontSize: 10 }} />
                    )}
                  </Stack>
                </MenuItem>
              ))}
            </Select>
            {selectedField && (
              <FormHelperText>
                <Stack direction="row" spacing={0.5} alignItems="flex-start" component="span">
                  <InfoOutlinedIcon sx={{ fontSize: 12, mt: '1px', flexShrink: 0 }} />
                  <span>
                    {selectedField.description}
                    {isLongTextField && ' — shown in the collapsible Analysis block.'}
                  </span>
                </Stack>
              </FormHelperText>
            )}
          </FormControl>

          {/* Column density hint */}
          <Box
            sx={{
              bgcolor: 'info.50',
              border: '1px solid',
              borderColor: 'info.200',
              borderRadius: 1.5,
              px: 1.5,
              py: 1,
            }}
          >
            <Stack direction="row" spacing={0.75} alignItems="flex-start">
              <Tooltip title="Tip about column density">
                <InfoOutlinedIcon sx={{ fontSize: 14, color: 'info.main', mt: '1px', flexShrink: 0 }} />
              </Tooltip>
              <Typography variant="caption" color="text.secondary">
                All other columns are shown below the primary value. The number of visible rows
                adapts to your grid column setting: 4-col shows 4 rows, 3-col shows 6, 2-col shows
                9, and 1-col shows everything. Long-text fields (Reason, AI Reason) appear in a
                collapsible Analysis section.
              </Typography>
            </Stack>
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => onSave({ ...form, id: form.id || crypto.randomUUID() })}
        >
          {initial ? 'Update Tile' : 'Add Tile'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
