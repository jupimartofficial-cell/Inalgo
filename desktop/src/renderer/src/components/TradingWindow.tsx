import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Slider,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import AutoGraphRoundedIcon from '@mui/icons-material/AutoGraphRounded';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import CandlestickChartRoundedIcon from '@mui/icons-material/CandlestickChartRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchHistoricalData,
  fetchMigrationJobs,
  fetchMigrationStatus,
  fetchTradingPreferences,
  saveTradingPreferences,
  type Candle,
  type MigrationStatus,
  type TradingPreferencesPayload,
} from '../api/admin';
import { ProChartCanvas } from './ProChartCanvas';

import {
  MAX_CHARTS,
  MAX_CHART_FETCH_SIZE,
  MAX_TABS,
  MIN_CHARTS,
  CUSTOM_INSTRUMENT,
  buildPreferencesPayload,
  createDefaultTab,
  createDefaultChart,
  formatTimeframeLabel,
  hydratePreferencesState,
  mergeInstrumentOptions,
  mergeTimeframeOptions,
  normalizeUnit,
  type ChartLayout,
  type InstrumentOption,
  type TimeframeOption,
  type TradingChartConfig,
  type TradingTabConfig,
  type TradingWindowProps,
} from './TradingWindowShared';

export const TradingWindow = ({
  token,
  tenantId,
  username,
  baseInstruments,
  baseTimeframes,
  onNotify,
}: TradingWindowProps) => {
  const [instrumentOptions, setInstrumentOptions] = useState<InstrumentOption[]>(baseInstruments);
  const [timeframeOptions, setTimeframeOptions] = useState<TimeframeOption[]>(baseTimeframes);
  const [tabs, setTabs] = useState<TradingTabConfig[]>(() => [createDefaultTab(1, baseInstruments, baseTimeframes)]);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [discoveringUniverse, setDiscoveringUniverse] = useState(false);
  const [preferencesLoading, setPreferencesLoading] = useState(false);
  const [preferencesSaving, setPreferencesSaving] = useState(false);

  const [chartDataById, setChartDataById] = useState<Record<string, Candle[]>>({});
  const [chartLoadingById, setChartLoadingById] = useState<Record<string, boolean>>({});
  const [chartErrorById, setChartErrorById] = useState<Record<string, string>>({});
  const chartRequestSeqRef = useRef<Record<string, number>>({});
  const preferencesLoadedRef = useRef(false);
  const lastSavedFingerprintRef = useRef('');

  const activeTab = tabs[activeTabIndex] ?? tabs[0];
  const knownInstrumentKeys = useMemo(() => new Set(instrumentOptions.map((option) => option.key)), [instrumentOptions]);

  const chartSignature = useMemo(
    () =>
      activeTab?.charts
        .map((chart) => `${chart.id}|${chart.instrumentKey}|${chart.timeframeUnit}|${chart.timeframeInterval}|${chart.lookbackDays}`)
        .join('||') ?? '',
    [activeTab],
  );
  const preferencesFingerprint = useMemo(
    () => JSON.stringify(buildPreferencesPayload(tabs, activeTabIndex)),
    [tabs, activeTabIndex],
  );

  useEffect(() => {
    // Keep the desk usable even while the saved universe is still being discovered from backend data.
    setTabs((current) => (current.length === 0 ? [createDefaultTab(1, instrumentOptions, timeframeOptions)] : current));
  }, [instrumentOptions, timeframeOptions]);

  useEffect(() => {
    if (activeTabIndex <= tabs.length - 1) return;
    setActiveTabIndex(Math.max(0, tabs.length - 1));
  }, [activeTabIndex, tabs.length]);

  useEffect(() => {
    const loadPreferences = async () => {
      if (!username.trim()) return;
      setPreferencesLoading(true);
      try {
        const response = await fetchTradingPreferences(tenantId, token, username.trim());
        if (response.preferences?.tabs?.length) {
          const loaded = hydratePreferencesState(response.preferences);
          if (loaded.tabs.length > 0) {
            setTabs(loaded.tabs);
            setActiveTabIndex(loaded.activeTabIndex);
            lastSavedFingerprintRef.current = JSON.stringify(
              buildPreferencesPayload(loaded.tabs, loaded.activeTabIndex),
            );

            const discoveredInstruments = loaded.tabs.flatMap((tab) =>
              tab.charts.map((chart) => ({
                key: chart.instrumentKey,
                label: chart.instrumentKey.split('|').at(-1) ?? chart.instrumentKey,
                exchange: chart.instrumentKey.split('|')[0],
              })),
            );
            const discoveredTimeframes = loaded.tabs.flatMap((tab) =>
              tab.charts.map((chart) => ({
                unit: chart.timeframeUnit,
                interval: chart.timeframeInterval,
                label: `${chart.timeframeInterval} ${chart.timeframeUnit}`,
              })),
            );
            setInstrumentOptions((current) => mergeInstrumentOptions(current, discoveredInstruments));
            setTimeframeOptions((current) => mergeTimeframeOptions(current, discoveredTimeframes));
          }
        }
      } catch (error) {
        onNotify({ msg: `Unable to load trading preferences: ${(error as Error).message}`, severity: 'error' });
      } finally {
        preferencesLoadedRef.current = true;
        setPreferencesLoading(false);
      }
    };

    void loadPreferences();
  }, [onNotify, tenantId, token, username]);

  const updateSelectedTab = useCallback((updater: (tab: TradingTabConfig) => TradingTabConfig) => {
    setTabs((current) =>
      current.map((tab, idx) => {
        if (idx !== activeTabIndex) return tab;
        return updater(tab);
      }),
    );
  }, [activeTabIndex]);

  const updateChartConfig = useCallback((chartId: string, patch: Partial<TradingChartConfig>) => {
    updateSelectedTab((tab) => ({
      ...tab,
      charts: tab.charts.map((chart) => (chart.id === chartId ? { ...chart, ...patch } : chart)),
    }));
  }, [updateSelectedTab]);

  const saveLayoutPreferences = useCallback(async (notifyOnSuccess: boolean) => {
    if (!preferencesLoadedRef.current) return;
    if (!username.trim()) return;
    const payload = buildPreferencesPayload(tabs, activeTabIndex);
    const fingerprint = JSON.stringify(payload);
    if (!notifyOnSuccess && fingerprint === lastSavedFingerprintRef.current) {
      return;
    }

    setPreferencesSaving(true);
    try {
      const response = await saveTradingPreferences(tenantId, token, {
        username: username.trim(),
        preferences: payload,
      });
      if (response.preferences) {
        lastSavedFingerprintRef.current = JSON.stringify(response.preferences);
      } else {
        lastSavedFingerprintRef.current = fingerprint;
      }
      if (notifyOnSuccess) {
        onNotify({ msg: 'Trading layout saved', severity: 'success' });
      }
    } catch (error) {
      onNotify({ msg: `Unable to save trading preferences: ${(error as Error).message}`, severity: 'error' });
    } finally {
      setPreferencesSaving(false);
    }
  }, [activeTabIndex, onNotify, tabs, tenantId, token, username]);

  useEffect(() => {
    if (!preferencesLoadedRef.current) return;
    // Debounce autosave so chart edits and tab changes collapse into one persistence call.
    const timer = setTimeout(() => {
      void saveLayoutPreferences(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, [preferencesFingerprint, saveLayoutPreferences]);

  const loadChartSeries = useCallback(async (chart: TradingChartConfig) => {
    const requestSeq = (chartRequestSeqRef.current[chart.id] ?? 0) + 1;
    chartRequestSeqRef.current[chart.id] = requestSeq;
    const normalizedInstrument = chart.instrumentKey.trim();
    const normalizedUnit = normalizeUnit(chart.timeframeUnit);
    if (!normalizedInstrument) {
      setChartErrorById((current) => ({ ...current, [chart.id]: 'Instrument key is required' }));
      return;
    }
    if (!normalizedUnit || chart.timeframeInterval < 1 || chart.timeframeInterval > 1440) {
      setChartErrorById((current) => ({ ...current, [chart.id]: 'Timeframe must be between 1 and 1440' }));
      return;
    }

    setChartLoadingById((current) => ({ ...current, [chart.id]: true }));
    setChartErrorById((current) => ({ ...current, [chart.id]: '' }));
    setChartDataById((current) => ({ ...current, [chart.id]: [] }));

    try {
      // Prefer the explicit lookback window first, then fall back to the latest stored candles for sparse streams.
      const toDate = new Date();
      const fromDate = new Date(toDate);
      fromDate.setDate(toDate.getDate() - chart.lookbackDays);
      const fetchLatest = async (withLookbackRange: boolean) =>
        fetchHistoricalData(tenantId, token, {
          instrumentKey: normalizedInstrument,
          timeframeUnit: normalizedUnit,
          timeframeInterval: chart.timeframeInterval,
          from: withLookbackRange ? fromDate.toISOString() : undefined,
          to: withLookbackRange ? toDate.toISOString() : undefined,
          sortBy: 'candleTs',
          sortDirection: 'desc',
          page: 0,
          size: MAX_CHART_FETCH_SIZE,
        });

      const primary = await fetchLatest(true);
      const fallback = primary.content.length === 0 ? await fetchLatest(false) : primary;
      if (chartRequestSeqRef.current[chart.id] !== requestSeq) {
        return;
      }
      const normalizedCandles = [...fallback.content].sort(
        (a, b) => new Date(a.candleTs).getTime() - new Date(b.candleTs).getTime(),
      ).filter((candle) => (
        Number.isFinite(new Date(candle.candleTs).getTime())
        && Number.isFinite(Number(candle.openPrice))
        && Number.isFinite(Number(candle.highPrice))
        && Number.isFinite(Number(candle.lowPrice))
        && Number.isFinite(Number(candle.closePrice))
      ));

      setChartDataById((current) => ({ ...current, [chart.id]: normalizedCandles }));
      if (normalizedCandles.length === 0) {
        setChartErrorById((current) => ({
          ...current,
          [chart.id]: 'No candles found for this instrument/timeframe',
        }));
      }
    } catch (error) {
      if (chartRequestSeqRef.current[chart.id] !== requestSeq) {
        return;
      }
      const message = (error as Error).message || 'Unable to load chart';
      setChartDataById((current) => ({ ...current, [chart.id]: [] }));
      setChartErrorById((current) => ({ ...current, [chart.id]: message }));
    } finally {
      if (chartRequestSeqRef.current[chart.id] === requestSeq) {
        setChartLoadingById((current) => ({ ...current, [chart.id]: false }));
      }
    }
  }, [tenantId, token]);

  useEffect(() => {
    if (!activeTab) return;
    const timer = setTimeout(() => {
      activeTab.charts.forEach((chart) => {
        void loadChartSeries(chart);
      });
    }, 280);
    return () => clearTimeout(timer);
  }, [activeTab, chartSignature, loadChartSeries, refreshTick]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => setRefreshTick((current) => current + 1), 45000);
    return () => clearInterval(timer);
  }, [autoRefresh]);

  useEffect(() => {
    const discoverUniverse = async () => {
      setDiscoveringUniverse(true);
      try {
        const [statusResult, jobsResult, dataResult] = await Promise.allSettled([
          fetchMigrationStatus(tenantId, token),
          fetchMigrationJobs(tenantId, token),
          fetchHistoricalData(tenantId, token, {
            page: 0,
            size: 500,
            sortBy: 'candleTs',
            sortDirection: 'desc',
          }),
        ]);

        const statusRows: MigrationStatus[] = statusResult.status === 'fulfilled' ? statusResult.value : [];
        const jobs = jobsResult.status === 'fulfilled' ? jobsResult.value : [];
        const candles: Candle[] = dataResult.status === 'fulfilled' ? dataResult.value.content : [];

        const discoveredInstruments: InstrumentOption[] = [
          ...statusRows.map((row) => ({
            key: row.instrumentKey,
            label: row.instrumentKey.split('|').at(-1) ?? row.instrumentKey,
            exchange: row.instrumentKey.split('|')[0],
          })),
          ...jobs.map((job) => ({
            key: job.instrumentKey,
            label: job.instrumentKey.split('|').at(-1) ?? job.instrumentKey,
            exchange: job.instrumentKey.split('|')[0],
          })),
          ...candles.map((candle) => ({
            key: candle.instrumentKey,
            label: candle.instrumentKey.split('|').at(-1) ?? candle.instrumentKey,
            exchange: candle.instrumentKey.split('|')[0],
          })),
        ];
        const discoveredTimeframes: TimeframeOption[] = [
          ...statusRows.map((row) => ({
            unit: row.timeframeUnit,
            interval: row.timeframeInterval,
            label: `${row.timeframeInterval} ${row.timeframeUnit}`,
          })),
          ...jobs.map((job) => ({
            unit: job.timeframeUnit,
            interval: job.timeframeInterval,
            label: `${job.timeframeInterval} ${job.timeframeUnit}`,
          })),
          ...candles.map((candle) => ({
            unit: candle.timeframeUnit,
            interval: candle.timeframeInterval,
            label: `${candle.timeframeInterval} ${candle.timeframeUnit}`,
          })),
        ];

        setInstrumentOptions((current) => mergeInstrumentOptions(current, baseInstruments, discoveredInstruments));
        setTimeframeOptions((current) => mergeTimeframeOptions(current, baseTimeframes, discoveredTimeframes));
      } finally {
        setDiscoveringUniverse(false);
      }
    };

    void discoverUniverse();
  }, [baseInstruments, baseTimeframes, tenantId, token]);

  const addTab = () => {
    if (tabs.length >= MAX_TABS) {
      onNotify({ msg: `Maximum ${MAX_TABS} tabs allowed`, severity: 'error' });
      return;
    }
    setTabs((current) => [...current, createDefaultTab(current.length + 1, instrumentOptions, timeframeOptions)]);
    setActiveTabIndex(tabs.length);
  };

  const deleteActiveTab = () => {
    if (tabs.length <= 1) {
      onNotify({ msg: 'At least one trading tab is required', severity: 'error' });
      return;
    }
    setTabs((current) => current.filter((_, index) => index !== activeTabIndex));
    setActiveTabIndex((current) => Math.max(0, current - 1));
  };

  const addChart = () => {
    if (!activeTab) return;
    if (activeTab.charts.length >= MAX_CHARTS) {
      onNotify({ msg: `You can add up to ${MAX_CHARTS} charts in one tab`, severity: 'error' });
      return;
    }
    const timeframe = timeframeOptions[(activeTab.charts.length + 1) % timeframeOptions.length] ?? timeframeOptions[0];
    const instrument = instrumentOptions[(activeTab.charts.length + 1) % instrumentOptions.length] ?? instrumentOptions[0];
    const nextChart = createDefaultChart(
      instrument?.key ?? 'NSE_INDEX|Nifty 50',
      timeframe?.unit ?? 'minutes',
      timeframe?.interval ?? 1,
      'split',
    );
    updateSelectedTab((tab) => ({
      ...tab,
      charts: [...tab.charts, nextChart],
    }));
  };

  const removeChart = (chartId: string) => {
    if (!activeTab) return;
    if (activeTab.charts.length <= MIN_CHARTS) {
      onNotify({ msg: `At least ${MIN_CHARTS} charts are required per tab`, severity: 'error' });
      return;
    }
    updateSelectedTab((tab) => ({
      ...tab,
      charts: tab.charts.filter((chart) => chart.id !== chartId),
    }));
    setChartDataById((current) => {
      const clone = { ...current };
      delete clone[chartId];
      return clone;
    });
    setChartLoadingById((current) => {
      const clone = { ...current };
      delete clone[chartId];
      return clone;
    });
    setChartErrorById((current) => {
      const clone = { ...current };
      delete clone[chartId];
      return clone;
    });
    delete chartRequestSeqRef.current[chartId];
  };

  const resolveLayoutWidth = (layout: ChartLayout) => {
    if (layout === 'full') return '100%';
    if (layout === 'wide') return 'calc(66.66% - 12px)';
    return 'calc(50% - 12px)';
  };

  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" alignItems={{ lg: 'center' }} spacing={1.5}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Trading window</Typography>
          <Typography variant="body2" color="text.secondary">
            Multi-chart execution desk with shared instrument/timeframe controls
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
          <Button
            data-testid="trading-window-refresh"
            size="small"
            variant="outlined"
            startIcon={<RefreshRoundedIcon />}
            onClick={() => setRefreshTick((current) => current + 1)}
          >
            Refresh Charts
          </Button>
          <Button
            data-testid="trading-window-autorefresh"
            size="small"
            variant={autoRefresh ? 'contained' : 'outlined'}
            color={autoRefresh ? 'info' : 'inherit'}
            startIcon={<AutorenewRoundedIcon sx={{ animation: autoRefresh ? 'spin 2s linear infinite' : 'none', '@keyframes spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } } }} />}
            onClick={() => setAutoRefresh((current) => !current)}
          >
            Auto 45s
          </Button>
          <Button
            data-testid="trading-window-save-layout"
            size="small"
            variant="outlined"
            startIcon={preferencesSaving ? <CircularProgress size={14} /> : <SaveRoundedIcon />}
            onClick={() => { void saveLayoutPreferences(true); }}
            disabled={preferencesSaving || preferencesLoading}
          >
            Save Layout
          </Button>
          <Button
            data-testid="trading-window-add-tab"
            size="small"
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={addTab}
            disabled={tabs.length >= MAX_TABS}
            sx={{ background: 'linear-gradient(135deg, #1a3a6b 0%, #2d5499 100%)' }}
          >
            Add Tab
          </Button>
        </Stack>
      </Stack>

      <Card>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ lg: 'center' }}>
            <Tabs
              data-testid="trading-window-tabs"
              value={activeTabIndex}
              onChange={(_, value) => setActiveTabIndex(value)}
              variant="scrollable"
              allowScrollButtonsMobile
              sx={{ minHeight: 42 }}
            >
              {tabs.map((tab) => (
                <Tab
                  key={tab.id}
                  label={
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <span>{tab.name}</span>
                      <Chip label={tab.charts.length} size="small" color="primary" variant="outlined" />
                    </Stack>
                  }
                />
              ))}
            </Tabs>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" gap={1}>
              <TextField
                data-testid="trading-window-tab-name"
                size="small"
                label="Tab Name"
                value={activeTab?.name ?? ''}
                onChange={(event) => {
                  const nextName = event.target.value.slice(0, 20);
                  updateSelectedTab((tab) => ({ ...tab, name: nextName || tab.name }));
                }}
                sx={{ minWidth: 180 }}
              />
              <Tooltip title={tabs.length <= 1 ? 'At least one tab is required' : 'Delete current tab'}>
                <span>
                  <Button
                    data-testid="trading-window-delete-tab"
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={<DeleteOutlineRoundedIcon />}
                    onClick={deleteActiveTab}
                    disabled={tabs.length <= 1}
                  >
                    Delete Tab
                  </Button>
                </span>
              </Tooltip>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Paper sx={{ p: 1.5, border: '1px solid', borderColor: 'divider' }}>
        <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" alignItems={{ lg: 'center' }} spacing={1}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" gap={1}>
            <Chip icon={<CandlestickChartRoundedIcon />} label={`${activeTab?.charts.length ?? 0} charts`} color="primary" variant="outlined" />
            <Chip icon={<AutoGraphRoundedIcon />} label={`Tab ${activeTabIndex + 1} / ${MAX_TABS}`} variant="outlined" />
            <Chip icon={<InsightsRoundedIcon />} label={`${instrumentOptions.length} instruments · ${timeframeOptions.length} timeframes`} variant="outlined" />
            {discoveringUniverse && (
              <Chip label="Discovering universe..." color="info" size="small" />
            )}
            {preferencesLoading && (
              <Chip label="Loading preferences..." color="info" size="small" />
            )}
            {preferencesSaving && (
              <Chip label="Saving..." color="success" size="small" />
            )}
          </Stack>
          <Button
            data-testid="trading-window-add-chart"
            size="small"
            variant="contained"
            startIcon={<AddRoundedIcon />}
            disabled={(activeTab?.charts.length ?? 0) >= MAX_CHARTS}
            onClick={addChart}
          >
            Add Chart
          </Button>
        </Stack>
      </Paper>

      {activeTab ? (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'stretch' }}>
          {activeTab.charts.map((chart, chartIndex) => (
            <Card
              key={chart.id}
              data-testid={`trading-window-chart-${chart.id}`}
              sx={{
                width: { xs: '100%', lg: resolveLayoutWidth(chart.layout) },
                resize: 'both',
                overflow: 'auto',
                minWidth: { xs: '100%', lg: 360 },
                maxWidth: '100%',
              }}
            >
              <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Stack spacing={1.25}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" spacing={0.8} alignItems="center">
                      <Typography variant="subtitle2" color="text.secondary">
                        Chart {chartIndex + 1}
                      </Typography>
                      <Chip
                        size="small"
                        color="info"
                        label={formatTimeframeLabel(chart.timeframeUnit, chart.timeframeInterval, timeframeOptions)}
                      />
                    </Stack>
                    <Stack direction="row" spacing={0.5}>
                      <IconButton
                        size="small"
                        onClick={() => { void loadChartSeries(chart); }}
                      >
                        <RefreshRoundedIcon fontSize="small" />
                      </IconButton>
                      <Tooltip title={activeTab.charts.length <= MIN_CHARTS ? `Minimum ${MIN_CHARTS} charts required` : 'Delete chart'}>
                        <span>
                          <IconButton
                            data-testid={`trading-window-delete-chart-${chart.id}`}
                            size="small"
                            color="error"
                            onClick={() => removeChart(chart.id)}
                            disabled={activeTab.charts.length <= MIN_CHARTS}
                          >
                            <DeleteOutlineRoundedIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Stack>
                  </Stack>

                  <Grid container spacing={1}>
                    <Grid item xs={12} lg={4}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Quick Pick</InputLabel>
                        <Select
                          value={knownInstrumentKeys.has(chart.instrumentKey) ? chart.instrumentKey : CUSTOM_INSTRUMENT}
                          label="Quick Pick"
                          onChange={(event) => {
                            if (event.target.value === CUSTOM_INSTRUMENT) return;
                            updateChartConfig(chart.id, { instrumentKey: event.target.value });
                          }}
                        >
                          <MenuItem value={CUSTOM_INSTRUMENT}>Custom Instrument</MenuItem>
                          {instrumentOptions.map((instrument) => (
                            <MenuItem key={instrument.key} value={instrument.key}>
                              {instrument.label} ({instrument.key})
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} lg={8}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Instrument Key"
                        value={chart.instrumentKey}
                        onChange={(event) => updateChartConfig(chart.id, { instrumentKey: event.target.value })}
                        placeholder="NSE_INDEX|Nifty 50"
                      />
                    </Grid>
                    <Grid item xs={12} sm={4} lg={3}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Unit</InputLabel>
                        <Select
                          value={chart.timeframeUnit}
                          label="Unit"
                          onChange={(event) => updateChartConfig(chart.id, { timeframeUnit: event.target.value })}
                        >
                          {[...new Set(timeframeOptions.map((option) => option.unit))].map((unit) => (
                            <MenuItem key={unit} value={unit}>{unit}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={6} sm={2} lg={2}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Interval"
                        type="number"
                        value={chart.timeframeInterval}
                        inputProps={{ min: 1, max: 1440 }}
                        onChange={(event) => updateChartConfig(chart.id, { timeframeInterval: Number(event.target.value) || 1 })}
                      />
                    </Grid>
                    <Grid item xs={6} sm={3} lg={2}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Lookback</InputLabel>
                        <Select
                          value={chart.lookbackDays}
                          label="Lookback"
                          onChange={(event) => updateChartConfig(chart.id, { lookbackDays: Number(event.target.value) })}
                        >
                          <MenuItem value={7}>7D</MenuItem>
                          <MenuItem value={14}>14D</MenuItem>
                          <MenuItem value={30}>30D</MenuItem>
                          <MenuItem value={60}>60D</MenuItem>
                          <MenuItem value={90}>90D</MenuItem>
                          <MenuItem value={180}>180D</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={6} sm={3} lg={2}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Tile</InputLabel>
                        <Select
                          value={chart.layout}
                          label="Tile"
                          onChange={(event) => updateChartConfig(chart.id, { layout: event.target.value as ChartLayout })}
                        >
                          <MenuItem value="split">Split</MenuItem>
                          <MenuItem value="wide">Wide</MenuItem>
                          <MenuItem value="full">Full</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} lg={3}>
                      <Stack spacing={0.3}>
                        <Typography variant="caption" color="text.secondary">
                          Height: {chart.height}px
                        </Typography>
                        <Slider
                          size="small"
                          min={260}
                          max={640}
                          step={10}
                          value={chart.height}
                          onChange={(_, nextValue) => updateChartConfig(chart.id, { height: Array.isArray(nextValue) ? nextValue[0] : nextValue })}
                        />
                      </Stack>
                    </Grid>
                  </Grid>

                  {chartErrorById[chart.id] && (
                    <Alert severity="warning" sx={{ py: 0, '& .MuiAlert-message': { fontSize: '0.75rem' } }}>
                      {chartErrorById[chart.id]}
                    </Alert>
                  )}

                  <ProChartCanvas
                    chartId={chart.id}
                    candles={chartDataById[chart.id] ?? []}
                    height={chart.height}
                    loading={Boolean(chartLoadingById[chart.id])}
                    error={chartErrorById[chart.id]}
                    instrumentKey={chart.instrumentKey}
                    timeframeUnit={chart.timeframeUnit}
                    timeframeInterval={chart.timeframeInterval}
                    timeframeOptions={timeframeOptions}
                    onTimeframeChange={(unit, interval) => updateChartConfig(chart.id, { timeframeUnit: unit, timeframeInterval: interval })}
                  />
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Box>
      ) : (
        <Paper sx={{ p: 5, textAlign: 'center', border: '1px dashed', borderColor: 'divider' }}>
          <Typography variant="h6" color="text.secondary">No active trading tab</Typography>
        </Paper>
      )}
    </Stack>
  );
};
