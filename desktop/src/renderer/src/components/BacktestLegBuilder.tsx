import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import FilterAltRoundedIcon from '@mui/icons-material/FilterAltRounded';
import FilterAltOffRoundedIcon from '@mui/icons-material/FilterAltOffRounded';
import { useState } from 'react';
import type { BacktestLegPayload } from '../api/admin';
import { BacktestAdvancedConditionsEditor } from './BacktestAdvancedConditionsEditor';
import { normalizeAdvancedConditions } from './BacktestPanelShared';
import type { TimeframeOption } from './backtestAdvancedConditionUtils';

export interface BacktestLegBuilderProps {
  legs: BacktestLegPayload[];
  timeframeOptions: TimeframeOption[];
  onAddLeg: () => void;
  onUpdateLeg: (legIndex: number, patch: Partial<BacktestLegPayload>) => void;
  onDeleteLeg: (legIndex: number) => void;
}

const MAX_LEGS = 10;

export const BacktestLegBuilder = ({
  legs,
  timeframeOptions,
  onAddLeg,
  onUpdateLeg,
  onDeleteLeg,
}: BacktestLegBuilderProps) => {
  const [filterDialogIndex, setFilterDialogIndex] = useState<number | null>(null);

  const openLeg = filterDialogIndex !== null ? legs[filterDialogIndex] : null;

  return (
    <Card>
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip label="4" size="small" color="primary" sx={{ width: 24, height: 24, fontWeight: 700, borderRadius: '50%' }} />
              <Typography variant="subtitle1" fontWeight={700}>Leg Builder</Typography>
              <Chip label={`${legs.length} / ${MAX_LEGS}`} size="small" variant="outlined" />
              <Chip
                label="Per-leg filters"
                size="small"
                color={legs.some((l) => l.legConditions?.enabled) ? 'primary' : 'default'}
                variant={legs.some((l) => l.legConditions?.enabled) ? 'filled' : 'outlined'}
                sx={{ fontSize: '0.68rem', height: 20 }}
              />
            </Stack>
            <Tooltip title={legs.length >= MAX_LEGS ? `Max ${MAX_LEGS} legs allowed` : 'Add a new leg'}>
              <span>
                <IconButton
                  size="small"
                  color="primary"
                  onClick={onAddLeg}
                  disabled={legs.length >= MAX_LEGS}
                  sx={{ border: '1px solid', borderColor: 'primary.light', borderRadius: 1 }}
                >
                  <AddRoundedIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>

          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead sx={{ bgcolor: '#f5f7fa' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, color: '#555', fontSize: '0.72rem' }}>#</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#555', fontSize: '0.72rem' }}>Seg</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#555', fontSize: '0.72rem' }}>B/S</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#555', fontSize: '0.72rem' }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#555', fontSize: '0.72rem' }}>Expiry</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#555', fontSize: '0.72rem' }}>Strike</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#555', fontSize: '0.72rem' }}>Steps</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#555', fontSize: '0.72rem' }}>Lots</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, color: '#555', fontSize: '0.72rem' }}>Filter</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: '#555', fontSize: '0.72rem' }}>Del</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {legs.map((leg, index) => {
                  const hasFilter = Boolean(leg.legConditions?.enabled);
                  return (
                    <TableRow
                      key={leg.id}
                      sx={{
                        '& td': { py: 0.5 },
                        bgcolor: leg.position === 'BUY' ? '#f6fff6' : '#fff5f5',
                        '&:hover': { bgcolor: leg.position === 'BUY' ? '#edfaed' : '#ffecec' },
                        outline: hasFilter ? '2px solid #1565c020' : 'none',
                      }}
                    >
                      <TableCell>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Chip
                            label={`L${index + 1}`}
                            size="small"
                            sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700, bgcolor: '#e3f2fd', color: '#1565c0' }}
                          />
                          {hasFilter && (
                            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#1565c0' }} />
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Select
                          size="small"
                          value={leg.segment}
                          sx={{ fontSize: '0.78rem', minWidth: 90 }}
                          onChange={(e) => onUpdateLeg(index, {
                            segment: e.target.value as 'OPTIONS' | 'FUTURES',
                            optionType: e.target.value === 'FUTURES' ? undefined : leg.optionType ?? 'CALL',
                          })}
                        >
                          <MenuItem value="OPTIONS">Options</MenuItem>
                          <MenuItem value="FUTURES">Futures</MenuItem>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          size="small"
                          value={leg.position}
                          sx={{
                            fontSize: '0.78rem',
                            color: leg.position === 'BUY' ? '#2e7d32' : '#c62828',
                            fontWeight: 700,
                            minWidth: 72,
                          }}
                          onChange={(e) => onUpdateLeg(index, { position: e.target.value as 'BUY' | 'SELL' })}
                        >
                          <MenuItem value="BUY" sx={{ color: '#2e7d32', fontWeight: 600 }}>BUY</MenuItem>
                          <MenuItem value="SELL" sx={{ color: '#c62828', fontWeight: 600 }}>SELL</MenuItem>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          size="small"
                          value={leg.optionType ?? 'CALL'}
                          disabled={leg.segment === 'FUTURES'}
                          sx={{ fontSize: '0.78rem', minWidth: 60 }}
                          onChange={(e) => onUpdateLeg(index, { optionType: e.target.value as 'CALL' | 'PUT' })}
                        >
                          <MenuItem value="CALL">CE</MenuItem>
                          <MenuItem value="PUT">PE</MenuItem>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          size="small"
                          value={leg.expiryType}
                          sx={{ fontSize: '0.78rem', minWidth: 90 }}
                          onChange={(e) => onUpdateLeg(index, { expiryType: e.target.value as 'WEEKLY' | 'MONTHLY' })}
                        >
                          <MenuItem value="WEEKLY">Weekly</MenuItem>
                          <MenuItem value="MONTHLY">Monthly</MenuItem>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          size="small"
                          value={leg.strikeType}
                          sx={{ fontSize: '0.78rem', minWidth: 72 }}
                          onChange={(e) => onUpdateLeg(index, { strikeType: e.target.value as 'ATM' | 'ITM' | 'OTM' })}
                        >
                          <MenuItem value="ATM">ATM</MenuItem>
                          <MenuItem value="ITM">ITM</MenuItem>
                          <MenuItem value="OTM">OTM</MenuItem>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Tooltip title={leg.strikeSteps === 0 ? 'Exact ATM/ITM/OTM' : leg.strikeSteps > 0 ? `${leg.strikeSteps} steps deeper ITM` : `${Math.abs(leg.strikeSteps)} steps toward OTM`}>
                          <TextField
                            size="small"
                            type="number"
                            value={leg.strikeSteps}
                            inputProps={{ style: { width: 45, textAlign: 'center' } }}
                            onChange={(e) => onUpdateLeg(index, { strikeSteps: Number(e.target.value) })}
                          />
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          type="number"
                          value={leg.lots}
                          inputProps={{ min: 1, style: { width: 45, textAlign: 'center' } }}
                          onChange={(e) => onUpdateLeg(index, { lots: Math.max(1, Number(e.target.value)) })}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title={hasFilter ? 'Leg filter active — click to edit' : 'Add entry/exit filter for this leg'}>
                          <IconButton
                            size="small"
                            onClick={() => setFilterDialogIndex(index)}
                            sx={{
                              p: 0.5,
                              color: hasFilter ? '#1565c0' : 'text.secondary',
                              bgcolor: hasFilter ? '#e3f2fd' : 'transparent',
                              border: hasFilter ? '1px solid #90caf9' : '1px solid transparent',
                              borderRadius: 1,
                              '&:hover': { bgcolor: '#e3f2fd', color: '#1565c0' },
                            }}
                          >
                            {hasFilter ? <FilterAltRoundedIcon sx={{ fontSize: 16 }} /> : <FilterAltOffRoundedIcon sx={{ fontSize: 16 }} />}
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          color="error"
                          disabled={legs.length <= 1}
                          onClick={() => onDeleteLeg(index)}
                          sx={{ opacity: legs.length <= 1 ? 0.3 : 0.7 }}
                        >
                          <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      </CardContent>

      {/* Per-leg advanced filter dialog */}
      <Dialog
        open={filterDialogIndex !== null}
        onClose={() => setFilterDialogIndex(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <FilterAltRoundedIcon color="primary" />
            <Box>
              <Typography variant="h6" fontWeight={800}>
                Leg {filterDialogIndex !== null ? filterDialogIndex + 1 : ''} — Entry / Exit Filter
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Define conditions that must be met before this leg is entered or exited. Up to 10+ conditions with nested groups supported.
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 2 }}>
          {openLeg && filterDialogIndex !== null && (
            <BacktestAdvancedConditionsEditor
              value={normalizeAdvancedConditions(openLeg.legConditions)}
              timeframeOptions={timeframeOptions}
              onChange={(legConditions) => onUpdateLeg(filterDialogIndex, { legConditions })}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 1.5 }}>
          {filterDialogIndex !== null && legs[filterDialogIndex]?.legConditions?.enabled && (
            <Button
              color="error"
              variant="outlined"
              size="small"
              startIcon={<FilterAltOffRoundedIcon />}
              onClick={() => {
                onUpdateLeg(filterDialogIndex, { legConditions: { enabled: false, entry: null, exit: null } });
                setFilterDialogIndex(null);
              }}
            >
              Clear Filter
            </Button>
          )}
          <Box sx={{ flex: 1 }} />
          <Button variant="contained" onClick={() => setFilterDialogIndex(null)}>
            Done
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};
