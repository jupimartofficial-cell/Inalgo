// AdvancedTradingDesk.tsx — Full-screen professional trading workspace
// Layout: MarketWatch (left) | Chart Tabs (center) | Option Chain (right)
//         + Bottom: Positions / Orders / Market News

import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControl, IconButton, InputLabel, MenuItem, Select, Stack, Tab,
  Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, Tooltip, Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CreateNewFolderRoundedIcon from '@mui/icons-material/CreateNewFolderRounded';
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import FiberManualRecordRoundedIcon from '@mui/icons-material/FiberManualRecordRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded';
import TrendingFlatRoundedIcon from '@mui/icons-material/TrendingFlatRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchHistoricalData, fetchLatestOptionChain, fetchMarketSentiments, fetchNewsFeedPreview,
  fetchOptionChainExpiries,
  type Candle, type NewsFeedArticlePreview, type OptionChainSnapshot,
} from '../api/admin';
import { placeIntraTradeOrder } from '../api/intraTrade';
import { fetchUpstoxOrders, fetchUpstoxPositions } from '../api/intraPnlAnalytics';
import type { UpstoxOrderItem, UpstoxPositionItem } from '../api/intraPnlAnalytics.types';
import { ProChartCanvas } from './ProChartCanvas';
import type { SnackSeverity } from './TradingWindowShared';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface WatchGroup {
  id: string;
  name: string;
}

interface WatchInstrument {
  id: string;
  instrumentKey: string;
  label: string;
  exchange: string;
  timeframeUnit: string;
  timeframeInterval: number;
  groupId?: string;
}

interface WatchItem extends WatchInstrument {
  ltp: number | null;
  prevClose: number | null;
  loading: boolean;
}

interface ChartTab {
  id: string;
  name: string;
  instrumentKey: string;
  timeframeUnit: string;
  timeframeInterval: number;
  candles: Candle[];
  loading: boolean;
  error: string;
}

interface OrderDlgState {
  strike: number;
  optionType: 'CE' | 'PE';
  action: 'BUY' | 'SELL';
  ltp: number;
  instrumentToken: string;
}

interface ATDConfig {
  watchInstruments: WatchInstrument[];
  watchGroups: WatchGroup[];
  refreshMs: { mw: number; oc: number; bp: number };
  ocUnderlying: string;
  strikesAround: number;
}

interface WatchEditDlg {
  open: boolean;
  mode: 'add' | 'edit';
  idx: number;
  item: Omit<WatchInstrument, 'id'>;
  addToGroupId?: string;
}

interface Props {
  token: string;
  tenantId: string;
  username: string;
  onNotify: (p: { msg: string; severity: SnackSeverity }) => void;
  onClose: () => void;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_WATCH: WatchInstrument[] = [
  { id: 'gift',   instrumentKey: 'NSE_INDEX|Gift Nifty', label: 'GIFT NIFTY',    exchange: 'NSE', timeframeUnit: 'days',    timeframeInterval: 1 },
  { id: 'nifty',  instrumentKey: 'NSE_INDEX|Nifty 50',   label: 'NIFTY 50',      exchange: 'NSE', timeframeUnit: 'minutes', timeframeInterval: 5 },
  { id: 'bank',   instrumentKey: 'NSE_INDEX|Nifty Bank', label: 'NIFTY BANK',    exchange: 'NSE', timeframeUnit: 'minutes', timeframeInterval: 5 },
  { id: 'sensex', instrumentKey: 'BSE_INDEX|SENSEX',     label: 'SENSEX',        exchange: 'BSE', timeframeUnit: 'days',    timeframeInterval: 1 },
  { id: 'nfut',   instrumentKey: 'NSE_FO|51714',         label: 'NIFTY FUT',     exchange: 'NSE', timeframeUnit: 'minutes', timeframeInterval: 5 },
  { id: 'bnfut',  instrumentKey: 'NSE_FO|51701',         label: 'BANKNIFTY FUT', exchange: 'NSE', timeframeUnit: 'minutes', timeframeInterval: 5 },
  { id: 'sxfut',  instrumentKey: 'BSE_FO|825565',        label: 'SENSEX FUT',    exchange: 'BSE', timeframeUnit: 'minutes', timeframeInterval: 5 },
];

const OC_UNDERLYINGS = [
  { key: 'NSE_INDEX|Nifty 50',  label: 'NIFTY' },
  { key: 'NSE_INDEX|Nifty Bank', label: 'BANKNIFTY' },
  { key: 'BSE_INDEX|SENSEX',    label: 'SENSEX' },
];

const TIMEFRAMES = [
  { unit: 'minutes', interval: 1,  label: '1m' },
  { unit: 'minutes', interval: 5,  label: '5m' },
  { unit: 'minutes', interval: 15, label: '15m' },
  { unit: 'minutes', interval: 30, label: '30m' },
  { unit: 'days',    interval: 1,  label: '1D' },
];

const REFRESH_OPTIONS = [
  { label: '15s', ms: 15_000 },
  { label: '30s', ms: 30_000 },
  { label: '1m',  ms: 60_000 },
  { label: '2m',  ms: 120_000 },
  { label: '5m',  ms: 300_000 },
  { label: 'Off', ms: 0 },
];

const STRIKES_OPTIONS = [10, 20, 30, 40, 50];

const DEFAULT_CONFIG: ATDConfig = {
  watchInstruments: DEFAULT_WATCH,
  watchGroups: [],
  refreshMs: { mw: 30_000, oc: 60_000, bp: 60_000 },
  ocUnderlying: 'NSE_INDEX|Nifty Bank',
  strikesAround: 20,
};

const BLANK_WATCH_ITEM: Omit<WatchInstrument, 'id'> = {
  instrumentKey: '', label: '', exchange: 'NSE', timeframeUnit: 'minutes', timeframeInterval: 5,
};

// ─── Config Persistence (localStorage) ────────────────────────────────────────

const cfgKey = (u: string) => `atd_cfg_v1_${u}`;

const loadConfig = (username: string): ATDConfig => {
  try {
    const raw = localStorage.getItem(cfgKey(username));
    if (!raw) return DEFAULT_CONFIG;
    const p = JSON.parse(raw) as Partial<ATDConfig>;
    const makeId = () => Math.random().toString(36).slice(2, 8);
    const normalizeWatch = (item: Partial<WatchInstrument>): WatchInstrument => ({
      id: item.id ?? item.instrumentKey ?? makeId(),
      instrumentKey: item.instrumentKey ?? '',
      label: item.label ?? item.instrumentKey ?? 'Instrument',
      exchange: item.exchange ?? 'NSE',
      timeframeUnit: item.timeframeUnit ?? 'minutes',
      timeframeInterval: item.timeframeInterval ?? 5,
    });
    const normalizedWatch = (p.watchInstruments?.length ? p.watchInstruments : DEFAULT_CONFIG.watchInstruments)
      .map((item) => normalizeWatch(item as WatchInstrument))
      .filter((item) => item.instrumentKey.trim().length > 0);
    return {
      watchInstruments: normalizedWatch.length ? normalizedWatch : DEFAULT_CONFIG.watchInstruments,
      watchGroups: Array.isArray(p.watchGroups) ? (p.watchGroups as WatchGroup[]) : [],
      refreshMs: { ...DEFAULT_CONFIG.refreshMs, ...(p.refreshMs ?? {}) },
      ocUnderlying: p.ocUnderlying ?? DEFAULT_CONFIG.ocUnderlying,
      strikesAround: p.strikesAround ?? DEFAULT_CONFIG.strikesAround,
    };
  } catch { return DEFAULT_CONFIG; }
};

const persistConfig = (username: string, cfg: ATDConfig) => {
  try { localStorage.setItem(cfgKey(username), JSON.stringify(cfg)); } catch { /* quota */ }
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

const createTab = (index: number): ChartTab => ({
  id: Math.random().toString(36).slice(2, 8),
  name: `Chart ${index}`,
  instrumentKey: 'NSE_INDEX|Nifty 50',
  timeframeUnit: 'minutes',
  timeframeInterval: 5,
  candles: [], loading: false, error: '',
});

const uid = () => Math.random().toString(36).slice(2, 8);

const fmtNum = (v: number | null | undefined, d = 2) =>
  v == null || isNaN(v) ? '--' : v.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });

const pctColor = (v: number | null | undefined) =>
  v == null ? '#64748b' : v > 0 ? '#0f9d58' : v < 0 ? '#d93025' : '#64748b';

// ─── Component ─────────────────────────────────────────────────────────────────

export const AdvancedTradingDesk = ({ token, tenantId, username, onNotify, onClose }: Props) => {
  // ── Config ────────────────────────────────────────────────────
  const [watchInstruments, setWatchInstruments] = useState<WatchInstrument[]>(() => loadConfig(username).watchInstruments);
  const [watchGroups, setWatchGroups]           = useState<WatchGroup[]>(() => loadConfig(username).watchGroups ?? []);
  const [refreshMs, setRefreshMs]               = useState(() => loadConfig(username).refreshMs);

  // ── Market Watch ──────────────────────────────────────────────
  const [watchItems, setWatchItems] = useState<WatchItem[]>(
    () => watchInstruments.map((i) => ({ ...i, ltp: null, prevClose: null, loading: true }))
  );
  const [watchEditDlg, setWatchEditDlg] = useState<WatchEditDlg>({
    open: false, mode: 'add', idx: -1, item: { ...BLANK_WATCH_ITEM },
  });
  const [editingGroupId, setEditingGroupId]     = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [refreshDlgOpen, setRefreshDlgOpen] = useState(false);
  const mwTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Chart Tabs ────────────────────────────────────────────────
  const [tabs, setTabs]             = useState<ChartTab[]>([createTab(1)]);
  const [activeTabIdx, setActiveTabIdx] = useState(0);

  // ── Option Chain ──────────────────────────────────────────────
  const [ocUnderlying, setOcUnderlying] = useState(() => loadConfig(username).ocUnderlying);
  const [ocExpiries, setOcExpiries]     = useState<string[]>([]);
  const [ocExpiry, setOcExpiry]         = useState('');
  const [ocSnapshot, setOcSnapshot]     = useState<OptionChainSnapshot | null>(null);
  const [ocLoading, setOcLoading]       = useState(false);
  const [strikesAround, setStrikesAround] = useState(() => loadConfig(username).strikesAround);
  const ocTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const ocScrollRef  = useRef<HTMLDivElement | null>(null);
  const atmRowRef    = useRef<HTMLTableRowElement | null>(null);

  // ── Bottom panel ──────────────────────────────────────────────
  const [bottomTab, setBottomTab]   = useState(0);
  const [positions, setPositions]   = useState<UpstoxPositionItem[]>([]);
  const [orders, setOrders]         = useState<UpstoxOrderItem[]>([]);
  const [news, setNews]             = useState<NewsFeedArticlePreview[]>([]);
  const [bottomLoading, setBottomLoading] = useState(false);
  const bpTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Clock ─────────────────────────────────────────────────────
  const [clockLabel, setClockLabel] = useState(() =>
    new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  );
  useEffect(() => {
    const id = setInterval(() => {
      setClockLabel(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }));
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  // ── Order Dialog ──────────────────────────────────────────────
  const [orderDlg, setOrderDlg]           = useState<OrderDlgState | null>(null);
  const [orderQty, setOrderQty]           = useState('1');
  const [orderType, setOrderType]         = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [orderLimitPrice, setOrderLimitPrice] = useState('');
  const [orderLoading, setOrderLoading]   = useState(false);

  // ── Persist config on change ──────────────────────────────────
  useEffect(() => {
    persistConfig(username, { watchInstruments, watchGroups, refreshMs, ocUnderlying, strikesAround });
  }, [username, watchInstruments, watchGroups, refreshMs, ocUnderlying, strikesAround]);

  // ─────────────────────────────────────────────────────────────
  // Market Watch: load one price
  // ─────────────────────────────────────────────────────────────
  const loadWatchPrice = useCallback(async (item: WatchInstrument) => {
    try {
      if (item.id === 'gift') {
        const latestResult = await fetchMarketSentiments(tenantId, token, { marketScope: 'GIFT_NIFTY', page: 0, size: 1 });
        const latest = latestResult.content[0];
        let prevClose: number | null = null;
        if (latest?.snapshotAt) {
          const d = new Date(latest.snapshotAt);
          const startOfDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
          const prevResult = await fetchMarketSentiments(tenantId, token, {
            marketScope: 'GIFT_NIFTY',
            toSnapshotAt: new Date(startOfDay.getTime() - 1).toISOString(),
            page: 0,
            size: 1,
          });
          prevClose = prevResult.content[0]?.currentValue ?? null;
        }
        setWatchItems((ws) => ws.map((w) =>
          w.id === 'gift'
            ? { ...w, ltp: latest?.currentValue ?? null, prevClose, loading: false }
            : w
        ));
        return;
      }
      const end = new Date();
      const start = new Date(end.getTime() - 30 * 86_400_000);
      const result = await fetchHistoricalData(tenantId, token, {
        instrumentKey: item.instrumentKey,
        timeframeUnit: item.timeframeUnit,
        timeframeInterval: item.timeframeInterval,
        from: start.toISOString(), to: end.toISOString(),
        sortBy: 'candleTs', sortDirection: 'desc', page: 0, size: 2,
      });
      const [latest, prev] = result.content;
      setWatchItems((ws) => ws.map((w) =>
        w.instrumentKey === item.instrumentKey
          ? { ...w, ltp: latest?.closePrice ?? null, prevClose: prev?.closePrice ?? null, loading: false }
          : w
      ));
    } catch {
      setWatchItems((ws) => ws.map((w) => w.instrumentKey === item.instrumentKey ? { ...w, loading: false } : w));
    }
  }, [tenantId, token]);

  const loadAllWatchPrices = useCallback(() => {
    setWatchItems((ws) => ws.map((w) => ({ ...w, loading: true })));
    watchInstruments.forEach((i) => loadWatchPrice(i));
  }, [loadWatchPrice, watchInstruments]);

  // Sync watchItems list when instrument config changes
  useEffect(() => {
    setWatchItems(watchInstruments.map((i) => ({ ...i, ltp: null, prevClose: null, loading: true })));
    watchInstruments.forEach((i) => loadWatchPrice(i));
  }, [watchInstruments, loadWatchPrice]);

  // Auto-refresh market watch
  useEffect(() => {
    if (mwTimerRef.current) clearInterval(mwTimerRef.current);
    if (refreshMs.mw > 0) mwTimerRef.current = setInterval(loadAllWatchPrices, refreshMs.mw);
    return () => { if (mwTimerRef.current) clearInterval(mwTimerRef.current); };
  }, [loadAllWatchPrices, refreshMs.mw]);

  // ─────────────────────────────────────────────────────────────
  // Chart tabs
  // ─────────────────────────────────────────────────────────────
  const loadTabCandles = useCallback(async (tabId: string, instrumentKey: string, unit: string, interval: number) => {
    setTabs((prev) => prev.map((t) => t.id === tabId ? { ...t, loading: true, error: '' } : t));
    try {
      const end = new Date();
      const start = new Date(end.getTime() - 30 * 86_400_000);
      const result = await fetchHistoricalData(tenantId, token, {
        instrumentKey, timeframeUnit: unit, timeframeInterval: interval,
        from: start.toISOString(), to: end.toISOString(),
        sortBy: 'candleTs', sortDirection: 'desc', page: 0, size: 500,
      });
      setTabs((prev) => prev.map((t) => t.id === tabId ? { ...t, candles: result.content, loading: false } : t));
    } catch (e) {
      setTabs((prev) => prev.map((t) => t.id === tabId ? { ...t, loading: false, error: (e as Error).message } : t));
    }
  }, [tenantId, token]);

  useEffect(() => {
    const tab = tabs[activeTabIdx];
    if (tab && tab.candles.length === 0 && !tab.loading) {
      loadTabCandles(tab.id, tab.instrumentKey, tab.timeframeUnit, tab.timeframeInterval);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabIdx, tabs.length]);

  // ─────────────────────────────────────────────────────────────
  // Option Chain
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    setOcExpiries([]); setOcExpiry(''); setOcSnapshot(null);
    fetchOptionChainExpiries(tenantId, token, ocUnderlying, false)
      .then((res) => { setOcExpiries(res.expiries); if (res.expiries.length > 0) setOcExpiry(res.expiries[0]); })
      .catch(() => {});
  }, [ocUnderlying, tenantId, token]);

  const loadOcSnapshot = useCallback(async () => {
    if (!ocExpiry) return;
    setOcLoading(true);
    try {
      setOcSnapshot(await fetchLatestOptionChain(tenantId, token, ocUnderlying, ocExpiry, true));
    } catch (e) { onNotify({ msg: (e as Error).message, severity: 'error' }); }
    finally { setOcLoading(false); }
  }, [ocExpiry, ocUnderlying, tenantId, token, onNotify]);

  useEffect(() => { if (ocExpiry) loadOcSnapshot(); }, [ocExpiry, loadOcSnapshot]);

  // Auto-refresh OC
  useEffect(() => {
    if (ocTimerRef.current) clearInterval(ocTimerRef.current);
    if (refreshMs.oc > 0) ocTimerRef.current = setInterval(loadOcSnapshot, refreshMs.oc);
    return () => { if (ocTimerRef.current) clearInterval(ocTimerRef.current); };
  }, [loadOcSnapshot, refreshMs.oc]);

  // Scroll ATM row to vertical center when snapshot loads
  useEffect(() => {
    if (!ocSnapshot) return;
    const timer = setTimeout(() => {
      const container = ocScrollRef.current;
      const atmEl = atmRowRef.current;
      if (container && atmEl) {
        const containerH = container.clientHeight;
        const atmOffsetTop = atmEl.offsetTop;
        container.scrollTop = atmOffsetTop - containerH / 2 + atmEl.clientHeight / 2;
      }
    }, 80);
    return () => clearTimeout(timer);
  }, [ocSnapshot]);

  // ─────────────────────────────────────────────────────────────
  // Bottom panel
  // ─────────────────────────────────────────────────────────────
  const loadBottomData = useCallback(async (tab: number) => {
    setBottomLoading(true);
    try {
      if (tab === 0) { setPositions((await fetchUpstoxPositions(tenantId, token, username)).positions); }
      else if (tab === 1) { setOrders((await fetchUpstoxOrders(tenantId, token, username)).orders); }
      else {
        const scope = tab === 2 ? 'GLOBAL' : 'INDIA';
        setNews((await fetchNewsFeedPreview(tenantId, token, scope)).feeds.flatMap((f) => f.articles));
      }
    } catch { /* silent */ }
    finally { setBottomLoading(false); }
  }, [tenantId, token, username]);

  useEffect(() => { loadBottomData(bottomTab); }, [bottomTab, loadBottomData]);

  // Auto-refresh bottom panel
  useEffect(() => {
    if (bpTimerRef.current) clearInterval(bpTimerRef.current);
    if (refreshMs.bp > 0) bpTimerRef.current = setInterval(() => loadBottomData(bottomTab), refreshMs.bp);
    return () => { if (bpTimerRef.current) clearInterval(bpTimerRef.current); };
  }, [loadBottomData, refreshMs.bp, bottomTab]);

  // ─────────────────────────────────────────────────────────────
  // Tab management
  // ─────────────────────────────────────────────────────────────
  const addTab = () => {
    if (tabs.length >= 5) { onNotify({ msg: 'Maximum 5 chart tabs', severity: 'info' }); return; }
    const t = createTab(tabs.length + 1);
    setTabs((prev) => [...prev, t]);
    setActiveTabIdx(tabs.length);
  };

  const closeTab = (id: string) => {
    if (tabs.length <= 1) return;
    const idx = tabs.findIndex((t) => t.id === id);
    setTabs((prev) => prev.filter((t) => t.id !== id));
    setActiveTabIdx((prev) => (idx <= prev && prev > 0 ? prev - 1 : Math.min(prev, tabs.length - 2)));
  };

  const updateTab = (id: string, patch: Partial<ChartTab>) => {
    const tab = tabs.find((t) => t.id === id);
    if (!tab) return;
    const updated = { ...tab, ...patch };
    setTabs((prev) => prev.map((t) => t.id === id ? { ...updated, candles: [], loading: false } : t));
    setTimeout(() => loadTabCandles(id, updated.instrumentKey, updated.timeframeUnit, updated.timeframeInterval), 0);
  };

  // ─────────────────────────────────────────────────────────────
  // Market Watch CRUD
  // ─────────────────────────────────────────────────────────────
  const openAddWatch = (addToGroupId?: string) =>
    setWatchEditDlg({ open: true, mode: 'add', idx: -1, item: { ...BLANK_WATCH_ITEM }, addToGroupId });

  const openEditWatch = (idx: number) => {
    const { id: _id, ...rest } = watchInstruments[idx];
    setWatchEditDlg({ open: true, mode: 'edit', idx, item: { ...rest } });
  };

  const deleteWatch = (idx: number) =>
    setWatchInstruments((prev) => prev.filter((_, i) => i !== idx));

  /** Move within the same group (or within ungrouped) */
  const moveWatch = (instrumentId: string, dir: -1 | 1) => {
    setWatchInstruments((prev) => {
      const item = prev.find((w) => w.id === instrumentId);
      if (!item) return prev;
      const groupPeers = prev.filter((w) => (w.groupId ?? undefined) === (item.groupId ?? undefined));
      const localIdx = groupPeers.findIndex((w) => w.id === instrumentId);
      const nextLocal = localIdx + dir;
      if (nextLocal < 0 || nextLocal >= groupPeers.length) return prev;
      const fromGlobal = prev.findIndex((w) => w.id === instrumentId);
      const toGlobal   = prev.findIndex((w) => w.id === groupPeers[nextLocal].id);
      const arr = [...prev];
      [arr[fromGlobal], arr[toGlobal]] = [arr[toGlobal], arr[fromGlobal]];
      return arr;
    });
  };

  const saveWatchDlg = () => {
    const { item, mode, idx, addToGroupId } = watchEditDlg;
    if (!item.instrumentKey.trim() || !item.label.trim()) {
      onNotify({ msg: 'Instrument key and label are required', severity: 'error' });
      return;
    }
    if (mode === 'add') {
      setWatchInstruments((prev) => [...prev, { ...item, id: uid(), groupId: addToGroupId }]);
    } else {
      setWatchInstruments((prev) => prev.map((w, i) => i === idx ? { ...w, ...item } : w));
    }
    setWatchEditDlg((d) => ({ ...d, open: false }));
  };

  // ─────────────────────────────────────────────────────────────
  // Watch Group CRUD
  // ─────────────────────────────────────────────────────────────
  const addWatchGroup = () => {
    const g: WatchGroup = { id: uid(), name: `Group ${watchGroups.length + 1}` };
    setWatchGroups((prev) => [...prev, g]);
  };

  const commitGroupRename = (id: string) => {
    const name = editingGroupName.trim();
    if (name) setWatchGroups((prev) => prev.map((g) => g.id === id ? { ...g, name } : g));
    setEditingGroupId(null);
  };

  const deleteWatchGroup = (id: string) => {
    setWatchGroups((prev) => prev.filter((g) => g.id !== id));
    setWatchInstruments((prev) => prev.map((w) => w.groupId === id ? { ...w, groupId: undefined } : w));
  };

  // ─────────────────────────────────────────────────────────────
  // Order placement
  // ─────────────────────────────────────────────────────────────
  const openOrderDlg = (strike: number, optionType: 'CE' | 'PE', action: 'BUY' | 'SELL', ltp: number, instrumentToken?: string) => {
    if (!instrumentToken) {
      onNotify({ msg: 'Missing option instrument token for this strike. Refresh option-chain data.', severity: 'error' });
      return;
    }
    const safeLtp = Number.isFinite(ltp) ? ltp : 0;
    setOrderDlg({ strike, optionType, action, ltp: safeLtp, instrumentToken });
    setOrderQty('1'); setOrderType('MARKET'); setOrderLimitPrice(safeLtp > 0 ? safeLtp.toFixed(2) : '');
  };

  const confirmOrder = async () => {
    if (!orderDlg) return;
    const qty = parseInt(orderQty, 10);
    if (isNaN(qty) || qty <= 0) { onNotify({ msg: 'Invalid quantity', severity: 'error' }); return; }
    if (orderType === 'LIMIT') {
      const limit = parseFloat(orderLimitPrice);
      if (!Number.isFinite(limit) || limit <= 0) {
        onNotify({ msg: 'Invalid limit price', severity: 'error' });
        return;
      }
    }
    setOrderLoading(true);
    try {
      const res = await placeIntraTradeOrder(tenantId, token, {
        instrumentToken: orderDlg.instrumentToken,
        transactionType: orderDlg.action,
        quantity: qty,
        orderType,
        ...(orderType === 'LIMIT' ? { limitPrice: parseFloat(orderLimitPrice) } : {}),
        tag: 'ADV_TRADING_DESK',
      });
      onNotify({ msg: `Order placed: ${res.orderId} — ${res.status}`, severity: 'success' });
      setOrderDlg(null);
      loadBottomData(1);
    } catch (e) { onNotify({ msg: (e as Error).message, severity: 'error' }); }
    finally { setOrderLoading(false); }
  };

  const activeTab = tabs[activeTabIdx] ?? tabs[0];

  // OC helpers — compute ATM-centred visible rows
  const ocVisibleRows = (() => {
    if (!ocSnapshot) return [];
    const rows = ocSnapshot.rows;
    const atmIdx = rows.findIndex((r) => {
      const snap = ocSnapshot as any;
      if (snap.atmStrike != null) return r.strikePrice === snap.atmStrike;
      return ocSnapshot.underlyingSpotPrice != null
        && Math.abs(r.strikePrice - ocSnapshot.underlyingSpotPrice)
           === Math.min(...rows.map((x) => Math.abs(x.strikePrice - (ocSnapshot.underlyingSpotPrice ?? 0))));
    });
    if (atmIdx === -1) return rows.slice(0, strikesAround);
    const half = Math.floor(strikesAround / 2);
    const start = Math.max(0, atmIdx - half);
    return rows.slice(start, start + strikesAround);
  })();

  const ocMaxOi = ocVisibleRows.length
    ? Math.max(1, ...ocVisibleRows.map((r) => Math.max((r as any).callOi ?? 0, (r as any).putOi ?? 0)))
    : 1;

  const refreshLabel = (ms: number) => REFRESH_OPTIONS.find((o) => o.ms === ms)?.label ?? '30s';

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', bgcolor: '#f1f5f9' }}>

      {/* ── Header ── */}
      <Box sx={{ height: 48, bgcolor: '#0f172a', display: 'flex', alignItems: 'center', px: 2, gap: 2, flexShrink: 0 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1 }}>
          <FiberManualRecordRoundedIcon sx={{ color: '#22c55e', fontSize: 10 }} />
          <Typography variant="subtitle2" sx={{ color: '#f8fafc', fontWeight: 700, letterSpacing: '0.04em' }}>
            ADVANCED TRADING DESK
          </Typography>
          <Chip label="Live" size="small" sx={{ bgcolor: '#166534', color: '#bbf7d0', fontWeight: 700, fontSize: '0.65rem', height: 18 }} />
        </Stack>
        <Tooltip title="Refresh settings">
          <IconButton size="small" onClick={() => setRefreshDlgOpen(true)} sx={{ color: '#94a3b8' }}>
            <SettingsRoundedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Typography variant="caption" sx={{ color: '#94a3b8' }}>
          {clockLabel}
        </Typography>
        <Tooltip title="Back to Admin Console">
          <Button size="small" startIcon={<ArrowBackRoundedIcon />} onClick={onClose}
            sx={{ color: '#94a3b8', fontSize: '0.75rem', '&:hover': { color: '#f8fafc', bgcolor: 'rgba(255,255,255,0.08)' } }}>
            Back
          </Button>
        </Tooltip>
      </Box>

      {/* ── Main Body ── */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Market Watch (Left) ── */}
        <Box sx={{ width: 210, bgcolor: '#fff', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
          <Box sx={{ px: 1.5, py: 0.75, borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.68rem' }}>
              Market Watch
            </Typography>
            <Stack direction="row" spacing={0.25} alignItems="center">
              <Tooltip title="Refresh settings">
                <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.62rem', cursor: 'pointer', '&:hover': { color: '#1d4ed8' } }}
                  onClick={() => setRefreshDlgOpen(true)}>{refreshLabel(refreshMs.mw)}</Typography>
              </Tooltip>
              <Tooltip title="Add group">
                <IconButton size="small" onClick={addWatchGroup} sx={{ p: 0.25 }}>
                  <CreateNewFolderRoundedIcon sx={{ fontSize: 13 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Add instrument">
                <IconButton size="small" onClick={() => openAddWatch()} sx={{ p: 0.25 }}>
                  <AddRoundedIcon sx={{ fontSize: 13 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Refresh now">
                <IconButton size="small" onClick={loadAllWatchPrices} sx={{ p: 0.25 }}>
                  <RefreshRoundedIcon sx={{ fontSize: 13 }} />
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>
          <Box sx={{ flex: 1, overflowY: 'auto' }}>
            {/* ── Instrument row renderer ── */}
            {(() => {
              const renderInstrumentRow = (wi: WatchItem, _instrumentIdx: number, groupPeers: WatchItem[]) => {
                const globalIdx = watchInstruments.findIndex((w) => w.id === wi.id);
                const localIdx  = groupPeers.findIndex((w) => w.id === wi.id);
                const change = wi.ltp != null && wi.prevClose != null ? wi.ltp - wi.prevClose : null;
                const changePct = change != null && wi.prevClose ? (change / wi.prevClose) * 100 : null;
                const isUp = change != null && change > 0;
                const isDown = change != null && change < 0;
                const trendColor = isUp ? '#16a34a' : isDown ? '#dc2626' : '#64748b';
                const tfLabel = TIMEFRAMES.find((t) => t.unit === wi.timeframeUnit && t.interval === wi.timeframeInterval)?.label ?? '1D';
                return (
                  <Box key={wi.id}
                    onClick={() => activeTab && updateTab(activeTab.id, { instrumentKey: wi.instrumentKey, name: wi.label, timeframeUnit: wi.timeframeUnit, timeframeInterval: wi.timeframeInterval })}
                    sx={{ px: 1, py: 0.75, borderBottom: '1px solid #f1f5f9', cursor: 'pointer', position: 'relative',
                      '&:hover': { bgcolor: '#f8fafc' }, '&:hover .mw-actions': { opacity: 1 } }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.72rem', display: 'block', lineHeight: 1.1, color: '#0f172a' }}>
                          {wi.label}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.6rem' }}>
                          {wi.exchange} · {tfLabel}
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                        {wi.loading ? <CircularProgress size={10} /> : (
                          <>
                            <Typography variant="caption" fontWeight={700} sx={{ display: 'block', fontSize: '0.75rem', lineHeight: 1.1, color: '#0f172a' }}>
                              {fmtNum(wi.ltp, 2)}
                            </Typography>
                            <Stack direction="row" alignItems="center" justifyContent="flex-end" spacing={0.25}>
                              {isUp   && <TrendingUpRoundedIcon   sx={{ fontSize: 11, color: trendColor }} />}
                              {isDown && <TrendingDownRoundedIcon sx={{ fontSize: 11, color: trendColor }} />}
                              {!isUp && !isDown && <TrendingFlatRoundedIcon sx={{ fontSize: 11, color: trendColor }} />}
                              <Typography variant="caption" sx={{ fontSize: '0.63rem', color: trendColor, fontWeight: 600 }}>
                                {changePct != null ? `${isUp ? '+' : ''}${changePct.toFixed(2)}%` : '--'}
                              </Typography>
                            </Stack>
                          </>
                        )}
                      </Box>
                    </Stack>
                    {/* Hover action buttons */}
                    <Stack className="mw-actions" direction="row" spacing={0.25}
                      sx={{ opacity: 0, transition: 'opacity 0.15s', position: 'absolute', bottom: 2, left: 6 }}
                      onClick={(e) => e.stopPropagation()}>
                      <Tooltip title="Move up">
                        <span><IconButton size="small" sx={{ p: 0.25 }} disabled={localIdx === 0} onClick={() => moveWatch(wi.id, -1)}>
                          <ArrowUpwardRoundedIcon sx={{ fontSize: 11 }} />
                        </IconButton></span>
                      </Tooltip>
                      <Tooltip title="Move down">
                        <span><IconButton size="small" sx={{ p: 0.25 }} disabled={localIdx === groupPeers.length - 1} onClick={() => moveWatch(wi.id, 1)}>
                          <ArrowDownwardRoundedIcon sx={{ fontSize: 11 }} />
                        </IconButton></span>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton size="small" sx={{ p: 0.25 }} onClick={() => openEditWatch(globalIdx)}>
                          <EditRoundedIcon sx={{ fontSize: 11 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" sx={{ p: 0.25, color: '#dc2626' }} onClick={() => deleteWatch(globalIdx)}>
                          <DeleteRoundedIcon sx={{ fontSize: 11 }} />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Box>
                );
              };

              // Ungrouped instruments
              const ungroupedItems = watchItems.filter((wi) => !wi.groupId || !watchGroups.find((g) => g.id === wi.groupId));

              // Group sections
              const groupSections = watchGroups.map((g) => ({
                group: g,
                items: watchItems.filter((wi) => wi.groupId === g.id),
              }));

              return (
                <>
                  {/* Ungrouped rows */}
                  {ungroupedItems.map((wi) => renderInstrumentRow(wi, watchInstruments.findIndex((w) => w.id === wi.id), ungroupedItems))}

                  {/* Group sections */}
                  {groupSections.map(({ group, items }) => (
                    <Box key={group.id}>
                      {/* Group header */}
                      <Box sx={{
                        px: 1, py: 0.5, borderBottom: '1px solid #f1f5f9',
                        bgcolor: '#f8fafc', display: 'flex', alignItems: 'center', gap: 0.5,
                        '& .grp-actions': { opacity: 0, transition: 'opacity 0.15s' },
                        '&:hover .grp-actions': { opacity: 1 },
                      }}>
                        <FolderOpenRoundedIcon sx={{ fontSize: 11, color: '#64748b', flexShrink: 0 }} />
                        {editingGroupId === group.id ? (
                          <>
                            <Box
                              component="input"
                              value={editingGroupName}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditingGroupName(e.target.value)}
                              onBlur={() => commitGroupRename(group.id)}
                              onKeyDown={(e: React.KeyboardEvent) => {
                                if (e.key === 'Enter') commitGroupRename(group.id);
                                if (e.key === 'Escape') setEditingGroupId(null);
                              }}
                              autoFocus
                              sx={{
                                flex: 1, border: '1px solid #94a3b8', borderRadius: '3px',
                                px: 0.5, py: 0.125, fontSize: '0.68rem', fontWeight: 700,
                                bgcolor: '#fff', outline: 'none', minWidth: 0,
                              }}
                            />
                            <IconButton size="small" sx={{ p: 0.125 }} onClick={() => commitGroupRename(group.id)}>
                              <CheckRoundedIcon sx={{ fontSize: 10 }} />
                            </IconButton>
                          </>
                        ) : (
                          <>
                            <Typography variant="caption" fontWeight={700} sx={{ flex: 1, fontSize: '0.68rem', color: '#334155', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {group.name}
                            </Typography>
                            <Stack className="grp-actions" direction="row" spacing={0} alignItems="center">
                              <Tooltip title="Rename group">
                                <IconButton size="small" sx={{ p: 0.125 }} onClick={() => { setEditingGroupName(group.name); setEditingGroupId(group.id); }}>
                                  <EditRoundedIcon sx={{ fontSize: 10 }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Add instrument to group">
                                <IconButton size="small" sx={{ p: 0.125 }} onClick={() => openAddWatch(group.id)}>
                                  <AddRoundedIcon sx={{ fontSize: 10 }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete group">
                                <IconButton size="small" sx={{ p: 0.125, color: '#dc2626' }} onClick={() => deleteWatchGroup(group.id)}>
                                  <DeleteRoundedIcon sx={{ fontSize: 10 }} />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </>
                        )}
                      </Box>
                      {/* Group instruments */}
                      {items.map((wi) => renderInstrumentRow(wi, watchInstruments.findIndex((w) => w.id === wi.id), items))}
                      {items.length === 0 && (
                        <Box sx={{ px: 1.5, py: 1, textAlign: 'center' }}>
                          <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.62rem' }}>
                            Empty — click + to add
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  ))}
                </>
              );
            })()}
          </Box>
        </Box>

        {/* ── Chart Tabs (Center) ── */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <Box sx={{ bgcolor: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', px: 1 }}>
            <Tabs value={activeTabIdx} onChange={(_, v) => setActiveTabIdx(v)} variant="scrollable" scrollButtons={false}
              sx={{ minHeight: 36, '& .MuiTab-root': { minHeight: 36, fontSize: '0.75rem', py: 0, px: 1.5 } }}>
              {tabs.map((t, i) => (
                <Tab key={t.id} value={i} label={
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <span>{t.name}</span>
                    {tabs.length > 1 && (
                      <Box component="span" onClick={(e) => { e.stopPropagation(); closeTab(t.id); }}
                        sx={{ display: 'flex', alignItems: 'center', color: '#94a3b8', '&:hover': { color: '#ef4444' } }}>
                        <CloseRoundedIcon sx={{ fontSize: 12 }} />
                      </Box>
                    )}
                  </Stack>
                } />
              ))}
            </Tabs>
            <Tooltip title="Add chart tab">
              <IconButton size="small" onClick={addTab} sx={{ ml: 0.5 }}>
                <AddRoundedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
            {activeTab && (
              <Stack direction="row" spacing={1} sx={{ ml: 'auto', mr: 1 }}>
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <Select value={activeTab.instrumentKey}
                    onChange={(e) => updateTab(activeTab.id, { instrumentKey: e.target.value as string, name: watchInstruments.find((w) => w.instrumentKey === e.target.value)?.label ?? activeTab.name })}
                    sx={{ fontSize: '0.72rem', height: 28 }}>
                    {watchInstruments.map((w) => <MenuItem key={w.instrumentKey} value={w.instrumentKey} sx={{ fontSize: '0.72rem' }}>{w.label}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 64 }}>
                  <Select value={`${activeTab.timeframeUnit}|${activeTab.timeframeInterval}`}
                    onChange={(e) => { const [u, i] = (e.target.value as string).split('|'); updateTab(activeTab.id, { timeframeUnit: u, timeframeInterval: parseInt(i, 10) }); }}
                    sx={{ fontSize: '0.72rem', height: 28 }}>
                    {TIMEFRAMES.map((tf) => <MenuItem key={tf.label} value={`${tf.unit}|${tf.interval}`} sx={{ fontSize: '0.72rem' }}>{tf.label}</MenuItem>)}
                  </Select>
                </FormControl>
                <Tooltip title="Refresh chart">
                  <IconButton size="small" onClick={() => loadTabCandles(activeTab.id, activeTab.instrumentKey, activeTab.timeframeUnit, activeTab.timeframeInterval)}>
                    <RefreshRoundedIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
              </Stack>
            )}
          </Box>
          <Box sx={{ flex: 1, overflow: 'hidden' }}>
            {activeTab && (
              <ProChartCanvas
                chartId={`adv-desk-${activeTab.id}`}
                candles={activeTab.candles}
                height={420}
                loading={activeTab.loading}
                error={activeTab.error}
                instrumentKey={activeTab.instrumentKey}
                timeframeUnit={activeTab.timeframeUnit}
                timeframeInterval={activeTab.timeframeInterval}
                timeframeOptions={TIMEFRAMES}
                onTimeframeChange={(u, i) => updateTab(activeTab.id, { timeframeUnit: u, timeframeInterval: i })}
              />
            )}
          </Box>
        </Box>

        {/* ── Option Chain (Right) ── */}
        <Box sx={{ width: 340, bgcolor: '#fff', borderLeft: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
          <Box sx={{ px: 1.5, py: 0.75, borderBottom: '1px solid #e2e8f0' }}>
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
              {OC_UNDERLYINGS.map((u) => (
                <Chip key={u.key} label={u.label} size="small" onClick={() => setOcUnderlying(u.key)}
                  sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer',
                    bgcolor: ocUnderlying === u.key ? '#1d4ed8' : '#f1f5f9',
                    color: ocUnderlying === u.key ? '#fff' : '#374151' }} />
              ))}
              <Box sx={{ flex: 1 }} />
              {/* Strikes count selector */}
              <FormControl size="small">
                <Select value={strikesAround}
                  onChange={(e) => setStrikesAround(e.target.value as number)}
                  sx={{ fontSize: '0.62rem', height: 20, '.MuiSelect-select': { py: '1px', px: '6px' }, '.MuiOutlinedInput-notchedOutline': { borderColor: '#d1d5db' } }}>
                  {STRIKES_OPTIONS.map((n) => <MenuItem key={n} value={n} sx={{ fontSize: '0.72rem' }}>{n} strikes</MenuItem>)}
                </Select>
              </FormControl>
              <Tooltip title="Refresh settings">
                <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.62rem', cursor: 'pointer' }}
                  onClick={() => setRefreshDlgOpen(true)}>{refreshLabel(refreshMs.oc)}</Typography>
              </Tooltip>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <FormControl size="small" sx={{ flex: 1 }}>
                <Select value={ocExpiry} onChange={(e) => setOcExpiry(e.target.value as string)}
                  displayEmpty renderValue={(v) => v || 'Select expiry'} sx={{ fontSize: '0.72rem', height: 26 }}>
                  {ocExpiries.map((e) => <MenuItem key={e} value={e} sx={{ fontSize: '0.72rem' }}>{e}</MenuItem>)}
                </Select>
              </FormControl>
              <Tooltip title="Refresh option chain">
                <IconButton size="small" onClick={loadOcSnapshot} disabled={ocLoading || !ocExpiry}>
                  {ocLoading ? <CircularProgress size={12} /> : <RefreshRoundedIcon sx={{ fontSize: 14 }} />}
                </IconButton>
              </Tooltip>
            </Stack>
            {ocSnapshot?.underlyingSpotPrice != null && (
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                <Chip label={`Spot: ${fmtNum(ocSnapshot.underlyingSpotPrice)}`} size="small"
                  sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700, bgcolor: '#b7cbe4', color: '#16385f', border: '1px solid #88a7ca' }} />
                <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.63rem' }}>
                  PCR: {fmtNum(ocSnapshot.pcr, 2)}
                </Typography>
              </Stack>
            )}
          </Box>
          <Box ref={ocScrollRef} sx={{ flex: 1, overflowY: 'auto' }}>
            {ocLoading && !ocSnapshot ? (
              <Box sx={{ p: 2, textAlign: 'center' }}><CircularProgress size={20} /></Box>
            ) : !ocSnapshot ? (
              <Box sx={{ p: 2, textAlign: 'center' }}><Typography variant="caption" color="text.secondary">Select expiry to load</Typography></Box>
            ) : (
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell colSpan={2} sx={{ fontSize: '0.63rem', fontWeight: 800, py: 0.5, px: 0.75, bgcolor: '#f8e9e7', color: '#9f3d2c', borderBottom: '1px solid #e7d1cc', textAlign: 'center' }}>CALLS</TableCell>
                    <TableCell sx={{ fontSize: '0.63rem', fontWeight: 800, py: 0.5, px: 0.75, bgcolor: '#eef3f8', color: '#35506e', borderBottom: '1px solid #d7e0ea', textAlign: 'center' }}>STRIKE</TableCell>
                    <TableCell colSpan={2} sx={{ fontSize: '0.63rem', fontWeight: 800, py: 0.5, px: 0.75, bgcolor: '#e7f4ec', color: '#2c6b4f', borderBottom: '1px solid #d2e4da', textAlign: 'center' }}>PUTS</TableCell>
                  </TableRow>
                  <TableRow>
                    {['OI%', 'LTP', 'Strike', 'LTP', 'OI%'].map((h, i) => (
                      <TableCell key={i} align={i === 2 ? 'center' : i < 2 ? 'right' : 'left'}
                        sx={{ fontSize: '0.6rem', fontWeight: 700, py: 0.25, px: 0.75,
                          bgcolor: i < 2 ? '#fdf5f4' : i > 2 ? '#f3fbf6' : '#f7fafd',
                          color: i < 2 ? '#9f3d2c' : i > 2 ? '#2c6b4f' : '#35506e' }}>
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {ocVisibleRows.map((row) => {
                    const r = row as any;
                    const snap = ocSnapshot as any;
                    const atm = snap.atmStrike != null
                      ? row.strikePrice === snap.atmStrike
                      : ocSnapshot!.underlyingSpotPrice != null
                        && Math.abs(row.strikePrice - ocSnapshot!.underlyingSpotPrice)
                           === Math.min(...ocVisibleRows.map((x) => Math.abs(x.strikePrice - (ocSnapshot!.underlyingSpotPrice ?? 0))));
                    const rowBg = atm ? '#dce6f2' : undefined;
                    const callOiPct = r.callOiChangePercent as number | null | undefined;
                    const putOiPct  = r.putOiChangePercent  as number | null | undefined;
                    const callOi    = (r.callOi  ?? 0) as number;
                    const putOi     = (r.putOi   ?? 0) as number;
                    const callBarW  = `${Math.min(100, Math.round((callOi / ocMaxOi) * 100))}%`;
                    const putBarW   = `${Math.min(100, Math.round((putOi  / ocMaxOi) * 100))}%`;
                    return (
                      <TableRow key={row.strikePrice} ref={atm ? atmRowRef : undefined} sx={{ bgcolor: rowBg, '&:hover': { bgcolor: atm ? '#d3dfef' : '#f2f7fc' } }}>
                        {/* Call OI% with bar */}
                        <TableCell align="right" sx={{ px: 0.75, py: 0.25, position: 'relative', bgcolor: atm ? rowBg : '#fefaf9', overflow: 'hidden' }}>
                          <Box sx={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: callBarW, bgcolor: 'rgba(189,92,66,0.18)', pointerEvents: 'none' }} />
                          <Typography variant="caption" sx={{ fontSize: '0.63rem', color: pctColor(callOiPct), fontWeight: 600, position: 'relative' }}>
                            {callOiPct != null ? `${callOiPct > 0 ? '+' : ''}${callOiPct.toFixed(1)}%` : '--'}
                          </Typography>
                        </TableCell>
                        {/* Call LTP + B/S */}
                        <TableCell align="right" sx={{ px: 0.75, py: 0.25, bgcolor: atm ? rowBg : '#fefaf9' }}>
                          <Stack direction="row" spacing={0.25} alignItems="center" justifyContent="flex-end">
                            <Typography variant="caption" sx={{ fontSize: '0.68rem', fontWeight: 600, color: '#172033' }}>{fmtNum(row.callLtp)}</Typography>
                            <Button size="small" sx={{ minWidth: 0, px: 0.4, py: 0, fontSize: '0.58rem', height: 15, borderColor: '#16a34a', color: '#16a34a', border: '1px solid', '&:hover': { bgcolor: '#dcfce7' } }}
                              disabled={!r.callInstrumentKey}
                              onClick={() => openOrderDlg(row.strikePrice, 'CE', 'BUY', row.callLtp ?? 0, r.callInstrumentKey)}>B</Button>
                            <Button size="small" sx={{ minWidth: 0, px: 0.4, py: 0, fontSize: '0.58rem', height: 15, borderColor: '#dc2626', color: '#dc2626', border: '1px solid', '&:hover': { bgcolor: '#fee2e2' } }}
                              disabled={!r.callInstrumentKey}
                              onClick={() => openOrderDlg(row.strikePrice, 'CE', 'SELL', row.callLtp ?? 0, r.callInstrumentKey)}>S</Button>
                          </Stack>
                        </TableCell>
                        {/* Strike */}
                        <TableCell align="center" sx={{ px: 0.75, py: 0.25, fontWeight: atm ? 800 : 600, fontSize: '0.68rem', color: atm ? '#16385f' : '#172033', bgcolor: atm ? '#dce6f2' : '#f7fafd' }}>
                          {row.strikePrice.toLocaleString('en-IN')}
                          {atm && <Typography component="span" sx={{ fontSize: '0.55rem', color: '#36597f', display: 'block', lineHeight: 1 }}>ATM</Typography>}
                        </TableCell>
                        {/* Put LTP + B/S */}
                        <TableCell sx={{ px: 0.75, py: 0.25, bgcolor: atm ? rowBg : '#f3fbf6' }}>
                          <Stack direction="row" spacing={0.25} alignItems="center">
                            <Button size="small" sx={{ minWidth: 0, px: 0.4, py: 0, fontSize: '0.58rem', height: 15, borderColor: '#16a34a', color: '#16a34a', border: '1px solid', '&:hover': { bgcolor: '#dcfce7' } }}
                              disabled={!r.putInstrumentKey}
                              onClick={() => openOrderDlg(row.strikePrice, 'PE', 'BUY', row.putLtp ?? 0, r.putInstrumentKey)}>B</Button>
                            <Button size="small" sx={{ minWidth: 0, px: 0.4, py: 0, fontSize: '0.58rem', height: 15, borderColor: '#dc2626', color: '#dc2626', border: '1px solid', '&:hover': { bgcolor: '#fee2e2' } }}
                              disabled={!r.putInstrumentKey}
                              onClick={() => openOrderDlg(row.strikePrice, 'PE', 'SELL', row.putLtp ?? 0, r.putInstrumentKey)}>S</Button>
                            <Typography variant="caption" sx={{ fontSize: '0.68rem', fontWeight: 600, color: '#172033' }}>{fmtNum(row.putLtp)}</Typography>
                          </Stack>
                        </TableCell>
                        {/* Put OI% with bar */}
                        <TableCell sx={{ px: 0.75, py: 0.25, position: 'relative', bgcolor: atm ? rowBg : '#f3fbf6', overflow: 'hidden' }}>
                          <Box sx={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: putBarW, bgcolor: 'rgba(61,154,109,0.18)', pointerEvents: 'none' }} />
                          <Typography variant="caption" sx={{ fontSize: '0.63rem', color: pctColor(putOiPct), fontWeight: 600, position: 'relative' }}>
                            {putOiPct != null ? `${putOiPct > 0 ? '+' : ''}${putOiPct.toFixed(1)}%` : '--'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Box>
        </Box>
      </Box>

      {/* ── Bottom Panel ── */}
      <Box sx={{ height: 220, bgcolor: '#fff', borderTop: '2px solid #e2e8f0', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
        <Box sx={{ borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1 }}>
          <Tabs value={bottomTab} onChange={(_, v) => setBottomTab(v)}
            sx={{ minHeight: 32, '& .MuiTab-root': { minHeight: 32, fontSize: '0.72rem', py: 0 } }}>
            <Tab label="Positions" /><Tab label="Orders" />
            <Tab label="News (Global)" /><Tab label="News (India)" />
          </Tabs>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Tooltip title="Refresh settings">
              <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.62rem', cursor: 'pointer' }}
                onClick={() => setRefreshDlgOpen(true)}>{refreshLabel(refreshMs.bp)}</Typography>
            </Tooltip>
            <Tooltip title="Refresh">
              <IconButton size="small" onClick={() => loadBottomData(bottomTab)}>
                {bottomLoading ? <CircularProgress size={12} /> : <RefreshRoundedIcon sx={{ fontSize: 14 }} />}
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>
        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          {bottomTab === 0 && (
            <Table size="small">
              <TableHead><TableRow sx={{ '& th': { fontSize: '0.65rem', fontWeight: 700, py: 0.5, px: 1, bgcolor: '#f8fafc' } }}>
                <TableCell>Symbol</TableCell><TableCell align="right">Qty</TableCell>
                <TableCell align="right">Avg Buy</TableCell><TableCell align="right">LTP</TableCell>
                <TableCell align="right">P&L</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {positions.length === 0 ? (
                  <TableRow><TableCell colSpan={5} align="center" sx={{ py: 2, color: '#94a3b8', fontSize: '0.72rem' }}>No positions</TableCell></TableRow>
                ) : positions.map((p, i) => (
                  <TableRow key={i} sx={{ '& td': { fontSize: '0.68rem', py: 0.4, px: 1 } }}>
                    <TableCell>{p.tradingSymbol}</TableCell>
                    <TableCell align="right">{p.netQuantity}</TableCell>
                    <TableCell align="right">{fmtNum(p.avgBuyPrice)}</TableCell>
                    <TableCell align="right">{fmtNum(p.ltp)}</TableCell>
                    <TableCell align="right" sx={{ color: (p.pnl ?? 0) >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>{fmtNum(p.pnl)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {bottomTab === 1 && (
            <Table size="small">
              <TableHead><TableRow sx={{ '& th': { fontSize: '0.65rem', fontWeight: 700, py: 0.5, px: 1, bgcolor: '#f8fafc' } }}>
                <TableCell>Order ID</TableCell><TableCell>Symbol</TableCell>
                <TableCell>Type</TableCell><TableCell align="right">Qty</TableCell>
                <TableCell align="right">Price</TableCell><TableCell>Status</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {orders.length === 0 ? (
                  <TableRow><TableCell colSpan={6} align="center" sx={{ py: 2, color: '#94a3b8', fontSize: '0.72rem' }}>No orders today</TableCell></TableRow>
                ) : orders.map((o) => (
                  <TableRow key={o.orderId} sx={{ '& td': { fontSize: '0.68rem', py: 0.4, px: 1 } }}>
                    <TableCell sx={{ maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.orderId}</TableCell>
                    <TableCell>{o.tradingSymbol ?? o.instrumentToken}</TableCell>
                    <TableCell>
                      <Chip label={o.transactionType} size="small"
                        sx={{ height: 16, fontSize: '0.6rem', bgcolor: o.transactionType === 'BUY' ? '#dcfce7' : '#fee2e2', color: o.transactionType === 'BUY' ? '#166534' : '#991b1b' }} />
                    </TableCell>
                    <TableCell align="right">{o.quantity}</TableCell>
                    <TableCell align="right">{fmtNum(o.averagePrice)}</TableCell>
                    <TableCell><Chip label={o.status} size="small" sx={{ height: 16, fontSize: '0.6rem' }} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {(bottomTab === 2 || bottomTab === 3) && (
            <Box sx={{ p: 1 }}>
              {news.length === 0
                ? <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', py: 2 }}>No news articles</Typography>
                : news.slice(0, 15).map((a, i) => (
                  <Box key={i} sx={{ mb: 0.75, pb: 0.75, borderBottom: '1px solid #f1f5f9' }}>
                    <Stack direction="row" spacing={0.5} alignItems="flex-start">
                      <Chip label={a.score > 0 ? '▲' : a.score < 0 ? '▼' : '—'} size="small"
                        sx={{ height: 16, fontSize: '0.6rem', flexShrink: 0,
                          bgcolor: a.score > 0 ? '#dcfce7' : a.score < 0 ? '#fee2e2' : '#f1f5f9',
                          color: a.score > 0 ? '#166534' : a.score < 0 ? '#991b1b' : '#6b7280' }} />
                      <Box>
                        <Typography variant="caption" sx={{ fontWeight: 500, fontSize: '0.7rem', display: 'block', lineHeight: 1.3 }}>{a.title}</Typography>
                        <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.62rem' }}>
                          {a.sourceName} · {a.publishedAt ? new Date(a.publishedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>
                ))
              }
            </Box>
          )}
        </Box>
      </Box>

      {/* ── Add / Edit Watch Instrument Dialog ── */}
      <Dialog open={watchEditDlg.open} onClose={() => setWatchEditDlg((d) => ({ ...d, open: false }))} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>{watchEditDlg.mode === 'add' ? 'Add Instrument' : 'Edit Instrument'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Instrument Key" size="small" fullWidth
              value={watchEditDlg.item.instrumentKey}
              onChange={(e) => setWatchEditDlg((d) => ({ ...d, item: { ...d.item, instrumentKey: e.target.value } }))}
              helperText="e.g. NSE_INDEX|Nifty 50 or NSE_FO|51714" />
            <TextField label="Display Label" size="small" fullWidth
              value={watchEditDlg.item.label}
              onChange={(e) => setWatchEditDlg((d) => ({ ...d, item: { ...d.item, label: e.target.value } }))} />
            <Stack direction="row" spacing={1}>
              <TextField label="Exchange" size="small" sx={{ flex: 1 }}
                value={watchEditDlg.item.exchange}
                onChange={(e) => setWatchEditDlg((d) => ({ ...d, item: { ...d.item, exchange: e.target.value } }))} />
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel>Timeframe</InputLabel>
                <Select label="Timeframe" value={`${watchEditDlg.item.timeframeUnit}|${watchEditDlg.item.timeframeInterval}`}
                  onChange={(e) => {
                    const [u, i] = (e.target.value as string).split('|');
                    setWatchEditDlg((d) => ({ ...d, item: { ...d.item, timeframeUnit: u, timeframeInterval: parseInt(i, 10) } }));
                  }}>
                  {TIMEFRAMES.map((tf) => <MenuItem key={tf.label} value={`${tf.unit}|${tf.interval}`}>{tf.label}</MenuItem>)}
                </Select>
              </FormControl>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2 }}>
          <Button onClick={() => setWatchEditDlg((d) => ({ ...d, open: false }))}>Cancel</Button>
          <Button onClick={saveWatchDlg} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>

      {/* ── Refresh Settings Dialog ── */}
      <Dialog open={refreshDlgOpen} onClose={() => setRefreshDlgOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>Auto-Refresh Settings</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {([
              { label: 'Market Watch', key: 'mw' },
              { label: 'Option Chain', key: 'oc' },
              { label: 'Bottom Panel', key: 'bp' },
            ] as const).map(({ label, key }) => (
              <Stack key={key} direction="row" alignItems="center" justifyContent="space-between">
                <Typography variant="body2">{label}</Typography>
                <FormControl size="small" sx={{ minWidth: 90 }}>
                  <Select value={refreshMs[key]}
                    onChange={(e) => setRefreshMs((prev) => ({ ...prev, [key]: e.target.value as number }))}>
                    {REFRESH_OPTIONS.map((o) => <MenuItem key={o.ms} value={o.ms}>{o.label}</MenuItem>)}
                  </Select>
                </FormControl>
              </Stack>
            ))}
            <Alert severity="info" sx={{ fontSize: '0.72rem', py: 0.5 }}>
              Settings are saved automatically and restored on next visit.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2 }}>
          <Button onClick={() => setRefreshDlgOpen(false)} variant="contained">Done</Button>
        </DialogActions>
      </Dialog>

      {/* ── Order Placement Dialog ── */}
      <Dialog open={Boolean(orderDlg)} onClose={() => !orderLoading && setOrderDlg(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="subtitle1" fontWeight={700}>
              {orderDlg?.action} {orderDlg?.strike} {orderDlg?.optionType}
            </Typography>
            <Chip label={orderDlg?.action} size="small"
              sx={{ bgcolor: orderDlg?.action === 'BUY' ? '#dcfce7' : '#fee2e2', color: orderDlg?.action === 'BUY' ? '#166534' : '#991b1b', fontWeight: 700 }} />
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Instrument Token" size="small" fullWidth
              value={orderDlg?.instrumentToken ?? ''}
              onChange={(e) => setOrderDlg((prev) => prev ? { ...prev, instrumentToken: e.target.value } : null)}
              helperText="Upstox instrument token (NSE_FO|xxxxx)" />
            <Stack direction="row" spacing={1}>
              <TextField label="Quantity (Lots)" size="small" type="number" sx={{ flex: 1 }}
                value={orderQty} onChange={(e) => setOrderQty(e.target.value)} inputProps={{ min: 1 }} />
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel>Order Type</InputLabel>
                <Select value={orderType} label="Order Type" onChange={(e) => setOrderType(e.target.value as 'MARKET' | 'LIMIT')}>
                  <MenuItem value="MARKET">MARKET</MenuItem>
                  <MenuItem value="LIMIT">LIMIT</MenuItem>
                </Select>
              </FormControl>
            </Stack>
            {orderType === 'LIMIT' && (
              <TextField label="Limit Price" size="small" type="number" fullWidth
                value={orderLimitPrice} onChange={(e) => setOrderLimitPrice(e.target.value)} />
            )}
            <Alert severity="warning" sx={{ fontSize: '0.72rem', py: 0.5 }}>
              LTP: ₹{fmtNum(orderDlg?.ltp)} — This will place a LIVE order via Upstox. Ensure token is active.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2 }}>
          <Button onClick={() => setOrderDlg(null)} disabled={orderLoading}>Cancel</Button>
          <Button onClick={confirmOrder} variant="contained" disabled={orderLoading}
            color={orderDlg?.action === 'BUY' ? 'success' : 'error'}
            startIcon={orderLoading ? <CircularProgress size={14} /> : undefined}>
            {orderLoading ? 'Placing…' : `${orderDlg?.action} ${orderDlg?.optionType}`}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
