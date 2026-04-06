import {
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  Grid,
  IconButton,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded';
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded';
import TrendingFlatRoundedIcon from '@mui/icons-material/TrendingFlatRounded';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchMarketWatchConfig,
  fetchMarketWatchData,
  type MarketWatchTileConfig,
  type MarketWatchTileResult,
} from '../../api/admin';
import type { MarketWatchGroup } from '../../api/admin.types';

const SOURCE_LABEL: Record<string, string> = {
  TRADING_SIGNAL: 'Signal',
  TRADING_PARAM: 'Param',
  MARKET_SENTIMENT: 'Trend',
  CANDLE: 'Candle',
};

const TONE_COLOR: Record<string, string> = {
  positive: '#15803d',
  negative: '#b91c1c',
  warning: '#b45309',
  neutral: '#475569',
};

const TONE_BG: Record<string, string> = {
  positive: '#f0fdf4',
  negative: '#fff5f5',
  warning: '#fffbeb',
  neutral: '#f8fafc',
};

const REFRESH_OPTIONS = [
  { value: 5, label: '5s' },
  { value: 10, label: '10s' },
  { value: 15, label: '15s' },
  { value: 30, label: '30s' },
  { value: 60, label: '1m' },
  { value: 120, label: '2m' },
];

const tileTitle = (tile: MarketWatchTileConfig | undefined, result: MarketWatchTileResult) =>
  tile?.title?.trim() || SOURCE_LABEL[result.source] || result.source.replace(/_/g, ' ');

const ToneIcon = ({ tone }: { tone: string }) => {
  if (tone === 'positive') return <TrendingUpRoundedIcon sx={{ fontSize: 14, color: TONE_COLOR.positive }} />;
  if (tone === 'negative') return <TrendingDownRoundedIcon sx={{ fontSize: 14, color: TONE_COLOR.negative }} />;
  return <TrendingFlatRoundedIcon sx={{ fontSize: 14, color: TONE_COLOR.neutral }} />;
};

/** Compact read-only tile row used inside group sections */
function TileRow({ tile, result }: { tile: MarketWatchTileConfig; result: MarketWatchTileResult }) {
  const tone   = result.statusTone ?? 'neutral';
  const accent = TONE_COLOR[tone] ?? TONE_COLOR.neutral;
  const bg     = TONE_BG[tone]    ?? TONE_BG.neutral;
  return (
    <Box
      sx={{
        p: 1.25,
        border: '1px solid',
        borderColor: 'divider',
        borderLeft: `3px solid ${accent}`,
        borderRadius: 1.5,
        bgcolor: bg,
      }}
    >
      <Stack spacing={0.75}>
        {/* Tile header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
            <ToneIcon tone={tone} />
            <Typography variant="caption" fontWeight={800} noWrap sx={{ fontSize: '0.74rem', color: '#1e293b' }}>
              {tileTitle(tile, result)}
            </Typography>
            <Chip
              label={SOURCE_LABEL[result.source] ?? result.source}
              size="small"
              sx={{ height: 16, fontSize: '0.6rem', bgcolor: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' }}
            />
          </Stack>
          <Chip
            label={result.statusLabel}
            size="small"
            sx={{
              height: 20,
              fontSize: '0.65rem',
              fontWeight: 800,
              color: accent,
              bgcolor: `${accent}15`,
              border: `1px solid ${accent}40`,
            }}
          />
        </Stack>

        {/* Primary value */}
        <Stack direction="row" justifyContent="space-between" alignItems="baseline">
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.66rem' }}>
            {result.primaryLabel}
          </Typography>
          <Typography variant="body2" fontWeight={800} sx={{ color: accent, fontSize: '1rem', lineHeight: 1 }}>
            {result.primaryValue}
          </Typography>
        </Stack>

        {/* Fields */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 8px' }}>
          {result.fields.slice(0, 6).map((field) => (
            <Stack key={field.key} direction="row" justifyContent="space-between" spacing={0.5}>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: '0.63rem' }}>
                {field.label}
              </Typography>
              <Typography
                variant="caption"
                fontWeight={700}
                noWrap
                sx={{ fontSize: '0.63rem', color: TONE_COLOR[field.tone ?? 'neutral'] ?? TONE_COLOR.neutral }}
              >
                {field.value}
              </Typography>
            </Stack>
          ))}
        </Box>

        {result.updatedAt && (
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
            {result.updatedAt}
          </Typography>
        )}
      </Stack>
    </Box>
  );
}

