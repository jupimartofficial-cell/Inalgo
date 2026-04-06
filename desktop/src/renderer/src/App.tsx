import {
  Alert,
  AppBar,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  CircularProgress,
  Container,
  CssBaseline,
  Divider,
  Drawer,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  LinearProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  Tabs,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';

import AccountCircleRoundedIcon from '@mui/icons-material/AccountCircleRounded';
import AlarmRoundedIcon from '@mui/icons-material/AlarmRounded';
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import BarChartRoundedIcon from '@mui/icons-material/BarChartRounded';
import CandlestickChartRoundedIcon from '@mui/icons-material/CandlestickChartRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ClearRoundedIcon from '@mui/icons-material/ClearRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import FilterAltOffRoundedIcon from '@mui/icons-material/FilterAltOffRounded';
import FilterAltRoundedIcon from '@mui/icons-material/FilterAltRounded';
import InfoRoundedIcon from '@mui/icons-material/InfoRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import PauseCircleRoundedIcon from '@mui/icons-material/PauseCircleRounded';
import PlayCircleRoundedIcon from '@mui/icons-material/PlayCircleRounded';
import QueryStatsRoundedIcon from '@mui/icons-material/QueryStatsRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ShowChartRoundedIcon from '@mui/icons-material/ShowChartRounded';
import StopCircleRoundedIcon from '@mui/icons-material/StopCircleRounded';
import StorageRoundedIcon from '@mui/icons-material/StorageRounded';
import TimelineRoundedIcon from '@mui/icons-material/TimelineRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  adminLogin,
  fetchHistoricalData,
  fetchInstruments,
  fetchMigrationJobs,
  fetchMigrationStatus,
  fetchOpenAiTokenStatus,
  fetchUpstoxTokenStatus,
  pauseMigrationJob,
  resumeMigrationJob,
  startMigrationJob,
  stopMigrationJob,
  updateOpenAiToken,
  updateUpstoxToken,
  type Candle,
  type InstrumentDto,
  type MigrationJob,
  type MigrationStatus,
  type OpenAiTokenStatus,
  type UpstoxTokenStatus,
} from './api/admin';
import { OptionChainPanel } from './components/OptionChainPanel';
import { ManageTriggersPanel } from './components/ManageTriggersPanel';
import { TradingWindow } from './components/TradingWindow';
import { BacktestPanel } from './components/BacktestPanel';
import { ProChartCanvas } from './components/ProChartCanvas';
import { MarketWatchPanel } from './components/MarketWatchPanel';
import { AdvancedTradingDesk } from './components/AdvancedTradingDesk';
import { buildSectionPath, resolveAppRoute, resolvePreferredAppPath } from './appRoutes';
import { IntraWorkspaceProvider } from './components/intra-trade/IntraWorkspaceContext';
import { IntraWorkspaceHeader } from './components/intra-trade/IntraWorkspaceHeader';
import { IntraStrategiesPage } from './components/intra-trade/IntraStrategiesPage';
import { IntraMonitorPage } from './components/intra-trade/IntraMonitorPage';
import { IntraPnlPage } from './components/intra-trade/IntraPnlPage';
import { TradingScriptsPage } from './components/trading-scripts/TradingScriptsPage';

