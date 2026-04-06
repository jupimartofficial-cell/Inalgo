export interface InstrumentDto {
  key: string;
  label: string;
  exchange: string;
  contractName?: string;
  expiryDate?: string;
  futures: boolean;
}

export interface MigrationStatus {
  instrumentKey: string;
  timeframeUnit: string;
  timeframeInterval: number;
  nextFromDate: string;
  completed: boolean;
  lastRunStatus: string;
  lastError?: string;
  lastRunAt?: string;
  updatedAt?: string;
}

export interface MigrationJob {
  instrumentKey: string;
  timeframeUnit: string;
  timeframeInterval: number;
  jobType?: string;
  bootstrapFromDate: string;
  status: string;
  progressPercent: number;
  lastError?: string;
  nextFromDate?: string;
  updatedAt?: string;
}

export interface AdminTrigger {
  id: number;
  jobKey: string;
  instrumentKey: string;
  timeframeUnit?: string;
  timeframeInterval?: number;
  eventSource: string;
  triggerType: string;
  intervalValue?: number;
  scheduledAt?: string;
  bootstrapFromDate?: string;
  status: string;
  lastRunStatus: string;
  lastError?: string;
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt?: string;
  updatedAt?: string;
  tabGroup?: string;
  jobNatureKey?: string;
  jobNatureLabel?: string;
  oneTime?: boolean;
}

export interface TriggerFacetOption {
  value: string;
  label: string;
  count: number;
}

export interface TriggerTimeframeFacetOption {
  value: string;
  label: string;
  timeframeUnit?: string;
  timeframeInterval?: number;
  count: number;
}

export interface TriggerBrowserSummary {
  totalInTab: number;
  filteredTotal: number;
  runningCount: number;
  pausedCount: number;
  failedCount: number;
  oneTimeCount: number;
  attentionCount: number;
}

export interface TriggerBrowserResponse {
  items: AdminTrigger[];
  totalElements: number;
  page: number;
  size: number;
  tabs: TriggerFacetOption[];
  instruments: TriggerFacetOption[];
  timeframes: TriggerTimeframeFacetOption[];
  jobNatures: TriggerFacetOption[];
  summary: TriggerBrowserSummary;
}

export interface UpstoxTokenStatus {
  configured: boolean;
  updatedAt?: string;
}

export interface OpenAiTokenStatus {
  configured: boolean;
  updatedAt?: string;
  model: string;
  enabled: boolean;
}

export interface TradingChartPreference {
  id: string;
  instrumentKey: string;
  timeframeUnit: string;
  timeframeInterval: number;
  lookbackDays: number;
  height: number;
  layout: 'split' | 'wide' | 'full';
}

export interface TradingTabPreference {
  name: string;
  charts: TradingChartPreference[];
}

export interface TradingPreferencesPayload {
  activeTabIndex: number;
  tabs: TradingTabPreference[];
}

export interface TradingPreferencesResponse {
  username: string;
  preferences: TradingPreferencesPayload | null;
  updatedAt?: string;
}

