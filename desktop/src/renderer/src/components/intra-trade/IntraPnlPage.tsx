import { Alert, Box, Button, Chip, Stack, Tab, Tabs, Typography } from '@mui/material';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { downloadIntraPnlExport, fetchIntraPnlDashboard, type IntraPnlDashboard } from '../../api/admin';
import { useIntraWorkspace } from './IntraWorkspaceContext';
import { formatPnlRupees } from './IntraTradeShared';
import { IntraPnlChartsCard } from './pnl/IntraPnlChartsCard';
import { IntraPnlFiltersCard } from './pnl/IntraPnlFiltersCard';
import { IntraPnlStrategyPerformanceCard } from './pnl/IntraPnlStrategyPerformanceCard';
import { IntraPnlSummaryCard } from './pnl/IntraPnlSummaryCard';
import { IntraPnlTopStatusStrip } from './pnl/IntraPnlTopStatusStrip';
import { IntraPnlTradeLedgerCard } from './pnl/IntraPnlTradeLedgerCard';
import type { DashboardFilters, PnlFilterState } from './pnl/pnlTypes';
import { dateRangeFromPreset, downloadBlob, pnlBg, pnlColor } from './pnl/pnlUtils';
import { UpstoxPortfolioTab } from './pnl/UpstoxPortfolioTab';

