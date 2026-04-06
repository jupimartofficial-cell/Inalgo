import { useCallback, useEffect, useState } from 'react';
import {
  fetchMarketSentiments,
  fetchNewsFeedPreview,
  refreshMarketSentiment,
  type MarketSentimentRow,
  type NewsFeedPreviewResponse,
} from '../api/admin';
import { createDefaultMarketSentimentFilters, type MarketSentimentFilters, type SnackSeverity } from './BacktestPanelShared';

interface UseMarketSentimentViewArgs {
  tenantId: string;
  token: string;
  active: boolean;
  onNotify: (payload: { msg: string; severity: SnackSeverity }) => void;
}

export const useMarketSentimentView = ({ tenantId, token, active, onNotify }: UseMarketSentimentViewArgs) => {
  const [rows, setRows] = useState<MarketSentimentRow[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<NewsFeedPreviewResponse | null>(null);
  const [filterDraft, setFilterDraft] = useState<MarketSentimentFilters>(createDefaultMarketSentimentFilters);
  const [filters, setFilters] = useState<MarketSentimentFilters>(createDefaultMarketSentimentFilters);

  const reload = useCallback(async (pageArg = page, sizeArg = rowsPerPage) => {
    setLoading(true);
    try {
      const response = await fetchMarketSentiments(tenantId, token, {
        marketScope: filters.marketScope || undefined,
        trendStatus: filters.trendStatus || undefined,
        fromSnapshotAt: filters.fromDate ? `${filters.fromDate}T00:00:00.000Z` : undefined,
        toSnapshotAt: filters.toDate ? `${filters.toDate}T23:59:59.999Z` : undefined,
        page: pageArg,
        size: sizeArg,
      });
      if (response.content.length === 0 && response.totalElements > 0 && pageArg > 0) {
        setPage(pageArg - 1);
        return;
      }
      setRows(response.content);
      setTotalElements(response.totalElements);
    } catch (error) {
      onNotify({ msg: (error as Error).message || 'Unable to load market trends', severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [filters, onNotify, page, rowsPerPage, tenantId, token]);

  useEffect(() => {
    if (!active) return;
    void reload();
  }, [active, reload]);

  const applyFilters = () => {
    setPage(0);
    setFilters({ ...filterDraft });
  };

  const resetFilters = () => {
    setPage(0);
    setFilterDraft(createDefaultMarketSentimentFilters());
    setFilters(createDefaultMarketSentimentFilters());
  };

  const refreshNow = useCallback(async () => {
    setRefreshing(true);
    try {
      const result = await refreshMarketSentiment(tenantId, token);
      onNotify({ msg: `Refreshed ${result.scopesUpdated} market scope(s) successfully`, severity: 'success' });
      void reload(0, rowsPerPage);
    } catch (error) {
      onNotify({ msg: (error as Error).message || 'Refresh failed', severity: 'error' });
    } finally {
      setRefreshing(false);
    }
  }, [onNotify, reload, rowsPerPage, tenantId, token]);

  const loadPreview = useCallback(async (scope: string) => {
    setPreviewLoading(true);
    setPreviewData(null);
    try {
      const data = await fetchNewsFeedPreview(tenantId, token, scope);
      setPreviewData(data);
    } catch (error) {
      onNotify({ msg: (error as Error).message || 'Unable to load news preview', severity: 'error' });
    } finally {
      setPreviewLoading(false);
    }
  }, [onNotify, tenantId, token]);

  return {
    rows,
    totalElements,
    page,
    rowsPerPage,
    loading,
    refreshing,
    previewLoading,
    previewData,
    filterDraft,
    setFilterDraft,
    setPage,
    setRowsPerPage,
    applyFilters,
    resetFilters,
    refreshNow,
    loadPreview,
  };
};