export const IntraTradeMarketWatchBoard = ({
  token,
  tenantId,
  username,
  onNotify,
}: {
  token: string;
  tenantId: string;
  username: string;
  onNotify: (snack: { msg: string; severity: 'success' | 'error' | 'info' }) => void;
}) => {
  const [loading, setLoading]             = useState(false);
  const [tiles, setTiles]                 = useState<MarketWatchTileConfig[]>([]);
  const [groups, setGroups]               = useState<MarketWatchGroup[]>([]);
  const [results, setResults]             = useState<Record<string, MarketWatchTileResult>>({});
  const [refreshInterval, setRefreshInterval] = useState(30);
  const [countdown, setCountdown]         = useState(30);
  const [lastUpdated, setLastUpdated]     = useState<string | null>(null);
  const refreshRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadBoard = useCallback(async () => {
    setLoading(true);
    try {
      const [configResponse, dataResponse] = await Promise.all([
        fetchMarketWatchConfig(tenantId, token, username),
        fetchMarketWatchData(tenantId, token, username),
      ]);
      setTiles(configResponse.config?.tiles ?? []);
      setGroups(configResponse.config?.groups ?? []);
      const next: Record<string, MarketWatchTileResult> = {};
      dataResponse.tiles.forEach((tile) => { next[tile.tileId] = tile; });
      setResults(next);
      setCountdown(refreshInterval);
      setLastUpdated(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
    } catch (error) {
      onNotify({ msg: (error as Error).message || 'Unable to load live Market Watch', severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [onNotify, tenantId, token, username, refreshInterval]);

  // Restart timers whenever refreshInterval changes
  useEffect(() => {
    void loadBoard();
    if (refreshRef.current) clearInterval(refreshRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    refreshRef.current    = setInterval(() => { void loadBoard(); }, refreshInterval * 1000);
    countdownRef.current  = setInterval(() => setCountdown((v) => (v <= 1 ? refreshInterval : v - 1)), 1_000);
    return () => {
      if (refreshRef.current) clearInterval(refreshRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshInterval]);

  // ── Build display sections: ungrouped + groups ──────────────────────────────
  const ungroupedEntries = tiles
    .filter(t => !t.groupId || !groups.find(g => g.id === t.groupId))
    .map(t => ({ tile: t, result: results[t.id] }))
    .filter(e => Boolean(e.result));

  const groupSections = groups.map(g => ({
    group: g,
    entries: tiles
      .filter(t => t.groupId === g.id)
      .map(t => ({ tile: t, result: results[t.id] }))
      .filter(e => Boolean(e.result)),
  }));

  const totalVisible = ungroupedEntries.length + groupSections.reduce((s, gs) => s + gs.entries.length, 0);

  return (
    <Card variant="outlined" sx={{ borderColor: '#e2e8f0' }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Stack spacing={1.5}>
          {/* Header row */}
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={1} alignItems="center">
              <GridViewRoundedIcon sx={{ color: '#3b82f6', fontSize: 18 }} />
              <Typography variant="subtitle2" fontWeight={800} sx={{ letterSpacing: -0.3 }}>
                Market Watch
              </Typography>
              <Chip
                label="LIVE"
                size="small"
                sx={{ height: 18, fontSize: '0.62rem', fontWeight: 800, bgcolor: '#dcfce7', color: '#15803d', border: '1px solid #86efac' }}
              />
            </Stack>
            <Stack direction="row" spacing={0.75} alignItems="center">
              {lastUpdated && (
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                  {lastUpdated}
                </Typography>
              )}
              <Tooltip title="Refresh interval">
                <FormControl size="small" variant="outlined" sx={{ minWidth: 56 }}>
                  <Select
                    value={refreshInterval}
                    onChange={(e) => setRefreshInterval(Number(e.target.value))}
                    sx={{ fontSize: '0.72rem', height: 26, '& .MuiSelect-select': { py: '2px', px: '6px', pr: '20px !important' } }}
                  >
                    {REFRESH_OPTIONS.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: '0.78rem' }}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Tooltip>
              <Tooltip title={`Refresh now · next in ${countdown}s`}>
                <span>
                  <IconButton
                    size="small"
                    onClick={() => { void loadBoard(); }}
                    disabled={loading}
                    sx={{ p: 0.5 }}
                    aria-label="Refresh market watch"
                  >
                    {loading ? <CircularProgress size={14} /> : <RefreshRoundedIcon sx={{ fontSize: 16 }} />}
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          </Stack>

          {/* Countdown bar */}
          <Box>
            <LinearProgress
              variant="determinate"
              value={((refreshInterval - countdown) / refreshInterval) * 100}
              sx={{ height: 3, borderRadius: 999, bgcolor: '#e2e8f0', '& .MuiLinearProgress-bar': { bgcolor: '#3b82f6' } }}
            />
          </Box>

          {/* No tiles state */}
          {!totalVisible && !loading && (
            <Box sx={{ p: 2, border: '1px dashed', borderColor: 'divider', borderRadius: 1.5, textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                No tiles configured
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
                Set up tiles in Market Signals → Market Watch
              </Typography>
            </Box>
          )}

          {/* Ungrouped tiles */}
          {ungroupedEntries.length > 0 && (
            <Grid container spacing={1}>
              {ungroupedEntries.map(({ tile, result }) => (
                <Grid item xs={12} key={tile.id}>
                  <TileRow tile={tile} result={result!} />
                </Grid>
              ))}
            </Grid>
          )}

          {/* Group sections (read-only with group label) */}
          {groupSections.map(({ group, entries }) => {
            if (entries.length === 0) return null;
            return (
              <Box key={group.id}>
                {/* Group label */}
                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.75 }}>
                  <FolderOpenRoundedIcon sx={{ fontSize: 11, color: '#64748b' }} />
                  <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {group.name}
                  </Typography>
                  <Typography sx={{ fontSize: '0.62rem', color: '#94a3b8' }}>
                    · {entries.length}
                  </Typography>
                </Stack>
                <Grid container spacing={1}>
                  {entries.map(({ tile, result }) => (
                    <Grid item xs={12} key={tile.id}>
                      <TileRow tile={tile} result={result!} />
                    </Grid>
                  ))}
                </Grid>
              </Box>
            );
          })}
        </Stack>
      </CardContent>
    </Card>
  );
};
