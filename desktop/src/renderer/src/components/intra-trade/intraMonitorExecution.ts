import {
  checkIntraTradeTrend,
  refreshIntraTradeExecution,
  runIntraTradeExecution,
  updateIntraTradeExecution,
  type BacktestStrategyPayload,
  type IntraTradeExecutionResponse,
  type IntraTradeMode,
  type IntraTradeRunPayload,
} from '../../api/admin';

export const buildIntraRunPayload = ({
  mode,
  username,
  strategyId,
  scanInstrumentKey,
  scanTimeframeKey,
  strategy,
}: {
  mode: IntraTradeMode;
  username: string;
  strategyId: number | null;
  scanInstrumentKey: string;
  scanTimeframeKey: string;
  strategy: BacktestStrategyPayload;
}): IntraTradeRunPayload | null => {
  if (strategy.strategyName.trim().length === 0) {
    return null;
  }
  const split = scanTimeframeKey.split('|');
  const scanTimeframeUnit = split[0];
  const scanTimeframeInterval = Number(split[1]);
  if (!scanTimeframeUnit || Number.isFinite(scanTimeframeInterval) === false) {
    return null;
  }
  return {
    username,
    strategyId,
    mode,
    scanInstrumentKey,
    scanTimeframeUnit,
    scanTimeframeInterval,
    strategy: {
      ...strategy,
      underlyingKey: scanInstrumentKey,
      strategyType: mode === 'BACKTEST' ? strategy.strategyType : 'INTRADAY',
    },
  } as IntraTradeRunPayload;
};

export const executeIntraRun = async ({
  tenantId,
  token,
  payload,
  editingExecutionId,
}: {
  tenantId: string;
  token: string;
  payload: IntraTradeRunPayload;
  editingExecutionId: number | null;
}): Promise<IntraTradeExecutionResponse | null> => {
  if (payload.mode !== 'BACKTEST') {
    const warning = await checkIntraTradeTrend(tenantId, token, payload);
    if (warning.hasConflict && !window.confirm(warning.message + '\n\nContinue with execution?')) {
      return null;
    }
  }
  return editingExecutionId == null
    ? runIntraTradeExecution(tenantId, token, payload)
    : updateIntraTradeExecution(tenantId, token, editingExecutionId, payload);
};

export const reloadExecutionSnapshot = (
  tenantId: string,
  token: string,
  executionId: number,
  username: string,
) => refreshIntraTradeExecution(tenantId, token, executionId, username);
