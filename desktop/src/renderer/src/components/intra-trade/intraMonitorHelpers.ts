import type { BacktestStrategyPayload, IntraMarketSummary, IntraStrategyLibraryItem, IntraTradeExecutionSummary } from '../../api/admin';
import type { IntraPromotionChecklistItem } from './IntraMonitorTraderView';

export const ACTIVE_RUNTIME_STATUSES = new Set(['WAITING', 'ENTERED', 'PARTIAL_EXIT', 'ERROR']);

export const describeExecutionState = (status?: string | null) => {
  switch (status) {
    case 'WAITING_ENTRY':
      return 'Waiting Entry';
    case 'ENTERED':
      return 'Paper Running';
    case 'EXITED':
      return 'Paper Exited';
    case 'COMPLETED':
      return 'Backtest Completed';
    case 'FAILED':
      return 'Run Failed';
    default:
      return 'Ready To Test';
  }
};

export const formatLastScan = (value?: string | null) => {
  if (!value) return 'No scan yet';
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
};

export const createPromotionChecklist = ({
  marketSummary,
  selectedStrategy,
  strategy,
  recentPaperRuns,
}: {
  marketSummary: IntraMarketSummary | null;
  selectedStrategy: IntraStrategyLibraryItem | null;
  strategy: BacktestStrategyPayload;
  recentPaperRuns: IntraTradeExecutionSummary[];
}): IntraPromotionChecklistItem[] => {
  const latestPaperRun = recentPaperRuns[0] ?? null;
  const riskConfigured = Boolean(
    strategy.overallSettings?.stopLossEnabled
    || strategy.overallSettings?.targetEnabled
    || strategy.overallSettings?.trailingEnabled,
  );
  const marketStale = marketSummary?.stale ?? true;
  return [
    {
      label: 'Market open',
      passed: marketSummary?.sessionStatus === 'Open',
      helper: marketSummary?.sessionStatus === 'Open' ? 'India market session is open.' : 'Wait for the India market session to open.',
    },
    {
      label: 'Signal freshness',
      passed: !marketStale,
      helper: marketStale ? 'Market summary is stale. Refresh before promotion.' : 'Market data is fresh enough for promotion.',
    },
    {
      label: 'Strategy validated',
      passed: selectedStrategy?.liveEligible === true && selectedStrategy?.status === 'LIVE_READY',
      helper: selectedStrategy?.liveEligible === true && selectedStrategy?.status === 'LIVE_READY'
        ? 'Strategy is published for live execution.'
        : 'Publish the strategy to LIVE_READY first.',
    },
    {
      label: 'Risk limits set',
      passed: riskConfigured,
      helper: riskConfigured
        ? 'Stop loss, target, or trailing controls are configured.'
        : 'Add stop loss, target, or trailing protection before promotion.',
    },
    {
      label: 'Recent paper run',
      passed: latestPaperRun != null,
      helper: latestPaperRun ? 'Latest paper run recorded at ' + formatLastScan(latestPaperRun.evaluatedAt) + '.' : 'Run at least one paper validation first.',
    },
  ];
};
