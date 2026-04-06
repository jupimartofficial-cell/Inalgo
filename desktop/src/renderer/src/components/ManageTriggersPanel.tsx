import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createTrigger,
  deleteTrigger,
  fetchTriggerBrowser,
  pauseTrigger,
  resumeTrigger,
  startTrigger,
  stopTrigger,
  updateTrigger,
  type AdminTrigger,
  type TriggerBrowserResponse,
} from '../api/admin';

import {
  ALL_FILTER_VALUE,
  EMPTY_TRIGGER_BROWSER,
  INTERVAL_OPTIONS,
  GLOBAL_INDEX_INSTRUMENT,
  GLOBAL_INDEX_INSTRUMENT_KEY,
  MARKET_SENTIMENT_INSTRUMENT,
  MARKET_SENTIMENT_INSTRUMENT_KEY,
  createDefaultDateTimeInput,
  formatTriggerDateTime,
  getDefaultFilterState,
  getInstrumentLabel,
  getJobOption,
  isSessionExpiredError,
  toDateTimeInputValue,
  type InstrumentOption,
  type NotifyPayload,
  type TimeframeOption,
  type TriggerAction,
  type TriggerJob,
  type TriggerTab,
  type TriggerType,
} from './ManageTriggersShared';
import { TriggerBrowserCard } from './TriggerBrowserCard';
import { TriggerForm } from './TriggerForm';

