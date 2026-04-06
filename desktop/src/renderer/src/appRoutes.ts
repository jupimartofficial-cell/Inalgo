import type {
  BacktestSubSection,
  IntraSubSection,
  MarketSignalsSubSection,
  NavSection,
  TradingDeskSubSection,
} from './components/AppShellShared';

export interface AppRouteState {
  section: NavSection;
  intraSubSection: IntraSubSection;
  backtestSubSection: BacktestSubSection;
  marketSignalsSubSection: MarketSignalsSubSection;
  tradingDeskSubSection: TradingDeskSubSection;
}

const KNOWN_APP_PATHS = new Set([
  '/',
  '/migration',
  '/triggers',
  '/history',
  '/option-chain',
  '/trading-window',
  '/trading-scripts',
  '/backtest/pnl',
  '/backtest/strategy-list',
  '/intra/strategies',
  '/intra/monitor',
  '/intra/pnl',
  '/market-signals/market-watch',
  '/market-signals/trading-signal',
  '/market-signals/market-trend',
  '/market-signals/trading-param',
  '/trading-desk/advanced',
]);

const DEFAULT_ROUTE_STATE: AppRouteState = {
  section: 'dashboard',
  intraSubSection: 'intra-monitor',
  backtestSubSection: 'pnl',
  marketSignalsSubSection: 'trading-param',
  tradingDeskSubSection: 'advanced-trading',
};

export const resolveAppRoute = (pathname: string): AppRouteState => {
  if (pathname === '/migration') {
    return { ...DEFAULT_ROUTE_STATE, section: 'migration' };
  }
  if (pathname === '/triggers') {
    return { ...DEFAULT_ROUTE_STATE, section: 'triggers' };
  }
  if (pathname === '/history') {
    return { ...DEFAULT_ROUTE_STATE, section: 'history' };
  }
  if (pathname === '/option-chain') {
    return { ...DEFAULT_ROUTE_STATE, section: 'optionchain' };
  }
  if (pathname === '/trading-window') {
    return { ...DEFAULT_ROUTE_STATE, section: 'trading' };
  }
  if (pathname === '/trading-scripts') {
    return { ...DEFAULT_ROUTE_STATE, section: 'trading-scripts' };
  }
  if (pathname === '/backtest/strategy-list') {
    return { ...DEFAULT_ROUTE_STATE, section: 'backtest', backtestSubSection: 'strategy-list' };
  }
  if (pathname === '/intra/strategies') {
    return { ...DEFAULT_ROUTE_STATE, section: 'intra', intraSubSection: 'intra-strategies' };
  }
  if (pathname === '/intra/monitor') {
    return { ...DEFAULT_ROUTE_STATE, section: 'intra', intraSubSection: 'intra-monitor' };
  }
  if (pathname === '/intra/pnl') {
    return { ...DEFAULT_ROUTE_STATE, section: 'intra', intraSubSection: 'intra-pnl' };
  }
  if (pathname === '/market-signals/market-watch') {
    return { ...DEFAULT_ROUTE_STATE, section: 'market-signals', marketSignalsSubSection: 'market-watch' };
  }
  if (pathname === '/market-signals/trading-signal') {
    return { ...DEFAULT_ROUTE_STATE, section: 'market-signals', marketSignalsSubSection: 'trading-signal' };
  }
  if (pathname === '/market-signals/market-trend') {
    return { ...DEFAULT_ROUTE_STATE, section: 'market-signals', marketSignalsSubSection: 'market-trend' };
  }
  if (pathname === '/market-signals/trading-param') {
    return { ...DEFAULT_ROUTE_STATE, section: 'market-signals', marketSignalsSubSection: 'trading-param' };
  }
  if (pathname === '/backtest/pnl') {
    return { ...DEFAULT_ROUTE_STATE, section: 'backtest', backtestSubSection: 'pnl' };
  }
  if (pathname === '/trading-desk/advanced') {
    return { ...DEFAULT_ROUTE_STATE, section: 'trading-desk', tradingDeskSubSection: 'advanced-trading' };
  }
  return DEFAULT_ROUTE_STATE;
};

export const isKnownAppPath = (pathname: string) => KNOWN_APP_PATHS.has(pathname);

export const resolvePreferredAppPath = (pathname: string, hash?: string) => {
  if (hash?.startsWith('#/')) {
    const hashPath = hash.slice(1);
    if (isKnownAppPath(hashPath)) {
      return hashPath;
    }
  }
  return isKnownAppPath(pathname) ? pathname : '/';
};

export const buildSectionPath = (
  section: NavSection,
  intraSubSection: IntraSubSection,
  backtestSubSection: BacktestSubSection,
  marketSignalsSubSection: MarketSignalsSubSection,
  tradingDeskSubSection?: TradingDeskSubSection,
) => {
  if (section === 'migration') return '/migration';
  if (section === 'triggers') return '/triggers';
  if (section === 'history') return '/history';
  if (section === 'optionchain') return '/option-chain';
  if (section === 'trading') return '/trading-window';
  if (section === 'trading-scripts') return '/trading-scripts';
  if (section === 'intra') {
    if (intraSubSection === 'intra-strategies') return '/intra/strategies';
    if (intraSubSection === 'intra-pnl') return '/intra/pnl';
    return '/intra/monitor';
  }
  if (section === 'backtest') {
    if (backtestSubSection === 'strategy-list') return '/backtest/strategy-list';
    return '/backtest/pnl';
  }
  if (section === 'market-signals') {
    if (marketSignalsSubSection === 'market-watch') return '/market-signals/market-watch';
    if (marketSignalsSubSection === 'trading-signal') return '/market-signals/trading-signal';
    if (marketSignalsSubSection === 'market-trend') return '/market-signals/market-trend';
    return '/market-signals/trading-param';
  }
  if (section === 'trading-desk') {
    return '/trading-desk/advanced';
  }
  return '/';
};
