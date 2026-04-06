import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import type {
  BacktestStrategyPayload,
  IntraTradeExecutionResponse,
  IntraTradeMode,
} from '../../api/admin';
import {
  createDefaultStrategy,
  normalizeStrategyForMvp,
  type InstrumentOption,
} from '../BacktestPanelShared';
import type { TimeframeOption } from '../backtestAdvancedConditionUtils';
import { toTimeframeKey } from './IntraTradeShared';

interface IntraWorkspaceContextValue {
  baseInstruments: InstrumentOption[];
  baseTimeframes: TimeframeOption[];
  workspaceLabel: string;
  tradeMode: IntraTradeMode;
  setTradeMode: Dispatch<SetStateAction<IntraTradeMode>>;
  brokerExchangeLabel: string;
  timezoneLabel: string;
  marketSessionLabel: string;
  scanInstrumentKey: string;
  setScanInstrumentKey: Dispatch<SetStateAction<string>>;
  scanTimeframeKey: string;
  setScanTimeframeKey: Dispatch<SetStateAction<string>>;
  strategyId: number | null;
  setStrategyId: Dispatch<SetStateAction<number | null>>;
  strategy: BacktestStrategyPayload;
  setStrategy: Dispatch<SetStateAction<BacktestStrategyPayload>>;
  editingExecutionId: number | null;
  setEditingExecutionId: Dispatch<SetStateAction<number | null>>;
  selectedExecution: IntraTradeExecutionResponse | null;
  setSelectedExecution: Dispatch<SetStateAction<IntraTradeExecutionResponse | null>>;
  loadStrategyIntoWorkspace: (strategyId: number | null, strategyPayload: BacktestStrategyPayload) => void;
  loadExecutionIntoWorkspace: (execution: IntraTradeExecutionResponse) => void;
  resetWorkspace: () => void;
}

const IntraWorkspaceContext = createContext<IntraWorkspaceContextValue | null>(null);

interface PersistedIntraWorkspace {
  tradeMode: IntraTradeMode;
  scanInstrumentKey: string;
  scanTimeframeKey: string;
  strategyId: number | null;
  strategy: BacktestStrategyPayload;
  editingExecutionId: number | null;
  selectedExecution: IntraTradeExecutionResponse | null;
}

const buildStorageKey = (tenantId: string, username: string) =>
  `inalgo_intra_workspace_v1:${tenantId}:${username}`;

const getExchangeLabel = (instrumentKey: string, instruments: InstrumentOption[]) => {
  const label = instruments.find((item) => item.key === instrumentKey)?.label ?? instrumentKey;
  if (instrumentKey.startsWith('BSE_')) return `BSE · ${label}`;
  if (instrumentKey.startsWith('NSE_')) return `NSE · ${label}`;
  return label;
};

const computeMarketSessionLabel = () => {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const weekday = parts.find((part) => part.type === 'weekday')?.value ?? '';
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');
  const totalMinutes = (hour * 60) + minute;
  const isBusinessDay = weekday !== 'Sat' && weekday !== 'Sun';
  const isOpen = isBusinessDay && totalMinutes >= (9 * 60) + 15 && totalMinutes <= (15 * 60) + 30;
  return isOpen ? 'India Market Open · 09:15-15:30 IST' : 'India Market Closed · 09:15-15:30 IST';
};

