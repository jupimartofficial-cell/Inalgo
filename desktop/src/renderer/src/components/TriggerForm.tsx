import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import AddCircleRoundedIcon from '@mui/icons-material/AddCircleRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import {
  INTERVAL_OPTIONS,
  JOB_OPTIONS,
  TRIGGER_TYPE_OPTIONS,
  type InstrumentOption,
  type TimeframeOption,
  type TriggerJob,
  type TriggerType,
} from './ManageTriggersShared';

export interface TriggerFormProps {
  expanded: boolean;
  isEditing: boolean;
  saving: boolean;
  jobKey: TriggerJob;
  instrumentKey: string;
  timeframeKey: string;
  triggerType: TriggerType;
  intervalValue: string;
  scheduledAt: string;
  selectedJob: typeof JOB_OPTIONS[0];
  activeIntervalOptions: { value: number; label: string }[];
  baseInstruments: InstrumentOption[];
  baseTimeframes: TimeframeOption[];
  previewSchedule: string;
  summaryChips: string[];
  onExpandedChange: (expanded: boolean) => void;
  onJobKeyChange: (value: TriggerJob) => void;
  onInstrumentKeyChange: (value: string) => void;
  onTimeframeKeyChange: (value: string) => void;
  onTriggerTypeChange: (value: TriggerType) => void;
  onIntervalValueChange: (value: string) => void;
  onScheduledAtChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}

