import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CreateNewFolderRoundedIcon from '@mui/icons-material/CreateNewFolderRounded';
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import ShowChartRoundedIcon from '@mui/icons-material/ShowChartRounded';
import SsidChartRoundedIcon from '@mui/icons-material/SsidChartRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import CandlestickChartRoundedIcon from '@mui/icons-material/CandlestickChartRounded';
import { Component, type ErrorInfo, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchMarketWatchConfig, fetchMarketWatchData, saveMarketWatchConfig } from '../../api/admin';
import type { MarketWatchGroup, MarketWatchLayoutConfig, MarketWatchTileConfig, MarketWatchTileResult } from '../../api/admin.types';
import { REFRESH_OPTIONS, SOURCE_META } from './catalog';
import { MarketWatchAccuracyPanel } from './MarketWatchAccuracyPanel';
import { MarketWatchTileCard } from './MarketWatchTileCard';
import { TileConfigDialog } from './TileConfigDialog';
import { TileGroupHeader } from './TileGroupHeader';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Move a tile from one position to another within the flat array, also updating its groupId */
const moveTileToPosition = (
  tiles: MarketWatchTileConfig[],
  fromId: string,
  toId: string,
  targetGroupId: string | undefined,
): MarketWatchTileConfig[] => {
  if (fromId === toId) return tiles;
  const fromIndex = tiles.findIndex(t => t.id === fromId);
  const toIndex   = tiles.findIndex(t => t.id === toId);
  if (fromIndex < 0 || toIndex < 0) return tiles;
  const next = [...tiles];
  const [tile] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, { ...tile, groupId: targetGroupId });
  return next;
};

/** Move a tile to the end of a group section */
const moveTileToGroup = (
  tiles: MarketWatchTileConfig[],
  tileId: string,
  groupId: string | undefined,
): MarketWatchTileConfig[] => {
  const tileIdx = tiles.findIndex(t => t.id === tileId);
  if (tileIdx < 0) return tiles;
  const next = [...tiles];
  const [tile] = next.splice(tileIdx, 1);
  // Find the last tile in the target group to insert after
  const lastGroupIdx = next.reduce(
    (last, t, i) => ((t.groupId ?? undefined) === groupId ? i : last),
    -1,
  );
  next.splice(lastGroupIdx + 1, 0, { ...tile, groupId });
  return next;
};

// Brief description shown in the empty-state source cards
const SOURCE_SUMMARY = [
  {
    source: 'TRADING_SIGNAL' as const,
    icon: <ShowChartRoundedIcon sx={{ fontSize: 18 }} />,
    example: 'BUY / SELL / HOLD with DMA 9, 26, 110',
  },
  {
    source: 'TRADING_PARAM' as const,
    icon: <SsidChartRoundedIcon sx={{ fontSize: 18 }} />,
    example: 'Gap type, ORB breakout/breakdown, prices',
  },
  {
    source: 'MARKET_SENTIMENT' as const,
    icon: <TrendingUpRoundedIcon sx={{ fontSize: 18 }} />,
    example: 'BULL / BEAR trend, AI confidence, EMA',
  },
  {
    source: 'CANDLE' as const,
    icon: <CandlestickChartRoundedIcon sx={{ fontSize: 18 }} />,
    example: 'OHLC + volume for any instrument / timeframe',
  },
];

class AccuracyErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; message: string }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown) {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Unknown error in Accuracy panel',
    };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    // Keep the failure visible in dev/prod consoles for diagnostics.
    console.error('MarketWatch Accuracy panel crashed', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 1.5 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'error.main' }}>
            Accuracy panel failed to render
          </Typography>
          <Typography sx={{ fontSize: 10, color: 'text.secondary', mt: 0.75 }}>
            {this.state.message}
          </Typography>
          <Typography sx={{ fontSize: 10, color: 'text.secondary', mt: 0.5 }}>
            Please refresh the page and run Accuracy again.
          </Typography>
        </Paper>
      );
    }
    return this.props.children;
  }
}

