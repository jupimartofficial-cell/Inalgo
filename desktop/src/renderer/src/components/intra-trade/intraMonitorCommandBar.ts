import type { IntraPrimaryAction, IntraTraderSurfaceMode } from './IntraMonitorTraderView';
import type { IntraRuntimeSummary, IntraStrategyLibraryItem, IntraTradeExecutionResponse, IntraTradeExecutionSummary, IntraTradeMode } from '../../api/admin';
import { friendlyRuntimeStatus, friendlyStrategyStatus } from './IntraTradeShared';
import { ACTIVE_RUNTIME_STATUSES, describeExecutionState, formatLastScan } from './intraMonitorHelpers';

export const buildCommandBarState = ({
  surfaceMode,
  selectedRuntime,
  selectedStrategy,
  selectedExecution,
  runningExecution,
  tradeMode,
  recentPaperRuns,
  marketRefreshedAt,
  selectedRuntimePositionsCount,
  onResume,
  onOpenPromotion,
  onRunSelectedMode,
}: {
  surfaceMode: IntraTraderSurfaceMode;
  selectedRuntime: IntraRuntimeSummary | null;
  selectedStrategy: IntraStrategyLibraryItem | null;
  selectedExecution: IntraTradeExecutionResponse | null;
  runningExecution: boolean;
  tradeMode: IntraTradeMode;
  recentPaperRuns: IntraTradeExecutionSummary[];
  marketRefreshedAt?: string | null;
  selectedRuntimePositionsCount: number;
  onResume: () => void;
  onOpenPromotion: () => void;
  onRunSelectedMode: () => void;
}) => {
  const quickTestActionLabel = tradeMode === 'BACKTEST'
    ? 'Run Historical Test'
    : 'Run Paper Test';

  const action: IntraPrimaryAction = surfaceMode === 'LIVE_MONITOR'
    ? selectedRuntime?.status === 'PAUSED'
      ? { label: 'Resume', tone: 'success', onClick: onResume }
      : selectedRuntime && ACTIVE_RUNTIME_STATUSES.has(selectedRuntime.status)
        ? { label: 'Exit Now', tone: 'warning', onClick: () => undefined }
        : { label: 'Start Live', tone: 'success', onClick: onOpenPromotion }
    : selectedExecution && (selectedExecution.status === 'EXITED' || selectedExecution.status === 'COMPLETED')
      ? { label: 'Start Live', tone: 'success', onClick: onOpenPromotion }
      : { label: quickTestActionLabel, tone: 'primary', disabled: selectedStrategy == null || runningExecution, onClick: onRunSelectedMode };

  return {
    action,
    stateLabel: surfaceMode === 'LIVE_MONITOR'
      ? (selectedRuntime ? friendlyRuntimeStatus(selectedRuntime.status).label : 'Ready For Live Monitor')
      : (selectedExecution ? describeExecutionState(selectedExecution.status) : (selectedStrategy ? friendlyStrategyStatus(selectedStrategy.status).label : 'Select A Strategy')),
    modeLabel: surfaceMode === 'LIVE_MONITOR'
      ? 'Live Monitor'
      : (tradeMode === 'BACKTEST' ? 'Quick Test · Backtest' : tradeMode === 'LIVE' ? 'Quick Test · Live' : 'Quick Test · Paper'),
    lastScan: surfaceMode === 'LIVE_MONITOR'
      ? formatLastScan(selectedRuntime?.refreshedAt ?? marketRefreshedAt)
      : formatLastScan(selectedExecution?.evaluatedAt ?? recentPaperRuns[0]?.evaluatedAt ?? marketRefreshedAt),
    openPositions: surfaceMode === 'LIVE_MONITOR'
      ? selectedRuntimePositionsCount
      : (selectedExecution?.status === 'ENTERED' ? selectedExecution.executedTrades : 0),
    mtm: surfaceMode === 'LIVE_MONITOR'
      ? (selectedRuntime?.currentMtm ?? null)
      : (selectedExecution?.result?.totalPnl ?? selectedStrategy?.latestPerformancePnl ?? recentPaperRuns[0]?.totalPnl ?? null),
    strategyName: surfaceMode === 'LIVE_MONITOR'
      ? (selectedRuntime?.strategyName ?? selectedStrategy?.strategyName ?? 'No live runtime selected')
      : (selectedStrategy?.strategyName ?? selectedExecution?.strategyName ?? 'No strategy selected'),
  };
};
