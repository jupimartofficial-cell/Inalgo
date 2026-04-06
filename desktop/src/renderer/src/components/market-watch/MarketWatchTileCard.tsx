import {
  Box,
  Chip,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { keyframes } from '@mui/system';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import type { MarketWatchTileConfig, MarketWatchTileResult } from '../../api/admin.types';
import { INSTRUMENTS, TIMEFRAME_OPTIONS } from '../AppShellShared';
import { MARKET_SCOPES, SOURCE_META } from './catalog';

// ─── Animation ────────────────────────────────────────────────────────────────

const livePulse = keyframes`
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.2; }
`;

// ─── Color / tone helpers ─────────────────────────────────────────────────────

const TONE_COLORS: Record<string, string> = {
  positive: '#16a34a',
  negative: '#dc2626',
  warning:  '#d97706',
  neutral:  '#64748b',
};

const tc = (tone?: string | null) => TONE_COLORS[tone ?? 'neutral'] ?? TONE_COLORS.neutral;

const dirPrefix = (tone?: string | null) =>
  tone === 'positive' ? '▲ ' : tone === 'negative' ? '▼ ' : '';

// ─── Field-lookup helpers ─────────────────────────────────────────────────────

type TField = { key: string; label: string; value: string; tone?: string | null };

/** Find a field by key in the fields array */
const ff = (fields: TField[], key: string) => fields.find(f => f.key === key);

/** Extract time "HH:MM" from "22 Mar 2026, 01:54" */
const hhmm = (updatedAt?: string | null) => {
  if (!updatedAt) return '—';
  const m = updatedAt.match(/(\d{2}:\d{2})(?:\s|$)/);
  return m ? m[1] : updatedAt;
};

/** Parse "85%" → 85, or null */
const parsePct = (v?: string) => {
  if (!v || v === '—') return null;
  const n = parseInt(v.replace('%', ''), 10);
  return isNaN(n) ? null : n;
};

const confColor = (pct: number) =>
  pct >= 70 ? '#16a34a' : pct >= 45 ? '#d97706' : '#dc2626';

// ─── Shared micro-components ──────────────────────────────────────────────────

/** Tiny inline status badge: "▼ BEAR" */
function Badge({
  value,
  tone,
  xs = false,
}: {
  value: string;
  tone?: string | null;
  xs?: boolean;
}) {
  const color = tc(tone);
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: xs ? 0.5 : 0.75,
        py: xs ? 0.1 : 0.2,
        borderRadius: 0.75,
        bgcolor: `${color}14`,
        border: `1px solid ${color}35`,
        flexShrink: 0,
      }}
    >
      <Typography
        sx={{
          fontWeight: 800,
          fontSize: xs ? 9 : 10,
          color,
          letterSpacing: 0.75,
          lineHeight: 1.4,
          fontFamily: 'monospace',
        }}
      >
        {dirPrefix(tone)}{value}
      </Typography>
    </Box>
  );
}

/** Compact stat cell — label above, value below */
function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value?: string;
  tone?: string | null;
}) {
  return (
    <Box>
      <Typography
        sx={{ fontSize: 8, color: 'text.disabled', lineHeight: 1.2, display: 'block', textTransform: 'uppercase' }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          fontSize: 10.5,
          fontWeight: 700,
          color: tc(tone),
          fontFeatureSettings: '"tnum"',
          lineHeight: 1.35,
          display: 'block',
        }}
      >
        {value ?? '—'}
      </Typography>
    </Box>
  );
}

/** Full-width stat row — label left, value right */
function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value?: string;
  tone?: string | null;
}) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="baseline">
      <Typography sx={{ fontSize: 9.5, color: 'text.secondary', lineHeight: 1.5 }}>
        {label}
      </Typography>
      <Typography
        sx={{
          fontSize: 10,
          fontWeight: 700,
          color: tc(tone),
          fontFeatureSettings: '"tnum"',
          lineHeight: 1.5,
        }}
      >
        {value ?? '—'}
      </Typography>
    </Stack>
  );
}