import {
  DEFAULT_MIGRATION_JOB_TYPE,
  HistorySectionCard,
  INSTRUMENTS,
  JobCard,
  SESSION_STORAGE_KEY,
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_WIDTH,
  SidebarContent,
  StatCard,
  TIMEFRAME_OPTIONS,
  buildJobKey,
  formatDateTime,
  getDefaultHistoryRange,
  getJobActionState,
  InstrumentBadge,
  isSessionExpiredError,
  migrationJobTypeLabel,
  navItems,
  StatusIcon,
  statusTone,
  TimeframeBadge,
  toJobStatus,
  toIsoOrUndefined,
  type BacktestSubSection,
  type IntraSubSection,
  type MarketSignalsSubSection,
  type NavGroupKey,
  type NavItemKey,
  type TradingDeskSubSection,
  type CandleSortKey,
  type JobAction,
  type NavSection,
  type PersistedSession,
  type SortDir,
} from './components/AppShellShared';

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const location = useLocation();
  const navigate = useNavigate();

  // Auth state
  const [tenantId, setTenantId] = useState('local-desktop');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Dynamic instruments catalog (starts from static fallback; refreshed from backend after login)
  const [instruments, setInstruments] = useState<Array<{ key: string; label: string; exchange: string }>>(INSTRUMENTS);

  // Layout state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [section, setSection] = useState<NavSection>('dashboard');
  const [intraSubSection, setIntraSubSection] = useState<IntraSubSection>('intra-monitor');
  const [backtestSubSection, setBacktestSubSection] = useState<BacktestSubSection>('pnl');
  const [marketSignalsSubSection, setMarketSignalsSubSection] = useState<MarketSignalsSubSection>('trading-param');
  const [tradingDeskSubSection, setTradingDeskSubSection] = useState<TradingDeskSubSection>('advanced-trading');
  const [pinnedNavItemKeys, setPinnedNavItemKeys] = useState<NavItemKey[]>(['intra-monitor', 'trading-desk', 'option-chain']);
  const [expandedNavGroup, setExpandedNavGroup] = useState<NavGroupKey>('trading');

  // Migration state
  const [statusRows, setStatusRows] = useState<MigrationStatus[]>([]);
  const [jobs, setJobs] = useState<MigrationJob[]>([]);
  const [migrationTab, setMigrationTab] = useState(0);
  const [migrationInstrumentKey, setMigrationInstrumentKey] = useState('');
  const [statusUnit, setStatusUnit] = useState('');
  const [statusInterval, setStatusInterval] = useState('');
  const [appliedMigrationInstrumentKey, setAppliedMigrationInstrumentKey] = useState('');
  const [appliedStatusUnit, setAppliedStatusUnit] = useState('');
  const [appliedStatusInterval, setAppliedStatusInterval] = useState('');
  const [migrationLoading, setMigrationLoading] = useState(false);
  const [runtimeJobsPage, setRuntimeJobsPage] = useState(0);
  const [runtimeJobsRowsPerPage, setRuntimeJobsRowsPerPage] = useState(6);
  const [migrationStatusPage, setMigrationStatusPage] = useState(0);
  const [migrationStatusRowsPerPage, setMigrationStatusRowsPerPage] = useState(10);
  const [jobActionLoading, setJobActionLoading] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshRequestSeqRef = useRef(0);
  const refreshLoadingSeqRef = useRef(0);
  const [upstoxToken, setUpstoxToken] = useState('');
  const [upstoxTokenStatus, setUpstoxTokenStatus] = useState<UpstoxTokenStatus | null>(null);
  const [upstoxTokenLoading, setUpstoxTokenLoading] = useState(false);
  const [upstoxTokenSaving, setUpstoxTokenSaving] = useState(false);
  const [openAiToken, setOpenAiToken] = useState('');
  const [openAiTokenStatus, setOpenAiTokenStatus] = useState<OpenAiTokenStatus | null>(null);
  const [openAiTokenLoading, setOpenAiTokenLoading] = useState(false);
  const [openAiTokenSaving, setOpenAiTokenSaving] = useState(false);
  const [migrationError, setMigrationError] = useState('');

  // Historical data state
  const [historyRows, setHistoryRows] = useState<Candle[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyChartRows, setHistoryChartRows] = useState<Candle[]>([]);
  const [historyChartLoading, setHistoryChartLoading] = useState(false);
  const [historyChartError, setHistoryChartError] = useState('');
  const [instrumentKey, setInstrumentKey] = useState('');
  const [historyUnit, setHistoryUnit] = useState('');
  const [historyInterval, setHistoryInterval] = useState('');
  const initialHistoryRangeRef = useRef(getDefaultHistoryRange());
  const [from, setFrom] = useState(initialHistoryRangeRef.current.from);
  const [to, setTo] = useState(initialHistoryRangeRef.current.to);
  const [sortBy, setSortBy] = useState<CandleSortKey>('candleTs');
  const [sortDirection, setSortDirection] = useState<SortDir>('desc');
  const [filterApplied, setFilterApplied] = useState(false);
  const [historyFiltersCollapsed, setHistoryFiltersCollapsed] = useState(false);
  const [historyChartCollapsed, setHistoryChartCollapsed] = useState(false);

  // Snackbar
  const [snack, setSnack] = useState<{ msg: string; severity: 'success' | 'error' | 'info' } | null>(null);

  const loggedIn = useMemo(() => Boolean(token), [token]);
  const notifyApiError = useCallback((error: unknown) => {
    const message = (error as Error).message || 'Request failed';
    if (isSessionExpiredError(message)) {
      setToken(null);
      setSnack({ msg: 'Admin session expired. Please sign in again.', severity: 'error' });
      return;
    }
    setSnack({ msg: message, severity: 'error' });
  }, []);

  const syncRouteState = useCallback((pathname: string) => {
    const routeState = resolveAppRoute(pathname);
    setSection(routeState.section);
    setIntraSubSection(routeState.intraSubSection);
    setBacktestSubSection(routeState.backtestSubSection);
    setMarketSignalsSubSection(routeState.marketSignalsSubSection);
    setTradingDeskSubSection(routeState.tradingDeskSubSection);
  }, []);

  const navigateToSection = useCallback((
    nextSection: NavSection,
    nextIntraSubSection: IntraSubSection = intraSubSection,
    nextBacktestSubSection: BacktestSubSection = backtestSubSection,
    nextMarketSignalsSubSection: MarketSignalsSubSection = marketSignalsSubSection,
    nextTradingDeskSubSection: TradingDeskSubSection = tradingDeskSubSection,
  ) => {
    const nextPath = buildSectionPath(nextSection, nextIntraSubSection, nextBacktestSubSection, nextMarketSignalsSubSection, nextTradingDeskSubSection);
    if (location.pathname !== nextPath) {
      navigate(nextPath);
    }
    setSection(nextSection);
    setIntraSubSection(nextIntraSubSection);
    setBacktestSubSection(nextBacktestSubSection);
    setMarketSignalsSubSection(nextMarketSignalsSubSection);
    setTradingDeskSubSection(nextTradingDeskSubSection);
  }, [intraSubSection, backtestSubSection, location.pathname, marketSignalsSubSection, tradingDeskSubSection, navigate]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as Partial<PersistedSession>;
      if (parsed.tenantId?.trim()) setTenantId(parsed.tenantId.trim());
      if (parsed.username?.trim()) setUsername(parsed.username.trim());
      if (parsed.token?.trim()) setToken(parsed.token.trim());
      if (parsed.section && ['dashboard', 'migration', 'triggers', 'history', 'optionchain', 'trading', 'trading-scripts', 'intra', 'backtest', 'market-signals', 'trading-desk'].includes(parsed.section)) {
        setSection(parsed.section);
      }
      if (parsed.intraSubSection && ['intra-strategies', 'intra-monitor', 'intra-pnl'].includes(parsed.intraSubSection)) {
        setIntraSubSection(parsed.intraSubSection);
      }
      if (parsed.backtestSubSection && ['pnl', 'strategy-list'].includes(parsed.backtestSubSection)) {
        setBacktestSubSection(parsed.backtestSubSection);
      }
      if (parsed.marketSignalsSubSection && ['trading-param', 'trading-signal', 'market-trend', 'market-watch'].includes(parsed.marketSignalsSubSection)) {
        setMarketSignalsSubSection(parsed.marketSignalsSubSection);
      }
      // Migrate older sessions that stored intra routes under backtest subsection.
      const legacyBacktestSubSection = (parsed as { backtestSubSection?: string }).backtestSubSection;
      if (legacyBacktestSubSection && ['intra-strategies', 'intra-monitor', 'intra-pnl'].includes(legacyBacktestSubSection)) {
        setSection('intra');
        setIntraSubSection(legacyBacktestSubSection as IntraSubSection);
      }
      if (typeof parsed.sidebarCollapsed === 'boolean') {
        setSidebarCollapsed(parsed.sidebarCollapsed);
      }
      if (Array.isArray(parsed.pinnedNavItemKeys)) {
        const valid = parsed.pinnedNavItemKeys.filter((key): key is NavItemKey => typeof key === 'string') as NavItemKey[];
        if (valid.length > 0) setPinnedNavItemKeys(valid);
      }
      if (typeof parsed.expandedNavGroup === 'string' && ['quick-access', 'trading', 'analytics', 'admin'].includes(parsed.expandedNavGroup)) {
        setExpandedNavGroup(parsed.expandedNavGroup as NavGroupKey);
      }
    } catch {
      // ignore malformed browser session cache
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const preferredPath = resolvePreferredAppPath(location.pathname, window.location.hash);
    if (preferredPath !== location.pathname) {
      navigate(preferredPath, { replace: true });
      return;
    }
    syncRouteState(preferredPath);
  }, [location.pathname, navigate, syncRouteState]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!token) {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return;
    }
    const payload: PersistedSession = {
      tenantId: tenantId.trim(),
      username: username.trim(),
      token: token.trim(),
      section,
      intraSubSection,
      backtestSubSection,
      marketSignalsSubSection,
      tradingDeskSubSection,
      sidebarCollapsed,
      pinnedNavItemKeys,
      expandedNavGroup,
    };
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
  }, [token, tenantId, username, section, intraSubSection, backtestSubSection, marketSignalsSubSection, tradingDeskSubSection, sidebarCollapsed, pinnedNavItemKeys, expandedNavGroup]);

  // ─── Auto-refresh ──────────────────────────────────────────────────────────

  const refreshMigration = useCallback(async (options?: {
    silent?: boolean;
    instrumentKey?: string;
    timeframeUnit?: string;
    timeframeInterval?: string;
  }) => {
    if (!token) return;
    const silent = options?.silent ?? false;
    const instrumentFilter = options?.instrumentKey ?? appliedMigrationInstrumentKey;
    const timeframeUnitFilter = options?.timeframeUnit ?? appliedStatusUnit;
    const timeframeIntervalFilter = options?.timeframeInterval ?? appliedStatusInterval;
    const requestSeq = ++refreshRequestSeqRef.current;
    const loadingSeq = silent ? 0 : ++refreshLoadingSeqRef.current;
    if (!silent) {
      setMigrationLoading(true);
    }
    try {
      const [j, s] = await Promise.all([
        fetchMigrationJobs(tenantId.trim(), token, instrumentFilter || undefined),
        fetchMigrationStatus(
          tenantId.trim(),
          token,
          instrumentFilter || undefined,
          timeframeUnitFilter || undefined,
          timeframeIntervalFilter ? Number(timeframeIntervalFilter) : undefined,
        ),
      ]);
      if (requestSeq !== refreshRequestSeqRef.current) {
        return;
      }
      setJobs(j);
      setStatusRows(s);
      setMigrationError('');
    } catch (e) {
      const message = (e as Error).message || 'Unable to refresh migration jobs';
      if (isSessionExpiredError(message)) {
        setToken(null);
        setMigrationError('Admin session expired. Please sign in again.');
        return;
      }
      setMigrationError(message);
    } finally {
      if (!silent && loadingSeq === refreshLoadingSeqRef.current) {
        setMigrationLoading(false);
      }
    }
  }, [token, tenantId, appliedMigrationInstrumentKey, appliedStatusUnit, appliedStatusInterval]);

  const refreshUpstoxTokenStatus = useCallback(async () => {
    if (!token) return;
    setUpstoxTokenLoading(true);
    try {
      const status = await fetchUpstoxTokenStatus(tenantId.trim(), token);
      setUpstoxTokenStatus(status);
    } catch (e) {
      notifyApiError(e);
    } finally {
      setUpstoxTokenLoading(false);
    }
  }, [token, tenantId, notifyApiError]);

  const refreshOpenAiTokenStatus = useCallback(async () => {
    if (!token) return;
    setOpenAiTokenLoading(true);
    try {
      const status = await fetchOpenAiTokenStatus(tenantId.trim(), token);
      setOpenAiTokenStatus(status);
    } catch (e) {
      notifyApiError(e);
    } finally {
      setOpenAiTokenLoading(false);
    }
  }, [token, tenantId, notifyApiError]);

  useEffect(() => {
    if (autoRefresh && token) {
      autoRefreshRef.current = setInterval(() => {
        void refreshMigration({ silent: true });
      }, 5000);
    } else {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    }
    return () => { if (autoRefreshRef.current) clearInterval(autoRefreshRef.current); };
  }, [autoRefresh, token, refreshMigration]);

  useEffect(() => {
    if (!token) return;
    void refreshMigration();
    const syncTimer = setInterval(() => {
      void refreshMigration({ silent: true });
    }, 15000);
    return () => clearInterval(syncTimer);
  }, [token, refreshMigration]);

  // Load when switching to migration section
  useEffect(() => {
    if (section === 'migration' && token) {
      void refreshMigration();
      void refreshUpstoxTokenStatus();
      void refreshOpenAiTokenStatus();
    }
  }, [section, token, refreshMigration, refreshUpstoxTokenStatus, refreshOpenAiTokenStatus]);

  useEffect(() => {
    if (section !== 'migration' || migrationTab !== 0 || !token) return;
    void refreshMigration({ silent: true });
  }, [section, migrationTab, token, refreshMigration]);

  // ─── API Handlers ──────────────────────────────────────────────────────────

  const handleLogin = async () => {
    setLoginError('');
    if (!tenantId.trim()) {
      setLoginError('Tenant ID is required');
      return;
    }
    if (!username.trim()) {
      setLoginError('Username is required');
      return;
    }
    setLoginLoading(true);
    try {
      const result = await adminLogin(tenantId.trim(), username.trim(), password);
      setToken(result.token);
      setPassword('');
      setMigrationError('');
      // Refresh instrument catalog from backend so futures labels are always current
      try {
        const dtos = await fetchInstruments(tenantId.trim(), result.token);
        setInstruments(dtos.map((d: InstrumentDto) => ({ key: d.key, label: d.contractName ?? d.label, exchange: d.exchange })));
      } catch {
        // Non-fatal: keep static fallback if the API fails
      }
    } catch (e) {
      setLoginError((e as Error).message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setSection('dashboard');
    setIntraSubSection('intra-monitor');
    setBacktestSubSection('pnl');
    setJobs([]);
    setStatusRows([]);
    setHistoryRows([]);
    setMigrationInstrumentKey('');
    setStatusUnit('');
    setStatusInterval('');
    setAppliedMigrationInstrumentKey('');
    setAppliedStatusUnit('');
    setAppliedStatusInterval('');
    setMigrationError('');
    navigate('/');
  };

  const handleUpdateUpstoxToken = async () => {
    if (!token) return;
    if (!upstoxToken.trim()) {
      setSnack({ msg: 'Upstox token is required', severity: 'error' });
      return;
    }
    setUpstoxTokenSaving(true);
    try {
      const status = await updateUpstoxToken(tenantId.trim(), token, upstoxToken.trim());
      setUpstoxTokenStatus(status);
      setUpstoxToken('');
      setSnack({ msg: 'Upstox token updated', severity: 'success' });
    } catch (e) {
      notifyApiError(e);
    } finally {
      setUpstoxTokenSaving(false);
    }
  };

  const handleUpdateOpenAiToken = async () => {
    if (!token) return;
    if (!openAiToken.trim()) {
      setSnack({ msg: 'OpenAI API key is required', severity: 'error' });
      return;
    }
    setOpenAiTokenSaving(true);
    try {
      const status = await updateOpenAiToken(tenantId.trim(), token, openAiToken.trim());
      setOpenAiTokenStatus(status);
      setOpenAiToken('');
      setSnack({ msg: 'OpenAI API key updated', severity: 'success' });
    } catch (e) {
      notifyApiError(e);
    } finally {
      setOpenAiTokenSaving(false);
    }
  };

  const updateJobStatus = async (job: MigrationJob, action: JobAction) => {
    if (!token) return;
    const jobKey = buildJobKey(job.instrumentKey, job.timeframeUnit, job.timeframeInterval, job.jobType);
    setJobActionLoading(jobKey);
    try {
      let response: { status: string };
      if (action === 'start') response = await startMigrationJob(tenantId.trim(), token, jobKey);
      else if (action === 'pause') response = await pauseMigrationJob(tenantId.trim(), token, jobKey);
      else if (action === 'resume') response = await resumeMigrationJob(tenantId.trim(), token, jobKey);
      else response = await stopMigrationJob(tenantId.trim(), token, jobKey);
      const inst = instruments.find((i) => i.key === job.instrumentKey)?.label ?? job.instrumentKey;
      const tf = TIMEFRAME_OPTIONS.find((t) => t.unit === job.timeframeUnit && t.interval === job.timeframeInterval)?.label ?? `${job.timeframeInterval} ${job.timeframeUnit}`;
      setSnack({ msg: `${inst} · ${tf} · ${migrationJobTypeLabel(job.jobType)}: ${response.status}`, severity: 'info' });
      await refreshMigration();
    } catch (e) {
      notifyApiError(e);
    } finally {
      setJobActionLoading(null);
    }
  };

  const loadHistory = useCallback(async (
    nextPage = page,
    nextPageSize = rowsPerPage,
    nextSortBy = sortBy,
    nextSortDirection = sortDirection,
    overrides?: {
      instrumentKey?: string;
      timeframeUnit?: string;
      timeframeInterval?: string;
      from?: string;
      to?: string;
    },
  ) => {
    if (!token) return;
    const nextInstrumentKey = overrides?.instrumentKey ?? instrumentKey;
    const nextHistoryUnit = overrides?.timeframeUnit ?? historyUnit;
    const nextHistoryInterval = overrides?.timeframeInterval ?? historyInterval;
    const nextFrom = overrides?.from ?? from;
    const nextTo = overrides?.to ?? to;
    setHistoryLoading(true);
    try {
      const response = await fetchHistoricalData(tenantId.trim(), token, {
        instrumentKey: nextInstrumentKey || undefined,
        timeframeUnit: nextHistoryUnit || undefined,
        timeframeInterval: nextHistoryInterval ? Number(nextHistoryInterval) : undefined,
        from: toIsoOrUndefined(nextFrom),
        to: toIsoOrUndefined(nextTo),
        sortBy: nextSortBy,
        sortDirection: nextSortDirection,
        page: nextPage,
        size: nextPageSize,
      });
      setHistoryRows(response.content);
      setTotalElements(response.totalElements);
      setTotalPages(response.totalPages);
      setPage(nextPage);
      setRowsPerPage(nextPageSize);
    } catch (e) {
      notifyApiError(e);
    } finally {
      setHistoryLoading(false);
    }
  }, [token, tenantId, instrumentKey, historyUnit, historyInterval, from, to, page, rowsPerPage, sortBy, sortDirection, notifyApiError]);

  const loadHistoryChart = useCallback(async (
    overrides?: {
      instrumentKey?: string;
      timeframeUnit?: string;
      timeframeInterval?: string;
      from?: string;
      to?: string;
    },
  ) => {
    if (!token) return;
    const nextInstrumentKey = overrides?.instrumentKey ?? instrumentKey;
    const nextHistoryUnit = overrides?.timeframeUnit ?? historyUnit;
    const nextHistoryInterval = overrides?.timeframeInterval ?? historyInterval;
    const nextFrom = overrides?.from ?? from;
    const nextTo = overrides?.to ?? to;

    if (!nextInstrumentKey || !nextHistoryUnit || !nextHistoryInterval) {
      setHistoryChartRows([]);
      setHistoryChartError('');
      return;
    }

    setHistoryChartLoading(true);
    setHistoryChartError('');
    try {
      const response = await fetchHistoricalData(tenantId.trim(), token, {
        instrumentKey: nextInstrumentKey,
        timeframeUnit: nextHistoryUnit,
        timeframeInterval: Number(nextHistoryInterval),
        from: toIsoOrUndefined(nextFrom),
        to: toIsoOrUndefined(nextTo),
        sortBy: 'candleTs',
        sortDirection: 'desc',
        page: 0,
        size: 500,
      });
      setHistoryChartRows(response.content);
      if (response.content.length === 0) {
        setHistoryChartError('No candle data available for the selected chart range');
      }
    } catch (e) {
      setHistoryChartRows([]);
      setHistoryChartError((e as Error).message || 'Unable to load chart data');
      notifyApiError(e);
    } finally {
      setHistoryChartLoading(false);
    }
  }, [token, tenantId, instrumentKey, historyUnit, historyInterval, from, to, notifyApiError]);

  const applyFilters = () => {
    setFilterApplied(true);
    // Keep the paginated grid request as the last historical-data call so UI state and tests track the same request.
    void loadHistoryChart();
    void loadHistory(0);
  };

  const applyMigrationFilters = () => {
    setAppliedMigrationInstrumentKey(migrationInstrumentKey);
    setAppliedStatusUnit(statusUnit);
    setAppliedStatusInterval(statusInterval);
    setRuntimeJobsPage(0);
    setMigrationStatusPage(0);
    void refreshMigration({
      instrumentKey: migrationInstrumentKey,
      timeframeUnit: statusUnit,
      timeframeInterval: statusInterval,
    });
  };

  const clearMigrationFilters = () => {
    setMigrationInstrumentKey('');
    setStatusUnit('');
    setStatusInterval('');
    setRuntimeJobsPage(0);
    setMigrationStatusPage(0);
  };

  const clearHistoryFilters = () => {
    const defaultHistoryRange = getDefaultHistoryRange();
    setInstrumentKey('');
    setHistoryUnit('');
    setHistoryInterval('');
    setFrom(defaultHistoryRange.from);
    setTo(defaultHistoryRange.to);
    setFilterApplied(false);
    setHistoryRows([]);
    setHistoryChartRows([]);
    setHistoryChartError('');
    setTotalElements(0);
    setTotalPages(0);
    setPage(0);
    setSortBy('candleTs');
    setSortDirection('desc');
  };

  const handleHistoryChartTimeframeChange = (unit: string, interval: number) => {
    const nextHistoryInterval = String(interval);
    setHistoryUnit(unit);
    setHistoryInterval(nextHistoryInterval);
    setFilterApplied(true);
    void loadHistoryChart({
      instrumentKey,
      timeframeUnit: unit,
      timeframeInterval: nextHistoryInterval,
      from,
      to,
    });
    void loadHistory(0, rowsPerPage, sortBy, sortDirection, {
      instrumentKey,
      timeframeUnit: unit,
      timeframeInterval: nextHistoryInterval,
      from,
      to,
    });
  };

  const handleSort = (column: CandleSortKey) => {
    const nextDir: SortDir = sortBy === column && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortBy(column);
    setSortDirection(nextDir);
    loadHistory(page, rowsPerPage, column, nextDir);
  };

  // ─── Derived stats ─────────────────────────────────────────────────────────

  const runningJobs = jobs.filter((j) => j.status === 'RUNNING' || j.status === 'RESUMED');
  const completedStreams = statusRows.filter((r) => r.completed).length;
  const failedStreams = statusRows.filter((r) => r.lastRunStatus?.toLowerCase().includes('fail')).length;
  const hasAppliedMigrationFilters = Boolean(appliedMigrationInstrumentKey || appliedStatusUnit || appliedStatusInterval);
  const selectedHistoryInstrument = useMemo(
    () => instruments.find((instrument) => instrument.key === instrumentKey),
    [instrumentKey, instruments],
  );
  const selectedHistoryTimeframe = useMemo(
    () => TIMEFRAME_OPTIONS.find((timeframe) => timeframe.unit === historyUnit && timeframe.interval === Number(historyInterval)),
    [historyUnit, historyInterval],
  );
  const jobsByKey = useMemo(() => {
    const map = new Map<string, MigrationJob>();
    jobs.forEach((job) => {
      map.set(buildJobKey(job.instrumentKey, job.timeframeUnit, job.timeframeInterval, job.jobType), job);
    });
    return map;
  }, [jobs]);
  const runtimeJobsPageRows = useMemo(() => {
    const startIndex = runtimeJobsPage * runtimeJobsRowsPerPage;
    return jobs.slice(startIndex, startIndex + runtimeJobsRowsPerPage);
  }, [jobs, runtimeJobsPage, runtimeJobsRowsPerPage]);
  const migrationStatusPageRows = useMemo(() => {
    const startIndex = migrationStatusPage * migrationStatusRowsPerPage;
    return statusRows.slice(startIndex, startIndex + migrationStatusRowsPerPage);
  }, [statusRows, migrationStatusPage, migrationStatusRowsPerPage]);

  useEffect(() => {
    setRuntimeJobsPage((current) => {
      const lastPage = Math.max(0, Math.ceil(jobs.length / runtimeJobsRowsPerPage) - 1);
      return current > lastPage ? lastPage : current;
    });
  }, [jobs.length, runtimeJobsRowsPerPage]);

  useEffect(() => {
    setMigrationStatusPage((current) => {
      const lastPage = Math.max(0, Math.ceil(statusRows.length / migrationStatusRowsPerPage) - 1);
      return current > lastPage ? lastPage : current;
    });
  }, [statusRows.length, migrationStatusRowsPerPage]);

  // ─── Login Screen ──────────────────────────────────────────────────────────

  if (!loggedIn) {
    return (
      <>
        <CssBaseline />
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'background.default',
            background: 'linear-gradient(135deg, #0f172a 0%, #1a3a6b 50%, #0f172a 100%)',
            px: 2,
          }}
        >
          <Box sx={{ width: '100%', maxWidth: 400 }}>
            {/* Brand */}
            <Stack alignItems="center" spacing={1.5} sx={{ mb: 4 }}>
              <Avatar
                sx={{
                  width: 56,
                  height: 56,
                  bgcolor: 'rgba(255,255,255,0.1)',
                  border: '2px solid rgba(255,255,255,0.2)',
                }}
              >
                <ShowChartRoundedIcon sx={{ color: '#60a5fa', fontSize: 30 }} />
              </Avatar>
              <Box textAlign="center">
                <Typography variant="h4" fontWeight={800} sx={{ color: '#ffffff', letterSpacing: '-0.03em' }}>
                  InAlgo
                </Typography>
                <Typography variant="caption" sx={{ color: '#94a3b8', letterSpacing: '0.15em', fontSize: '0.7rem' }}>
                  TRADE ADMINISTRATION CONSOLE
                </Typography>
              </Box>
            </Stack>

            <Card sx={{ bgcolor: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.3)' }}>
              <CardContent sx={{ p: 3.5, '&:last-child': { pb: 3.5 } }}>
                <Typography variant="h6" fontWeight={700} sx={{ mb: 2.5 }}>
                  Sign In
                </Typography>
                <Stack spacing={2}>
                  <TextField
                    label="Tenant ID"
                    value={tenantId}
                    onChange={(e) => setTenantId(e.target.value)}
                    fullWidth
                    size="small"
                    InputProps={{
                      startAdornment: <StorageRoundedIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 18 }} />,
                    }}
                  />
                  <TextField
                    label="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    fullWidth
                    size="small"
                    InputProps={{
                      startAdornment: <AccountCircleRoundedIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 18 }} />,
                    }}
                  />
                  <TextField
                    label="Password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    fullWidth
                    size="small"
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  />
                  {loginError && <Alert severity="error" sx={{ py: 0.5 }}>{loginError}</Alert>}
                  <Button
                    variant="contained"
                    onClick={handleLogin}
                    disabled={loginLoading}
                    fullWidth
                    size="large"
                    sx={{
                      py: 1.2,
                      background: 'linear-gradient(135deg, #1a3a6b 0%, #2d5499 100%)',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                    }}
                  >
                    {loginLoading ? <CircularProgress size={20} color="inherit" /> : 'Sign In'}
                  </Button>
                </Stack>
              </CardContent>
            </Card>

            <Typography variant="caption" sx={{ color: '#64748b', display: 'block', textAlign: 'center', mt: 2 }}>
              InAlgo Trade Platform · NSE/BSE Financial Data
            </Typography>
          </Box>
        </Box>
      </>
    );
  }

  // ─── Dashboard Section ─────────────────────────────────────────────────────

  const DashboardSection = () => (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" fontWeight={700}>Dashboard</Typography>
        <Typography variant="body2" color="text.secondary">
          Platform overview — InAlgo Trade Data Console
        </Typography>
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            icon={<RocketLaunchRoundedIcon />}
            label="Migration Streams"
            value={statusRows.length}
            color="#1a3a6b"
            subtext={`${completedStreams} completed`}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            icon={<TrendingUpRoundedIcon />}
            label="Active Jobs"
            value={runningJobs.length}
            color="#0ea5e9"
            subtext={`${jobs.length} total jobs`}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            icon={<QueryStatsRoundedIcon />}
            label="Historical Candles"
            value={totalElements.toLocaleString()}
            color="#10b981"
            subtext="in current view"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            icon={failedStreams > 0 ? <ErrorRoundedIcon /> : <CheckCircleRoundedIcon />}
            label="Failed Streams"
            value={failedStreams}
            color={failedStreams > 0 ? '#ef4444' : '#10b981'}
            subtext={failedStreams > 0 ? 'Needs attention' : 'All healthy'}
          />
        </Grid>
      </Grid>

      {/* Quick Instrument Status */}
      <Card>
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
            Instruments Overview
          </Typography>
          <Grid container spacing={2}>
            {instruments.map((inst) => {
              const instStreams = statusRows.filter((r) => r.instrumentKey === inst.key);
              const instCompleted = instStreams.filter((r) => r.completed).length;
              return (
                <Grid item xs={12} md={4} key={inst.key}>
                  <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                      <InstrumentBadge instrumentKey={inst.key} />
                      <Chip
                        label={`${instCompleted}/${instStreams.length}`}
                        size="small"
                        color={instCompleted === instStreams.length && instStreams.length > 0 ? 'success' : 'default'}
                      />
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={instStreams.length > 0 ? (instCompleted / instStreams.length) * 100 : 0}
                      color="success"
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      {instCompleted} of {instStreams.length} timeframes completed
                    </Typography>
                  </Box>
                </Grid>
              );
            })}
          </Grid>
        </CardContent>
      </Card>

      {/* Timeframe summary */}
      <Card>
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
            Timeframe Coverage
          </Typography>
          <Grid container spacing={1}>
            {TIMEFRAME_OPTIONS.map((tf) => {
              const tfStreams = statusRows.filter((r) => r.timeframeUnit === tf.unit && r.timeframeInterval === tf.interval);
              const tfCompleted = tfStreams.filter((r) => r.completed).length;
              return (
                <Grid item xs={6} sm={4} md={3} key={`${tf.unit}-${tf.interval}`}>
                  <Box sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1.5, textAlign: 'center' }}>
                    <Chip
                      label={tf.label}
                      size="small"
                      color={tfCompleted === tfStreams.length && tfStreams.length > 0 ? 'success' : tfCompleted > 0 ? 'info' : 'default'}
                      sx={{ mb: 0.5 }}
                    />
                    <Typography variant="caption" display="block" color="text.secondary">
                      {tfCompleted}/{tfStreams.length} done
                    </Typography>
                  </Box>
                </Grid>
              );
            })}
          </Grid>
        </CardContent>
      </Card>
    </Stack>
  );

  // ─── Migration Section ─────────────────────────────────────────────────────

  const MigrationSection = () => (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1.5}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Migration Jobs</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage data ingestion jobs across all instruments and timeframes
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
          <Tooltip title={autoRefresh ? 'Disable auto-refresh' : 'Enable 5s auto-refresh'}>
            <Button
              variant={autoRefresh ? 'contained' : 'outlined'}
              size="small"
              color="secondary"
              startIcon={<AutorenewRoundedIcon sx={{ animation: autoRefresh ? 'spin 2s linear infinite' : 'none', '@keyframes spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } } }} />}
              onClick={() => setAutoRefresh((v) => !v)}
            >
              Auto-Refresh
            </Button>
          </Tooltip>
          <Button
            variant="outlined"
            size="small"
            startIcon={migrationLoading ? <CircularProgress size={14} /> : <RefreshRoundedIcon />}
            onClick={() => { void refreshMigration(); }}
            disabled={migrationLoading}
          >
            Refresh
          </Button>
        </Stack>
      </Stack>

      {migrationError && (
        <Alert severity="error" sx={{ py: 0.5 }}>
          {migrationError}
        </Alert>
      )}

      {/* Upstox token */}
      <Card>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.75 }}>
                Upstox Access Token
              </Typography>
              <TextField
                fullWidth
                size="small"
                type="password"
                placeholder="Paste the latest Upstox token"
                value={upstoxToken}
                onChange={(e) => setUpstoxToken(e.target.value)}
              />
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                variant="contained"
                size="small"
                onClick={handleUpdateUpstoxToken}
                disabled={upstoxTokenSaving || upstoxTokenLoading}
              >
                {upstoxTokenSaving ? <CircularProgress size={16} color="inherit" /> : 'Update Token'}
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={refreshUpstoxTokenStatus}
                disabled={upstoxTokenLoading}
              >
                {upstoxTokenLoading ? <CircularProgress size={16} /> : 'Refresh Status'}
              </Button>
            </Stack>
            <Stack spacing={0.5} sx={{ minWidth: 180 }}>
              <Typography variant="caption" color="text.secondary">
                Status
              </Typography>
              <Chip
                size="small"
                color={upstoxTokenStatus?.configured ? 'success' : 'warning'}
                label={upstoxTokenStatus?.configured ? 'Configured' : 'Not Configured'}
                sx={{ width: 'fit-content' }}
              />
              {upstoxTokenStatus?.updatedAt && (
                <Typography variant="caption" color="text.secondary">
                  Updated: {formatDateTime(upstoxTokenStatus.updatedAt)}
                </Typography>
              )}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.75 }}>
                OpenAI API Key
              </Typography>
              <TextField
                fullWidth
                size="small"
                type="password"
                placeholder="Paste the OpenAI API key"
                value={openAiToken}
                onChange={(e) => setOpenAiToken(e.target.value)}
              />
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                variant="contained"
                size="small"
                onClick={handleUpdateOpenAiToken}
                disabled={openAiTokenSaving || openAiTokenLoading}
              >
                {openAiTokenSaving ? <CircularProgress size={16} color="inherit" /> : 'Update Token'}
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={refreshOpenAiTokenStatus}
                disabled={openAiTokenLoading}
              >
                {openAiTokenLoading ? <CircularProgress size={16} /> : 'Refresh Status'}
              </Button>
            </Stack>
            <Stack spacing={0.5} sx={{ minWidth: 220 }}>
              <Typography variant="caption" color="text.secondary">
                Status
              </Typography>
              <Chip
                size="small"
                color={openAiTokenStatus?.configured ? 'success' : 'warning'}
                label={openAiTokenStatus?.configured ? 'Configured' : 'Not Configured'}
                sx={{ width: 'fit-content' }}
              />
              <Typography variant="caption" color="text.secondary">
                Model: {openAiTokenStatus?.model ?? 'gpt-5-mini'}{openAiTokenStatus?.enabled === false ? ' · disabled' : ''}
              </Typography>
              {openAiTokenStatus?.updatedAt && (
                <Typography variant="caption" color="text.secondary">
                  Updated: {formatDateTime(openAiTokenStatus.updatedAt)}
                </Typography>
              )}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* Filter row */}
      <Card>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
            <FilterAltRoundedIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
            <FormControl size="small" sx={{ minWidth: 220 }} data-testid="migration-instrument-filter">
              <InputLabel shrink>Instrument</InputLabel>
              <Select
                native
                value={migrationInstrumentKey}
                onChange={(e) => setMigrationInstrumentKey(e.target.value)}
                label="Instrument"
                inputProps={{ 'aria-label': 'Instrument' }}
              >
                <option value="">All Instruments</option>
                {instruments.map((instrument) => (
                  <option key={instrument.key} value={instrument.key}>
                    {instrument.label}
                  </option>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Filter Unit</InputLabel>
              <Select value={statusUnit} onChange={(e) => setStatusUnit(e.target.value)} label="Filter Unit">
                <MenuItem value="">All Units</MenuItem>
                <MenuItem value="minutes">Minutes</MenuItem>
                <MenuItem value="days">Days</MenuItem>
                <MenuItem value="weeks">Weeks</MenuItem>
                <MenuItem value="months">Months</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Interval"
              type="number"
              size="small"
              value={statusInterval}
              onChange={(e) => setStatusInterval(e.target.value)}
              sx={{ width: 100 }}
            />
            <Button size="small" variant="outlined" onClick={applyMigrationFilters}>
              Apply Filters
            </Button>
            {(migrationInstrumentKey || statusUnit || statusInterval) && (
              <IconButton
                size="small"
                onClick={clearMigrationFilters}
              >
                <ClearRoundedIcon fontSize="small" />
              </IconButton>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Tabs value={migrationTab} onChange={(_, v) => setMigrationTab(v)} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
        <Tab label={
          <Stack direction="row" spacing={0.75} alignItems="center">
            <span>Runtime Jobs</span>
            {runningJobs.length > 0 && (
              <Badge badgeContent={runningJobs.length} color="info" sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', height: 16, minWidth: 16 } }} />
            )}
          </Stack>
        } />
        <Tab label={
          <Stack direction="row" spacing={0.75} alignItems="center">
            <span>Migration State</span>
            <Badge badgeContent={statusRows.length} color="primary" sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', height: 16, minWidth: 16 } }} />
          </Stack>
        } />
      </Tabs>

      {/* Runtime Jobs tab */}
      {migrationTab === 0 && (
        <Box>
          {jobs.length === 0 ? (
            <Paper sx={{ p: 6, textAlign: 'center', border: '2px dashed', borderColor: 'divider' }}>
              <RocketLaunchRoundedIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
              <Typography variant="h6" color="text.secondary">
                {hasAppliedMigrationFilters ? 'No migration jobs match current filters' : 'No migration jobs running'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {hasAppliedMigrationFilters
                  ? 'Adjust the migration filters or clear them to view all configured jobs.'
                  : 'No configured migration jobs were found for this tenant.'}
              </Typography>
            </Paper>
          ) : (
            <Grid container spacing={2}>
              {runtimeJobsPageRows.map((job) => (
                <Grid
                  item
                  xs={12}
                  sm={6}
                  lg={4}
                  key={buildJobKey(job.instrumentKey, job.timeframeUnit, job.timeframeInterval, job.jobType)}
                >
                  <JobCard
                    job={job}
                    onAction={updateJobStatus}
                    loading={jobActionLoading === buildJobKey(job.instrumentKey, job.timeframeUnit, job.timeframeInterval, job.jobType)}
                  />
                </Grid>
              ))}
            </Grid>
          )}

          {/* Summary row */}
          {jobs.length > 0 && (
            <Card sx={{ mt: 2, bgcolor: '#f8fafc' }}>
              <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Stack direction="row" spacing={2} flexWrap="wrap" gap={1}>
                  {(['RUNNING', 'RESUMED', 'PAUSED', 'STOPPED', 'COMPLETED', 'FAILED'] as const).map((s) => {
                    const count = jobs.filter((j) => j.status === s).length;
                    if (count === 0) return null;
                    return (
                      <Stack key={s} direction="row" spacing={0.5} alignItems="center">
                        <Chip label={`${s}: ${count}`} size="small" color={statusTone(s)} />
                      </Stack>
                    );
                  })}
                </Stack>
              </CardContent>
            </Card>
          )}
          {jobs.length > 0 && (
            <Box
              data-testid="runtime-jobs-pagination"
              sx={{ mt: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
            >
              <TablePagination
                component="div"
                count={jobs.length}
                page={runtimeJobsPage}
                onPageChange={(_, nextPage) => setRuntimeJobsPage(nextPage)}
                rowsPerPage={runtimeJobsRowsPerPage}
                onRowsPerPageChange={(event) => {
                  setRuntimeJobsRowsPerPage(parseInt(event.target.value, 10));
                  setRuntimeJobsPage(0);
                }}
                rowsPerPageOptions={[6, 12, 18, 24]}
                labelRowsPerPage="Jobs per page"
                showFirstButton
                showLastButton
                sx={{ '& .MuiTablePagination-toolbar': { minHeight: 44 }, '& .MuiTablePagination-displayedRows': { fontSize: '0.78rem' } }}
              />
            </Box>
          )}
        </Box>
      )}

      {/* Migration State tab */}
      {migrationTab === 1 && (
        <Box>
          <TableContainer component={Paper} sx={{ border: '1px solid', borderColor: 'divider' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Instrument</TableCell>
                  <TableCell>Timeframe</TableCell>
                  <TableCell>Next From Date</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Completed</TableCell>
                  <TableCell>Last Run At</TableCell>
                  <TableCell>Last Error</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {statusRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                      {hasAppliedMigrationFilters
                        ? 'No migration status rows match the current filters.'
                        : 'No migration state data. Run "Refresh" to load.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  migrationStatusPageRows.map((row) => {
                    const jobKey = buildJobKey(
                      row.instrumentKey,
                      row.timeframeUnit,
                      row.timeframeInterval,
                      DEFAULT_MIGRATION_JOB_TYPE
                    );
                    const linkedJob = jobsByKey.get(jobKey);
                    const normalizedStatus = toJobStatus(row.lastRunStatus);
                    const inferredStatus = row.completed
                      ? 'COMPLETED'
                      : ['RUNNING', 'RESUMED', 'PAUSED', 'STOPPED', 'FAILED', 'PENDING'].includes(normalizedStatus)
                        ? normalizedStatus
                        : 'PENDING';
                    const actionJob: MigrationJob = linkedJob ?? {
                      instrumentKey: row.instrumentKey,
                      timeframeUnit: row.timeframeUnit,
                      timeframeInterval: row.timeframeInterval,
                      jobType: DEFAULT_MIGRATION_JOB_TYPE,
                      bootstrapFromDate: row.nextFromDate,
                      status: inferredStatus,
                      progressPercent: row.completed ? 100 : 0,
                      lastError: row.lastError,
                      nextFromDate: row.nextFromDate,
                      updatedAt: row.updatedAt,
                    };
                    const actionLoading = jobActionLoading === jobKey;
                    const { canStart, canPause, canResume, canStop, startActionLabel } = getJobActionState(actionJob.status);

                    return (
                      <TableRow key={`${row.instrumentKey}-${row.timeframeUnit}-${row.timeframeInterval}`}>
                        <TableCell><InstrumentBadge instrumentKey={row.instrumentKey} /></TableCell>
                        <TableCell><TimeframeBadge unit={row.timeframeUnit} interval={row.timeframeInterval} /></TableCell>
                        <TableCell>
                          <Typography variant="body2" fontFamily="monospace" fontSize="0.78rem">
                            {row.nextFromDate}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={row.lastRunStatus}
                            size="small"
                            color={statusTone(row.lastRunStatus)}
                            icon={<StatusIcon status={row.lastRunStatus} />}
                          />
                        </TableCell>
                        <TableCell align="center">
                          {row.completed
                            ? <CheckCircleRoundedIcon color="success" fontSize="small" />
                            : <Typography variant="body2" color="text.secondary">—</Typography>}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {row.lastRunAt ? formatDateTime(row.lastRunAt) : '—'}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ maxWidth: 200 }}>
                          {row.lastError ? (
                            <Tooltip title={row.lastError}>
                              <Typography variant="caption" color="error" sx={{ cursor: 'help' }} noWrap display="block">
                                {row.lastError}
                              </Typography>
                            </Tooltip>
                          ) : (
                            <Typography variant="body2" color="text.secondary">—</Typography>
                          )}
                        </TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end" flexWrap="wrap">
                            {canStart && (
                              <Button
                                size="small"
                                variant="outlined"
                                color="success"
                                startIcon={actionLoading ? <CircularProgress size={12} /> : <PlayCircleRoundedIcon fontSize="small" />}
                                onClick={() => { void updateJobStatus(actionJob, 'start'); }}
                                disabled={actionLoading}
                              >
                                {startActionLabel}
                              </Button>
                            )}
                            {canPause && (
                              <Button
                                size="small"
                                variant="outlined"
                                color="warning"
                                startIcon={actionLoading ? <CircularProgress size={12} /> : <PauseCircleRoundedIcon fontSize="small" />}
                                onClick={() => { void updateJobStatus(actionJob, 'pause'); }}
                                disabled={actionLoading}
                              >
                                Pause
                              </Button>
                            )}
                            {canResume && (
                              <Button
                                size="small"
                                variant="outlined"
                                color="info"
                                startIcon={actionLoading ? <CircularProgress size={12} /> : <AutorenewRoundedIcon fontSize="small" />}
                                onClick={() => { void updateJobStatus(actionJob, 'resume'); }}
                                disabled={actionLoading}
                              >
                                Resume
                              </Button>
                            )}
                            {canStop && (
                              <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                startIcon={actionLoading ? <CircularProgress size={12} /> : <StopCircleRoundedIcon fontSize="small" />}
                                onClick={() => { void updateJobStatus(actionJob, 'stop'); }}
                                disabled={actionLoading}
                              >
                                Stop
                              </Button>
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {statusRows.length > 0 && (
            <Box
              data-testid="migration-status-pagination"
              sx={{ border: '1px solid', borderColor: 'divider', borderTop: 0, borderRadius: '0 0 4px 4px' }}
            >
              <TablePagination
                component="div"
                count={statusRows.length}
                page={migrationStatusPage}
                onPageChange={(_, nextPage) => setMigrationStatusPage(nextPage)}
                rowsPerPage={migrationStatusRowsPerPage}
                onRowsPerPageChange={(event) => {
                  setMigrationStatusRowsPerPage(parseInt(event.target.value, 10));
                  setMigrationStatusPage(0);
                }}
                rowsPerPageOptions={[10, 25, 50, 100]}
                labelRowsPerPage="Rows per page"
                showFirstButton
                showLastButton
                sx={{ '& .MuiTablePagination-toolbar': { minHeight: 44 }, '& .MuiTablePagination-displayedRows': { fontSize: '0.78rem' } }}
              />
            </Box>
          )}
        </Box>
      )}
    </Stack>
  );

  // ─── Historical Data Section ───────────────────────────────────────────────

  const candleColumns: { key: CandleSortKey; label: string; align?: 'right' }[] = [
    { key: 'candleTs',   label: 'Timestamp' },
    { key: 'openPrice',  label: 'Open',   align: 'right' },
    { key: 'highPrice',  label: 'High',   align: 'right' },
    { key: 'lowPrice',   label: 'Low',    align: 'right' },
    { key: 'closePrice', label: 'Close',  align: 'right' },
    { key: 'volume',     label: 'Volume', align: 'right' },
  ];

  const HistorySection = () => (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Historical Data</Typography>
          <Typography variant="body2" color="text.secondary">
            Browse OHLCV candle data by instrument, timeframe, and date range
          </Typography>
        </Box>
        {historyRows.length > 0 && (
          <Chip
            icon={<AssessmentRoundedIcon />}
            label={`${totalElements.toLocaleString()} candles`}
            color="primary"
            variant="outlined"
          />
        )}
      </Stack>

      <HistorySectionCard
        title="Filters"
        icon={<FilterAltRoundedIcon sx={{ color: 'text.secondary', fontSize: 18 }} />}
        collapsed={historyFiltersCollapsed}
        onToggle={() => setHistoryFiltersCollapsed((current) => !current)}
      >
        <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
          <Stack spacing={2}>
            <Grid container spacing={1.5}>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Instrument</InputLabel>
                  <Select value={instrumentKey} onChange={(e) => setInstrumentKey(e.target.value)} label="Instrument">
                    <MenuItem value=""><em>All Instruments</em></MenuItem>
                    {instruments.map((inst) => (
                      <MenuItem key={inst.key} value={inst.key}>
                        <Stack direction="row" spacing={0.75} alignItems="center">
                          <Chip label={inst.exchange} size="small" sx={{ height: 16, fontSize: '0.6rem', fontWeight: 700 }} />
                          <span>{inst.label}</span>
                        </Stack>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={4.5}>
                <TextField
                  label="From"
                  type="datetime-local"
                  size="small"
                  fullWidth
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={4.5}>
                <TextField
                  label="To"
                  type="datetime-local"
                  size="small"
                  fullWidth
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            </Grid>

            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" gap={1}>
              <Button
                variant="contained"
                startIcon={historyLoading ? <CircularProgress size={14} color="inherit" /> : <SearchRoundedIcon />}
                onClick={applyFilters}
                disabled={historyLoading}
                sx={{ background: 'linear-gradient(135deg, #1a3a6b 0%, #2d5499 100%)' }}
              >
                Apply Filters
              </Button>
              {filterApplied && (
                <Button
                  variant="outlined"
                  color="inherit"
                  startIcon={<FilterAltOffRoundedIcon />}
                  onClick={clearHistoryFilters}
                  size="small"
                >
                  Clear Filters
                </Button>
              )}
              <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5}>
                {TIMEFRAME_OPTIONS.map((tf) => (
                  <Chip
                    key={`${tf.unit}-${tf.interval}`}
                    label={tf.label}
                    size="small"
                    clickable
                    variant={historyUnit === tf.unit && historyInterval === String(tf.interval) ? 'filled' : 'outlined'}
                    color={historyUnit === tf.unit && historyInterval === String(tf.interval) ? 'primary' : 'default'}
                    onClick={() => {
                      setHistoryUnit(tf.unit);
                      setHistoryInterval(String(tf.interval));
                    }}
                  />
                ))}
              </Stack>
            </Stack>
          </Stack>
        </CardContent>
      </HistorySectionCard>

      <HistorySectionCard
        title="Chart"
        icon={<CandlestickChartRoundedIcon sx={{ color: 'text.secondary', fontSize: 18 }} />}
        collapsed={historyChartCollapsed}
        onToggle={() => setHistoryChartCollapsed((current) => !current)}
        extra={(
          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" justifyContent="flex-end">
            {selectedHistoryInstrument && (
              <Chip size="small" label={selectedHistoryInstrument.label} variant="outlined" />
            )}
            {selectedHistoryTimeframe && (
              <Chip size="small" label={selectedHistoryTimeframe.label} color="primary" variant="outlined" />
            )}
          </Stack>
        )}
      >
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          {!filterApplied ? (
            <Alert severity="info" variant="outlined">
              Choose an instrument and timeframe, then click `Apply Filters` to load the chart and candle grid.
            </Alert>
          ) : !instrumentKey || !selectedHistoryTimeframe ? (
            <Alert severity="warning" variant="outlined">
              Select a single instrument and timeframe to render the Historical Data chart.
            </Alert>
          ) : (
            <ProChartCanvas
              key={`historical-data-chart-${instrumentKey}-${selectedHistoryTimeframe.unit}-${selectedHistoryTimeframe.interval}-${from}-${to}`}
              chartId="historical-data-chart"
              candles={historyChartRows}
              height={420}
              loading={historyChartLoading}
              error={historyChartError}
              instrumentKey={instrumentKey}
              timeframeUnit={selectedHistoryTimeframe.unit}
              timeframeInterval={selectedHistoryTimeframe.interval}
              timeframeOptions={TIMEFRAME_OPTIONS}
              onTimeframeChange={handleHistoryChartTimeframeChange}
              defaultColorMode="light"
              defaultIndicators={{
                volume: true,
                ema: true,
                sma: false,
                vwap: false,
                bollinger: false,
                pivots: false,
                macd: false,
                rsi: false,
              }}
            />
          )}
        </CardContent>
      </HistorySectionCard>

      {/* Info bar */}
      {filterApplied && (
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={0.5}>
          <Typography variant="body2" color="text.secondary">
            {historyLoading ? (
              <CircularProgress size={12} sx={{ mr: 0.5 }} />
            ) : (
              <>
                {totalElements > 0
                  ? `Showing ${historyRows.length.toLocaleString()} of ${totalElements.toLocaleString()} candles`
                  : 'No candles found'}
                {totalPages > 1 ? ` · Page ${page + 1} of ${totalPages}` : ''}
              </>
            )}
          </Typography>
          {historyRows.length > 0 && (
            <Stack direction="row" spacing={0.5}>
              {instrumentKey && <Chip label={instruments.find((i) => i.key === instrumentKey)?.label ?? instrumentKey} size="small" onDelete={() => setInstrumentKey('')} />}
              {historyUnit && historyInterval && (
                <Chip
                  label={TIMEFRAME_OPTIONS.find((t) => t.unit === historyUnit && t.interval === Number(historyInterval))?.label ?? `${historyInterval} ${historyUnit}`}
                  size="small"
                  onDelete={() => { setHistoryUnit(''); setHistoryInterval(''); }}
                />
              )}
            </Stack>
          )}
        </Stack>
      )}

      {/* Data grid */}
      {filterApplied && (
        <Paper sx={{ border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
          {historyLoading && <LinearProgress />}
          <TableContainer sx={{ maxHeight: 'calc(100vh - 420px)', minHeight: 200 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ minWidth: 160 }}>Instrument</TableCell>
                  <TableCell sx={{ minWidth: 90 }}>Timeframe</TableCell>
                  {candleColumns.map(({ key, label, align }) => (
                    <TableCell
                      key={key}
                      align={align}
                      sortDirection={sortBy === key ? sortDirection : false}
                      sx={{ minWidth: key === 'candleTs' ? 170 : key === 'volume' ? 110 : 90, whiteSpace: 'nowrap' }}
                    >
                      <TableSortLabel
                        active={sortBy === key}
                        direction={sortBy === key ? sortDirection : 'asc'}
                        onClick={() => handleSort(key)}
                      >
                        {label}
                      </TableSortLabel>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {historyRows.length === 0 && !historyLoading ? (
                  <TableRow>
                    <TableCell colSpan={candleColumns.length + 2} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                      No candles found for the selected filters
                    </TableCell>
                  </TableRow>
                ) : (
                  historyRows.map((row, idx) => {
                    const prevRow = historyRows[idx - 1];
                    const priceChange = prevRow ? Number(row.closePrice) - Number(prevRow.closePrice) : 0;
                    const isUp = priceChange >= 0;
                    return (
                      <TableRow key={`${row.instrumentKey}-${row.timeframeUnit}-${row.timeframeInterval}-${row.candleTs}`}
                        sx={{
                          '&:nth-of-type(even)': { bgcolor: '#fafbfc' },
                          '&:hover': { bgcolor: '#f0f4ff !important' },
                        }}
                      >
                        <TableCell><InstrumentBadge instrumentKey={row.instrumentKey} /></TableCell>
                        <TableCell><TimeframeBadge unit={row.timeframeUnit} interval={row.timeframeInterval} /></TableCell>
                        <TableCell>
                          <Typography variant="body2" fontFamily="monospace" fontSize="0.76rem" noWrap>
                            {formatDateTime(row.candleTs)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontFamily="monospace" fontSize="0.78rem">
                            {Number(row.openPrice).toFixed(2)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontFamily="monospace" fontSize="0.78rem" sx={{ color: 'success.dark', fontWeight: 600 }}>
                            {Number(row.highPrice).toFixed(2)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontFamily="monospace" fontSize="0.78rem" sx={{ color: 'error.dark', fontWeight: 600 }}>
                            {Number(row.lowPrice).toFixed(2)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="body2"
                            fontFamily="monospace"
                            fontSize="0.78rem"
                            fontWeight={700}
                            sx={{ color: idx === 0 ? 'text.primary' : isUp ? 'success.dark' : 'error.dark' }}
                          >
                            {Number(row.closePrice).toFixed(2)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" color="text.secondary" fontFamily="monospace" fontSize="0.76rem">
                            {row.volume != null ? Number(row.volume).toLocaleString() : '—'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {totalElements > 0 && (
            <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
              <TablePagination
                component="div"
                count={totalElements}
                page={page}
                onPageChange={(_, newPage) => loadHistory(newPage, rowsPerPage, sortBy, sortDirection)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(e) => loadHistory(0, parseInt(e.target.value, 10), sortBy, sortDirection)}
                rowsPerPageOptions={[10, 25, 50, 100, 200]}
                showFirstButton
                showLastButton
                sx={{ '& .MuiTablePagination-toolbar': { minHeight: 44 }, '& .MuiTablePagination-displayedRows': { fontSize: '0.78rem' } }}
              />
            </Box>
          )}
        </Paper>
      )}

      {!filterApplied && (
        <Paper sx={{ p: 6, textAlign: 'center', border: '2px dashed', borderColor: 'divider' }}>
          <BarChartRoundedIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
          <Typography variant="h6" color="text.secondary">Select filters to view candle data</Typography>
          <Typography variant="body2" color="text.secondary">
            Choose an instrument and timeframe, then click "Apply Filters"
          </Typography>
        </Paper>
      )}
    </Stack>
  );

  // ─── Advanced Trading Desk (fullscreen — no sidebar/header) ───────────────
  if (section === 'trading-desk') {
    return (
      <>
        <CssBaseline />
        <AdvancedTradingDesk
          token={token!}
          tenantId={tenantId.trim()}
          username={username.trim()}
          onNotify={setSnack}
          onClose={() => navigateToSection('dashboard', intraSubSection, backtestSubSection, marketSignalsSubSection, tradingDeskSubSection)}
        />
        <Snackbar
          open={Boolean(snack)}
          autoHideDuration={4000}
          onClose={() => setSnack(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          {snack ? (
            <Alert severity={snack.severity} onClose={() => setSnack(null)} variant="filled"
              sx={{ minWidth: 280, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
              {snack.msg}
            </Alert>
          ) : undefined}
        </Snackbar>
      </>
    );
  }

  // ─── Layout ────────────────────────────────────────────────────────────────

  const sidebarContent = (
    <SidebarContent
      collapsed={!isMobile && sidebarCollapsed}
      section={section}
      onSection={(nextSection) => {
        const defaultIntraSubSection = nextSection === 'intra' ? 'intra-monitor' : intraSubSection;
        const defaultBacktestSubSection = nextSection === 'backtest' ? 'pnl' : backtestSubSection;
        const defaultMarketSignalsSubSection = nextSection === 'market-signals' ? 'trading-param' : marketSignalsSubSection;
        const defaultTradingDeskSubSection = nextSection === 'trading-desk' ? 'advanced-trading' : tradingDeskSubSection;
        navigateToSection(nextSection, defaultIntraSubSection, defaultBacktestSubSection, defaultMarketSignalsSubSection, defaultTradingDeskSubSection);
      }}
      intraSubSection={intraSubSection}
      onIntraSubSection={(nextSubSection) => navigateToSection('intra', nextSubSection, backtestSubSection, marketSignalsSubSection, tradingDeskSubSection)}
      backtestSubSection={backtestSubSection}
      onBacktestSubSection={(nextSubSection) => navigateToSection('backtest', intraSubSection, nextSubSection, marketSignalsSubSection, tradingDeskSubSection)}
      marketSignalsSubSection={marketSignalsSubSection}
      onMarketSignalsSubSection={(nextSubSection) => navigateToSection('market-signals', intraSubSection, backtestSubSection, nextSubSection, tradingDeskSubSection)}
      tradingDeskSubSection={tradingDeskSubSection}
      onTradingDeskSubSection={(nextSubSection) => navigateToSection('trading-desk', intraSubSection, backtestSubSection, marketSignalsSubSection, nextSubSection)}
      pinnedNavItemKeys={pinnedNavItemKeys}
      onPinnedNavItemKeysChange={setPinnedNavItemKeys}
      expandedNavGroup={expandedNavGroup}
      onExpandedNavGroupChange={setExpandedNavGroup}
      tenantId={tenantId}
      onLogout={handleLogout}
      onClose={() => setSidebarOpen(false)}
      isMobile={isMobile}
    />
  );
  const sidebarWidth = !isMobile && sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;

  return (
    <>
      <CssBaseline />
      <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
        {/* Persistent sidebar — desktop */}
        {!isMobile && (
          <Drawer
            variant="permanent"
            sx={{
              width: sidebarWidth,
              flexShrink: 0,
              '& .MuiDrawer-paper': {
                width: sidebarWidth,
                boxSizing: 'border-box',
                bgcolor: 'background.paper',
                overflowX: 'hidden',
                transition: theme.transitions.create('width', {
                  duration: theme.transitions.duration.shorter,
                }),
              },
            }}
          >
            {sidebarContent}
          </Drawer>
        )}

        {/* Temporary drawer — mobile */}
        {isMobile && (
          <Drawer
            variant="temporary"
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            ModalProps={{ keepMounted: true }}
            sx={{
              '& .MuiDrawer-paper': { width: SIDEBAR_WIDTH, boxSizing: 'border-box', bgcolor: 'background.paper' },
            }}
          >
            {sidebarContent}
          </Drawer>
        )}

        {/* Main content */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
          {/* Top AppBar */}
          <AppBar
            position="sticky"
            color="inherit"
            elevation={0}
            sx={{ zIndex: (t) => t.zIndex.drawer - 1, borderBottom: '1px solid', borderColor: 'divider' }}
          >
            <Toolbar sx={{ minHeight: { xs: 52, sm: 60 }, px: { xs: 1.5, sm: 2 } }}>
              <Tooltip title={isMobile ? 'Open navigation' : (sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation')}>
                <IconButton
                  edge="start"
                  onClick={() => {
                    if (isMobile) {
                      setSidebarOpen(true);
                      return;
                    }
                    setSidebarCollapsed((current) => !current);
                  }}
                  sx={{ mr: 1 }}
                  data-testid="sidebar-collapse-toggle"
                  aria-label={isMobile ? 'Open navigation' : (sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation')}
                >
                  <MenuRoundedIcon />
                </IconButton>
              </Tooltip>

              {/* Breadcrumb */}
              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
                <TimelineRoundedIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
                  InAlgo
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>·</Typography>
                <Typography variant="body2" fontWeight={600} color="text.primary" noWrap>
                  {section === 'backtest'
                    ? `Backtest · ${backtestSubSection === 'strategy-list'
                      ? 'Strategy List'
                      : 'Backtest P&L'}`
                    : section === 'intra'
                      ? `Intra Trade · ${intraSubSection === 'intra-strategies'
                        ? 'Intra Strategies'
                        : intraSubSection === 'intra-pnl'
                          ? 'Intra P&L'
                          : 'Intra Monitor'}`
                    : section === 'trading-scripts'
                      ? 'Trading Scripts'
                    : section === 'market-signals'
                      ? `Market Signals · ${marketSignalsSubSection === 'market-watch' ? 'Market Watch' : marketSignalsSubSection === 'trading-signal' ? 'Trading Signal' : marketSignalsSubSection === 'market-trend' ? 'Market Trend' : 'Trading Param'}`
                      : (navItems.find((n) => n.section === section)?.label ?? 'Dashboard')}
                </Typography>
              </Stack>

              {/* Status indicators */}
              <Stack direction="row" spacing={1} alignItems="center">
                {runningJobs.length > 0 && (
                  <Tooltip title={`${runningJobs.length} jobs running`}>
                    <Chip
                      icon={<AutorenewRoundedIcon sx={{ animation: 'spin 2s linear infinite', '@keyframes spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } } }} />}
                      label={`${runningJobs.length} running`}
                      size="small"
                      color="info"
                      variant="outlined"
                      sx={{ display: { xs: 'none', sm: 'flex' } }}
                    />
                  </Tooltip>
                )}
                <Chip
                  label="Live"
                  size="small"
                  color="success"
                  variant="outlined"
                  sx={{ display: { xs: 'none', sm: 'flex' }, fontWeight: 700 }}
                />
                <Avatar sx={{ width: 30, height: 30, bgcolor: 'primary.main', fontSize: 13, fontWeight: 700 }}>
                  A
                </Avatar>
              </Stack>
            </Toolbar>
          </AppBar>

          {/* Page content */}
          <Box component="main" sx={{ flex: 1, p: { xs: 2, sm: 3 }, overflow: 'auto' }}>
            <Container maxWidth="xl" disableGutters>
              {section === 'dashboard' && <DashboardSection />}
              {section === 'migration' && <MigrationSection />}
              {section === 'triggers' && (
                <ManageTriggersPanel
                  token={token!}
                  tenantId={tenantId.trim()}
                  baseInstruments={instruments}
                  baseTimeframes={TIMEFRAME_OPTIONS}
                  onNotify={setSnack}
                />
              )}
              {section === 'history' && <HistorySection />}
              {section === 'optionchain' && (
                <OptionChainPanel
                  token={token!}
                  tenantId={tenantId.trim()}
                  onNotify={setSnack}
                />
              )}
              {section === 'trading' && (
                <TradingWindow
                  token={token!}
                  tenantId={tenantId.trim()}
                  username={username.trim()}
                  baseInstruments={instruments}
                  baseTimeframes={TIMEFRAME_OPTIONS}
                  onNotify={setSnack}
                />
              )}
              {section === 'trading-scripts' && (
                <TradingScriptsPage
                  token={token!}
                  tenantId={tenantId.trim()}
                  username={username.trim()}
                  baseInstruments={instruments}
                  onNotify={setSnack}
                />
              )}
              {section === 'backtest' && (
                <BacktestPanel
                  token={token!}
                  tenantId={tenantId.trim()}
                  username={username.trim()}
                  baseInstruments={instruments}
                  baseTimeframes={TIMEFRAME_OPTIONS}
                  activeView={backtestSubSection === 'strategy-list' ? 'strategy-list' : 'pnl'}
                  onNavigateToPnl={() => navigateToSection('backtest', intraSubSection, 'pnl', marketSignalsSubSection)}
                  onNotify={setSnack}
                />
              )}
              {section === 'intra' && (
                <IntraWorkspaceProvider
                  tenantId={tenantId.trim()}
                  username={username.trim()}
                  baseInstruments={instruments}
                  baseTimeframes={TIMEFRAME_OPTIONS}
                >
                  <Stack spacing={2.5}>
                    {intraSubSection !== 'intra-monitor' && <IntraWorkspaceHeader />}
                    {intraSubSection === 'intra-strategies' && (
                      <IntraStrategiesPage
                        token={token!}
                        tenantId={tenantId.trim()}
                        username={username.trim()}
                        onNotify={setSnack}
                      />
                    )}
                    {intraSubSection === 'intra-monitor' && (
                      <IntraMonitorPage
                        token={token!}
                        tenantId={tenantId.trim()}
                        username={username.trim()}
                        onNotify={setSnack}
                      />
                    )}
                    {intraSubSection === 'intra-pnl' && (
                      <IntraPnlPage
                        token={token!}
                        tenantId={tenantId.trim()}
                        username={username.trim()}
                        onNotify={setSnack}
                      />
                    )}
                  </Stack>
                </IntraWorkspaceProvider>
              )}
              {section === 'market-signals' && marketSignalsSubSection !== 'market-watch' && (
                <BacktestPanel
                  token={token!}
                  tenantId={tenantId.trim()}
                  username={username.trim()}
                  baseInstruments={instruments}
                  baseTimeframes={TIMEFRAME_OPTIONS}
                  activeView={marketSignalsSubSection}
                  onNavigateToPnl={() => navigateToSection('backtest', intraSubSection, 'pnl', marketSignalsSubSection)}
                  onNotify={setSnack}
                />
              )}
              {section === 'market-signals' && marketSignalsSubSection === 'market-watch' && (
                <MarketWatchPanel
                  token={token!}
                  tenantId={tenantId.trim()}
                  username={username.trim()}
                  onNotify={setSnack}
                />
              )}
            </Container>
          </Box>
        </Box>
      </Box>

      {/* Toast notifications */}
      <Snackbar
        open={Boolean(snack)}
        autoHideDuration={4000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        {snack ? (
          <Alert
            severity={snack.severity}
            onClose={() => setSnack(null)}
            variant="filled"
            sx={{ minWidth: 280, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}
          >
            {snack.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </>
  );
}