export const IntraWorkspaceProvider = ({
  tenantId,
  username,
  baseInstruments,
  baseTimeframes,
  children,
}: {
  tenantId: string;
  username: string;
  baseInstruments: InstrumentOption[];
  baseTimeframes: TimeframeOption[];
  children: ReactNode;
}) => {
  const initialInstrument = baseInstruments[0]?.key ?? 'NSE_INDEX|Nifty 50';
  const defaultTimeframeKey = toTimeframeKey(baseTimeframes[0]?.unit ?? 'minutes', baseTimeframes[0]?.interval ?? 5);
  const storageKey = buildStorageKey(tenantId, username);

  const [tradeMode, setTradeMode] = useState<IntraTradeMode>('PAPER');
  const [scanInstrumentKey, setScanInstrumentKey] = useState(initialInstrument);
  const [scanTimeframeKey, setScanTimeframeKey] = useState(defaultTimeframeKey);
  const [strategyId, setStrategyId] = useState<number | null>(null);
  const [strategy, setStrategy] = useState<BacktestStrategyPayload>(() => createDefaultStrategy(initialInstrument));
  const [editingExecutionId, setEditingExecutionId] = useState<number | null>(null);
  const [selectedExecution, setSelectedExecution] = useState<IntraTradeExecutionResponse | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.sessionStorage.getItem(storageKey);
      if (!stored) return;
      const parsed = JSON.parse(stored) as Partial<PersistedIntraWorkspace>;
      if (parsed.tradeMode === 'LIVE' || parsed.tradeMode === 'PAPER' || parsed.tradeMode === 'BACKTEST') {
        setTradeMode(parsed.tradeMode);
      }
      if (parsed.scanInstrumentKey) {
        setScanInstrumentKey(parsed.scanInstrumentKey);
      }
      if (parsed.scanTimeframeKey) {
        setScanTimeframeKey(parsed.scanTimeframeKey);
      }
      if (typeof parsed.strategyId === 'number' || parsed.strategyId === null) {
        setStrategyId(parsed.strategyId ?? null);
      }
      if (parsed.strategy) {
        setStrategy(normalizeStrategyForMvp(parsed.strategy));
      }
      if (typeof parsed.editingExecutionId === 'number' || parsed.editingExecutionId === null) {
        setEditingExecutionId(parsed.editingExecutionId ?? null);
      }
      if (parsed.selectedExecution) {
        setSelectedExecution(parsed.selectedExecution);
      }
    } catch {
      // ignore malformed session cache
    }
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const payload: PersistedIntraWorkspace = {
      tradeMode,
      scanInstrumentKey,
      scanTimeframeKey,
      strategyId,
      strategy,
      editingExecutionId,
      selectedExecution,
    };
    window.sessionStorage.setItem(storageKey, JSON.stringify(payload));
  }, [editingExecutionId, scanInstrumentKey, scanTimeframeKey, selectedExecution, storageKey, strategy, strategyId, tradeMode]);

  const loadStrategyIntoWorkspace = (nextStrategyId: number | null, strategyPayload: BacktestStrategyPayload) => {
    const normalized = normalizeStrategyForMvp(strategyPayload);
    setStrategyId(nextStrategyId);
    setStrategy(normalized);
    setScanInstrumentKey(normalized.underlyingKey);
    setEditingExecutionId(null);
    setSelectedExecution(null);
  };

  const loadExecutionIntoWorkspace = (execution: IntraTradeExecutionResponse) => {
    setEditingExecutionId(execution.id);
    setSelectedExecution(execution);
    setStrategyId(execution.strategyId ?? null);
    setStrategy(normalizeStrategyForMvp(execution.strategy));
    setScanInstrumentKey(execution.scanInstrumentKey);
    setScanTimeframeKey(toTimeframeKey(execution.scanTimeframeUnit, execution.scanTimeframeInterval));
    setTradeMode(execution.mode);
  };

  const resetWorkspace = () => {
    setTradeMode('PAPER');
    setStrategyId(null);
    setStrategy(createDefaultStrategy(scanInstrumentKey));
    setEditingExecutionId(null);
    setSelectedExecution(null);
  };

  const value = useMemo<IntraWorkspaceContextValue>(() => ({
    baseInstruments,
    baseTimeframes,
    workspaceLabel: `${tenantId} · ${username}`,
    tradeMode,
    setTradeMode,
    brokerExchangeLabel: getExchangeLabel(scanInstrumentKey, baseInstruments),
    timezoneLabel: 'Asia/Kolkata',
    marketSessionLabel: computeMarketSessionLabel(),
    scanInstrumentKey,
    setScanInstrumentKey,
    scanTimeframeKey,
    setScanTimeframeKey,
    strategyId,
    setStrategyId,
    strategy,
    setStrategy,
    editingExecutionId,
    setEditingExecutionId,
    selectedExecution,
    setSelectedExecution,
    loadStrategyIntoWorkspace,
    loadExecutionIntoWorkspace,
    resetWorkspace,
  }), [
    baseInstruments,
    baseTimeframes,
    editingExecutionId,
    scanInstrumentKey,
    scanTimeframeKey,
    selectedExecution,
    strategy,
    strategyId,
    tenantId,
    tradeMode,
    username,
  ]);

  return (
    <IntraWorkspaceContext.Provider value={value}>
      {children}
    </IntraWorkspaceContext.Provider>
  );
};

export const useIntraWorkspace = () => {
  const context = useContext(IntraWorkspaceContext);
  if (!context) {
    throw new Error('useIntraWorkspace must be used within IntraWorkspaceProvider');
  }
  return context;
};