export function MarketWatchPanel({
  token,
  tenantId,
  username,
  onNotify,
}: {
  token: string;
  tenantId: string;
  username: string;
  onNotify: (snack: { msg: string; severity: 'success' | 'error' | 'info' }) => void;
}) {
  const [tiles, setTiles]                       = useState<MarketWatchTileConfig[]>([]);
  const [groups, setGroups]                     = useState<MarketWatchGroup[]>([]);
  const [results, setResults]                   = useState<Record<string, MarketWatchTileResult>>({});
  const [refreshSeconds, setRefreshSeconds]     = useState(30);
  const [gridColumns, setGridColumns]           = useState(4);
  const [countdown, setCountdown]               = useState(30);
  const [dialogOpen, setDialogOpen]             = useState(false);
  const [editingTile, setEditingTile]           = useState<MarketWatchTileConfig | null>(null);
  const [addToGroupId, setAddToGroupId]         = useState<string | undefined>(undefined);
  const [configDirty, setConfigDirty]           = useState(false);
  const [loading, setLoading]                   = useState(false);
  const [saving, setSaving]                     = useState(false);
  const [dragTargetGroupId, setDragTargetGroupId] = useState<string | null>(null);
  const [activeTab, setActiveTab]               = useState<'tiles' | 'accuracy'>('tiles');

  const dragTileId     = useRef<string | null>(null);
  const refreshTimer   = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshData = useCallback(() => {
    if (tiles.length === 0) return;
    setLoading(true);
    fetchMarketWatchData(tenantId, token, username)
      .then(response => {
        const next: Record<string, MarketWatchTileResult> = {};
        response.tiles.forEach(t => { next[t.tileId] = t; });
        setResults(next);
      })
      .catch(err => onNotify({ msg: String(err.message ?? err), severity: 'error' }))
      .finally(() => setLoading(false));
  }, [onNotify, tenantId, tiles.length, token, username]);

  // Load saved config on mount
  useEffect(() => {
    fetchMarketWatchConfig(tenantId, token, username)
      .then(response => {
        if (!response.config) return;
        setTiles(response.config.tiles ?? []);
        setGroups(response.config.groups ?? []);
        setRefreshSeconds(response.config.refreshIntervalSeconds ?? 30);
        setGridColumns(response.config.gridColumns ?? 3);
      })
      .catch(() => undefined);
  }, [tenantId, token, username]);

  // Auto-refresh timer
  useEffect(() => {
    setCountdown(refreshSeconds);
    if (refreshTimer.current)   clearInterval(refreshTimer.current);
    if (countdownTimer.current) clearInterval(countdownTimer.current);
    refreshData();
    refreshTimer.current   = setInterval(refreshData, refreshSeconds * 1000);
    countdownTimer.current = setInterval(() => {
      setCountdown(v => (v <= 1 ? refreshSeconds : v - 1));
    }, 1000);
    return () => {
      if (refreshTimer.current)   clearInterval(refreshTimer.current);
      if (countdownTimer.current) clearInterval(countdownTimer.current);
    };
  }, [refreshData, refreshSeconds]);

  const saveLayout = async () => {
    const config: MarketWatchLayoutConfig = {
      refreshIntervalSeconds: refreshSeconds,
      gridColumns: gridColumns as 1 | 2 | 3 | 4,
      tiles,
      groups,
    };
    setSaving(true);
    try {
      await saveMarketWatchConfig(tenantId, token, username, config);
      setConfigDirty(false);
      onNotify({ msg: 'Layout saved', severity: 'success' });
      refreshData();
    } catch (err) {
      onNotify({ msg: String((err as Error).message ?? err), severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // ── Group management ────────────────────────────────────────────────────────

  const addGroup = () => {
    const newGroup: MarketWatchGroup = {
      id: crypto.randomUUID(),
      name: `Group ${groups.length + 1}`,
    };
    setGroups(prev => [...prev, newGroup]);
    setConfigDirty(true);
  };

  const renameGroup = (id: string, name: string) => {
    setGroups(prev => prev.map(g => g.id === id ? { ...g, name } : g));
    setConfigDirty(true);
  };

  const deleteGroup = (id: string) => {
    setGroups(prev => prev.filter(g => g.id !== id));
    // Ungroup tiles that belonged to this group
    setTiles(prev => prev.map(t => t.groupId === id ? { ...t, groupId: undefined } : t));
    setConfigDirty(true);
  };

  // ── Tile movement helpers ───────────────────────────────────────────────────

  /**
   * Move a tile by delta within its group (or within ungrouped tiles).
   * Works by swapping positions in the full tiles array.
   */
  const moveWithinGroup = (tileId: string, delta: -1 | 1, groupId: string | undefined) => {
    setTiles(prev => {
      const groupTiles = prev.filter(t => (t.groupId ?? undefined) === groupId);
      const localIdx = groupTiles.findIndex(t => t.id === tileId);
      if (localIdx < 0) return prev;
      const nextLocalIdx = localIdx + delta;
      if (nextLocalIdx < 0 || nextLocalIdx >= groupTiles.length) return prev;
      const fromGlobal = prev.findIndex(t => t.id === tileId);
      const toGlobal   = prev.findIndex(t => t.id === groupTiles[nextLocalIdx].id);
      if (fromGlobal < 0 || toGlobal < 0) return prev;
      const next = [...prev];
      [next[fromGlobal], next[toGlobal]] = [next[toGlobal], next[fromGlobal]];
      return next;
    });
    setConfigDirty(true);
  };

  // ── Computed layout sections ────────────────────────────────────────────────

  const ungroupedTiles = tiles.filter(t => !t.groupId || !groups.find(g => g.id === t.groupId));
  const groupSections  = groups.map(g => ({
    group: g,
    tiles: tiles.filter(t => t.groupId === g.id),
  }));

  const gridXs = 12 / Math.min(gridColumns, 4) as never;

  const statusLine = useMemo(() => {
    const parts: string[] = [`${tiles.length} tile${tiles.length === 1 ? '' : 's'}`];
    if (groups.length > 0) parts.push(`${groups.length} group${groups.length === 1 ? '' : 's'}`);
    if (tiles.length > 0) parts.push(`${gridColumns} col`, `${refreshSeconds}s refresh`);
    return parts.join(' · ');
  }, [gridColumns, groups.length, refreshSeconds, tiles.length]);

  // ── Shared tile card renderer ───────────────────────────────────────────────

  const renderTile = (tile: MarketWatchTileConfig, localIndex: number, localTotal: number, groupId: string | undefined) => (
    <Grid key={tile.id} item xs={12} md={gridXs}>
      <MarketWatchTileCard
        tile={tile}
        result={results[tile.id]}
        position={localIndex}
        total={localTotal}
        onEdit={() => { setEditingTile(tile); setAddToGroupId(tile.groupId); setDialogOpen(true); }}
        onDelete={() => { setTiles(prev => prev.filter(t => t.id !== tile.id)); setConfigDirty(true); }}
        onMove={delta => moveWithinGroup(tile.id, delta, groupId)}
        onDragStart={() => { dragTileId.current = tile.id; }}
        onDrop={() => {
          if (!dragTileId.current || dragTileId.current === tile.id) return;
          setTiles(prev => moveTileToPosition(prev, dragTileId.current!, tile.id, groupId));
          setConfigDirty(true);
          dragTileId.current = null;
          setDragTargetGroupId(null);
        }}
      />
    </Grid>
  );

  return (
    <Box>
      {/* ── Control bar ──────────────────────────────────────────────────── */}
      <Card
        sx={{
          mb: 2,
          borderRadius: 3,
          background: 'linear-gradient(135deg, #fff7ed 0%, #f8fafc 46%, #ecfeff 100%)',
        }}
      >
        <CardContent sx={{ pb: '12px !important' }}>
          <Stack
            direction={{ xs: 'column', lg: 'row' }}
            spacing={2}
            alignItems={{ xs: 'flex-start', lg: 'center' }}
          >
            {/* Title block */}
            <Stack spacing={0.5} sx={{ minWidth: 0 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <GridViewRoundedIcon color="primary" />
                <Typography variant="h6" fontWeight={800}>Market Watch</Typography>
                <Chip label="Live" size="small" color="success" sx={{ height: 20, fontSize: 10 }} />
              </Stack>
              <Typography variant="caption" color="text.secondary">{statusLine}</Typography>
            </Stack>

            <Box sx={{ flex: 1 }} />

            {/* Controls */}
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.25}
              alignItems={{ xs: 'stretch', sm: 'center' }}
            >
              <FormControl size="small" sx={{ minWidth: 108 }}>
                <InputLabel>Refresh</InputLabel>
                <Select
                  label="Refresh"
                  value={refreshSeconds}
                  onChange={e => { setRefreshSeconds(Number(e.target.value)); setConfigDirty(true); }}
                >
                  {REFRESH_OPTIONS.map(o => (
                    <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 96 }}>
                <InputLabel>Columns</InputLabel>
                <Select
                  label="Columns"
                  value={gridColumns}
                  onChange={e => { setGridColumns(Number(e.target.value)); setConfigDirty(true); }}
                >
                  {[1, 2, 3, 4].map(v => (
                    <MenuItem key={v} value={v}>{v} col</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Tooltip title={`Refresh now · next in ${countdown}s`}>
                <span>
                  <IconButton onClick={refreshData} disabled={loading}>
                    {loading ? <CircularProgress size={18} /> : <RefreshRoundedIcon />}
                  </IconButton>
                </span>
              </Tooltip>

              <Tooltip title="Add a named group to organise tiles">
                <Button
                  variant="outlined"
                  startIcon={<CreateNewFolderRoundedIcon />}
                  onClick={addGroup}
                  data-testid="add-group-btn"
                >
                  Add Group
                </Button>
              </Tooltip>

              <Button
                variant="outlined"
                startIcon={<AddRoundedIcon />}
                onClick={() => { setEditingTile(null); setAddToGroupId(undefined); setDialogOpen(true); }}
                data-testid="add-tile-btn"
              >
                Add Tile
              </Button>

              {configDirty && (
                <Button
                  variant="contained"
                  color="success"
                  startIcon={saving ? <CircularProgress size={16} /> : <SaveRoundedIcon />}
                  onClick={saveLayout}
                  disabled={saving}
                  data-testid="save-layout-btn"
                >
                  Save Layout
                </Button>
              )}
            </Stack>
          </Stack>

          {/* Countdown progress */}
          <Box mt={1.5}>
            <LinearProgress
              variant="determinate"
              value={((refreshSeconds - countdown) / refreshSeconds) * 100}
              sx={{ height: 3, borderRadius: 99 }}
            />
            <Typography variant="caption" color="text.secondary">
              Next refresh in {countdown}s
              {tiles.length > 0 && ` · ${tiles.length} tile${tiles.length === 1 ? '' : 's'}`}
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* ── Tab strip ─────────────────────────────────────────────────────── */}
      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        sx={{ mb: 1.5, borderBottom: '1px solid', borderBottomColor: 'divider', minHeight: 36 }}
        TabIndicatorProps={{ sx: { height: 2 } }}
      >
        <Tab value="tiles"    label="Tiles"    sx={{ fontSize: 11, minHeight: 36, py: 0.5 }} />
        <Tab value="accuracy" label="Accuracy" sx={{ fontSize: 11, minHeight: 36, py: 0.5 }} />
      </Tabs>

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {activeTab === 'tiles' && tiles.length === 0 && groups.length === 0 ? (
        <Paper
          variant="outlined"
          sx={{ borderRadius: 3, p: 4, borderStyle: 'dashed', textAlign: 'center' }}
        >
          <GridViewRoundedIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1.5 }} />
          <Typography variant="h6" fontWeight={700} gutterBottom>
            No tiles yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 520, mx: 'auto' }}>
            Add tiles to monitor live market data. Each tile shows the latest real row from a
            source table — irrelevant columns (ids, audit timestamps) are automatically excluded.
            Use <strong>Add Group</strong> to organise tiles into named sections.
          </Typography>

          {/* Source preview cards */}
          <Grid container spacing={1.5} justifyContent="center" sx={{ mb: 3, maxWidth: 680, mx: 'auto' }}>
            {SOURCE_SUMMARY.map(({ source, icon, example }) => {
              const meta = SOURCE_META[source];
              return (
                <Grid key={source} item xs={12} sm={6}>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      textAlign: 'left',
                      borderLeft: `3px solid ${meta.color}`,
                      borderRadius: 2,
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
                      <Box sx={{ color: meta.color }}>{icon}</Box>
                      <Typography variant="caption" fontWeight={700} sx={{ color: meta.color }}>
                        {meta.label}
                      </Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {example}
                    </Typography>
                  </Paper>
                </Grid>
              );
            })}
          </Grid>

          <Stack direction="row" spacing={1.5} justifyContent="center">
            <Button
              variant="outlined"
              size="large"
              startIcon={<CreateNewFolderRoundedIcon />}
              onClick={addGroup}
            >
              Add Group
            </Button>
            <Button
              variant="contained"
              size="large"
              startIcon={<AddRoundedIcon />}
              onClick={() => setDialogOpen(true)}
            >
              Add your first tile
            </Button>
          </Stack>
        </Paper>
      ) : activeTab === 'tiles' ? (
        /* ── Tile layout (ungrouped + grouped sections) ──────────────────── */
        <Box>
          {/* Ungrouped tiles */}
          {ungroupedTiles.length > 0 && (
            <Box
              onDragOver={e => e.preventDefault()}
              onDrop={() => {
                if (!dragTileId.current) return;
                setTiles(prev => moveTileToGroup(prev, dragTileId.current!, undefined));
                setConfigDirty(true);
                dragTileId.current = null;
                setDragTargetGroupId(null);
              }}
              mb={groups.length > 0 ? 2 : 0}
            >
              <Grid container spacing={2}>
                {ungroupedTiles.map((tile, idx) =>
                  renderTile(tile, idx, ungroupedTiles.length, undefined)
                )}
              </Grid>
            </Box>
          )}

          {/* Group sections */}
          {groupSections.map(({ group, tiles: gTiles }) => (
            <Box key={group.id} mb={2}>
              <TileGroupHeader
                group={group}
                tileCount={gTiles.length}
                isDragTarget={dragTargetGroupId === group.id}
                onRename={renameGroup}
                onDelete={deleteGroup}
                onAddTile={groupId => {
                  setEditingTile(null);
                  setAddToGroupId(groupId);
                  setDialogOpen(true);
                }}
                onDragOver={e => { e.preventDefault(); setDragTargetGroupId(group.id); }}
                onDrop={() => {
                  if (!dragTileId.current) return;
                  setTiles(prev => moveTileToGroup(prev, dragTileId.current!, group.id));
                  setConfigDirty(true);
                  dragTileId.current = null;
                  setDragTargetGroupId(null);
                }}
              />
              {gTiles.length > 0 ? (
                <Grid container spacing={2}>
                  {gTiles.map((tile, idx) =>
                    renderTile(tile, idx, gTiles.length, group.id)
                  )}
                </Grid>
              ) : (
                <Paper
                  variant="outlined"
                  sx={{
                    borderRadius: 1.5,
                    p: 2,
                    borderStyle: 'dashed',
                    textAlign: 'center',
                    bgcolor: dragTargetGroupId === group.id ? 'primary.50' : 'transparent',
                  }}
                  onDragOver={e => { e.preventDefault(); setDragTargetGroupId(group.id); }}
                  onDrop={() => {
                    if (!dragTileId.current) return;
                    setTiles(prev => moveTileToGroup(prev, dragTileId.current!, group.id));
                    setConfigDirty(true);
                    dragTileId.current = null;
                    setDragTargetGroupId(null);
                  }}
                >
                  <Typography variant="caption" color="text.disabled">
                    Drag tiles here or click + to add a tile to this group
                  </Typography>
                </Paper>
              )}
            </Box>
          ))}
        </Box>
      ) : null}

      {activeTab === 'accuracy' && (
        <AccuracyErrorBoundary>
          <MarketWatchAccuracyPanel tenantId={tenantId} token={token} />
        </AccuracyErrorBoundary>
      )}

      <TileConfigDialog
        open={dialogOpen}
        initial={editingTile}
        onClose={() => { setDialogOpen(false); setEditingTile(null); setAddToGroupId(undefined); }}
        onSave={tile => {
          const tileWithGroup: MarketWatchTileConfig = {
            ...tile,
            groupId: editingTile ? tile.groupId : addToGroupId,
          };
          setTiles(prev => {
            const idx = prev.findIndex(t => t.id === tileWithGroup.id);
            if (idx < 0) return [...prev, tileWithGroup];
            return prev.map(t => (t.id === tileWithGroup.id ? tileWithGroup : t));
          });
          setConfigDirty(true);
          setDialogOpen(false);
          setEditingTile(null);
          setAddToGroupId(undefined);
        }}
      />
    </Box>
  );
}
