import type { BacktestRunResponse, BacktestStrategyPayload } from './admin.types';

export type IntraTradeMode = 'LIVE' | 'PAPER' | 'BACKTEST';
export type IntraTradeStatus = 'WAITING_ENTRY' | 'ENTERED' | 'EXITED' | 'COMPLETED' | 'FAILED';

export interface IntraTradeExecutionSummary {
  id: number;
  username: string;
  strategyId?: number | null;
  mode: IntraTradeMode;
  status: IntraTradeStatus;
  strategyName: string;
  scanInstrumentKey: string;
  scanTimeframeUnit: string;
  scanTimeframeInterval: number;
  totalPnl: number;
  executedTrades: number;
  evaluatedAt?: string;
  statusMessage?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface IntraTradeExecutionResponse extends IntraTradeExecutionSummary {
  strategy: BacktestStrategyPayload;
  result: BacktestRunResponse;
}

export interface IntraTradeTrendCheckResponse {
  hasConflict: boolean;
  strategyBias: string;
  currentTrend: string;
  message: string;
}

export interface IntraTradeRunPayload {
  username: string;
  strategyId?: number | null;
  mode: IntraTradeMode;
  scanInstrumentKey: string;
  scanTimeframeUnit: string;
  scanTimeframeInterval: number;
  strategy: BacktestStrategyPayload;
}

export interface IntraTradeDeleteResponse {
  status: string;
  id: number;
}
