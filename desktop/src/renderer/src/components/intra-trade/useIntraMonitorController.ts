import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  deleteIntraTradeExecution,
  exitIntraTradeExecution,
  fetchIntraMarketSummary,
  fetchIntraMonitorEvents,
  fetchIntraMonitorPositions,
  fetchIntraMonitorRuntimes,
  fetchIntraStrategyLibrary,
  fetchIntraStrategyVersions,
  fetchIntraTradeExecutions,
  refreshIntraTradeExecution,
  resumeIntraRuntime,
  type IntraEventLogItem,
  type IntraMarketSummary,
  type IntraPositionSnapshot,
  type IntraRuntimeSummary,
  type IntraStrategyLibraryItem,
  type IntraTradeExecutionSummary,
  type IntraTradeMode,
} from '../../api/admin';
import { useIntraWorkspace } from './IntraWorkspaceContext';
import {
  toTimeframeKey,
  type LiveGuardResult,
} from './IntraTradeShared';
import {
  buildIntraRunPayload,
  executeIntraRun,
  reloadExecutionSnapshot,
} from './intraMonitorExecution';
import { buildCommandBarState } from './intraMonitorCommandBar';
import type { IntraTraderSurfaceMode } from './IntraMonitorTraderView';
import { ACTIVE_RUNTIME_STATUSES, createPromotionChecklist } from './intraMonitorHelpers';

const MARKET_STALE_THRESHOLD_SECONDS = 30;