/** Thin 1px section divider */
const Div = () => (
  <Box sx={{ borderTop: '1px solid', borderTopColor: 'grey.100' }} />
);

// ─── Source-specific compact body renderers ───────────────────────────────────

/** MARKET_SENTIMENT — trend + AI confidence meter + value/EMAs + reason snippet */
function SentimentBody({ result }: { result: MarketWatchTileResult }) {
  const f = result.fields;

  const trend      = ff(f, 'trendStatus');
  const curVal     = ff(f, 'currentValue');
  const ema9       = ff(f, 'ema9');
  const ema21      = ff(f, 'ema21');
  const ema110     = ff(f, 'ema110');
  const aiSig      = ff(f, 'aiAnalysis');
  const aiConf     = ff(f, 'aiConfidence');
  const srcCount   = ff(f, 'sourceCount');
  const evCount    = ff(f, 'evidenceCount');
  const dataAsOf   = ff(f, 'dataAsOf');
  const reason     = ff(f, 'reason');
  const aiReason   = ff(f, 'aiReason');

  const trendValue = trend?.value ?? result.primaryValue;
  const trendTone  = trend?.tone  ?? result.statusTone;
  const aiTone     = aiSig?.tone  ?? result.statusTone;
  const confPct    = parsePct(aiConf?.value);
  const cColor     = confPct != null ? confColor(confPct) : '#64748b';

  // Prefer "reason"; fall back to AI reason for the snippet
  const snippet = (reason?.value && reason.value !== '—')
    ? reason.value
    : (aiReason?.value && aiReason.value !== '—') ? aiReason.value : null;

  return (
    <Stack spacing={0.75}>

      {/* ── Trend + AI signal fused ──────────────────────────────────────── */}
      <Stack direction="row" alignItems="flex-start" spacing={1}>
        {/* Left: Trend status */}
        <Box>
          <Typography sx={{ fontSize: 7.5, color: 'text.disabled', textTransform: 'uppercase', lineHeight: 1.3 }}>
            Trend
          </Typography>
          <Badge value={trendValue} tone={trendTone} />
        </Box>

        {/* Right: AI signal + confidence meter */}
        {aiSig && (
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography sx={{ fontSize: 7.5, color: 'text.disabled', textTransform: 'uppercase', lineHeight: 1.3 }}>
                AI
              </Typography>
              <Badge value={aiSig.value} tone={aiTone} xs />
              {confPct != null && (
                <Typography sx={{ fontSize: 9, fontWeight: 700, color: cColor, ml: 0.25 }}>
                  {confPct}%
                </Typography>
              )}
            </Stack>
            {confPct != null && (
              <LinearProgress
                variant="determinate"
                value={confPct}
                sx={{
                  height: 4,
                  borderRadius: 99,
                  mt: 0.375,
                  bgcolor: `${cColor}22`,
                  '& .MuiLinearProgress-bar': { bgcolor: cColor, borderRadius: 99 },
                }}
              />
            )}
          </Box>
        )}
      </Stack>

      {/* ── Value + EMAs (technical tiles only — absent for news/web-search) ─ */}
      {[curVal, ema9, ema21, ema110].some(f => f?.value && f.value !== '—') && (
        <>
          <Div />
          <Stack direction="row" justifyContent="space-between">
            <Stat label="Value"   value={curVal?.value} />
            <Stat label="EMA 9"   value={ema9?.value} />
            <Stat label="EMA 21"  value={ema21?.value} />
            <Stat label="EMA 110" value={ema110?.value} />
          </Stack>
        </>
      )}

      {/* ── Evidence row ─────────────────────────────────────────────────── */}
      {(srcCount || evCount || dataAsOf) && (
        <>
          <Div />
          <Typography sx={{ fontSize: 9, color: 'text.secondary', lineHeight: 1.4 }}>
            {[
              srcCount?.value !== '—' && `${srcCount?.value} sources`,
              evCount?.value  !== '—' && `${evCount?.value} articles`,
              dataAsOf?.value && dataAsOf.value !== '—' && `data at ${hhmm(dataAsOf.value)}`,
            ].filter(Boolean).join(' · ')}
          </Typography>
        </>
      )}

      {/* ── Reason snippet (1 line, always visible) ───────────────────────── */}
      {snippet && (
        <>
          <Div />
          <Tooltip title={snippet} placement="bottom" enterDelay={500}>
            <Typography
              noWrap
              sx={{ fontSize: 9, color: 'text.secondary', lineHeight: 1.4, cursor: 'default' }}
            >
              {snippet}
            </Typography>
          </Tooltip>
        </>
      )}
    </Stack>
  );
}

