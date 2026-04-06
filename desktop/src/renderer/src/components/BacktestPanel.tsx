import {
  Button,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import AssessmentRounded from '@mui/icons-material/AssessmentRounded';
import SaveRounded from '@mui/icons-material/SaveRounded';
import PlayArrowRounded from '@mui/icons-material/PlayArrowRounded';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createBacktestStrategy,
  deleteBacktestStrategy,
  fetchBacktestStrategies,
  fetchTradingDayParams,
  fetchTradingSignals,
  runBacktest,
  updateBacktestStrategy,
  type BacktestLegPayload,
  type BacktestResultRow,
  type BacktestRunResponse,
  type BacktestStrategyPayload,
  type BacktestStrategyResponse,
  type TradingDayParamRow,
  type TradingSignalRow,
} from '../api/admin';
import {
  createDefaultDayParamFilters,
  createDefaultLeg,
  createDefaultSignalFilters,
  createDefaultStrategy,
  normalizeStrategyForMvp,
  parseTimeframeKey,
  type BacktestPanelProps,
  type TradingDayParamFilters,
  type TradingSignalFilters,
} from './BacktestPanelShared';
import { BacktestStrategyForm } from './BacktestStrategyForm';
import { BacktestResultsPanel } from './BacktestResultsPanel';
import { BacktestStrategyListView } from './BacktestStrategyListView';
import { BacktestTradingSignalView } from './BacktestTradingSignalView';
import { BacktestTradingParamView } from './BacktestTradingParamView';
import { BacktestMarketTrendView } from './BacktestMarketTrendView';
import { useMarketSentimentView } from './useMarketSentimentView';

