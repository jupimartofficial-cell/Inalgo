export interface IntraPnlSummary {
  totalPnl: number;
  todayPnl: number;
  realizedPnl: number;
  unrealizedPnl: number;
  winRate: number;
  avgGain: number;
  avgLoss: number;
  maxDrawdown: number;
}

export interface IntraPnlChartPoint {
  date: string;
  value: number;
  mode: 'LIVE' | 'PAPER';
}

export interface IntraStrategyPerformanceRow {
  strategyName: string;
  numberOfTrades: number;
  winRate: number;
  totalPnl: number;
  avgTrade: number;
  maxWin: number;
  maxLoss: number;
  drawdown: number;
  paperTrades: number;
  liveTrades: number;
}

export interface IntraTradeLedgerRow {
  executionId: number;
  date: string;
  time: string;
  instrument: string;
  strategy: string;
  tradeMode: 'LIVE' | 'PAPER';
  entry?: number | null;
  exit?: number | null;
  quantity: number;
  pnl: number;
  exitReason: string;
  duration: string;
  status: 'OPEN' | 'CLOSED';
  account: string;
}

export interface IntraPnlDashboard {
  summary: IntraPnlSummary;
  dailyTrend: IntraPnlChartPoint[];
  cumulative: IntraPnlChartPoint[];
  strategyPerformance: IntraStrategyPerformanceRow[];
  tradeLedger: IntraTradeLedgerRow[];
}

// ─── Upstox live portfolio ────────────────────────────────────────────────────

export interface UpstoxPositionItem {
  instrumentToken: string;
  tradingSymbol: string;
  netQuantity: number;
  avgBuyPrice: number | null;
  avgSellPrice: number | null;
  ltp: number | null;
  pnl: number | null;
}

export interface UpstoxOrderItem {
  orderId: string;
  instrumentToken: string;
  tradingSymbol: string | null;
  transactionType: string;
  quantity: number;
  filledQuantity: number;
  orderType: string;
  limitPrice: number | null;
  averagePrice: number | null;
  tag: string;
  status: string;
  message: string;
}

export interface UpstoxPositionsResponse {
  tenantId: string;
  positions: UpstoxPositionItem[];
  count: number;
}

export interface UpstoxOrdersResponse {
  tenantId: string;
  orders: UpstoxOrderItem[];
  count: number;
}