/** TRADING_SIGNAL — signal badge + close/prev + DMA grid */
function SignalBody({ result }: { result: MarketWatchTileResult }) {
  const f = result.fields;

  const signal    = ff(f, 'signal');
  const curClose  = ff(f, 'currentClose');
  const prevClose = ff(f, 'previousClose');
  const dma9      = ff(f, 'dma9');
  const dma26     = ff(f, 'dma26');
  const dma110    = ff(f, 'dma110');
  const sigDate   = ff(f, 'signalDate');

  const sigVal  = signal?.value ?? result.primaryValue;
  const sigTone = signal?.tone  ?? result.statusTone;

  return (
    <Stack spacing={0.75}>

      {/* Signal + date */}
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Badge value={sigVal} tone={sigTone} />
        {sigDate?.value && sigDate.value !== '—' && (
          <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>{sigDate.value}</Typography>
        )}
      </Stack>

      <Div />

      {/* Close prices */}
      <Stack direction="row" spacing={1} justifyContent="space-between">
        <Stat label="Close" value={curClose?.value}  tone={sigTone} />
        <Stat label="Prev"  value={prevClose?.value} />
      </Stack>

      <Div />

      {/* DMAs */}
      <Stack direction="row" justifyContent="space-between">
        <Stat label="DMA 9"   value={dma9?.value} />
        <Stat label="DMA 26"  value={dma26?.value} />
        <Stat label="DMA 110" value={dma110?.value} />
      </Stack>
    </Stack>
  );
}

/** TRADING_PARAM — gap + ORB + today/prev prices */
function ParamBody({ result }: { result: MarketWatchTileResult }) {
  const f = result.fields;

  const gapType    = ff(f, 'gapType');
  const gapPct     = ff(f, 'gapPct');
  const breakout   = ff(f, 'orbBreakout');
  const breakdown  = ff(f, 'orbBreakdown');
  const orbHigh    = ff(f, 'orbHigh');
  const orbLow     = ff(f, 'orbLow');
  const todayOpen  = ff(f, 'todayOpen');
  const todayClose = ff(f, 'todayClose');
  const prevHigh   = ff(f, 'prevHigh');
  const prevLow    = ff(f, 'prevLow');
  const prevClose  = ff(f, 'prevClose');
  const tradeDate  = ff(f, 'tradeDate');

  const gapVal  = gapType?.value ?? result.primaryValue;
  const gapTone = gapType?.tone  ?? result.statusTone;

  const hasOrb       = orbHigh?.value !== '—' || orbLow?.value !== '—';
  const isBreakout   = breakout?.value  === 'Yes';
  const isBreakdown  = breakdown?.value === 'Yes';

  return (
    <Stack spacing={0.75}>

      {/* Gap line */}
      <Stack direction="row" alignItems="center" spacing={0.75} flexWrap="wrap" useFlexGap>
        <Badge value={gapVal} tone={gapTone} />
        {gapPct?.value && gapPct.value !== '—' && (
          <Typography sx={{ fontSize: 11, fontWeight: 800, color: tc(gapTone), fontFeatureSettings: '"tnum"' }}>
            {gapPct.value}
          </Typography>
        )}
        {isBreakout  && <Badge value="Breakout ▲"  tone="positive" xs />}
        {isBreakdown && <Badge value="Breakdown ▼" tone="negative" xs />}
      </Stack>

      {/* ORB range */}
      {hasOrb && (
        <>
          <Div />
          <Stack direction="row" justifyContent="space-between">
            <Stat label="ORB High" value={orbHigh?.value} />
            <Stat label="ORB Low"  value={orbLow?.value} />
          </Stack>
        </>
      )}

      <Div />

      {/* Today */}
      <Stack direction="row" justifyContent="space-between">
        <Stat label="Open"  value={todayOpen?.value} />
        <Stat label="Close" value={todayClose?.value} />
      </Stack>

      <Div />

      {/* Previous session */}
      <Stack direction="row" justifyContent="space-between">
        <Stat label="Prev High"  value={prevHigh?.value} />
        <Stat label="Prev Low"   value={prevLow?.value} />
        <Stat label="Prev Close" value={prevClose?.value} />
      </Stack>

      {tradeDate?.value && tradeDate.value !== '—' && (
        <Typography sx={{ fontSize: 8.5, color: 'text.disabled', textAlign: 'right' }}>
          {tradeDate.value}
        </Typography>
      )}
    </Stack>
  );
}