export const BacktestPanel = ({
  token,
  tenantId,
  username,
  baseInstruments,
  baseTimeframes,
  activeView,
  onNavigateToPnl,
  onNotify,
}: BacktestPanelProps) => {
  const initialInstrument = baseInstruments[0]?.key ?? 'NSE_INDEX|Nifty 50';

  const [strategyId, setStrategyId] = useState<number | null>(null);
  const [strategy, setStrategy] = useState<BacktestStrategyPayload>(() => createDefaultStrategy(initialInstrument));
  const [strategies, setStrategies] = useState<BacktestStrategyResponse[]>([]);
  const [strategyPage, setStrategyPage] = useState(0);
  const [strategyRowsPerPage, setStrategyRowsPerPage] = useState(10);
  const [strategyTotalElements, setStrategyTotalElements] = useState(0);
  const [results, setResults] = useState<BacktestResultRow[]>([]);
  const [summary, setSummary] = useState<BacktestRunResponse | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  const [tradingSignalRows, setTradingSignalRows] = useState<TradingSignalRow[]>([]);
  const [tradingSignalTotalElements, setTradingSignalTotalElements] = useState(0);
  const [tradingSignalPage, setTradingSignalPage] = useState(0);
  const [tradingSignalRowsPerPage, setTradingSignalRowsPerPage] = useState(25);
  const [tradingSignalLoading, setTradingSignalLoading] = useState(false);
  const [tradingSignalFilterDraft, setTradingSignalFilterDraft] = useState<TradingSignalFilters>(createDefaultSignalFilters);
  const [tradingSignalFilters, setTradingSignalFilters] = useState<TradingSignalFilters>(createDefaultSignalFilters);

  const [tradingDayParamRows, setTradingDayParamRows] = useState<TradingDayParamRow[]>([]);
  const [tradingDayParamTotalElements, setTradingDayParamTotalElements] = useState(0);
  const [tradingDayParamPage, setTradingDayParamPage] = useState(0);
  const [tradingDayParamRowsPerPage, setTradingDayParamRowsPerPage] = useState(25);
  const [tradingDayParamLoading, setTradingDayParamLoading] = useState(false);
  const [tradingDayParamFilterDraft, setTradingDayParamFilterDraft] = useState<TradingDayParamFilters>(createDefaultDayParamFilters);
  const [tradingDayParamFilters, setTradingDayParamFilters] = useState<TradingDayParamFilters>(createDefaultDayParamFilters);
  const marketSentimentView = useMarketSentimentView({ tenantId, token, active: activeView === 'market-trend', onNotify });

  const instrumentFilterOptions = useMemo(
    () => [{ key: '', label: 'All indexes' }, ...baseInstruments],
    [baseInstruments]
  );

  // ── Data loaders ─────────────────────────────────────────────────────────────
  const reloadStrategies = useCallback(async (pageArg = strategyPage, sizeArg = strategyRowsPerPage) => {
    if (!username.trim()) return;
    setLoadingList(true);
    try {
      const response = await fetchBacktestStrategies(tenantId, token, username.trim(), pageArg, sizeArg);
      if (response.content.length === 0 && response.totalElements > 0 && pageArg > 0) {
        setStrategyPage(pageArg - 1);
        return;
      }
      setStrategies(response.content);
      setStrategyTotalElements(response.totalElements);
    } catch (error) {
      onNotify({ msg: (error as Error).message || 'Unable to load strategies', severity: 'error' });
    } finally {
      setLoadingList(false);
    }
  }, [onNotify, strategyPage, strategyRowsPerPage, tenantId, token, username]);

  useEffect(() => { void reloadStrategies(); }, [reloadStrategies]);

  const reloadTradingSignals = useCallback(async (pageArg = tradingSignalPage, sizeArg = tradingSignalRowsPerPage) => {
    setTradingSignalLoading(true);
    try {
      const timeframeFilter = parseTimeframeKey(tradingSignalFilters.timeframeKey);
      const response = await fetchTradingSignals(tenantId, token, {
        instrumentKey: tradingSignalFilters.instrumentKey || undefined,
        timeframeUnit: timeframeFilter.timeframeUnit,
        timeframeInterval: timeframeFilter.timeframeInterval,
        signal: tradingSignalFilters.signal || undefined,
        fromDate: tradingSignalFilters.fromDate || undefined,
        toDate: tradingSignalFilters.toDate || undefined,
        page: pageArg,
        size: sizeArg,
      });
      if (response.content.length === 0 && response.totalElements > 0 && pageArg > 0) {
        setTradingSignalPage(pageArg - 1);
        return;
      }
      setTradingSignalRows(response.content);
      setTradingSignalTotalElements(response.totalElements);
    } catch (error) {
      onNotify({ msg: (error as Error).message || 'Unable to load trading signals', severity: 'error' });
    } finally {
      setTradingSignalLoading(false);
    }
  }, [onNotify, tenantId, token, tradingSignalPage, tradingSignalRowsPerPage, tradingSignalFilters]);

  const reloadTradingDayParams = useCallback(async (pageArg = tradingDayParamPage, sizeArg = tradingDayParamRowsPerPage) => {
    setTradingDayParamLoading(true);
    try {
      const response = await fetchTradingDayParams(tenantId, token, {
        instrumentKey: tradingDayParamFilters.instrumentKey || undefined,
        fromDate: tradingDayParamFilters.fromDate || undefined,
        toDate: tradingDayParamFilters.toDate || undefined,
        page: pageArg,
        size: sizeArg,
      });
      if (response.content.length === 0 && response.totalElements > 0 && pageArg > 0) {
        setTradingDayParamPage(pageArg - 1);
        return;
      }
      setTradingDayParamRows(response.content);
      setTradingDayParamTotalElements(response.totalElements);
    } catch (error) {
      onNotify({ msg: (error as Error).message || 'Unable to load trading params', severity: 'error' });
    } finally {
      setTradingDayParamLoading(false);
    }
  }, [onNotify, tenantId, token, tradingDayParamPage, tradingDayParamRowsPerPage, tradingDayParamFilters]);

  useEffect(() => {
    if (activeView !== 'trading-signal') return;
    void reloadTradingSignals();
  }, [activeView, reloadTradingSignals]);

  useEffect(() => {
    if (activeView !== 'trading-param') return;
    void reloadTradingDayParams();
  }, [activeView, reloadTradingDayParams]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const applyTradingSignalFilters = () => { setTradingSignalPage(0); setTradingSignalFilters({ ...tradingSignalFilterDraft }); };
  const resetTradingSignalFilters = () => { setTradingSignalPage(0); setTradingSignalFilterDraft(createDefaultSignalFilters()); setTradingSignalFilters(createDefaultSignalFilters()); };
  const applyTradingDayParamFilters = () => { setTradingDayParamPage(0); setTradingDayParamFilters({ ...tradingDayParamFilterDraft }); };
  const resetTradingDayParamFilters = () => { setTradingDayParamPage(0); setTradingDayParamFilterDraft(createDefaultDayParamFilters()); setTradingDayParamFilters(createDefaultDayParamFilters()); };
  const isDirty = useMemo(() => strategy.strategyName.trim().length > 0, [strategy.strategyName]);

  const updateStrategyField = <K extends keyof BacktestStrategyPayload>(key: K, value: BacktestStrategyPayload[K]) =>
    setStrategy((current) => ({ ...current, [key]: value }));

  const addLeg = () => setStrategy((current) => ({
    ...current,
    legs: [...current.legs, createDefaultLeg(current.legs.length + 1)],
  }));

  const updateLeg = (legIndex: number, patch: Partial<BacktestLegPayload>) =>
    setStrategy((current) => ({
      ...current,
      legs: current.legs.map((leg, index) => (index === legIndex ? { ...leg, ...patch } : leg)),
    }));

  const deleteLeg = (legIndex: number) =>
    setStrategy((current) => ({ ...current, legs: current.legs.filter((_, index) => index !== legIndex) }));

  const resetForm = () => { setStrategyId(null); setStrategy(createDefaultStrategy(initialInstrument)); setSummary(null); setResults([]); };

  const handleSave = async () => {
    if (!strategy.strategyName.trim()) { onNotify({ msg: 'Strategy name is required', severity: 'error' }); return; }
    if (!strategy.legs.length) { onNotify({ msg: 'At least one leg is required', severity: 'error' }); return; }
    setSaving(true);
    try {
      if (strategyId == null) {
        await createBacktestStrategy(tenantId, token, { username: username.trim(), strategy });
        onNotify({ msg: 'Strategy saved', severity: 'success' });
      } else {
        await updateBacktestStrategy(tenantId, token, strategyId, { username: username.trim(), strategy });
        onNotify({ msg: 'Strategy saved', severity: 'success' });
      }
      await reloadStrategies();
      if (strategyId == null) resetForm();
    } catch (error) {
      onNotify({ msg: (error as Error).message || 'Unable to save strategy', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteBacktestStrategy(tenantId, token, id, username.trim());
      onNotify({ msg: 'Strategy deleted', severity: 'info' });
      if (strategyId === id) resetForm();
      await reloadStrategies();
    } catch (error) {
      onNotify({ msg: (error as Error).message || 'Unable to delete strategy', severity: 'error' });
    }
  };

  const handleEdit = (row: BacktestStrategyResponse) => {
    setStrategyId(row.id);
    setStrategy(normalizeStrategyForMvp(row.strategy));
    setSummary(null);
    setResults([]);
    onNotify({ msg: `Loaded "${row.strategyName}" for editing`, severity: 'info' });
    onNavigateToPnl();
  };

  const handleRunBacktest = async () => {
    if (!strategy.strategyName.trim()) { onNotify({ msg: 'Enter a strategy name before running', severity: 'error' }); return; }
    if (!strategy.legs.length) { onNotify({ msg: 'Add at least one leg before running', severity: 'error' }); return; }
    setRunning(true);
    setSummary(null);
    setResults([]);
    try {
      const response = await runBacktest(tenantId, token, { username: username.trim(), strategy });
      setResults(response.rows);
      setSummary(response);
      onNotify({ msg: `Backtest completed with ${response.executedTrades} trades`, severity: 'success' });
    } catch (error) {
      onNotify({ msg: (error as Error).message || 'Backtest run failed', severity: 'error' });
    } finally {
      setRunning(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <Stack spacing={2.5}>

      {/* ═══════════════════════════ P&L VIEW ═══════════════════════════════ */}
      {activeView === 'pnl' && (
        <>
          {/* Header card */}
          <Card>
            <CardContent sx={{ pb: '12px !important' }}>
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={1.5}>
                  <Stack spacing={0.25}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <AssessmentRounded sx={{ color: 'primary.main', fontSize: 22 }} />
                      <Typography variant="h5" fontWeight={800}>Backtest</Typography>
                      {strategyId != null && (
                        <Chip label={`Editing: ${strategy.strategyName || '—'}`} size="small" color="primary" variant="outlined" sx={{ maxWidth: 220 }} />
                      )}
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      Define schedule, risk controls, and legs — then run the backtest to see P&L.
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={resetForm}
                      disabled={saving || running}
                    >
                      New
                    </Button>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<SaveRounded />}
                      onClick={handleSave}
                      disabled={!isDirty || saving || running}
                    >
                      {saving ? 'Saving…' : 'Save Strategy'}
                    </Button>
                    <Button
                      variant="contained"
                      color="success"
                      size="small"
                      startIcon={<PlayArrowRounded />}
                      onClick={handleRunBacktest}
                      disabled={running || saving}
                      sx={{ fontWeight: 700 }}
                    >
                      {running ? 'Running…' : 'Start Backtest'}
                    </Button>
                  </Stack>
                </Stack>

                {running && <LinearProgress sx={{ borderRadius: 1 }} />}
              </Stack>
            </CardContent>
          </Card>

          <BacktestStrategyForm
            strategy={strategy}
            baseInstruments={baseInstruments}
            baseTimeframes={baseTimeframes}
            onUpdateField={updateStrategyField}
            onSetStrategy={setStrategy}
            onAddLeg={addLeg}
            onUpdateLeg={updateLeg}
            onDeleteLeg={deleteLeg}
          />

          <BacktestResultsPanel
            results={results}
            summary={summary}
            strategyName={strategy.strategyName}
            startDate={strategy.startDate}
            endDate={strategy.endDate}
          />
        </>
      )}

      {/* ═══════════════════════════ STRATEGY LIST ═══════════════════════════ */}
      {activeView === 'strategy-list' && (
        <BacktestStrategyListView
          strategies={strategies}
          totalElements={strategyTotalElements}
          page={strategyPage}
          rowsPerPage={strategyRowsPerPage}
          loadingList={loadingList}
          baseInstruments={baseInstruments}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onPageChange={setStrategyPage}
          onRowsPerPageChange={setStrategyRowsPerPage}
        />
      )}

      {/* ═══════════════════════════ TRADING SIGNAL ══════════════════════════ */}
      {activeView === 'trading-signal' && (
        <BacktestTradingSignalView
          rows={tradingSignalRows}
          totalElements={tradingSignalTotalElements}
          page={tradingSignalPage}
          rowsPerPage={tradingSignalRowsPerPage}
          loading={tradingSignalLoading}
          filterDraft={tradingSignalFilterDraft}
          instrumentFilterOptions={instrumentFilterOptions}
          baseInstruments={baseInstruments}
          onFilterDraftChange={setTradingSignalFilterDraft}
          onApplyFilters={applyTradingSignalFilters}
          onResetFilters={resetTradingSignalFilters}
          onPageChange={setTradingSignalPage}
          onRowsPerPageChange={setTradingSignalRowsPerPage}
        />
      )}

      {/* ═══════════════════════════ TRADING PARAM ═══════════════════════════ */}
      {activeView === 'trading-param' && (
        <BacktestTradingParamView
          rows={tradingDayParamRows}
          totalElements={tradingDayParamTotalElements}
          page={tradingDayParamPage}
          rowsPerPage={tradingDayParamRowsPerPage}
          loading={tradingDayParamLoading}
          filterDraft={tradingDayParamFilterDraft}
          instrumentFilterOptions={instrumentFilterOptions}
          baseInstruments={baseInstruments}
          onFilterDraftChange={setTradingDayParamFilterDraft}
          onApplyFilters={applyTradingDayParamFilters}
          onResetFilters={resetTradingDayParamFilters}
          onPageChange={setTradingDayParamPage}
          onRowsPerPageChange={setTradingDayParamRowsPerPage}
        />
      )}

      {activeView === 'market-trend' && (
        <BacktestMarketTrendView
          rows={marketSentimentView.rows}
          totalElements={marketSentimentView.totalElements}
          page={marketSentimentView.page}
          rowsPerPage={marketSentimentView.rowsPerPage}
          loading={marketSentimentView.loading}
          refreshing={marketSentimentView.refreshing}
          previewLoading={marketSentimentView.previewLoading}
          previewData={marketSentimentView.previewData}
          filterDraft={marketSentimentView.filterDraft}
          onFilterDraftChange={marketSentimentView.setFilterDraft}
          onApplyFilters={marketSentimentView.applyFilters}
          onResetFilters={marketSentimentView.resetFilters}
          onPageChange={marketSentimentView.setPage}
          onRowsPerPageChange={marketSentimentView.setRowsPerPage}
          onRefreshNow={marketSentimentView.refreshNow}
          onLoadPreview={marketSentimentView.loadPreview}
        />
      )}
    </Stack>
  );
};
