import type { BacktestStrategyPayload } from './admin.types';

export type IntraStrategyStatus = 'DRAFT' | 'PAPER_READY' | 'LIVE_READY' | 'ARCHIVED';
export type IntraStrategySort = 'RECENT_EDITED' | 'NAME' | 'PERFORMANCE';

export interface IntraStrategyBuilderPayload {
  strategy: BacktestStrategyPayload;
  timeframeUnit: string;
  timeframeInterval: number;
  advancedMode?: boolean;
  marketSession?: string;
}

export interface IntraStrategyLibraryItem {
  id: number;
  strategyName: string;
  instrumentKey: string;
  timeframeUnit: string;
  timeframeInterval: number;
  strategyType: string;
  status: IntraStrategyStatus;
  lastModifiedAt?: string;
  creator: string;
  version: number;
  paperEligible: boolean;
  liveEligible: boolean;
  latestPerformancePnl?: number;
  latestExecutedTrades?: number;
}

export interface IntraStrategyValidationIssue {
  step: number;
  field: string;
  message: string;
}

export interface IntraStrategyValidationResult {
  valid: boolean;
  paperEligible: boolean;
  liveEligible: boolean;
  fieldErrors: IntraStrategyValidationIssue[];
  summaryErrors: string[];
  warnings: string[];
}

export interface IntraStrategyVersion {
  id: number;
  strategyId: number;
  version: number;
  advancedMode: boolean;
  timeframeUnit: string;
  timeframeInterval: number;
  strategy: BacktestStrategyPayload;
  validation: IntraStrategyValidationResult;
  createdAt?: string;
  validatedAt?: string;
}

export interface IntraStrategyDetailsResponse {
  strategy: IntraStrategyLibraryItem;
  latestVersion: IntraStrategyVersion;
}

export interface IntraStrategyLibraryResponse {
  content: IntraStrategyLibraryItem[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface IntraStrategyActionResponse {
  status: string;
  strategyId: number;
}

export interface IntraStrategyImportResult {
  backtestStrategyId: number;
  intraStrategyId?: number;
  status: string;
  message: string;
}

export interface IntraStrategyImportResponse {
  results: IntraStrategyImportResult[];
}

export interface IntraStrategyAiGenerateRequest {
  username: string;
  instrumentKey: string;
  candidateCount: number;
  lookbackDays: number;
  timeframeUnit: string;
  timeframeInterval: number;
  saveAsDrafts?: boolean;
}

export interface IntraStrategyAiBacktestSummary {
  totalPnl?: number;
  averagePnl?: number;
  executedTrades?: number;
  winTrades?: number;
  lossTrades?: number;
  realWorldAccuracyPct?: number;
  marketPricedTrades?: number;
  fallbackPricedTrades?: number;
  notes?: string[];
}

export interface IntraStrategyAiCandidate {
  rank: number;
  strategyName: string;
  templateKey: string;
  direction: string;
  rationale: string;
  strategy: BacktestStrategyPayload;
  validation: IntraStrategyValidationResult;
  backtest?: IntraStrategyAiBacktestSummary;
  trendConflict?: boolean;
  trendBias?: string;
  currentTrend?: string;
  trendReason?: string;
  selectionScore?: number;
  savedStrategyId?: number;
  notes?: string[];
}

export interface IntraStrategyAiGenerateResponse {
  instrumentKey: string;
  timeframeUnit: string;
  timeframeInterval: number;
  lookbackFromDate: string;
  lookbackToDate: string;
  latestTrendSignal: string;
  generationSource: string;
  disclaimer: string;
  recommendedRank?: number;
  candidates: IntraStrategyAiCandidate[];
}
