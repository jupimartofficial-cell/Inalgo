import type { BacktestRunResponse, BacktestStrategyPayload } from './admin.types';

export type TradingScriptStatus = 'DRAFT' | 'COMPILED' | 'PAPER_READY' | 'LIVE_READY' | 'ARCHIVED';
export type TradingScriptCompileStatus = 'PENDING' | 'SUCCESS' | 'FAILED';
export type TradingScriptSort = 'RECENT_EDITED' | 'NAME' | 'PERFORMANCE';

export interface TradingScriptBuilderPayload {
  sourceJs: string;
}

export interface TradingScriptDiagnostic {
  severity?: string;
  code?: string;
  message: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
}

export interface TradingScriptInputDescriptor {
  key: string;
  label?: string;
  type?: string;
  defaultValue?: unknown;
  required?: boolean;
  description?: string;
}

export interface TradingScriptMeta {
  name?: string;
  instrumentKey?: string;
  timeframeUnit?: string;
  timeframeInterval?: number;
  strategyType?: string;
  marketSession?: string;
}

export interface TradingScriptCompiledArtifact {
  meta: TradingScriptMeta;
  inputs: TradingScriptInputDescriptor[];
  compiledStrategy: BacktestStrategyPayload;
  imports: string[];
  notes: string[];
  runtimeHints: Record<string, unknown>;
  sourceHash?: string;
}

export interface TradingScriptCompileResponse {
  compileStatus: TradingScriptCompileStatus;
  valid: boolean;
  paperEligible: boolean;
  liveEligible: boolean;
  diagnostics: TradingScriptDiagnostic[];
  artifact?: TradingScriptCompiledArtifact | null;
  warnings: string[];
}

export interface TradingScriptBacktestSummary {
  totalPnl?: number;
  averagePnl?: number;
  executedTrades?: number;
  winTrades?: number;
  lossTrades?: number;
  realWorldAccuracyPct?: number;
  marketPricedTrades?: number;
  fallbackPricedTrades?: number;
  evaluatedAt?: string;
  notes: string[];
}

export interface TradingScriptLibraryItem {
  id: number;
  scriptName: string;
  instrumentKey: string;
  timeframeUnit: string;
  timeframeInterval: number;
  strategyType: string;
  status: TradingScriptStatus;
  compileStatus: TradingScriptCompileStatus;
  lastModifiedAt?: string;
  creator: string;
  version: number;
  paperEligible: boolean;
  liveEligible: boolean;
  latestPerformancePnl?: number;
  latestExecutedTrades?: number;
  latestRealWorldAccuracyPct?: number;
}

export interface TradingScriptVersion {
  id: number;
  scriptId: number;
  version: number;
  sourceJs: string;
  compile: TradingScriptCompileResponse;
  createdAt?: string;
  compiledAt?: string;
}

export interface TradingScriptDetailsResponse {
  script: TradingScriptLibraryItem;
  latestVersion: TradingScriptVersion;
  latestBacktest?: TradingScriptBacktestSummary | null;
}

export interface TradingScriptLibraryResponse {
  content: TradingScriptLibraryItem[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface TradingScriptActionResponse {
  status: string;
  scriptId: number;
}

export interface TradingScriptBacktestResponse {
  summary: TradingScriptBacktestSummary;
  result: BacktestRunResponse;
}