export const IntraPnlPage = ({
  token,
  tenantId,
  username,
  onNotify,
}: {
  token: string;
  tenantId: string;
  username: string;
  onNotify: (payload: { msg: string; severity: 'success' | 'error' | 'info' }) => void;
}) => {
  const navigate = useNavigate();
  const { resetWorkspace } = useIntraWorkspace();
  const [activeTab, setActiveTab] = useState(0);

  const [dashboard, setDashboard] = useState<IntraPnlDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastDashboardRefresh, setLastDashboardRefresh] = useState<Date | null>(null);

  const [filters, setFilters] = useState<PnlFilterState>({
    mode: 'ALL',
    status: 'ALL',
    preset: 'MONTH',
    customFromDate: '',
    customToDate: '',
    strategyFilter: '',
    instrumentFilter: '',
    accountFilter: tenantId + ':' + username,
  });

  const [secFilters, setSecFilters] = useState(true);
  const [secSummary, setSecSummary] = useState(true);
  const [secCharts, setSecCharts] = useState(true);
  const [secStrat, setSecStrat] = useState(true);
  const [secLedger, setSecLedger] = useState(true);

  const [stratSearch, setStratSearch] = useState('');
  const [stratPage, setStratPage] = useState(0);
  const [stratRpp, setStratRpp] = useState(10);
  const [stratSortBy, setStratSortBy] = useState<'totalPnl' | 'winRate' | 'numberOfTrades'>('totalPnl');
  const [stratSortAsc, setStratSortAsc] = useState(false);

  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerModeFilter, setLedgerModeFilter] = useState<'ALL' | 'PAPER' | 'LIVE'>('ALL');
  const [ledgerStatusFilter, setLedgerStatusFilter] = useState<'ALL' | 'OPEN' | 'CLOSED'>('ALL');
  const [ledgerSortBy, setLedgerSortBy] = useState<'dateTime' | 'pnl'>('dateTime');
  const [ledgerSortAsc, setLedgerSortAsc] = useState(false);
  const [ledgerPage, setLedgerPage] = useState(0);
  const [ledgerRpp, setLedgerRpp] = useState(25);

  const filterPayload = useMemo<DashboardFilters>(() => {
    const range = dateRangeFromPreset(filters.preset);
    return {
      mode: filters.mode === 'ALL' ? undefined : filters.mode,
      status: filters.status === 'ALL' ? undefined : filters.status,
      fromDate: filters.preset === 'CUSTOM' ? (filters.customFromDate || undefined) : range.fromDate,
      toDate: filters.preset === 'CUSTOM' ? (filters.customToDate || undefined) : range.toDate,
      strategy: filters.strategyFilter || undefined,
      instrument: filters.instrumentFilter || undefined,
      account: filters.accountFilter || undefined,
    };
  }, [filters]);

  const reloadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchIntraPnlDashboard(tenantId, token, username, filterPayload);
      setDashboard(response);
      setLastDashboardRefresh(new Date());
      setLedgerPage(0);
      setStratPage(0);
    } catch (error) {
      onNotify({ msg: (error as Error).message || 'Unable to load Intra P&L dashboard', severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [tenantId, token, username, filterPayload, onNotify]);

  useEffect(() => {
    if (activeTab === 0) {
      void reloadDashboard();
    }
  }, [activeTab, reloadDashboard]);

  const handleExport = async (format: 'CSV' | 'XLSX' | 'PDF') => {
    try {
      const blob = await downloadIntraPnlExport(tenantId, token, username, format, filterPayload);
      downloadBlob(blob, 'intra-pnl-report.' + format.toLowerCase());
      onNotify({ msg: 'Export downloaded (' + format + ')', severity: 'success' });
    } catch (error) {
      onNotify({ msg: (error as Error).message || 'Unable to export report', severity: 'error' });
    }
  };

  const filteredStrat = useMemo(() => {
    const needle = stratSearch.trim().toLowerCase();
    const rows = (dashboard?.strategyPerformance ?? []).filter((row) => !needle || row.strategyName.toLowerCase().includes(needle));
    rows.sort((a, b) => {
      const av = a[stratSortBy] as number;
      const bv = b[stratSortBy] as number;
      return stratSortAsc ? av - bv : bv - av;
    });
    return rows;
  }, [dashboard?.strategyPerformance, stratSearch, stratSortBy, stratSortAsc]);

  const filteredLedger = useMemo(() => {
    const needle = ledgerSearch.trim().toLowerCase();
    const rows = (dashboard?.tradeLedger ?? []).filter((row) => {
      if (ledgerModeFilter !== 'ALL' && row.tradeMode !== ledgerModeFilter) return false;
      if (ledgerStatusFilter !== 'ALL' && row.status !== ledgerStatusFilter) return false;
      if (!needle) return true;
      return row.instrument?.toLowerCase().includes(needle)
        || row.strategy?.toLowerCase().includes(needle)
        || row.exitReason?.toLowerCase().includes(needle);
    });
    rows.sort((a, b) => {
      if (ledgerSortBy === 'pnl') {
        return ledgerSortAsc ? a.pnl - b.pnl : b.pnl - a.pnl;
      }
      const ad = Date.parse(`${a.date}T${a.time}:00`);
      const bd = Date.parse(`${b.date}T${b.time}:00`);
      return ledgerSortAsc ? ad - bd : bd - ad;
    });
    return rows;
  }, [dashboard?.tradeLedger, ledgerSearch, ledgerModeFilter, ledgerStatusFilter, ledgerSortBy, ledgerSortAsc]);

  const openExposureCount = useMemo(
    () => (dashboard?.tradeLedger ?? []).filter((row) => row.status === 'OPEN').length,
    [dashboard?.tradeLedger],
  );

  const summary = dashboard?.summary ?? null;

  const toggleStratSort = (col: 'totalPnl' | 'winRate' | 'numberOfTrades') => {
    if (stratSortBy === col) {
      setStratSortAsc((v) => !v);
    } else {
      setStratSortBy(col);
      setStratSortAsc(false);
    }
  };

  const toggleLedgerSort = (col: 'dateTime' | 'pnl') => {
    if (ledgerSortBy === col) {
      setLedgerSortAsc((v) => !v);
    } else {
      setLedgerSortBy(col);
      setLedgerSortAsc(false);
    }
  };

  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
        <Stack spacing={0.25}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Typography variant="h5" fontWeight={800}>Intra P&L</Typography>
            {summary != null && (
              <Chip
                size="small"
                label={formatPnlRupees(summary.totalPnl)}
                sx={{
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  bgcolor: pnlBg(summary.totalPnl),
                  color: pnlColor(summary.totalPnl),
                  border: '1px solid',
                  borderColor: (summary.totalPnl ?? 0) > 0 ? '#bbf7d0' : (summary.totalPnl ?? 0) < 0 ? '#fecaca' : 'divider',
                }}
              />
            )}
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Performance analytics and live Upstox portfolio sync.
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button variant="outlined" onClick={resetWorkspace}>Clear Workspace</Button>
          <Button variant="contained" endIcon={<ArrowForwardRoundedIcon />} onClick={() => navigate('/intra/monitor')}>
            Open Intra Monitor
          </Button>
        </Stack>
      </Stack>

      {activeTab === 0 && (
        <IntraPnlTopStatusStrip
          filters={filters}
          summary={summary}
          openExposureCount={openExposureCount}
          lastRefreshed={lastDashboardRefresh}
        />
      )}

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)} aria-label="Intra P&L tabs">
          <Tab label="InAlgo P&L" id="intra-pnl-tab-0" aria-controls="intra-pnl-panel-0" data-testid="intra-pnl-tab-inalgo" />
          <Tab label="Upstox Portfolio" id="intra-pnl-tab-1" aria-controls="intra-pnl-panel-1" data-testid="intra-pnl-tab-upstox" />
        </Tabs>
      </Box>

      {activeTab === 0 && (
        <Stack spacing={2.5} role="tabpanel" id="intra-pnl-panel-0" aria-labelledby="intra-pnl-tab-0">
          <IntraPnlFiltersCard
            open={secFilters}
            filters={filters}
            loading={loading}
            onToggle={() => setSecFilters((v) => !v)}
            onFilterChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
            onApply={() => void reloadDashboard()}
            onExport={(format) => void handleExport(format)}
          />
          <IntraPnlSummaryCard open={secSummary} summary={summary} onToggle={() => setSecSummary((v) => !v)} />
          <IntraPnlChartsCard open={secCharts} dashboard={dashboard} onToggle={() => setSecCharts((v) => !v)} />
          <IntraPnlStrategyPerformanceCard
            open={secStrat}
            onToggle={() => setSecStrat((v) => !v)}
            rows={filteredStrat}
            search={stratSearch}
            onSearchChange={(value) => { setStratPage(0); setStratSearch(value); }}
            page={stratPage}
            rowsPerPage={stratRpp}
            onPageChange={setStratPage}
            onRowsPerPageChange={(rowsPerPage) => { setStratPage(0); setStratRpp(rowsPerPage); }}
            sortBy={stratSortBy}
            sortAsc={stratSortAsc}
            onSort={toggleStratSort}
          />
          <IntraPnlTradeLedgerCard
            open={secLedger}
            onToggle={() => setSecLedger((v) => !v)}
            rows={filteredLedger}
            search={ledgerSearch}
            onSearchChange={(value) => { setLedgerPage(0); setLedgerSearch(value); }}
            modeFilter={ledgerModeFilter}
            onModeFilterChange={(value) => { setLedgerPage(0); setLedgerModeFilter(value); }}
            statusFilter={ledgerStatusFilter}
            onStatusFilterChange={(value) => { setLedgerPage(0); setLedgerStatusFilter(value); }}
            page={ledgerPage}
            rowsPerPage={ledgerRpp}
            onPageChange={setLedgerPage}
            onRowsPerPageChange={(rowsPerPage) => { setLedgerPage(0); setLedgerRpp(rowsPerPage); }}
            sortBy={ledgerSortBy}
            sortAsc={ledgerSortAsc}
            onSort={toggleLedgerSort}
          />
          {loading && <Alert severity="info">Refreshing Intra P&L dashboard…</Alert>}
        </Stack>
      )}

      {activeTab === 1 && (
        <Box role="tabpanel" id="intra-pnl-panel-1" aria-labelledby="intra-pnl-tab-1">
          <UpstoxPortfolioTab token={token} tenantId={tenantId} username={username} />
        </Box>
      )}
    </Stack>
  );
};
