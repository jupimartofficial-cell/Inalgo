export interface IntraMarketIndexValue {
  instrumentKey: string;
  label: string;
  value?: number | null;
  valueTs?: string | null;
}

export interface IntraMarketSummary {
  marketTrend: string;
  sessionStatus: string;
  refreshedAt: string;
  stale: boolean;
  freshnessSeconds: number;
  indexValues: IntraMarketIndexValue[];
}

export type IntraRuntimeStatus = 'WAITING' | 'ENTERED' | 'PARTIAL_EXIT' | 'EXITED' | 'PAUSED' | 'ERROR';

export interface IntraRuntimeSummary {
  runtimeId: number;
  executionId: number;
  strategyId?: number | null;
  strategyName: string;
  instrument: string;
  mode: 'LIVE' | 'PAPER';
  status: IntraRuntimeStatus;
  entryTime?: string | null;
  currentSignal?: string | null;
  currentMtm: number;
  slState?: string | null;
  targetState?: string | null;
  nextExpectedAction?: string | null;
  refreshedAt: string;
  freshnessSeconds: number;
}

export interface IntraPositionSnapshot {
  positionId: number;
  runtimeId: number;
  executionId: number;
  instrument: string;
  quantityLots: number;
  entryPrice?: number | null;
  currentPrice?: number | null;
  unrealizedPnl: number;
  realizedPnl: number;
  sl?: number | null;
  target?: number | null;
  strategyName: string;
  timeInTradeSeconds: number;
  status: string;
  manualWatch: boolean;
  mode: 'LIVE' | 'PAPER';
  updatedAt: string;
}

export interface IntraEventLogItem {
  id: number;
  eventTime: string;
  eventType: string;
  severity: string;
  mode?: 'LIVE' | 'PAPER' | null;
  message: string;
  reason?: string | null;
  actor: string;
  runtimeId?: number | null;
  positionId?: number | null;
  correlationId?: string | null;
}

export interface IntraLiveActionRequest {
  confirmLiveAction: boolean;
  liveAcknowledgement: string;
  reason: string;
}

export interface IntraRuntimeActionResponse {
  status: string;
  message: string;
  runtimeId: number;
  updatedAt: string;
}

export interface IntraPositionActionResponse {
  status: string;
  message: string;
  positionId: number;
  updatedAt: string;
}

export interface IntraEmergencyActionRequest {
  action: 'SQUARE_OFF_ALL' | 'EXIT_ALL_PAPER' | 'EXIT_ALL_LIVE' | 'PAUSE_ALL' | 'RESUME_SELECTED';
  selectedRuntimeId?: number;
  confirmLiveAction?: boolean;
  liveAcknowledgement?: string;
  reason?: string;
}

export interface IntraEmergencyActionResponse {
  status: string;
  action: string;
  affectedRuntimes: number;
  affectedPositions: number;
  executedAt: string;
}