export const useIntraMonitorController = ({
  token,
  tenantId,
  username,
  onNotify,
}: {
  token: string;
  tenantId: string;
  username: string;
  onNotify: (payload: { msg: string; severity: 'success' | 'error' | 'info' }) => void;
}) => {
  const {
    baseInstruments,
    baseTimeframes,
    tradeMode,
    setTradeMode,
    scanInstrumentKey,
    setScanInstrumentKey,
    scanTimeframeKey,
    setScanTimeframeKey,
    strategyId,
    strategy,
    setStrategy,
    editingExecutionId,
    selectedExecution,
    loadStrategyIntoWorkspace,
    loadExecutionIntoWorkspace,
  } = useIntraWorkspace();

  const [surfaceMode, setSurfaceMode] = useState<IntraTraderSurfaceMode>('QUICK_TEST');
  const [savedStrategies, setSavedStrategies] = useState<IntraStrategyLibraryItem[]>([]);
  const [loadingStrategies, setLoadingStrategies] = useState(false);
  const [runningExecution, setRunningExecution] = useState(false);
  const [refreshingExecution, setRefreshingExecution] = useState(false);
  const [marketSummary, setMarketSummary] = useState<IntraMarketSummary | null>(null);
  const [marketSummaryReceivedAt, setMarketSummaryReceivedAt] = useState<number | null>(null);
  const [liveRuntimePage, setLiveRuntimePage] = useState(0);
  const [liveRuntimeRowsPerPage, setLiveRuntimeRowsPerPage] = useState(5);
  const [runtimeRows, setRuntimeRows] = useState<IntraRuntimeSummary[]>([]);
  const [runtimeTotal, setRuntimeTotal] = useState(0);
  const [selectedRuntimeId, setSelectedRuntimeId] = useState<number | null>(null);
  const [allPositionRows, setAllPositionRows] = useState<IntraPositionSnapshot[]>([]);
  const [allEventRows, setAllEventRows] = useState<IntraEventLogItem[]>([]);
  const [positionPage, setPositionPage] = useState(0);
  const [positionRowsPerPage, setPositionRowsPerPage] = useState(5);
  const [eventPage, setEventPage] = useState(0);
  const [eventRowsPerPage, setEventRowsPerPage] = useState(5);
  const [recentExecutions, setRecentExecutions] = useState<IntraTradeExecutionSummary[]>([]);
  const [loadingMonitor, setLoadingMonitor] = useState(false);
  const [marketWatchOpen, setMarketWatchOpen] = useState(true);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(30);
  const [autoRefreshCountdown, setAutoRefreshCountdown] = useState(30);
  const [eventFilter, setEventFilter] = useState('');
  const [runtimeStatusFilter, setRuntimeStatusFilter] = useState('ACTIVE');
  const [strategySearch, setStrategySearch] = useState('');
  const [strategyStatusFilter, setStrategyStatusFilter] = useState('ACTIVE');
  const [strategyPage, setStrategyPage] = useState(0);
  const [strategyRowsPerPage, setStrategyRowsPerPage] = useState(5);
  const [promotionOpen, setPromotionOpen] = useState(false);
  const [paperRunPage, setPaperRunPage] = useState(0);
  const [paperRunRowsPerPage, setPaperRunRowsPerPage] = useState(5);
  const [paperRunModeFilter, setPaperRunModeFilter] = useState('ALL');
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoRefreshCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Stable refs so the interval callback always reads the latest values without
  // being added to the effect dependency array (which would reset the timer).
  const surfaceModeRef = useRef(surfaceMode);
  const selectedExecutionRef = useRef(selectedExecution);
  const refreshSelectedExecutionRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const activeLiveExecutionIdsRef = useRef<number[]>([]);
  const [guardOpen, setGuardOpen] = useState(false);
  const [guardLabel, setGuardLabel] = useState('');
  const [guardIsLive, setGuardIsLive] = useState(false);
  const pendingActionRef = useRef<((result: LiveGuardResult) => Promise<void>) | null>(null);

  const timeframeOptions = useMemo(
    () => (tradeMode === 'BACKTEST' ? baseTimeframes : baseTimeframes.filter((item) => item.unit === 'minutes')),
    [baseTimeframes, tradeMode],
  );

  useEffect(() => {
    if (timeframeOptions.some((item) => toTimeframeKey(item.unit, item.interval) === scanTimeframeKey) === false) {
      const fallback = timeframeOptions[0];
      if (fallback) {
        setScanTimeframeKey(toTimeframeKey(fallback.unit, fallback.interval));
      }
    }
  }, [scanTimeframeKey, setScanTimeframeKey, timeframeOptions]);

  const reloadStrategies = useCallback(async () => {
    setLoadingStrategies(true);
    try {
      const response = await fetchIntraStrategyLibrary(tenantId, token, {
        username,
        sort: 'RECENT_EDITED',
        page: 0,
        size: 100,
      });
      setSavedStrategies(response.content);
    } catch (error) {
      onNotify({ msg: (error as Error).message || 'Unable to load saved strategies', severity: 'error' });
    } finally {
      setLoadingStrategies(false);
    }
  }, [onNotify, tenantId, token, username]);

  const reloadMonitor = useCallback(async () => {
    setLoadingMonitor(true);
    try {
      const [summary, liveRuntimes, livePositions, events, executions] = await Promise.all([
        fetchIntraMarketSummary(tenantId, token, username),
        fetchIntraMonitorRuntimes(tenantId, token, username, { mode: 'LIVE', page: liveRuntimePage, size: liveRuntimeRowsPerPage }),
        fetchIntraMonitorPositions(tenantId, token, username, { mode: 'LIVE', page: 0, size: 100 }),
        fetchIntraMonitorEvents(tenantId, token, username, { eventType: eventFilter || undefined, page: 0, size: 200 }),
        fetchIntraTradeExecutions(tenantId, token, username, 0, 20),
      ]);
      setMarketSummary(summary);
      setMarketSummaryReceivedAt(Date.now());
      setRuntimeRows(liveRuntimes.content);
      setRuntimeTotal(liveRuntimes.totalElements);
      setAllPositionRows(livePositions.content);
      setAllEventRows(events.content);
      setRecentExecutions(executions.content);
    } catch (error) {
      onNotify({ msg: (error as Error).message || 'Unable to load monitor data', severity: 'error' });
    } finally {
      setLoadingMonitor(false);
    }
  }, [eventFilter, liveRuntimePage, liveRuntimeRowsPerPage, onNotify, tenantId, token, username]);

  useEffect(() => {
    void reloadStrategies();
  }, [reloadStrategies]);

  useEffect(() => {
    void reloadMonitor();
  }, [reloadMonitor]);

  const openGuardDialog = useCallback((actionLabel: string, mode: 'LIVE' | 'PAPER', fn: (payload: LiveGuardResult) => Promise<unknown>) => {
    setGuardLabel(actionLabel);
    setGuardIsLive(mode === 'LIVE');
    pendingActionRef.current = async (result) => {
      try {
        await fn(result);
        onNotify({ msg: actionLabel + ' completed', severity: 'success' });
        await reloadMonitor();
      } catch (error) {
        onNotify({ msg: (error as Error).message || actionLabel + ' failed', severity: 'error' });
      }
    };
    setGuardOpen(true);
  }, [onNotify, reloadMonitor]);

  const runStrategy = useCallback(async (modeOverride?: IntraTradeMode) => {
    const payload = buildIntraRunPayload({
      mode: modeOverride ?? tradeMode,
      username,
      strategyId,
      scanInstrumentKey,
      scanTimeframeKey,
      strategy,
    });
    if (payload == null) return;
    if (strategy.strategyName.trim().length === 0) {
      onNotify({ msg: 'Select a saved strategy or build one in Intra Strategies first', severity: 'error' });
      return;
    }
    setRunningExecution(true);
    try {
      const response = await executeIntraRun({ tenantId, token, payload, editingExecutionId });
      if (response == null) return;
      loadExecutionIntoWorkspace(response);
      setTradeMode(payload.mode);
      onNotify({ msg: editingExecutionId == null ? 'Run started' : 'Saved run updated', severity: 'success' });
      if (payload.mode === 'LIVE') setSurfaceMode('LIVE_MONITOR');
      await reloadMonitor();
    } catch (error) {
      onNotify({ msg: (error as Error).message || 'Unable to execute selected strategy', severity: 'error' });
    } finally {
      setRunningExecution(false);
    }
  }, [editingExecutionId, loadExecutionIntoWorkspace, onNotify, reloadMonitor, scanInstrumentKey, scanTimeframeKey, setTradeMode, strategy, strategyId, tenantId, token, tradeMode, username]);

  const refreshSelectedExecution = useCallback(async () => {
    if (selectedExecution == null) return;
    setRefreshingExecution(true);
    try {
      const response = await reloadExecutionSnapshot(tenantId, token, selectedExecution.id, username);
      loadExecutionIntoWorkspace(response);
      onNotify({ msg: 'Execution refreshed', severity: 'success' });
      await reloadMonitor();
    } catch (error) {
      onNotify({ msg: (error as Error).message || 'Unable to refresh execution', severity: 'error' });
    } finally {
      setRefreshingExecution(false);
    }
  }, [loadExecutionIntoWorkspace, onNotify, reloadMonitor, selectedExecution, tenantId, token, username]);

  // Keep stable refs in sync so the auto-refresh interval can always read the
  // latest values without being added to the effect's dependency array (which
  // would reset the timer on every render).
  useEffect(() => { surfaceModeRef.current = surfaceMode; }, [surfaceMode]);
  useEffect(() => { selectedExecutionRef.current = selectedExecution; }, [selectedExecution]);
  useEffect(() => { refreshSelectedExecutionRef.current = refreshSelectedExecution; }, [refreshSelectedExecution]);
  useEffect(() => {
    activeLiveExecutionIdsRef.current = runtimeRows
      .filter((row) => ACTIVE_RUNTIME_STATUSES.has(row.status))
      .map((row) => row.executionId);
  }, [runtimeRows]);

  const refreshActiveLiveExecutions = useCallback(async () => {
    const executionIds = [...new Set(activeLiveExecutionIdsRef.current)];
    if (executionIds.length === 0) return;

    const refreshedExecutions = await Promise.all(executionIds.map(async (executionId) => {
      try {
        return await refreshIntraTradeExecution(tenantId, token, executionId, username);
      } catch {
        return null;
      }
    }));

    const selected = selectedExecutionRef.current;
    const refreshedSelected = refreshedExecutions.find((execution) => execution != null && execution.id === selected?.id);
    if (refreshedSelected != null) {
      loadExecutionIntoWorkspace(refreshedSelected);
    }
  }, [loadExecutionIntoWorkspace, tenantId, token, username]);

  useEffect(() => {
    setAutoRefreshCountdown(autoRefreshInterval);
    if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    if (autoRefreshCountdownRef.current) clearInterval(autoRefreshCountdownRef.current);
    autoRefreshRef.current = setInterval(() => {
      void (async () => {
        await refreshActiveLiveExecutions();
        await reloadMonitor();
      })();
      // In Quick Test mode, auto-refresh the selected paper execution while it is
      // actively scanning (WAITING_ENTRY or ENTERED) so the scan window expands
      // with each new candle and re-entry opportunities are discovered automatically.
      const exec = selectedExecutionRef.current;
      if (
        surfaceModeRef.current === 'QUICK_TEST'
        && exec != null
        && exec.mode === 'PAPER'
        && (exec.status === 'WAITING_ENTRY' || exec.status === 'ENTERED')
      ) {
        void refreshSelectedExecutionRef.current();
      }
      setAutoRefreshCountdown(autoRefreshInterval);
    }, autoRefreshInterval * 1000);
    autoRefreshCountdownRef.current = setInterval(() => {
      setAutoRefreshCountdown((v) => (v <= 1 ? autoRefreshInterval : v - 1));
    }, 1000);
    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
      if (autoRefreshCountdownRef.current) clearInterval(autoRefreshCountdownRef.current);
    };
  }, [autoRefreshInterval, refreshActiveLiveExecutions, reloadMonitor]);

  const filteredStrategies = useMemo(() => {
    return savedStrategies.filter((row) => {
      const matchesStatus = strategyStatusFilter === 'ACTIVE'
        ? row.status !== 'ARCHIVED'
        : strategyStatusFilter === 'ALL' || row.status === strategyStatusFilter;
      const needle = strategySearch.trim().toLowerCase();
      const matchesSearch = needle.length === 0
        || row.strategyName.toLowerCase().includes(needle)
        || row.instrumentKey.toLowerCase().includes(needle);
      return matchesStatus && matchesSearch;
    });
  }, [savedStrategies, strategySearch, strategyStatusFilter]);

  const pagedStrategies = useMemo(() => {
    const start = strategyPage * strategyRowsPerPage;
    return filteredStrategies.slice(start, start + strategyRowsPerPage);
  }, [filteredStrategies, strategyPage, strategyRowsPerPage]);

  useEffect(() => {
    if (filteredStrategies.length === 0) return;
    if (strategyId == null || filteredStrategies.some((row) => row.id === strategyId) === false) {
      const first = filteredStrategies[0];
      if (first) {
        void (async () => {
          try {
            const versions = await fetchIntraStrategyVersions(tenantId, token, first.id, username);
            const latest = versions[0];
            if (latest) loadStrategyIntoWorkspace(first.id, latest.strategy);
          } catch {
            // selection fallback should not block the screen
          }
        })();
      }
    }
  }, [filteredStrategies, loadStrategyIntoWorkspace, strategyId, tenantId, token, username]);

  const selectedStrategy = useMemo(
    () => savedStrategies.find((row) => row.id === strategyId) ?? null,
    [savedStrategies, strategyId],
  );

  const recentPaperRuns = useMemo(() => {
    return recentExecutions
      .filter((row) => row.mode === 'PAPER' && (strategyId == null || row.strategyId === strategyId))
      .slice(0, 3);
  }, [recentExecutions, strategyId]);

  const allValidationRuns = useMemo(() => {
    return recentExecutions.filter((row) =>
      (row.mode === 'PAPER' || row.mode === 'BACKTEST') &&
      (strategyId == null || row.strategyId === strategyId),
    );
  }, [recentExecutions, strategyId]);

  const filteredValidationRuns = useMemo(() => {
    if (paperRunModeFilter === 'ALL') return allValidationRuns;
    return allValidationRuns.filter((row) => row.mode === paperRunModeFilter);
  }, [allValidationRuns, paperRunModeFilter]);

  const pagedValidationRuns = useMemo(() => {
    const start = paperRunPage * paperRunRowsPerPage;
    return filteredValidationRuns.slice(start, start + paperRunRowsPerPage);
  }, [filteredValidationRuns, paperRunPage, paperRunRowsPerPage]);

  const marketSummaryDerived = useMemo(() => {
    if (marketSummary == null) return null;
    const receivedAt = marketSummaryReceivedAt ?? Date.now();
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - receivedAt) / 1000));
    const baseFreshness = Math.max(0, marketSummary.freshnessSeconds ?? 0);
    const freshnessSeconds = baseFreshness + elapsedSeconds;
    return {
      ...marketSummary,
      freshnessSeconds,
      stale: marketSummary.stale || freshnessSeconds > MARKET_STALE_THRESHOLD_SECONDS,
    };
  }, [autoRefreshCountdown, marketSummary, marketSummaryReceivedAt]);

  const promotionChecklist = useMemo(
    () => createPromotionChecklist({ marketSummary: marketSummaryDerived, selectedStrategy, strategy, recentPaperRuns }),
    [marketSummaryDerived, recentPaperRuns, selectedStrategy, strategy],
  );

  const filteredLiveRuntimes = useMemo(() => {
    return runtimeRows.filter((row) => {
      if (runtimeStatusFilter === 'ALL') return true;
      if (runtimeStatusFilter === 'ACTIVE') return ACTIVE_RUNTIME_STATUSES.has(row.status);
      return row.status === runtimeStatusFilter;
    });
  }, [runtimeRows, runtimeStatusFilter]);

  useEffect(() => {
    const first = filteredLiveRuntimes[0];
    if (filteredLiveRuntimes.length === 0) {
      setSelectedRuntimeId(null);
      return;
    }
    if (selectedRuntimeId == null || filteredLiveRuntimes.some((row) => row.runtimeId === selectedRuntimeId) === false) {
      setSelectedRuntimeId(first.runtimeId);
    }
  }, [filteredLiveRuntimes, selectedRuntimeId]);

  const selectedRuntime = useMemo(
    () => filteredLiveRuntimes.find((row) => row.runtimeId === selectedRuntimeId) ?? null,
    [filteredLiveRuntimes, selectedRuntimeId],
  );

  const selectedRuntimePositionsAll = useMemo(() => {
    if (selectedRuntime == null) return [];
    return allPositionRows.filter((row) => row.runtimeId === selectedRuntime.runtimeId);
  }, [allPositionRows, selectedRuntime]);

  const selectedRuntimeEventsAll = useMemo(() => {
    if (selectedRuntime == null) return [];
    return allEventRows.filter((row) => row.mode === 'LIVE' && row.runtimeId === selectedRuntime.runtimeId);
  }, [allEventRows, selectedRuntime]);

  const selectedRuntimePositions = useMemo(() => {
    const start = positionPage * positionRowsPerPage;
    return selectedRuntimePositionsAll.slice(start, start + positionRowsPerPage);
  }, [positionPage, positionRowsPerPage, selectedRuntimePositionsAll]);

  const selectedRuntimeEvents = useMemo(() => {
    const start = eventPage * eventRowsPerPage;
    return selectedRuntimeEventsAll.slice(start, start + eventRowsPerPage);
  }, [eventPage, eventRowsPerPage, selectedRuntimeEventsAll]);

  useEffect(() => {
    setPositionPage(0);
  }, [selectedRuntimeId]);

  useEffect(() => {
    setEventPage(0);
  }, [selectedRuntimeId, eventFilter]);

  const commandBar = useMemo(() => buildCommandBarState({
    surfaceMode,
    selectedRuntime,
    selectedStrategy,
    selectedExecution,
    runningExecution,
    tradeMode,
    recentPaperRuns,
    marketRefreshedAt: marketSummary?.refreshedAt,
    selectedRuntimePositionsCount: selectedRuntimePositionsAll.length,
    onResume: () => {
      if (!selectedRuntime) return;
      void resumeIntraRuntime(tenantId, token, selectedRuntime.runtimeId, username, 'resume from command bar')
        .then(() => reloadMonitor())
        .catch((error) => onNotify({ msg: (error as Error).message || 'Unable to resume strategy', severity: 'error' }));
    },
    onOpenPromotion: () => setPromotionOpen(true),
    onRunSelectedMode: () => { void runStrategy(tradeMode === 'BACKTEST' ? 'BACKTEST' : 'PAPER'); },
  }), [
    marketSummary?.refreshedAt,
    onNotify,
    promotionChecklist,
    recentPaperRuns,
    reloadMonitor,
    runStrategy,
    runningExecution,
    selectedExecution,
    selectedRuntime,
    selectedRuntimePositionsAll.length,
    selectedStrategy,
    surfaceMode,
    tenantId,
    token,
    tradeMode,
    username,
  ]);

  const stopValidationRun = useCallback(async (runId: number, status: string) => {
    try {
      if (status === 'ENTERED') {
        // Has an open position — exit it gracefully first
        await exitIntraTradeExecution(tenantId, token, runId, username);
        onNotify({ msg: 'Run exited', severity: 'success' });
      } else {
        // WAITING_ENTRY — no open position, just delete
        await deleteIntraTradeExecution(tenantId, token, runId, username);
        onNotify({ msg: 'Run cancelled', severity: 'success' });
      }
      await reloadMonitor();
    } catch (error) {
      onNotify({ msg: (error as Error).message || 'Unable to stop run', severity: 'error' });
    }
  }, [onNotify, reloadMonitor, tenantId, token, username]);

  const deleteValidationRun = useCallback(async (runId: number) => {
    try {
      await deleteIntraTradeExecution(tenantId, token, runId, username);
      onNotify({ msg: 'Run deleted', severity: 'success' });
      await reloadMonitor();
    } catch (error) {
      onNotify({ msg: (error as Error).message || 'Unable to delete run', severity: 'error' });
    }
  }, [onNotify, reloadMonitor, tenantId, token, username]);

  return {
    baseInstruments,
    tradeMode,
    setTradeMode,
    scanInstrumentKey,
    setScanInstrumentKey,
    scanTimeframeKey,
    setScanTimeframeKey,
    strategyId,
    selectedExecution,
    surfaceMode,
    setSurfaceMode,
    pagedStrategies,
    filteredStrategies,
    loadingStrategies,
    selectedStrategy,
    strategyPage,
    setStrategyPage,
    strategyRowsPerPage,
    setStrategyRowsPerPage,
    strategySearch,
    setStrategySearch,
    strategyStatusFilter,
    setStrategyStatusFilter,
    timeframeOptions,
    recentPaperRuns,
    promotionChecklist,
    filteredLiveRuntimes,
    runtimeTotal,
    liveRuntimePage,
    setLiveRuntimePage,
    liveRuntimeRowsPerPage,
    setLiveRuntimeRowsPerPage,
    runtimeStatusFilter,
    setRuntimeStatusFilter,
    selectedRuntimeId,
    setSelectedRuntimeId,
    selectedRuntime,
    selectedRuntimePositions,
    selectedRuntimePositionsAll,
    positionPage,
    setPositionPage,
    positionRowsPerPage,
    setPositionRowsPerPage,
    selectedRuntimeEvents,
    selectedRuntimeEventsAll,
    eventPage,
    setEventPage,
    eventRowsPerPage,
    setEventRowsPerPage,
    eventFilter,
    setEventFilter,
    autoRefreshInterval,
    setAutoRefreshInterval,
    autoRefreshCountdown,
    pagedValidationRuns,
    filteredValidationRuns,
    paperRunPage,
    setPaperRunPage,
    paperRunRowsPerPage,
    setPaperRunRowsPerPage,
    paperRunModeFilter,
    setPaperRunModeFilter,
    marketSummary: marketSummaryDerived,
    marketWatchOpen,
    setMarketWatchOpen,
    loadingMonitor,
    refreshingExecution,
    promotionOpen,
    setPromotionOpen,
    guardOpen,
    guardLabel,
    guardIsLive,
    setGuardOpen,
    pendingActionRef,
    commandBarAction: commandBar.action,
    commandBarStateLabel: commandBar.stateLabel,
    commandBarModeLabel: commandBar.modeLabel,
    commandBarLastScan: commandBar.lastScan,
    commandBarOpenPositions: commandBar.openPositions,
    commandBarMtm: commandBar.mtm,
    commandBarStrategyName: commandBar.strategyName,
    marketStatusLabel: marketSummaryDerived?.sessionStatus === 'Open' ? 'Market Open' : 'Market Closed',
    freshnessLabel: marketSummaryDerived == null ? 'Loading...' : (marketSummaryDerived.stale ? 'Stale' : 'Fresh'),
    openGuardDialog,
    runStrategy,
    refreshSelectedExecution,
    loadStrategyIntoWorkspace,
    reloadMonitor,
    stopValidationRun,
    deleteValidationRun,
    strategy,
    setStrategy,
  };
};
