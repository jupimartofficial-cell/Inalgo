import {
  Card,
  CardContent,
  Chip,
  Divider,
  FormControl,
  Grid,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import type { BacktestLegPayload, BacktestStrategyPayload } from '../api/admin';
import { BacktestAdvancedConditionsEditor } from './BacktestAdvancedConditionsEditor';
import {
  formatAdvancedConditionsSummary,
  type TimeframeOption,
} from './backtestAdvancedConditionUtils';
import {
  RiskControlRow,
  normalizeAdvancedConditions,
  numberFromInput,
  type InstrumentOption,
  type SupportedStrategyType,
} from './BacktestPanelShared';
import { BacktestLegBuilder } from './BacktestLegBuilder';

export interface BacktestStrategyFormProps {
  strategy: BacktestStrategyPayload;
  baseInstruments: InstrumentOption[];
  baseTimeframes: TimeframeOption[];
  onUpdateField: <K extends keyof BacktestStrategyPayload>(key: K, value: BacktestStrategyPayload[K]) => void;
  onSetStrategy: (updater: (current: BacktestStrategyPayload) => BacktestStrategyPayload) => void;
  onAddLeg: () => void;
  onUpdateLeg: (legIndex: number, patch: Partial<BacktestLegPayload>) => void;
  onDeleteLeg: (legIndex: number) => void;
}

export const BacktestStrategyForm = ({
  strategy,
  baseInstruments,
  baseTimeframes,
  onUpdateField,
  onSetStrategy,
  onAddLeg,
  onUpdateLeg,
  onDeleteLeg,
}: BacktestStrategyFormProps) => {
  const advancedConditionSummary = formatAdvancedConditionsSummary(
    strategy.advancedConditions,
    baseTimeframes
  );

  return (
    <>
      {/* ─── Step 1 — Schedule & Index ─────────────────────────────── */}
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip label="1" size="small" color="primary" sx={{ width: 24, height: 24, fontWeight: 700, borderRadius: '50%' }} />
              <Typography variant="subtitle1" fontWeight={700}>Schedule & Index</Typography>
            </Stack>

            <Grid container spacing={2} alignItems="flex-start">
              <Grid item xs={12} md={4}>
                <TextField
                  label="Strategy Name"
                  value={strategy.strategyName}
                  fullWidth
                  size="small"
                  placeholder="e.g. Nifty ATM Sell Weekly"
                  onChange={(e) => onUpdateField('strategyName', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Index</InputLabel>
                  <Select
                    label="Index"
                    value={strategy.underlyingKey}
                    onChange={(e) => onUpdateField('underlyingKey', e.target.value)}
                  >
                    {baseInstruments.map((instrument) => (
                      <MenuItem key={instrument.key} value={instrument.key}>{instrument.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={2.5}>
                <FormControl fullWidth size="small">
                  <InputLabel>Underlying Source</InputLabel>
                  <Select
                    label="Underlying Source"
                    value={strategy.underlyingSource}
                    disabled
                  >
                    <MenuItem value="FUTURES">Futures</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={2.5}>
                <FormControl fullWidth size="small">
                  <InputLabel>Strategy Type</InputLabel>
                  <Select
                    label="Strategy Type"
                    value={strategy.strategyType}
                    onChange={(e) => onUpdateField('strategyType', e.target.value as SupportedStrategyType)}
                  >
                    <MenuItem value="INTRADAY">Intraday</MenuItem>
                    <MenuItem value="POSITIONAL">Positional</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Grid container spacing={2} alignItems="flex-start">
              <Grid item xs={6} sm={3}>
                <TextField
                  label="Start Date"
                  type="date"
                  value={strategy.startDate}
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  onChange={(e) => onUpdateField('startDate', e.target.value)}
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField
                  label="End Date"
                  type="date"
                  value={strategy.endDate}
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  onChange={(e) => onUpdateField('endDate', e.target.value)}
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField
                  label="Entry Time"
                  type="time"
                  value={strategy.entryTime}
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ step: 60 }}
                  helperText="Market opens 09:15"
                  onChange={(e) => onUpdateField('entryTime', e.target.value)}
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField
                  label="Exit Time"
                  type="time"
                  value={strategy.exitTime}
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ step: 60 }}
                  helperText="Must be after entry"
                  onChange={(e) => onUpdateField('exitTime', e.target.value)}
                />
              </Grid>
            </Grid>
          </Stack>
        </CardContent>
      </Card>

      {/* ─── Step 2 — Risk Controls ────────────────────────────────── */}
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip label="2" size="small" color="primary" sx={{ width: 24, height: 24, fontWeight: 700, borderRadius: '50%' }} />
              <Typography variant="subtitle1" fontWeight={700}>Risk Controls</Typography>
              <Tooltip title="All values are in points. Stop Loss triggers when combined leg P&L falls below the SL value. Target triggers when combined P&L reaches the target. Trailing SL adjusts the stop level as profit grows.">
                <InfoOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              </Tooltip>
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap>
              <RiskControlRow
                label="Stop Loss"
                enabled={strategy.overallSettings.stopLossEnabled}
                value={strategy.overallSettings.stopLossValue ?? 0}
                onToggle={(v) => onSetStrategy((c) => ({ ...c, overallSettings: { ...c.overallSettings, stopLossEnabled: v } }))}
                onValueChange={(v) => onSetStrategy((c) => ({ ...c, overallSettings: { ...c.overallSettings, stopLossValue: v } }))}
                hint="Max combined loss"
              />
              <RiskControlRow
                label="Target"
                enabled={strategy.overallSettings.targetEnabled}
                value={strategy.overallSettings.targetValue ?? 0}
                onToggle={(v) => onSetStrategy((c) => ({ ...c, overallSettings: { ...c.overallSettings, targetEnabled: v } }))}
                onValueChange={(v) => onSetStrategy((c) => ({ ...c, overallSettings: { ...c.overallSettings, targetValue: v } }))}
                hint="Max combined profit"
              />
              <RiskControlRow
                label="Trailing SL"
                enabled={strategy.overallSettings.trailingEnabled}
                value={strategy.overallSettings.trailingTrigger ?? 0}
                onToggle={(v) => onSetStrategy((c) => ({ ...c, overallSettings: { ...c.overallSettings, trailingEnabled: v } }))}
                onValueChange={(v) => onSetStrategy((c) => ({ ...c, overallSettings: { ...c.overallSettings, trailingTrigger: v } }))}
                hint="Trigger to activate trailing"
              />
              {strategy.overallSettings.trailingEnabled && (
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1.5}
                  sx={{
                    px: 1.5,
                    py: 0.75,
                    border: '1px solid',
                    borderColor: 'warning.light',
                    borderRadius: 1.5,
                    bgcolor: '#fffde7',
                  }}
                >
                  <Typography variant="body2" fontWeight={600} sx={{ minWidth: 90 }}>Lock Profit</Typography>
                  <TextField
                    size="small"
                    type="number"
                    value={strategy.overallSettings.trailingLockProfit ?? 0}
                    onChange={(e) => onSetStrategy((c) => ({ ...c, overallSettings: { ...c.overallSettings, trailingLockProfit: numberFromInput(e.target.value) } }))}
                    InputProps={{
                      endAdornment: <InputAdornment position="end"><Typography variant="caption" color="text.secondary">pts</Typography></InputAdornment>,
                      inputProps: { min: 0, step: 0.5, style: { width: 70 } },
                    }}
                    sx={{ maxWidth: 130 }}
                    helperText="Profit locked at trigger"
                  />
                </Stack>
              )}
            </Stack>

            <Divider />

            {/* Position Management sub-section */}
            <Stack spacing={1}>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <Typography variant="body2" fontWeight={700} color="text.secondary" sx={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  Position Management
                </Typography>
                <Tooltip title="Controls how legs are exited and re-entry restrictions during the trading session.">
                  <InfoOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                </Tooltip>
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap>

                {/* Square Off Mode */}
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 1.5, py: 0.75, border: '1px solid', borderColor: 'divider', borderRadius: 1.5, bgcolor: '#fafafa' }}>
                  <Typography variant="body2" fontWeight={600} sx={{ minWidth: 90 }}>Square Off</Typography>
                  <FormControl size="small">
                    <Select
                      value={strategy.legwiseSettings.squareOffMode}
                      onChange={(e) => onSetStrategy((c) => ({ ...c, legwiseSettings: { ...c.legwiseSettings, squareOffMode: e.target.value as 'PARTIAL' | 'COMPLETE' } }))}
                      sx={{ fontSize: '0.78rem', minWidth: 110 }}
                    >
                      <MenuItem value="PARTIAL">Partial</MenuItem>
                      <MenuItem value="COMPLETE">Complete</MenuItem>
                    </Select>
                  </FormControl>
                  <Tooltip title="PARTIAL: exit individual legs when their own SL/target is hit. COMPLETE: exit all legs simultaneously when combined P&L SL/target is reached.">
                    <InfoOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                  </Tooltip>
                </Stack>

                {/* Trail SL to Break Even */}
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1.5}
                  sx={{
                    px: 1.5, py: 0.75, border: '1px solid',
                    borderColor: strategy.legwiseSettings.trailSlToBreakEven ? 'warning.light' : 'divider',
                    borderRadius: 1.5,
                    bgcolor: strategy.legwiseSettings.trailSlToBreakEven ? '#fffde7' : '#fafafa',
                    transition: 'all 0.2s',
                  }}
                >
                  <Switch
                    size="small"
                    checked={strategy.legwiseSettings.trailSlToBreakEven}
                    onChange={(e) => onSetStrategy((c) => ({ ...c, legwiseSettings: { ...c.legwiseSettings, trailSlToBreakEven: e.target.checked } }))}
                    color="warning"
                  />
                  <Typography variant="body2" fontWeight={600} sx={{ color: strategy.legwiseSettings.trailSlToBreakEven ? 'text.primary' : 'text.disabled' }}>
                    Trail SL → B/E
                  </Typography>
                  <Tooltip title="Move stop loss to breakeven once a profit milestone is achieved, locking in no-loss exit.">
                    <InfoOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                  </Tooltip>
                </Stack>

                {/* No Re-Entry After */}
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1.5}
                  sx={{
                    px: 1.5, py: 0.75, border: '1px solid',
                    borderColor: strategy.legwiseSettings.noReEntryAfterEnabled ? 'error.light' : 'divider',
                    borderRadius: 1.5,
                    bgcolor: strategy.legwiseSettings.noReEntryAfterEnabled ? '#fff5f5' : '#fafafa',
                    transition: 'all 0.2s',
                  }}
                >
                  <Switch
                    size="small"
                    checked={strategy.legwiseSettings.noReEntryAfterEnabled}
                    onChange={(e) => onSetStrategy((c) => ({ ...c, legwiseSettings: { ...c.legwiseSettings, noReEntryAfterEnabled: e.target.checked } }))}
                    color="error"
                  />
                  <Typography variant="body2" fontWeight={600} sx={{ minWidth: 120, color: strategy.legwiseSettings.noReEntryAfterEnabled ? 'text.primary' : 'text.disabled' }}>
                    No Re-Entry After
                  </Typography>
                  <TextField
                    size="small"
                    type="time"
                    value={strategy.legwiseSettings.noReEntryAfterTime ?? '14:30'}
                    disabled={!strategy.legwiseSettings.noReEntryAfterEnabled}
                    inputProps={{ step: 60 }}
                    InputLabelProps={{ shrink: true }}
                    onChange={(e) => onSetStrategy((c) => ({ ...c, legwiseSettings: { ...c.legwiseSettings, noReEntryAfterTime: e.target.value } }))}
                    sx={{ width: 110 }}
                    helperText="Block re-entries after this time"
                  />
                </Stack>

              </Stack>
            </Stack>

          </Stack>
        </CardContent>
      </Card>

      {/* ─── Step 3 — Advanced Conditions ─────────────────────────── */}
      <Stack spacing={0.5}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 0.5 }}>
          <Chip label="3" size="small" color="primary" sx={{ width: 24, height: 24, fontWeight: 700, borderRadius: '50%' }} />
          <Typography variant="subtitle1" fontWeight={700}>Entry / Exit Conditions</Typography>
          <Typography variant="caption" color="text.secondary">(optional — uses Trading Signal &amp; Param data)</Typography>
        </Stack>
        <BacktestAdvancedConditionsEditor
          value={normalizeAdvancedConditions(strategy.advancedConditions)}
          timeframeOptions={baseTimeframes}
          onChange={(advancedConditions) => onSetStrategy((current) => ({ ...current, advancedConditions }))}
        />
      </Stack>

      {/* ─── Step 4 — Leg Builder ──────────────────────────────────── */}
      <BacktestLegBuilder
        legs={strategy.legs}
        timeframeOptions={baseTimeframes}
        onAddLeg={onAddLeg}
        onUpdateLeg={onUpdateLeg}
        onDeleteLeg={onDeleteLeg}
      />

      {/* ─── Strategy Logic Preview ────────────────────────────────── */}
      <Card data-testid="backtest-logic-preview">
        <CardContent>
          <Stack spacing={1}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle2" fontWeight={700} color="text.secondary">
                Strategy Logic Preview
              </Typography>
              <Chip
                size="small"
                color={strategy.advancedConditions?.enabled ? 'primary' : 'default'}
                variant={strategy.advancedConditions?.enabled ? 'filled' : 'outlined'}
                label={strategy.advancedConditions?.enabled ? 'Advance conditions active' : 'Basic timing mode'}
              />
            </Stack>
            <Paper variant="outlined" sx={{ p: 1.5, bgcolor: '#f8fafc', borderStyle: 'dashed', borderColor: '#cbd5e1' }}>
              <Stack spacing={0.75}>
                <Typography variant="caption" color="text.secondary">{advancedConditionSummary.fullText}</Typography>
                <Divider />
                <Typography variant="caption" color="text.secondary">
                  <strong>ENTRY: </strong>{advancedConditionSummary.entryText}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  <strong>EXIT: </strong>{advancedConditionSummary.exitText}
                </Typography>
              </Stack>
            </Paper>
          </Stack>
        </CardContent>
      </Card>
    </>
  );
};