/** CANDLE — close price + OHLV compact bar */
function CandleBody({ result }: { result: MarketWatchTileResult }) {
  const f = result.fields;

  const openPrice  = ff(f, 'openPrice');
  const highPrice  = ff(f, 'highPrice');
  const lowPrice   = ff(f, 'lowPrice');
  const volume     = ff(f, 'volume');

  const closeValue = result.primaryValue;
  const tone       = result.statusTone;

  return (
    <Stack spacing={0.75}>

      {/* Close — slightly prominent */}
      <Box>
        <Typography sx={{ fontSize: 7.5, color: 'text.disabled', textTransform: 'uppercase', lineHeight: 1.3 }}>
          Close
        </Typography>
        <Typography
          sx={{
            fontSize: 22,
            fontWeight: 800,
            color: tc(tone),
            fontFeatureSettings: '"tnum"',
            lineHeight: 1.1,
            letterSpacing: -0.5,
          }}
        >
          {closeValue}
        </Typography>
      </Box>

      <Div />

      {/* OHLV row */}
      <Stack direction="row" justifyContent="space-between">
        <Stat label="Open"   value={openPrice?.value} />
        <Stat label="High"   value={highPrice?.value} tone="positive" />
        <Stat label="Low"    value={lowPrice?.value}  tone="negative" />
        <Stat label="Volume" value={volume?.value} />
      </Stack>
    </Stack>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MarketWatchTileCard({
  tile,
  result,
  position,
  total,
  onEdit,
  onDelete,
  onMove,
  onDragStart,
  onDrop,
}: {
  tile: MarketWatchTileConfig;
  result?: MarketWatchTileResult;
  position: number;
  total: number;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (delta: -1 | 1) => void;
  onDragStart: () => void;
  onDrop: () => void;
}) {
  const meta        = SOURCE_META[tile.source];
  const accentColor = tc(result?.statusTone);

  const subtitle = tile.source === 'MARKET_SENTIMENT'
    ? (MARKET_SCOPES.find(s => s.key === tile.marketScope)?.label ?? tile.marketScope ?? 'Market')
    : [
        INSTRUMENTS.find(i => i.key === tile.instrumentKey)?.label ?? tile.instrumentKey ?? '—',
        (tile.source === 'TRADING_SIGNAL' || tile.source === 'CANDLE')
          ? TIMEFRAME_OPTIONS.find(
              t => t.unit === tile.timeframeUnit && t.interval === tile.timeframeInterval
            )?.label
          : null,
      ].filter(Boolean).join(' · ');

  return (
    <Paper
      variant="outlined"
      draggable
      data-testid={`market-watch-tile-${tile.id}`}
      onDragStart={onDragStart}
      onDragOver={e => e.preventDefault()}
      onDrop={onDrop}
      sx={{
        borderRadius: 1.5,
        borderLeft: `3px solid ${accentColor}`,
        overflow: 'hidden',
        transition: 'box-shadow 120ms',
        '&:hover': { boxShadow: 3 },
        // Action buttons are hidden until hover
        '& .tile-actions': { opacity: 0, transition: 'opacity 120ms' },
        '&:hover .tile-actions': { opacity: 1 },
      }}
    >
      {/* ── Compact single-row header ────────────────────────────────────── */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={0.5}
        sx={{
          px: 0.875,
          py: 0.5,
          borderBottom: '1px solid',
          borderBottomColor: 'divider',
          bgcolor: 'grey.50',
        }}
      >
        {/* Source chip */}
        <Chip
          label={meta.label}
          size="small"
          sx={{
            bgcolor: `${meta.color}18`,
            color: meta.color,
            fontWeight: 700,
            height: 16,
            fontSize: 9,
            '& .MuiChip-label': { px: 0.625 },
          }}
        />

        {/* Status chip */}
        {result && (
          <Chip
            label={`${dirPrefix(result.statusTone)}${result.statusLabel}`}
            size="small"
            sx={{
              bgcolor: `${accentColor}18`,
              color: accentColor,
              fontWeight: 700,
              height: 16,
              fontSize: 9,
              '& .MuiChip-label': { px: 0.625 },
            }}
          />
        )}

        {/* Subtitle / custom title */}
        <Typography
          noWrap
          sx={{ flex: 1, fontSize: 9.5, color: 'text.secondary', mx: 0.25, lineHeight: 1 }}
        >
          {tile.title || subtitle}
        </Typography>

        {/* Hover-only action buttons */}
        <Stack direction="row" className="tile-actions" alignItems="center" spacing={0}>
          <Tooltip title="Drag to reorder">
            <IconButton size="small" sx={{ cursor: 'grab', p: 0.25 }}>
              <DragIndicatorRoundedIcon sx={{ fontSize: 11 }} />
            </IconButton>
          </Tooltip>
          <IconButton
            size="small"
            disabled={position === 0}
            onClick={() => onMove(-1)}
            sx={{ p: 0.25 }}
          >
            <ArrowBackRoundedIcon sx={{ fontSize: 11 }} />
          </IconButton>
          <IconButton
            size="small"
            disabled={position === total - 1}
            onClick={() => onMove(1)}
            sx={{ p: 0.25 }}
          >
            <ArrowForwardRoundedIcon sx={{ fontSize: 11 }} />
          </IconButton>
          <IconButton size="small" onClick={onEdit} sx={{ p: 0.25 }}>
            <EditRoundedIcon sx={{ fontSize: 11 }} />
          </IconButton>
          <IconButton size="small" color="error" onClick={onDelete} sx={{ p: 0.25 }}>
            <DeleteRoundedIcon sx={{ fontSize: 11 }} />
          </IconButton>
        </Stack>
      </Stack>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <Box sx={{ px: 1, py: 0.875 }}>
        {!result ? (
          <Typography sx={{ fontSize: 10, color: 'text.disabled', py: 0.75 }}>
            Loading…
          </Typography>
        ) : tile.source === 'MARKET_SENTIMENT' ? (
          <SentimentBody result={result} />
        ) : tile.source === 'TRADING_SIGNAL' ? (
          <SignalBody result={result} />
        ) : tile.source === 'TRADING_PARAM' ? (
          <ParamBody result={result} />
        ) : (
          <CandleBody result={result} />
        )}
      </Box>

      {/* ── Compact footer: pulsing dot + HH:MM ──────────────────────────── */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={0.5}
        sx={{
          px: 1,
          py: 0.375,
          borderTop: '1px solid',
          borderTopColor: 'divider',
          bgcolor: 'grey.50',
        }}
      >
        <Box
          sx={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            bgcolor: result ? '#16a34a' : 'grey.300',
            flexShrink: 0,
            animation: result ? `${livePulse} 2.5s ease-in-out infinite` : 'none',
          }}
        />
        <Typography sx={{ fontSize: 9.5, color: 'text.secondary' }}>
          {result?.updatedAt ? hhmm(result.updatedAt) : '…'}
        </Typography>
      </Stack>
    </Paper>
  );
}