export function ManageTriggersPanel({
  token,
  tenantId,
  baseInstruments,
  baseTimeframes,
  onNotify,
}: {
  token: string;
  tenantId: string;
  baseInstruments: InstrumentOption[];
  baseTimeframes: TimeframeOption[];
  onNotify: (payload: NotifyPayload) => void;
}) {
  const [browserData, setBrowserData] = useState<TriggerBrowserResponse>(EMPTY_TRIGGER_BROWSER);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [editingTriggerId, setEditingTriggerId] = useState<number | null>(null);
  const [createTriggerExpanded, setCreateTriggerExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<TriggerTab>('CANDLE_SYNC');
  const [browserDataTab, setBrowserDataTab] = useState<TriggerTab | null>(null);
  const [filterInstrumentKey, setFilterInstrumentKey] = useState(getDefaultFilterState('CANDLE_SYNC').instrumentKey);
  const [filterTimeframeKey, setFilterTimeframeKey] = useState(getDefaultFilterState('CANDLE_SYNC').timeframeKey);
  const [filterJobNatureKey, setFilterJobNatureKey] = useState(getDefaultFilterState('CANDLE_SYNC').jobNatureKey);
  const [filtersExpanded, setFiltersExpanded] = useState(true);
  const [triggersPage, setTriggersPage] = useState(0);
  const [triggersRowsPerPage, setTriggersRowsPerPage] = useState(25);

  const [jobKey, setJobKey] = useState<TriggerJob>('CANDLE_SYNC');
  const [instrumentKey, setInstrumentKey] = useState(baseInstruments[0]?.key ?? '');
  const [timeframeKey, setTimeframeKey] = useState(
    baseTimeframes[0] ? `${baseTimeframes[0].unit}|${baseTimeframes[0].interval}` : ''
  );
  const [triggerType, setTriggerType] = useState<TriggerType>('HOUR_TIMER');
  const [intervalValue, setIntervalValue] = useState('1');
  const [scheduledAt, setScheduledAt] = useState(createDefaultDateTimeInput());
  const triggerInstruments = useMemo(() => {
    let instruments = baseInstruments;
    if (!instruments.some((instrument) => instrument.key === MARKET_SENTIMENT_INSTRUMENT_KEY)) {
      instruments = [...instruments, MARKET_SENTIMENT_INSTRUMENT];
    }
    if (!instruments.some((instrument) => instrument.key === GLOBAL_INDEX_INSTRUMENT_KEY)) {
      instruments = [...instruments, GLOBAL_INDEX_INSTRUMENT];
    }
    return instruments;
  }, [baseInstruments]);

  const selectedJob = useMemo(() => getJobOption(jobKey), [jobKey]);
  const isEditing = editingTriggerId != null;

  const activeIntervalOptions = useMemo(
    () => triggerType === 'SPECIFIC_DATE_TIME' ? [] : INTERVAL_OPTIONS[triggerType],
    [triggerType]
  );

  const reloadTriggerBrowser = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetchTriggerBrowser(tenantId, token, {
        tabGroup: activeTab,
        instrumentKey: filterInstrumentKey !== ALL_FILTER_VALUE ? filterInstrumentKey : undefined,
        timeframeKey: filterTimeframeKey !== ALL_FILTER_VALUE ? filterTimeframeKey : undefined,
        jobNatureKey: filterJobNatureKey !== ALL_FILTER_VALUE ? filterJobNatureKey : undefined,
        page: triggersPage,
        size: triggersRowsPerPage,
      });
      setBrowserData(response);
      setBrowserDataTab(activeTab);
      setError('');
    } catch (requestError) {
      const message = (requestError as Error).message || 'Unable to load configured triggers';
      setError(message);
      if (isSessionExpiredError(message)) {
        onNotify({ msg: 'Admin session expired. Please sign in again.', severity: 'error' });
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [
    activeTab,
    filterInstrumentKey,
    filterJobNatureKey,
    filterTimeframeKey,
    onNotify,
    tenantId,
    token,
    triggersPage,
    triggersRowsPerPage,
  ]);

  useEffect(() => {
    void reloadTriggerBrowser();
  }, [reloadTriggerBrowser]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = window.setInterval(() => {
      void reloadTriggerBrowser(true);
    }, 10000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, reloadTriggerBrowser]);

  useEffect(() => {
    if (triggerType === 'SPECIFIC_DATE_TIME') return;
    const nextDefault = activeIntervalOptions[0]?.value;
    if (nextDefault != null && !activeIntervalOptions.some((option) => String(option.value) === intervalValue)) {
      setIntervalValue(String(nextDefault));
    }
  }, [activeIntervalOptions, intervalValue, triggerType]);

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(browserData.totalElements / triggersRowsPerPage) - 1);
    if (triggersPage > maxPage) {
      setTriggersPage(maxPage);
    }
  }, [browserData.totalElements, triggersPage, triggersRowsPerPage]);

  useEffect(() => {
    if (browserDataTab !== activeTab) return;
    if (filterInstrumentKey !== ALL_FILTER_VALUE && !browserData.instruments.some((option) => option.value === filterInstrumentKey)) {
      setFilterInstrumentKey(ALL_FILTER_VALUE);
    }
    if (filterTimeframeKey !== ALL_FILTER_VALUE && !browserData.timeframes.some((option) => option.value === filterTimeframeKey)) {
      setFilterTimeframeKey(ALL_FILTER_VALUE);
    }
    if (filterJobNatureKey !== ALL_FILTER_VALUE && !browserData.jobNatures.some((option) => option.value === filterJobNatureKey)) {
      setFilterJobNatureKey(ALL_FILTER_VALUE);
    }
  }, [activeTab, browserData.instruments, browserData.jobNatures, browserData.timeframes, browserDataTab, filterInstrumentKey, filterJobNatureKey, filterTimeframeKey]);

  const resetForm = () => {
    setEditingTriggerId(null);
    setCreateTriggerExpanded(false);
    setJobKey('CANDLE_SYNC');
    setInstrumentKey(baseInstruments[0]?.key ?? '');
    setTimeframeKey(baseTimeframes[0] ? `${baseTimeframes[0].unit}|${baseTimeframes[0].interval}` : '');
    setTriggerType('HOUR_TIMER');
    setIntervalValue('1');
    setScheduledAt(createDefaultDateTimeInput());
  };

  const handleJobKeyChange = (value: TriggerJob) => {
    setJobKey(value);
    if (value === 'MARKET_SENTIMENT_REFRESH') {
      setInstrumentKey(MARKET_SENTIMENT_INSTRUMENT_KEY);
      return;
    }
    if (value === 'GLOBAL_INDEX_REFRESH') {
      setInstrumentKey(GLOBAL_INDEX_INSTRUMENT_KEY);
      return;
    }
    if (instrumentKey === MARKET_SENTIMENT_INSTRUMENT_KEY || instrumentKey === GLOBAL_INDEX_INSTRUMENT_KEY) {
      setInstrumentKey(baseInstruments[0]?.key ?? '');
    }
  };

  const handleClearBrowserFilters = () => {
    const defaults = getDefaultFilterState(activeTab);
    setFilterInstrumentKey(defaults.instrumentKey);
    setFilterTimeframeKey(defaults.timeframeKey);
    setFilterJobNatureKey(defaults.jobNatureKey);
    setTriggersPage(0);
  };

  const handleEditTrigger = (trigger: AdminTrigger) => {
    setEditingTriggerId(trigger.id);
    setCreateTriggerExpanded(true);
    setJobKey((trigger.jobKey as TriggerJob | undefined) ?? 'CANDLE_SYNC');
    setInstrumentKey(trigger.instrumentKey);
    setTimeframeKey(
      trigger.timeframeUnit && trigger.timeframeInterval
        ? `${trigger.timeframeUnit}|${trigger.timeframeInterval}`
        : (baseTimeframes[0] ? `${baseTimeframes[0].unit}|${baseTimeframes[0].interval}` : '')
    );
    setTriggerType(trigger.triggerType as TriggerType);
    setIntervalValue(String(trigger.intervalValue ?? '1'));
    setScheduledAt(toDateTimeInputValue(trigger.scheduledAt));
  };

  const handleSaveTrigger = async () => {
    if (!instrumentKey) {
      onNotify({ msg: 'Instrument is required', severity: 'error' });
      return;
    }
    if (selectedJob.requiresTimeframe && !timeframeKey) {
      onNotify({ msg: 'Timeframe is required for this job', severity: 'error' });
      return;
    }

    const [timeframeUnit, timeframeIntervalRaw] = timeframeKey.split('|');
    const effectiveInstrumentKey = jobKey === 'MARKET_SENTIMENT_REFRESH'
      ? MARKET_SENTIMENT_INSTRUMENT_KEY
      : jobKey === 'GLOBAL_INDEX_REFRESH'
        ? GLOBAL_INDEX_INSTRUMENT_KEY
        : instrumentKey;
    const payload = {
      jobKey,
      instrumentKey: effectiveInstrumentKey,
      timeframeUnit: selectedJob.requiresTimeframe ? timeframeUnit : undefined,
      timeframeInterval: selectedJob.requiresTimeframe ? Number(timeframeIntervalRaw) : undefined,
      eventSource: 'TIME_DRIVEN',
      triggerType,
      intervalValue: triggerType === 'SPECIFIC_DATE_TIME' ? undefined : Number(intervalValue),
      scheduledAt: triggerType === 'SPECIFIC_DATE_TIME' ? new Date(scheduledAt).toISOString() : undefined,
    };

    setSaving(true);
    try {
      if (editingTriggerId != null) {
        await updateTrigger(tenantId, token, editingTriggerId, payload);
        onNotify({ msg: 'Trigger updated', severity: 'success' });
      } else {
        await createTrigger(tenantId, token, payload);
        onNotify({ msg: 'Trigger saved in stopped state', severity: 'success' });
      }
      resetForm();
      await reloadTriggerBrowser();
    } catch (requestError) {
      onNotify({
        msg: (requestError as Error).message || (editingTriggerId != null ? 'Unable to update trigger' : 'Unable to save trigger'),
        severity: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (trigger: AdminTrigger, action: TriggerAction) => {
    setActionLoadingId(trigger.id);
    try {
      let response: { status: string };
      if (action === 'start') response = await startTrigger(tenantId, token, trigger.id);
      else if (action === 'pause') response = await pauseTrigger(tenantId, token, trigger.id);
      else if (action === 'resume') response = await resumeTrigger(tenantId, token, trigger.id);
      else response = await stopTrigger(tenantId, token, trigger.id);

      onNotify({
        msg: `${getInstrumentLabel(triggerInstruments, trigger.instrumentKey)}: ${response.status}`,
        severity: 'info',
      });
      await reloadTriggerBrowser(true);
    } catch (requestError) {
      onNotify({ msg: (requestError as Error).message || 'Unable to update trigger', severity: 'error' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteTrigger = async (trigger: AdminTrigger) => {
    if (!window.confirm(`Delete trigger for ${getInstrumentLabel(triggerInstruments, trigger.instrumentKey)}?`)) {
      return;
    }

    setActionLoadingId(trigger.id);
    try {
      await deleteTrigger(tenantId, token, trigger.id);
      if (editingTriggerId === trigger.id) {
        resetForm();
      }
      onNotify({ msg: 'Trigger deleted', severity: 'success' });
      await reloadTriggerBrowser(true);
    } catch (requestError) {
      onNotify({ msg: (requestError as Error).message || 'Unable to delete trigger', severity: 'error' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const activeTabOption = browserData.tabs.find((tab) => tab.value === activeTab);
  const activeInstrument = browserData.instruments.find((option) => option.value === filterInstrumentKey);
  const activeTimeframe = browserData.timeframes.find((option) => option.value === filterTimeframeKey);
  const activeJobNature = browserData.jobNatures.find((option) => option.value === filterJobNatureKey);
  const selectedTimeframe = selectedJob.requiresTimeframe
    ? baseTimeframes.find((timeframe) => `${timeframe.unit}|${timeframe.interval}` === timeframeKey)
    : undefined;
  const previewSchedule = triggerType === 'SPECIFIC_DATE_TIME'
    ? `Specific date and time · ${formatTriggerDateTime(new Date(scheduledAt).toISOString())}`
    : activeIntervalOptions.find((option) => String(option.value) === intervalValue)?.label ?? 'Select interval';

  const activeFilterChips = [
    activeInstrument ? `Instrument · ${getInstrumentLabel(triggerInstruments, activeInstrument.value)}` : null,
    activeTimeframe ? `Timeframe · ${activeTimeframe.label}` : null,
    activeJobNature ? `Nature · ${activeJobNature.label}` : null,
  ].filter(Boolean) as string[];

  const createTriggerSummaryChips = [
    selectedJob.label,
    triggerInstruments.find((inst) => inst.key === instrumentKey)?.label ?? 'Choose instrument',
    selectedJob.requiresTimeframe ? (selectedTimeframe?.label ?? 'Choose timeframe') : 'No timeframe',
    previewSchedule,
  ];

  const visibleFilterInstrumentKey = filterInstrumentKey === ALL_FILTER_VALUE || browserData.instruments.some((option) => option.value === filterInstrumentKey)
    ? filterInstrumentKey
    : ALL_FILTER_VALUE;
  const visibleFilterTimeframeKey = filterTimeframeKey === ALL_FILTER_VALUE || browserData.timeframes.some((option) => option.value === filterTimeframeKey)
    ? filterTimeframeKey
    : ALL_FILTER_VALUE;
  const visibleFilterJobNatureKey = filterJobNatureKey === ALL_FILTER_VALUE || browserData.jobNatures.some((option) => option.value === filterJobNatureKey)
    ? filterJobNatureKey
    : ALL_FILTER_VALUE;

  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1.5}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Manage Triggers</Typography>
          <Typography variant="body2" color="text.secondary">
            Configure time-driven jobs for candle sync, trading signals, and opening-range analytics
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
          <Button
            variant={autoRefresh ? 'contained' : 'outlined'}
            size="small"
            color="secondary"
            startIcon={<AutorenewRoundedIcon />}
            onClick={() => setAutoRefresh((current) => !current)}
          >
            Auto-Refresh
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={loading ? <CircularProgress size={14} /> : <RefreshRoundedIcon />}
            onClick={() => { void reloadTriggerBrowser(); }}
            disabled={loading}
          >
            Refresh
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ py: 0.5 }}>
          {error}
        </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, minmax(0, 1fr))',
            md: 'repeat(4, minmax(0, 1fr))',
          },
        }}
      >
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Typography variant="overline" color="text.secondary">In active tab</Typography>
            <Typography variant="h4" fontWeight={800}>{browserData.summary.totalInTab}</Typography>
            <Typography variant="body2" color="text.secondary">{activeTabOption?.label ?? (activeTab === 'CANDLE_SYNC' ? 'Candle sync Jobs' : 'Others')}</Typography>
          </CardContent>
        </Card>
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Typography variant="overline" color="text.secondary">Matching</Typography>
            <Typography variant="h4" fontWeight={800}>{browserData.summary.filteredTotal}</Typography>
            <Typography variant="body2" color="text.secondary">Visible to current filters</Typography>
          </CardContent>
        </Card>
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Typography variant="overline" color="text.secondary">Running</Typography>
            <Typography variant="h4" fontWeight={800} color="info.main">{browserData.summary.runningCount}</Typography>
            <Typography variant="body2" color="text.secondary">Live scheduled jobs</Typography>
          </CardContent>
        </Card>
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Typography variant="overline" color="text.secondary">Attention</Typography>
            <Typography variant="h4" fontWeight={800} color={browserData.summary.attentionCount > 0 ? 'error.main' : 'warning.main'}>
              {browserData.summary.attentionCount}
            </Typography>
            <Typography variant="body2" color="text.secondary">Paused or failed in current view</Typography>
          </CardContent>
        </Card>
      </Box>

              <TriggerForm
        expanded={createTriggerExpanded}
        isEditing={isEditing}
        saving={saving}
        jobKey={jobKey}
        instrumentKey={instrumentKey}
        timeframeKey={timeframeKey}
        triggerType={triggerType}
        intervalValue={intervalValue}
        scheduledAt={scheduledAt}
        selectedJob={selectedJob}
        activeIntervalOptions={activeIntervalOptions}
                baseInstruments={triggerInstruments}
                baseTimeframes={baseTimeframes}
        previewSchedule={previewSchedule}
        summaryChips={createTriggerSummaryChips}
        onExpandedChange={setCreateTriggerExpanded}
                onJobKeyChange={handleJobKeyChange}
        onInstrumentKeyChange={setInstrumentKey}
        onTimeframeKeyChange={setTimeframeKey}
        onTriggerTypeChange={setTriggerType}
        onIntervalValueChange={setIntervalValue}
        onScheduledAtChange={setScheduledAt}
        onCancel={resetForm}
        onSave={() => { void handleSaveTrigger(); }}
      />

      <TriggerBrowserCard
        browserData={browserData}
        activeTab={activeTab}
        filtersExpanded={filtersExpanded}
        filterInstrumentKey={filterInstrumentKey}
        filterTimeframeKey={filterTimeframeKey}
        filterJobNatureKey={filterJobNatureKey}
        visibleFilterInstrumentKey={visibleFilterInstrumentKey}
        visibleFilterTimeframeKey={visibleFilterTimeframeKey}
        visibleFilterJobNatureKey={visibleFilterJobNatureKey}
        activeFilterChips={activeFilterChips}
        triggersPage={triggersPage}
        triggersRowsPerPage={triggersRowsPerPage}
        baseInstruments={triggerInstruments}
        baseTimeframes={baseTimeframes}
        tableProps={{
          actionLoadingId,
          onAction: (trigger, action) => { void handleAction(trigger, action); },
          onEdit: handleEditTrigger,
          onDelete: (trigger) => { void handleDeleteTrigger(trigger); },
          onPageChange: setTriggersPage,
          onRowsPerPageChange: (rowsPerPage) => {
            setTriggersRowsPerPage(rowsPerPage);
            setTriggersPage(0);
          },
        }}
        onTabChange={setActiveTab}
        onFiltersExpandedChange={setFiltersExpanded}
        onFilterInstrumentChange={setFilterInstrumentKey}
        onFilterTimeframeChange={setFilterTimeframeKey}
        onFilterJobNatureChange={setFilterJobNatureKey}
        onClearFilters={handleClearBrowserFilters}
        onPageChange={setTriggersPage}
        onRowsPerPageChange={(rowsPerPage) => {
          setTriggersRowsPerPage(rowsPerPage);
          setTriggersPage(0);
        }}
      />
    </Stack>
  );
}
