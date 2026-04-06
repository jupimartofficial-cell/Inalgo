import type { MarketWatchSource } from '../../api/admin.types';

export const MARKET_SCOPES = [
  { key: 'GLOBAL_NEWS', label: 'Global News' },
  { key: 'INDIA_NEWS',  label: 'India News' },
  { key: 'GIFT_NIFTY',  label: 'Gift Nifty' },
  { key: 'SP500',        label: 'S&P 500' },
] as const;

export const REFRESH_OPTIONS = [
  { value: 15,  label: '15 sec' },
  { value: 30,  label: '30 sec' },
  { value: 60,  label: '1 min' },
  { value: 120, label: '2 min' },
  { value: 300, label: '5 min' },
] as const;

export const SOURCE_META: Record<MarketWatchSource, { label: string; color: string }> = {
  TRADING_SIGNAL:   { label: 'Signal',    color: '#2563eb' },
  TRADING_PARAM:    { label: 'Day Param', color: '#ea580c' },
  MARKET_SENTIMENT: { label: 'Sentiment', color: '#0f766e' },
  CANDLE:           { label: 'Candle',    color: '#16a34a' },
};

/**
 * Fields that render as a large colored badge (categorical signals).
 * These get pill/chip treatment in the primary value position instead of plain text.
 */
export const BADGE_FIELD_KEYS = new Set([
  'signal',       // BUY / SELL / HOLD
  'trendStatus',  // BULL / BEAR / NEUTRAL
  'aiAnalysis',   // BULL / BEAR / NEUTRAL
  'gapType',      // Gap Up / Gap Down / Flat
  'orbBreakout',  // Yes / No
  'orbBreakdown', // Yes / No
]);

/**
 * Fields that contain free-form long text.
 * These are rendered in a collapsible "Analysis & Reason" section,
 * not in the main data grid.
 */
export const LONG_TEXT_FIELD_KEYS = new Set([
  'reason',      // MARKET_SENTIMENT — human-readable trend reasoning
  'aiReason',    // MARKET_SENTIMENT — AI narrative explanation
  'sourceNames', // MARKET_SENTIMENT — contributing data source names
]);

/**
 * Meaningful column options per source.
 * Excluded from all sources: id, tenantId, instrumentKey, timeframeUnit,
 * timeframeInterval, createdAt, updatedAt (audit-only).
 * Excluded from footer-duplicate fields: snapshotAt (MARKET_SENTIMENT),
 * candleTs (CANDLE) — both are already shown in the tile footer.
 */
export const FIELD_OPTIONS: Record<
  MarketWatchSource,
  Array<{ key: string; label: string; description: string }>
> = {
  TRADING_SIGNAL: [
    { key: 'signal',        label: 'Signal',         description: 'Latest BUY / SELL / HOLD trading signal' },
    { key: 'currentClose',  label: 'Current Close',  description: 'Close price on the signal date' },
    { key: 'previousClose', label: 'Previous Close', description: 'Prior session close price' },
    { key: 'dma9',          label: 'DMA 9',          description: '9-period dynamic moving average' },
    { key: 'dma26',         label: 'DMA 26',         description: '26-period dynamic moving average' },
    { key: 'dma110',        label: 'DMA 110',        description: '110-period dynamic moving average' },
    { key: 'signalDate',    label: 'Signal Date',    description: 'Calendar date the signal was generated' },
  ],

  TRADING_PARAM: [
    { key: 'gapType',      label: 'Gap Type',      description: 'Gap Up / Gap Down / Flat market open' },
    { key: 'gapPct',       label: 'Gap %',         description: "Today's open gap vs previous close (%)" },
    { key: 'orbBreakout',  label: 'ORB Breakout',  description: 'Price broke above Opening Range high' },
    { key: 'orbBreakdown', label: 'ORB Breakdown', description: 'Price broke below Opening Range low' },
    { key: 'orbHigh',      label: 'ORB High',      description: 'Opening Range Breakout upper boundary' },
    { key: 'orbLow',       label: 'ORB Low',       description: 'Opening Range Breakout lower boundary' },
    { key: 'todayOpen',    label: 'Today Open',    description: "Market open price for today's session" },
    { key: 'todayClose',   label: 'Today Close',   description: "Latest close price in today's session" },
    { key: 'prevHigh',     label: 'Prev High',     description: 'Previous session high' },
    { key: 'prevLow',      label: 'Prev Low',      description: 'Previous session low' },
    { key: 'prevClose',    label: 'Prev Close',    description: 'Previous session close price' },
    { key: 'gapUpPct',     label: 'Gap Up %',      description: 'Upside gap percentage (applicable when gap-up)' },
    { key: 'gapDownPct',   label: 'Gap Down %',    description: 'Downside gap percentage (applicable when gap-down)' },
    { key: 'tradeDate',    label: 'Trade Date',    description: 'Calendar date for this day-param record' },
  ],

  MARKET_SENTIMENT: [
    { key: 'trendStatus',   label: 'Trend',          description: 'BULL / BEAR / NEUTRAL overall trend status' },
    { key: 'currentValue',  label: 'Current Value',  description: 'Latest index or spot value tracked' },
    { key: 'ema9',          label: 'EMA 9',          description: '9-period EMA of the tracked index' },
    { key: 'ema21',         label: 'EMA 21',         description: '21-period EMA of the tracked index' },
    { key: 'ema110',        label: 'EMA 110',        description: '110-period EMA of the tracked index' },
    { key: 'aiAnalysis',    label: 'AI Trend',       description: 'AI-derived BULL / BEAR / NEUTRAL signal' },
    { key: 'aiConfidence',  label: 'AI Confidence',  description: 'AI signal confidence score (0–100%)' },
    { key: 'sourceCount',   label: 'Sources',        description: 'Number of data sources evaluated' },
    { key: 'evidenceCount', label: 'Evidence',       description: 'Count of supporting evidence items' },
    { key: 'dataAsOf',      label: 'Data As Of',     description: 'Timestamp when underlying data was collected' },
    // Long-text fields — rendered in collapsible Analysis block, not the data grid
    { key: 'reason',        label: 'Reason',         description: 'Human-readable trend reasoning (long text)' },
    { key: 'aiReason',      label: 'AI Reason',      description: 'AI analysis narrative explanation (long text)' },
    { key: 'sourceNames',   label: 'Sources Detail', description: 'Names of contributing data sources (long text)' },
  ],

  CANDLE: [
    { key: 'closePrice', label: 'Close',  description: 'Most recent close price of the candle' },
    { key: 'openPrice',  label: 'Open',   description: 'Opening price of the candle period' },
    { key: 'highPrice',  label: 'High',   description: 'Highest price reached in the candle period' },
    { key: 'lowPrice',   label: 'Low',    description: 'Lowest price reached in the candle period' },
    { key: 'volume',     label: 'Volume', description: 'Total trade volume for the candle period' },
  ],
};

export const DEFAULT_PRIMARY_FIELD: Record<MarketWatchSource, string> = {
  TRADING_SIGNAL:   'signal',
  TRADING_PARAM:    'gapType',
  MARKET_SENTIMENT: 'trendStatus',
  CANDLE:           'closePrice',
};
