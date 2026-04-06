import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import type {
  BacktestLegPayload,
  BacktestStrategyPayload,
  IntraStrategyValidationResult,
} from '../../api/admin';
import { BacktestAdvancedConditionsEditor } from '../BacktestAdvancedConditionsEditor';
import { BacktestLegBuilder } from '../BacktestLegBuilder';
import {
  createDefaultLeg,
  normalizeAdvancedConditions,
  numberFromInput,
  type InstrumentOption,
} from '../BacktestPanelShared';
import type { TimeframeOption } from '../backtestAdvancedConditionUtils';

const STEPS = [
  'Basic setup',
  'Entry conditions',
  'Exit and risk',
  'Position setup',
  'Review and save',
] as const;

const fieldError = (
  validation: IntraStrategyValidationResult | null,
  field: string
) => validation?.fieldErrors.find((item) => item.field === field)?.message;

export const IntraStrategyBuilder = ({
  strategy,
  timeframeUnit,
  timeframeInterval,
  advancedMode,
  marketSession,
  baseInstruments,
  baseTimeframes,
  validation,
  activeStep,
  setActiveStep,
  setAdvancedMode,
  setMarketSession,
  setTimeframeUnit,
  setTimeframeInterval,
  onSetStrategy,
  onUpdateField,
  onAddLeg,
  onUpdateLeg,
  onDeleteLeg,
}: {
  strategy: BacktestStrategyPayload;
  timeframeUnit: string;
  timeframeInterval: number;
  advancedMode: boolean;
  marketSession: string;
  baseInstruments: InstrumentOption[];
  baseTimeframes: TimeframeOption[];
  validation: IntraStrategyValidationResult | null;
  activeStep: number;
  setActiveStep: (next: number) => void;
  setAdvancedMode: (value: boolean) => void;
  setMarketSession: (value: string) => void;
  setTimeframeUnit: (value: string) => void;
  setTimeframeInterval: (value: number) => void;
  onSetStrategy: (updater: (current: BacktestStrategyPayload) => BacktestStrategyPayload) => void;
  onUpdateField: <K extends keyof BacktestStrategyPayload>(key: K, value: BacktestStrategyPayload[K]) => void;
  onAddLeg: () => void;
  onUpdateLeg: (legIndex: number, patch: Partial<BacktestLegPayload>) => void;
  onDeleteLeg: (legIndex: number) => void;
}) => {
  const next = () => setActiveStep(Math.min(activeStep + 1, STEPS.length - 1));
  const back = () => setActiveStep(Math.max(activeStep - 1, 0));
  const stepErrorCount = validation?.fieldErrors.filter((e) => e.step === activeStep + 1).length ?? 0;

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} justifyContent="space-between" spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              {STEPS.map((label, idx) => (
                <Chip
                  key={label}
                  label={`${idx + 1}. ${label}`}
                  size="small"
                  color={idx === activeStep ? 'primary' : idx < activeStep ? 'success' : 'default'}
                  variant={idx === activeStep ? 'filled' : 'outlined'}
                  onClick={() => setActiveStep(idx)}
                />
              ))}
            </Stack>
            <FormControlLabel
              control={<Switch checked={advancedMode} onChange={(e) => setAdvancedMode(e.target.checked)} />}
              label="Advanced mode"
            />
          </Stack>

          {validation && validation.summaryErrors.length > 0 && (
            <Alert severity="error">
              {validation.summaryErrors.join(' ')}
            </Alert>
          )}
          {validation && validation.warnings.length > 0 && (
            <Alert severity="warning">
              {validation.warnings.join(' ')}
            </Alert>
          )}

          {activeStep === 0 && (
            <Stack spacing={2}>
              <Typography variant="subtitle1" fontWeight={700}>Step 1: Basic setup</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Strategy name"
                    value={strategy.strategyName}
                    onChange={(e) => onUpdateField('strategyName', e.target.value)}
                    fullWidth
                    size="small"
                    error={Boolean(fieldError(validation, 'strategy.strategyName'))}
                    helperText={fieldError(validation, 'strategy.strategyName') ?? ''}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Instrument / index</InputLabel>
                    <Select
                      label="Instrument / index"
                      value={strategy.underlyingKey}
                      onChange={(e) => onUpdateField('underlyingKey', e.target.value)}
                    >
                      {baseInstruments.map((item) => <MenuItem key={item.key} value={item.key}>{item.label}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Underlying source</InputLabel>
                    <Select
                      label="Underlying source"
                      value={strategy.underlyingSource}
                      onChange={(e) => onUpdateField('underlyingSource', e.target.value as BacktestStrategyPayload['underlyingSource'])}
                    >
                      <MenuItem value="FUTURES">Futures</MenuItem>
                      <MenuItem value="CASH">Cash</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Strategy type</InputLabel>
                    <Select
                      label="Strategy type"
                      value={strategy.strategyType}
                      onChange={(e) => onUpdateField('strategyType', e.target.value as BacktestStrategyPayload['strategyType'])}
                    >
                      <MenuItem value="INTRADAY">INTRADAY</MenuItem>
                      <MenuItem value="BTST">BTST</MenuItem>
                      <MenuItem value="POSITIONAL">POSITIONAL</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Timeframe unit</InputLabel>
                    <Select
                      label="Timeframe unit"
                      value={timeframeUnit}
                      onChange={(e) => setTimeframeUnit(e.target.value)}
                    >
                      <MenuItem value="minutes">minutes</MenuItem>
                      <MenuItem value="days">days</MenuItem>
                      <MenuItem value="weeks">weeks</MenuItem>
                      <MenuItem value="months">months</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    size="small"
                    type="number"
                    label="Timeframe interval"
                    value={timeframeInterval}
                    onChange={(e) => setTimeframeInterval(numberFromInput(e.target.value))}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    size="small"
                    label="Active session / timing"
                    value={marketSession}
                    onChange={(e) => setMarketSession(e.target.value)}
                    fullWidth
                    placeholder="REGULAR_MARKET"
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    size="small"
                    type="time"
                    label="Entry time"
                    value={strategy.entryTime}
                    onChange={(e) => onUpdateField('entryTime', e.target.value)}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    size="small"
                    type="time"
                    label="Exit time"
                    value={strategy.exitTime}
                    onChange={(e) => onUpdateField('exitTime', e.target.value)}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    size="small"
                    type="date"
                    label="Start date"
                    value={strategy.startDate}
                    onChange={(e) => onUpdateField('startDate', e.target.value)}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    size="small"
                    type="date"
                    label="End date"
                    value={strategy.endDate}
                    onChange={(e) => onUpdateField('endDate', e.target.value)}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </Grid>
            </Stack>
          )}

          {activeStep === 1 && (
            <Stack spacing={1.5}>
              <Typography variant="subtitle1" fontWeight={700}>Step 2: Entry conditions</Typography>
              {!advancedMode ? (
                <Alert severity="info">
                  Basic mode uses time-based entry from Step 1 (entry time: <b>{strategy.entryTime || '—'}</b>).
                  Enable <b>Advanced mode</b> above to configure signal conditions, grouped logic, and nested rules.
                </Alert>
              ) : (
                <>
                  <Typography variant="body2" color="text.secondary">
                    Configure entry signal source, trend rules, time windows, optional advanced conditions, and grouping logic.
                  </Typography>
                  <BacktestAdvancedConditionsEditor
                    value={normalizeAdvancedConditions(strategy.advancedConditions)}
                    timeframeOptions={baseTimeframes}
                    onChange={(advancedConditions) => onSetStrategy((current) => ({ ...current, advancedConditions }))}
                  />
                </>
              )}
            </Stack>
          )}

          {activeStep === 2 && (
            <Stack spacing={2}>
              <Typography variant="subtitle1" fontWeight={700}>Step 3: Exit and risk</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={3}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={strategy.overallSettings.stopLossEnabled}
                        onChange={(e) => onSetStrategy((c) => ({
                          ...c,
                          overallSettings: { ...c.overallSettings, stopLossEnabled: e.target.checked }
                        }))}
                      />
                    }
                    label="Stop loss"
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    size="small"
                    type="number"
                    label="Stop loss value"
                    value={strategy.overallSettings.stopLossValue ?? 0}
                    onChange={(e) => onSetStrategy((c) => ({ ...c, overallSettings: { ...c.overallSettings, stopLossValue: numberFromInput(e.target.value) } }))}
                    fullWidth
                    disabled={!strategy.overallSettings.stopLossEnabled}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={strategy.overallSettings.targetEnabled}
                        onChange={(e) => onSetStrategy((c) => ({
                          ...c,
                          overallSettings: { ...c.overallSettings, targetEnabled: e.target.checked }
                        }))}
                      />
                    }
                    label="Target"
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    size="small"
                    type="number"
                    label="Target value"
                    value={strategy.overallSettings.targetValue ?? 0}
                    onChange={(e) => onSetStrategy((c) => ({ ...c, overallSettings: { ...c.overallSettings, targetValue: numberFromInput(e.target.value) } }))}
                    fullWidth
                    disabled={!strategy.overallSettings.targetEnabled}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={strategy.overallSettings.trailingEnabled}
                        onChange={(e) => onSetStrategy((c) => ({
                          ...c,
                          overallSettings: { ...c.overallSettings, trailingEnabled: e.target.checked }
                        }))}
                      />
                    }
                    label="Trailing stop"
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    size="small"
                    type="number"
                    label="Trailing trigger"
                    value={strategy.overallSettings.trailingTrigger ?? 0}
                    onChange={(e) => onSetStrategy((c) => ({ ...c, overallSettings: { ...c.overallSettings, trailingTrigger: numberFromInput(e.target.value) } }))}
                    fullWidth
                    disabled={!strategy.overallSettings.trailingEnabled}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Square off</InputLabel>
                    <Select
                      label="Square off"
                      value={strategy.legwiseSettings.squareOffMode}
                      onChange={(e) => onSetStrategy((c) => ({ ...c, legwiseSettings: { ...c.legwiseSettings, squareOffMode: e.target.value as 'PARTIAL' | 'COMPLETE' } }))}
                    >
                      <MenuItem value="PARTIAL">PARTIAL</MenuItem>
                      <MenuItem value="COMPLETE">COMPLETE</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={3}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={strategy.legwiseSettings.noReEntryAfterEnabled}
                        onChange={(e) => onSetStrategy((c) => ({ ...c, legwiseSettings: { ...c.legwiseSettings, noReEntryAfterEnabled: e.target.checked } }))}
                      />
                    }
                    label="No re-entry rule"
                  />
                </Grid>
              </Grid>
            </Stack>
          )}

          {activeStep === 3 && (
            <Stack spacing={1.5}>
              <Typography variant="subtitle1" fontWeight={700}>Step 4: Position setup</Typography>
              <Typography variant="body2" color="text.secondary">
                Configure option/futures legs, direction, expiry, strike logic, steps, lots, and leg filters.
              </Typography>
              <BacktestLegBuilder
                legs={strategy.legs}
                timeframeOptions={baseTimeframes}
                onAddLeg={onAddLeg}
                onUpdateLeg={onUpdateLeg}
                onDeleteLeg={onDeleteLeg}
              />
            </Stack>
          )}

          {activeStep === 4 && (
            <Stack spacing={1.5}>
              <Typography variant="subtitle1" fontWeight={700}>Step 5: Review and save</Typography>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={1}>
                  <Typography variant="body2"><b>Strategy:</b> {strategy.strategyName || 'Untitled'}</Typography>
                  <Typography variant="body2"><b>Overview:</b> {strategy.strategyType} · {strategy.underlyingKey} · {timeframeInterval} {timeframeUnit}</Typography>
                  <Typography variant="body2"><b>Entry logic:</b> {strategy.entryTime} (advanced: {strategy.advancedConditions?.enabled ? 'enabled' : 'disabled'})</Typography>
                  <Typography variant="body2"><b>Exit logic:</b> {strategy.exitTime}</Typography>
                  <Typography variant="body2"><b>Risk rules:</b> SL {strategy.overallSettings.stopLossEnabled ? 'on' : 'off'} · Target {strategy.overallSettings.targetEnabled ? 'on' : 'off'} · Trailing {strategy.overallSettings.trailingEnabled ? 'on' : 'off'}</Typography>
                  <Typography variant="body2"><b>Leg setup:</b> {strategy.legs.length} leg(s)</Typography>
                  {validation?.warnings?.map((warning) => (
                    <Alert key={warning} severity="warning">{warning}</Alert>
                  ))}
                </Stack>
              </Paper>
              {validation?.valid && (
                <Alert icon={<CheckCircleRoundedIcon />} severity="success">
                  Configuration is valid. Paper eligible: {String(validation.paperEligible)}. Live eligible: {String(validation.liveEligible)}.
                </Alert>
              )}
            </Stack>
          )}

          <Divider />
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Button startIcon={<ArrowBackRoundedIcon />} onClick={back} disabled={activeStep === 0}>
              Back
            </Button>
            <Stack direction="row" alignItems="center" spacing={1}>
              {stepErrorCount > 0 && (
                <Chip size="small" color="error" label={`${stepErrorCount} step error(s)`} />
              )}
              <Button endIcon={<ArrowForwardRoundedIcon />} onClick={next} disabled={activeStep === STEPS.length - 1}>
                Next
              </Button>
            </Stack>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
};

export const createEmptyLeg = () => createDefaultLeg(1);