export interface TradingSignalRow {
  id: number;
  instrumentKey: string;
  timeframeUnit: string;
  timeframeInterval: number;
  signalDate: string;
  previousClose?: number;
  currentClose?: number;
  dma9?: number;
  dma26?: number;
  dma110?: number;
  signal: string;
  firstCandleColor?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TradingDayParamRow {
  id: number;
  tradeDate: string;
  instrumentKey: string;
  orbHigh?: number;
  orbLow?: number;
  orbBreakout: string;
  orbBreakdown: string;
  todayOpen?: number;
  todayClose?: number;
  prevHigh?: number;
  prevLow?: number;
  prevClose?: number;
  gapPct?: number;
  gapType?: string;
  gapUpPct?: number;
  gapDownPct?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface MarketSentimentRow {
  id: number;
  marketScope: string;
  marketName: string;
  evaluationType: string;
  trendStatus: string;
  reason: string;
  currentValue?: number;
  ema9?: number;
  ema21?: number;
  ema110?: number;
  sourceCount: number;
  evidenceCount: number;
  sourceNames?: string;
  dataAsOf?: string;
  aiAnalysis?: string;
  aiReason?: string;
  aiConfidence?: number;
  aiModel?: string;
  aiUpdatedAt?: string;
  snapshotAt: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface NewsFeedArticlePreview {
  sourceName: string;
  title: string;
  publishedAt?: string;
  included: boolean;
  excludeReason?: string;
  score: number;
  tags: string[];
  link: string;
}

export interface NewsFeedSourcePreview {
  name: string;
  url: string;
  status: 'OK' | 'ERROR';
  error?: string;
  totalFetched: number;
  includedCount: number;
  articles: NewsFeedArticlePreview[];
}

export interface NewsFeedPreviewResponse {
  scope: string;
  fetchedAt: string;
  cutoff: string;
  newsLookbackHours: number;
  webSearchMode: boolean;
  feeds: NewsFeedSourcePreview[];
}

export interface MarketSentimentRefreshResponse {
  scopesUpdated: number;
  refreshedAt: string;
}

export interface BacktestLegPayload {
  id: string;
  segment: 'OPTIONS' | 'FUTURES';
  lots: number;
  position: 'BUY' | 'SELL';
  optionType?: 'CALL' | 'PUT';
  expiryType: 'WEEKLY' | 'MONTHLY';
  strikeType: 'ATM' | 'ITM' | 'OTM';
  strikeSteps: number;
  /** Per-leg entry/exit conditions. Stored in strategy JSON and applied by backtest engine. */
  legConditions?: BacktestAdvancedConditionsPayload;
}

// ─── Intra Trade Orders ────────────────────────────────────────────────────────

export interface IntraOrderPlaceRequest {
  instrumentToken: string;
  transactionType: 'BUY' | 'SELL';
  quantity: number;
  orderType?: 'MARKET' | 'LIMIT';
  limitPrice?: number;
  tag?: string;
  executionId?: string;
}

export interface IntraOrderResult {
  orderId: string;
  instrumentToken: string;
  transactionType: string;
  quantity: number;
  orderType: string;
  limitPrice?: number;
  tag?: string;
  status: string;
  message: string;
}

export interface IntraOrdersResponse {
  tenantId: string;
  orders: IntraOrderResult[];
  count: number;
}

export interface IntraPositionSummary {
  instrumentToken: string;
  tradingSymbol: string;
  netQuantity: number;
  avgBuyPrice?: number;
  avgSellPrice?: number;
  ltp?: number;
  pnl?: number;
}

export interface IntraPositionsResponse {
  tenantId: string;
  positions: IntraPositionSummary[];
  count: number;
}

export interface BacktestLegwiseSettingsPayload {
  squareOffMode: 'PARTIAL' | 'COMPLETE';
  trailSlToBreakEven: boolean;
  trailScope: 'ALL_LEGS' | 'SL_LEGS';
  noReEntryAfterEnabled: boolean;
  noReEntryAfterTime?: string;
  overallMomentumEnabled: boolean;
  overallMomentumMode?: string;
  overallMomentumValue?: number;
}

export interface BacktestOverallSettingsPayload {
  stopLossEnabled: boolean;
  stopLossMode?: string;
  stopLossValue?: number;
  targetEnabled: boolean;
  targetMode?: string;
  targetValue?: number;
  trailingEnabled: boolean;
  trailingMode?: string;
  trailingTrigger?: number;
  trailingLockProfit?: number;
}

export type BacktestConditionComparator =
  | 'EQUAL_TO'
  | 'HIGHER_THAN'
  | 'HIGHER_THAN_EQUAL_TO'
  | 'LOWER_THAN'
  | 'LOWER_THAN_EQUAL_TO'
  | 'CROSSES_ABOVE'
  | 'CROSSES_BELOW'
  | 'UP_BY'
  | 'DOWN_BY';

export type BacktestConditionOperandPayload =
  | {
      kind: 'FIELD';
      source: 'TRADING_SIGNAL' | 'TRADING_DAY_PARAM';
      field: string;
      value?: undefined;
      valueType?: undefined;
    }
  | {
      kind: 'VALUE';
      source?: undefined;
      field?: undefined;
      value: string;
      valueType: 'NUMBER' | 'STRING' | 'BOOLEAN' | 'DATE';
    };

export interface BacktestConditionRulePayload {
  timeframeUnit: string;
  timeframeInterval: number;
  left: BacktestConditionOperandPayload;
  comparator: BacktestConditionComparator;
  right: BacktestConditionOperandPayload;
}

export interface BacktestConditionNodePayload {
  rule?: BacktestConditionRulePayload;
  group?: BacktestConditionGroupPayload;
}

export interface BacktestConditionGroupPayload {
  operator: 'AND' | 'OR';
  items: BacktestConditionNodePayload[];
}

export interface BacktestAdvancedConditionsPayload {
  enabled: boolean;
  entry?: BacktestConditionGroupPayload | null;
  exit?: BacktestConditionGroupPayload | null;
}

export interface BacktestStrategyPayload {
  strategyName: string;
  underlyingKey: string;
  underlyingSource: 'CASH' | 'FUTURES';
  strategyType: 'INTRADAY' | 'BTST' | 'POSITIONAL';
  entryTime: string;
  exitTime: string;
  startDate: string;
  endDate: string;
  legs: BacktestLegPayload[];
  legwiseSettings: BacktestLegwiseSettingsPayload;
  overallSettings: BacktestOverallSettingsPayload;
  advancedConditions?: BacktestAdvancedConditionsPayload;
}

export interface BacktestLegResult {
  legId: string;
  legLabel: string;
  instrumentKey: string;
  expiryDate?: string;
  strikePrice?: number;
  lotSize: number;
  lots: number;
  entryPrice: number;
  exitPrice: number;
  pnlAmount: number;
}

export interface BacktestResultRow {
  tradeDate: string;
  exitDate: string;
  expiryLabel: string;
  entryTs: string;
  exitTs: string;
  entryUnderlyingPrice: number;
  exitUnderlyingPrice: number;
  pnlAmount: number;
  legsSummary: string;
  legs: BacktestLegResult[];
}

export interface BacktestRunResponse {
  strategy: BacktestStrategyPayload;
  rows: BacktestResultRow[];
  totalPnl: number;
  averagePnl: number;
  executedTrades: number;
  winTrades: number;
  lossTrades: number;
  syncedInstruments: number;
  syncedCandles: number;
  realWorldAccuracyPct: number;
  marketPricedTrades: number;
  fallbackPricedTrades: number;
  notes: string[];
}

export interface BacktestStrategyResponse {
  id: number;
  username: string;
  strategyName: string;
  underlyingKey: string;
  underlyingSource: 'CASH' | 'FUTURES';
  strategyType: 'INTRADAY' | 'BTST' | 'POSITIONAL';
  startDate: string;
  endDate: string;
  entryTime: string;
  exitTime: string;
  legsCount: number;
  strategy: BacktestStrategyPayload;
  createdAt?: string;
  updatedAt?: string;
}

export interface Candle {
  instrumentKey: string;
  timeframeUnit: string;
  timeframeInterval: number;
  candleTs: string;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  closePrice: number;
  volume?: number;
}

export interface OptionChainRow {
  strikePrice: number;
  callInstrumentKey?: string;
  callLtp?: number;
  callOi?: number;
  callPrevOi?: number;
  callVolume?: number;
  callIv?: number;
  callOiChangePercent?: number;
  putInstrumentKey?: string;
  putLtp?: number;
  putOi?: number;
  putPrevOi?: number;
  putVolume?: number;
  putIv?: number;
  putOiChangePercent?: number;
}

export interface OptionChainSnapshot {
  underlyingKey: string;
  expiryDate: string;
  snapshotTs?: string;
  underlyingSpotPrice?: number;
  pcr?: number;
  syntheticFuturePrice?: number;
  rows: OptionChainRow[];
}

export interface OptionChainExpiriesResponse {
  underlyingKey: string;
  expiries: string[];
}

export interface OptionChainRefreshResult {
  underlyingKey: string;
  processedExpiries: number;
  persistedRows: number;
  failedExpiries: number;
  errors: string[];
}

export interface OptionChainRefreshResponse {
  results: OptionChainRefreshResult[];
}

// ─── Market Watch ─────────────────────────────────────────────────────────────

export type MarketWatchSource = 'TRADING_SIGNAL' | 'TRADING_PARAM' | 'MARKET_SENTIMENT' | 'CANDLE';

export interface MarketWatchGroup {
  id: string;
  name: string;
}

export interface MarketWatchTileConfig {
  id: string;
  title: string;
  source: MarketWatchSource;
  instrumentKey?: string;
  timeframeUnit?: string;
  timeframeInterval?: number;
  marketScope?: string;
  primaryField?: string;
  groupId?: string;
}

export interface MarketWatchLayoutConfig {
  refreshIntervalSeconds: number;
  gridColumns: 1 | 2 | 3 | 4;
  tiles: MarketWatchTileConfig[];
  groups?: MarketWatchGroup[];
}

export interface MarketWatchTileResult {
  tileId: string;
  source: MarketWatchSource;
  primaryField?: string;
  primaryLabel: string;
  primaryValue: string;
  statusLabel: string;
  statusTone: string;
  updatedAt?: string | null;
  fields: Array<{
    key: string;
    label: string;
    value: string;
    tone?: string | null;
  }>;
}

export interface MarketWatchDataResponse {
  tiles: MarketWatchTileResult[];
  fetchedAt: string;
}

export interface MarketWatchConfigResponse {
  username: string;
  config: MarketWatchLayoutConfig | null;
  updatedAt?: string;
}

// ─── Trend accuracy ────────────────────────────────────────────────────────────

export interface DailyAccuracyRow {
  tradeDate: string;
  predictedTrend: string | null;
  aiPrediction: string | null;
  avgConfidence: number;
  snapCount: number;
  startPrice: number;
  endPrice: number;
  changePct: number;
  actualDirection: string;
  trendCorrect: boolean;
  aiCorrect: boolean;
}

export interface WindowAccuracy {
  windowKey: string;
  windowLabel: string;
  referencePeriod: string;
  snapshotDays: number;
  totalDays: number;
  trendCorrect: number;
  trendAccuracyPct: number;
  aiCorrect: number;
  aiAccuracyPct: number;
  trendBullPrecision: number | null;
  trendBearPrecision: number | null;
  aiBullPrecision: number | null;
  aiBearPrecision: number | null;
  dailyRows: DailyAccuracyRow[];
}

export interface ScopeAccuracy {
  scope: string;
  benchmark: string;
  snapshotDays: number;
  totalDays: number;
  trendCorrect: number;
  trendAccuracyPct: number;
  aiCorrect: number;
  aiAccuracyPct: number;
  trendBullPrecision: number | null;
  trendBearPrecision: number | null;
  aiBullPrecision: number | null;
  aiBearPrecision: number | null;
  dailyRows: DailyAccuracyRow[];
  windows: WindowAccuracy[];
}

export interface TrendAccuracyReport {
  computedAt: string;
  lookbackDays: number;
  candleIntervalMinutes: number;
  indiaNews: ScopeAccuracy;
  globalNews: ScopeAccuracy;
}