export const TriggerForm = ({
  expanded,
  isEditing,
  saving,
  jobKey,
  instrumentKey,
  timeframeKey,
  triggerType,
  intervalValue,
  scheduledAt,
  selectedJob,
  activeIntervalOptions,
  baseInstruments,
  baseTimeframes,
  previewSchedule,
  summaryChips,
  onExpandedChange,
  onJobKeyChange,
  onInstrumentKeyChange,
  onTimeframeKeyChange,
  onTriggerTypeChange,
  onIntervalValueChange,
  onScheduledAtChange,
  onCancel,
  onSave,
}: TriggerFormProps) => {
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down('md'));

  const selectedInstrument = baseInstruments.find((instrument) => instrument.key === instrumentKey);
  const selectedTimeframe = selectedJob.requiresTimeframe
    ? baseTimeframes.find((timeframe) => `${timeframe.unit}|${timeframe.interval}` === timeframeKey)
    : undefined;

  return (
    <Accordion
      expanded={expanded}
      onChange={(_, next) => onExpandedChange(next)}
      disableGutters
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        overflow: 'hidden',
        '&:before': { display: 'none' },
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreRoundedIcon />}
        data-testid="create-trigger-toggle"
        sx={{ px: { xs: 2, md: 3 }, py: 1, alignItems: 'flex-start' }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ md: 'center' }}
          spacing={1.5}
          sx={{ width: '100%', pr: 1 }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <AddCircleRoundedIcon color="primary" />
            <Box>
              <Typography variant="h6" fontWeight={700}>{isEditing ? 'Edit Trigger' : 'Create Trigger'}</Typography>
              <Typography variant="body2" color="text.secondary">
                {isEditing
                  ? 'Update the job scope or cadence, then save the new configuration'
                  : 'Collapsed by default so the configured-trigger browser stays in view until you need the form'}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {isEditing && <Chip label="Editing" color="secondary" size="small" />}
            {summaryChips.map((label, index) => (
              <Chip key={`${index}-${label}`} label={label} size="small" variant="outlined" />
            ))}
          </Stack>
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ px: { xs: 2, md: 3 }, pb: { xs: 2, md: 3 }, pt: 0 }}>
        <Grid container spacing={3} alignItems="stretch">
          <Grid item xs={12} md={7}>
            <Stack spacing={2.5}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" sx={{ mb: 0.75 }}>Select event source</Typography>
                  <FormControl fullWidth size="small">
                    <InputLabel>Event source</InputLabel>
                    <Select value="TIME_DRIVEN" label="Event source" disabled>
                      <MenuItem value="TIME_DRIVEN">Time-driven</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12}>
                  <Typography variant="subtitle2" sx={{ mb: 0.75 }}>Select job</Typography>
                  <FormControl fullWidth size="small">
                    <InputLabel>Job</InputLabel>
                    <Select
                      value={jobKey}
                      onChange={(event) => onJobKeyChange(event.target.value as TriggerJob)}
                      label="Job"
                    >
                      {JOB_OPTIONS.map((option) => (
                        <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12}>
                  <Typography variant="subtitle2" sx={{ mb: 0.75 }}>Select type of time based trigger</Typography>
                  <FormControl fullWidth size="small">
                    <InputLabel>Trigger type</InputLabel>
                    <Select
                      value={triggerType}
                      onChange={(event) => onTriggerTypeChange(event.target.value as TriggerType)}
                      label="Trigger type"
                    >
                      {TRIGGER_TYPE_OPTIONS.map((option) => (
                        <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                {triggerType === 'SPECIFIC_DATE_TIME' ? (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" sx={{ mb: 0.75 }}>Select date and time</Typography>
                    <TextField
                      fullWidth
                      size="small"
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(event) => onScheduledAtChange(event.target.value)}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                ) : (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
                      Select {triggerType.replace('_TIMER', '').toLowerCase()} interval
                    </Typography>
                    <FormControl fullWidth size="small">
                      <InputLabel>Interval</InputLabel>
                      <Select
                        value={intervalValue}
                        onChange={(event) => onIntervalValueChange(event.target.value)}
                        label="Interval"
                      >
                        {activeIntervalOptions.map((option) => (
                          <MenuItem key={option.value} value={String(option.value)}>{option.label}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                )}

                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" sx={{ mb: 0.75 }}>Instrument</Typography>
                  {jobKey === 'MARKET_SENTIMENT_REFRESH' ? (
                    <Alert severity="info" sx={{ py: 0.5 }}>
                      This job runs against the tenant-level market trend pipeline and uses the system market-trend target automatically.
                    </Alert>
                  ) : (
                    <FormControl fullWidth size="small">
                      <InputLabel>Instrument</InputLabel>
                      <Select
                        value={instrumentKey}
                        onChange={(event) => onInstrumentKeyChange(event.target.value)}
                        label="Instrument"
                      >
                        {baseInstruments.map((instrument) => (
                          <MenuItem key={instrument.key} value={instrument.key}>
                            {instrument.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                </Grid>

                {selectedJob.requiresTimeframe ? (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" sx={{ mb: 0.75 }}>Timeframe</Typography>
                    <FormControl fullWidth size="small">
                      <InputLabel>Timeframe</InputLabel>
                      <Select
                        value={timeframeKey}
                        onChange={(event) => onTimeframeKeyChange(event.target.value)}
                        label="Timeframe"
                      >
                        {baseTimeframes.map((timeframe) => (
                          <MenuItem key={`${timeframe.unit}-${timeframe.interval}`} value={`${timeframe.unit}|${timeframe.interval}`}>
                            {timeframe.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                ) : (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" sx={{ mb: 0.75 }}>Timeframe</Typography>
                    <Alert severity="info" sx={{ py: 0.5 }}>
                      This job uses the 15 Min opening-range candle automatically.
                    </Alert>
                  </Grid>
                )}
              </Grid>

              <Stack direction="row" justifyContent="flex-end" spacing={1}>
                <Button variant="text" color="inherit" onClick={onCancel}>
                  {isEditing ? 'Cancel Edit' : 'Cancel'}
                </Button>
                <Button
                  variant="contained"
                  onClick={onSave}
                  disabled={saving}
                  sx={{ minWidth: 120 }}
                >
                  {saving ? <CircularProgress size={18} color="inherit" /> : (isEditing ? 'Update' : 'Save')}
                </Button>
              </Stack>
            </Stack>
          </Grid>

          <Grid item xs={12} md={5}>
            <Box sx={{ display: 'flex', height: '100%' }}>
              {!isCompact && <Divider orientation="vertical" flexItem sx={{ mr: 3 }} />}
              <Stack spacing={2.5} sx={{ flex: 1, pl: { md: 1 } }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <ScheduleRoundedIcon color="action" />
                  <Typography variant="h6" fontWeight={700}>Configuration Preview</Typography>
                </Stack>

                <Paper variant="outlined" sx={{ p: 2, bgcolor: '#f8fafc', minHeight: 0 }}>
                  <Stack spacing={1.5}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Job</Typography>
                      <Typography variant="body1" fontWeight={700}>{selectedJob.label}</Typography>
                      <Typography variant="body2" color="text.secondary">{selectedJob.description}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Instrument</Typography>
                      <Typography variant="body1" fontWeight={700}>
                        {selectedInstrument?.label ?? 'Select instrument'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Timeframe</Typography>
                      <Typography variant="body1" fontWeight={700}>
                        {selectedTimeframe?.label ?? 'Not required for this job'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Event source</Typography>
                      <Typography variant="body1" fontWeight={700}>Time-driven</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Schedule</Typography>
                      <Typography variant="body1" fontWeight={700}>{previewSchedule}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Activation behavior</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Triggers are saved in stopped state so you can review the job before enabling live updates.
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Job logic</Typography>
                      <Typography variant="body2" color="text.secondary">{selectedJob.preview}</Typography>
                    </Box>
                  </Stack>
                </Paper>

                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Stack spacing={1}>
                    <Typography variant="subtitle2" fontWeight={700}>Operational notes</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Start runs the selected job immediately, then the configured cadence controls subsequent executions.
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Pause preserves configuration without deleting the trigger record.
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Stop disables the schedule until you explicitly start it again.
                    </Typography>
                  </Stack>
                </Paper>
              </Stack>
            </Box>
          </Grid>
        </Grid>
      </AccordionDetails>
    </Accordion>
  );
};
