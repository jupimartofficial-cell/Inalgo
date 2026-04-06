import {
Alert,
Box,
Button,
Card,
CardContent,
Chip,
CircularProgress,
FormControl,
Grid,
InputLabel,
MenuItem,
Paper,
Select,
Stack,
Switch,
Table,
TableBody,
TableCell,
TableContainer,
TableHead,
TableRow,
Typography,
} from '@mui/material';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
fetchLatestOptionChain,
fetchOptionChainExpiries,
migrateOptionChainHistorical,
type OptionChainRow,
type OptionChainSnapshot,
} from '../api/admin';
type SnackSeverity = 'success' | 'error' | 'info';
interface OptionChainPanelProps {
token: string;
tenantId: string;
onNotify: (payload: { msg: string; severity: SnackSeverity }) => void;
}
const UNDERLYINGS = [
{ key: 'NSE_INDEX|Nifty 50', label: 'NIFTY' },
{ key: 'NSE_INDEX|Nifty Bank', label: 'BANKNIFTY' },
{ key: 'BSE_INDEX|SENSEX', label: 'SENSEX' },
];
const formatNumber = (value?: number, digits = 2) => {
if (value === undefined || value === null || Number.isNaN(value)) return '--';
return Number(value).toLocaleString('en-IN', { maximumFractionDigits: digits, minimumFractionDigits: digits });
};
const formatWholeNumber = (value?: number) => {
if (value === undefined || value === null || Number.isNaN(value)) return '--';
return Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 });
};
const formatPercentChange = (value?: number) => {
if (value === undefined || value === null || Number.isNaN(value)) return '--';
const sign = value > 0 ? '+' : '';
return `${sign}${value.toFixed(1)}%`;
};
const getPercentTone = (value?: number) => {
if (value === undefined || value === null || Number.isNaN(value)) return 'text.secondary';
if (value > 0) return '#0f9d58';
if (value < 0) return '#d93025';
return 'text.secondary';
};
const toOiLakhs = (value?: number) => {
if (value === undefined || value === null) return undefined;
return value / 100000;
};
const findHighestOiRow = (rows: OptionChainRow[], side: 'callOi' | 'putOi') => rows.reduce<OptionChainRow | null>((best, row) => {
const current = row[side] ?? 0;
const bestValue = best?.[side] ?? 0;
return current > bestValue ? row : best;
}, null);
const metricCardSx = {
borderRadius: 2,
px: 1.5,
py: 1.15,
minWidth: 132,
border: '1px solid #d7e0ea',
bgcolor: '#f8fafc',
};
const OptionChainPanel = ({ token, tenantId, onNotify }: OptionChainPanelProps) => {
const [underlyingKey, setUnderlyingKey] = useState(UNDERLYINGS[0].key);
const [expiries, setExpiries] = useState<string[]>([]);
const [expiryDate, setExpiryDate] = useState<string>('');
const [snapshot, setSnapshot] = useState<OptionChainSnapshot | null>(null);
const [loadingExpiries, setLoadingExpiries] = useState(false);
const [loadingSnapshot, setLoadingSnapshot] = useState(false);
const [migrating, setMigrating] = useState(false);
const [autoRefresh, setAutoRefresh] = useState(true);
const [error, setError] = useState<string | null>(null);
const reloadExpiries = useCallback(async (targetUnderlying: string) => {
setLoadingExpiries(true);
setError(null);
try {
const response = await fetchOptionChainExpiries(tenantId, token, targetUnderlying, true);
setExpiries(response.expiries);
setExpiryDate((prev) => {
if (prev && response.expiries.includes(prev)) return prev;
return response.expiries[0] ?? '';
});
} catch (err) {
const message = err instanceof Error ? err.message : 'Failed to load option expiries';
setError(message);
} finally {
setLoadingExpiries(false);
}
}, [tenantId, token]);
const reloadSnapshot = useCallback(async (targetUnderlying: string, targetExpiry: string, refreshIfMissing: boolean) => {
if (!targetExpiry) {
setSnapshot(null);
return;
}
setLoadingSnapshot(true);
setError(null);
try {
const response = await fetchLatestOptionChain(tenantId, token, targetUnderlying, targetExpiry, refreshIfMissing);
setSnapshot(response);
} catch (err) {
const message = err instanceof Error ? err.message : 'Failed to load option chain';
setError(message);
} finally {
setLoadingSnapshot(false);
}
}, [tenantId, token]);
useEffect(() => {
void reloadExpiries(underlyingKey);
}, [underlyingKey, reloadExpiries]);
useEffect(() => {
if (!expiryDate) {
setSnapshot(null);
return;
}
void reloadSnapshot(underlyingKey, expiryDate, true);
}, [underlyingKey, expiryDate, reloadSnapshot]);
useEffect(() => {
if (!autoRefresh || !expiryDate) return;
// Auto-refresh keeps the active expiry live without forcing a provider refresh for missing data every cycle.
const interval = window.setInterval(() => {
void reloadSnapshot(underlyingKey, expiryDate, false);
}, 30_000);
return () => window.clearInterval(interval);
}, [autoRefresh, expiryDate, underlyingKey, reloadSnapshot]);
const rows = useMemo(() => {
if (!snapshot?.rows) return [];
return [...snapshot.rows].sort((a, b) => Number(a.strikePrice) - Number(b.strikePrice));
}, [snapshot]);
const maxCallOi = useMemo(
() => rows.reduce((max, row) => Math.max(max, row.callOi ?? 0), 0),
[rows]
);
const maxPutOi = useMemo(
() => rows.reduce((max, row) => Math.max(max, row.putOi ?? 0), 0),
[rows]
);
const atmStrike = useMemo(() => {
const spot = snapshot?.underlyingSpotPrice;
if (!spot || rows.length === 0) return null;
return rows.reduce((closest, row) => {
if (!closest) return row;
const currentDiff = Math.abs(Number(row.strikePrice) - spot);
const closestDiff = Math.abs(Number(closest.strikePrice) - spot);
return currentDiff < closestDiff ? row : closest;
}, rows[0] as OptionChainRow).strikePrice;
}, [rows, snapshot]);
const callWall = useMemo(() => findHighestOiRow(rows, 'callOi'), [rows]);
const putWall = useMemo(() => findHighestOiRow(rows, 'putOi'), [rows]);
const oiBias = useMemo(() => {
const totalCallOi = rows.reduce((sum, row) => sum + (row.callOi ?? 0), 0);
const totalPutOi = rows.reduce((sum, row) => sum + (row.putOi ?? 0), 0);
if (totalCallOi === 0 || totalPutOi === 0) return null;
const ratio = totalPutOi / totalCallOi;
if (ratio >= 1.1) return { label: 'Put-heavy', value: ratio };
if (ratio <= 0.9) return { label: 'Call-heavy', value: ratio };
return { label: 'Balanced', value: ratio };
}, [rows]);
const runHistoricalMigration = async () => {
setMigrating(true);
try {
const response = await migrateOptionChainHistorical(tenantId, token, {
underlyingKey,
includeAllExpiries: true,
});
const result = response.results[0];
if (result) {
onNotify({
msg: `Migration done: ${result.persistedRows} rows, ${result.failedExpiries} failed expiries`,
severity: result.failedExpiries > 0 ? 'info' : 'success',
});
}
await reloadExpiries(underlyingKey);
if (expiryDate) {
await reloadSnapshot(underlyingKey, expiryDate, true);
}
} catch (err) {
const message = err instanceof Error ? err.message : 'Failed to trigger option migration';
setError(message);
onNotify({ msg: message, severity: 'error' });
} finally {
setMigrating(false);
}
};
return (
<Stack spacing={2}>
<Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
<Box>
<Typography variant="h5" fontWeight={700}>Option Chain</Typography>
<Typography variant="body2" color="text.secondary">
Nifty 50, Bank Nifty, and Sensex full-chain snapshots with live refresh.
</Typography>
</Box>
<Stack direction="row" spacing={1}>
<Button
variant="outlined"
size="small"
startIcon={migrating ? <CircularProgress size={14} /> : <HistoryRoundedIcon />}
disabled={migrating || loadingSnapshot}
onClick={runHistoricalMigration}
>
Migrate Historical
</Button>
<Button
variant="contained"
size="small"
startIcon={loadingSnapshot ? <CircularProgress size={14} color="inherit" /> : <RefreshRoundedIcon />}
onClick={() => { void reloadSnapshot(underlyingKey, expiryDate, true); }}
disabled={loadingSnapshot || !expiryDate}
>
Refresh
</Button>
</Stack>
</Stack>
{error && <Alert severity="error">{error}</Alert>}
<Card>
<CardContent>
<Stack spacing={2}>
<Box
sx={{
display: 'grid',
gridTemplateColumns: {
xs: 'repeat(2, minmax(0, 1fr))',
md: '1.2fr repeat(5, minmax(0, 1fr))',
},
gap: 1,
p: 1.25,
borderRadius: 2.5,
border: '1px solid #d7e3ef',
background: 'linear-gradient(180deg, #f8fbfe 0%, #f2f6fb 100%)',
}}
>
<Box
sx={{
...metricCardSx,
bgcolor: '#c3d4ea',
borderColor: '#8aa6c7',
color: '#16385f',
boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.55)',
}}
>
<Typography variant="caption" sx={{ display: 'block', color: '#36597f', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
Spot Price
</Typography>
<Typography variant="h6" sx={{ fontSize: '1.18rem', fontWeight: 800, lineHeight: 1.2 }}>
{formatNumber(snapshot?.underlyingSpotPrice)}
</Typography>
</Box>
<Box sx={metricCardSx}>
<Typography variant="caption" sx={{ display: 'block', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary' }}>
ATM Strike
</Typography>
<Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
{formatNumber(atmStrike ?? undefined, 0)}
</Typography>
</Box>
<Box sx={metricCardSx}>
<Typography variant="caption" sx={{ display: 'block', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary' }}>
Synth Future
</Typography>
<Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
{formatNumber(snapshot?.syntheticFuturePrice)}
</Typography>
</Box>
<Box sx={metricCardSx}>
<Typography variant="caption" sx={{ display: 'block', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary' }}>
OI Bias
</Typography>
<Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
{oiBias ? `${oiBias.label} ${oiBias.value.toFixed(2)}x` : '--'}
</Typography>
</Box>
<Box sx={metricCardSx}>
<Typography variant="caption" sx={{ display: 'block', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary' }}>
Call Wall
</Typography>
<Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
{callWall ? `${formatNumber(callWall.strikePrice, 0)} • ${formatNumber(toOiLakhs(callWall.callOi))}L` : '--'}
</Typography>
</Box>
<Box sx={metricCardSx}>
<Typography variant="caption" sx={{ display: 'block', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary' }}>
Put Wall
</Typography>
<Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
{putWall ? `${formatNumber(putWall.strikePrice, 0)} • ${formatNumber(toOiLakhs(putWall.putOi))}L` : '--'}
</Typography>
</Box>
</Box>
<Grid container spacing={1.5} alignItems="center">
<Grid item xs={12} md={3}>
<FormControl fullWidth size="small">
<InputLabel id="option-chain-underlying-label">Underlying</InputLabel>
<Select
labelId="option-chain-underlying-label"
value={underlyingKey}
label="Underlying"
onChange={(event) => setUnderlyingKey(event.target.value)}
>
{UNDERLYINGS.map((underlying) => (
<MenuItem key={underlying.key} value={underlying.key}>{underlying.label}</MenuItem>
))}
</Select>
</FormControl>
</Grid>
<Grid item xs={12} md={3}>
<FormControl fullWidth size="small" disabled={loadingExpiries}>
<InputLabel id="option-chain-expiry-label">Expiry</InputLabel>
<Select
labelId="option-chain-expiry-label"
value={expiryDate}
label="Expiry"
onChange={(event) => setExpiryDate(event.target.value)}
>
{expiries.map((expiry) => (
<MenuItem key={expiry} value={expiry}>{expiry}</MenuItem>
))}
</Select>
</FormControl>
</Grid>
<Grid item xs={12} md={6}>
<Stack direction="row" justifyContent={{ xs: 'flex-start', md: 'flex-end' }} spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
<Chip
size="small"
label={`Spot ${formatNumber(snapshot?.underlyingSpotPrice)}`}
sx={{
bgcolor: '#b7cbe4',
color: '#16385f',
border: '1px solid #88a7ca',
}}
/>
<Chip size="small" label={`PCR ${formatNumber(snapshot?.pcr, 3)}`} />
<Stack direction="row" spacing={0.5} alignItems="center">
<AutorenewRoundedIcon fontSize="small" color={autoRefresh ? 'success' : 'disabled'} />
<Switch checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} size="small" />
<Typography variant="caption" color="text.secondary">Auto 30s</Typography>
</Stack>
<Chip size="small" label={`${rows.length} strikes`} />
</Stack>
</Grid>
</Grid>
<Paper
variant="outlined"
sx={{
overflow: 'hidden',
borderRadius: 2.5,
borderColor: '#d4dde7',
}}
>
<TableContainer sx={{ maxHeight: '68vh' }}>
<Table stickyHeader size="small">
<TableHead>
<TableRow>
<TableCell align="center" colSpan={4} sx={{ bgcolor: '#f8e9e7', color: '#9f3d2c', fontWeight: 800, borderBottom: '1px solid #e7d1cc' }}>CALLS</TableCell>
<TableCell align="center" sx={{ bgcolor: '#eef3f8', color: '#35506e', fontWeight: 800, borderBottom: '1px solid #d7e0ea' }}>STRIKE</TableCell>
<TableCell align="center" sx={{ bgcolor: '#eef6f1', color: '#2c6b4f', fontWeight: 800, borderBottom: '1px solid #d2e4da' }}>IV</TableCell>
<TableCell align="center" colSpan={4} sx={{ bgcolor: '#e7f4ec', color: '#2c6b4f', fontWeight: 800, borderBottom: '1px solid #d2e4da' }}>PUTS</TableCell>
</TableRow>
<TableRow>
<TableCell align="right">OI Chg%</TableCell>
<TableCell align="right">OI (L)</TableCell>
<TableCell align="left">Call OI</TableCell>
<TableCell align="right">LTP</TableCell>
<TableCell align="center">Strike</TableCell>
<TableCell align="center">IV</TableCell>
<TableCell align="right">LTP</TableCell>
<TableCell align="left">Put OI</TableCell>
<TableCell align="right">OI (L)</TableCell>
<TableCell align="right">OI Chg%</TableCell>
</TableRow>
</TableHead>
<TableBody>
{loadingSnapshot && rows.length === 0 && (
<TableRow>
<TableCell colSpan={10} align="center" sx={{ py: 6 }}>
<CircularProgress size={24} />
</TableCell>
</TableRow>
)}
{!loadingSnapshot && rows.length === 0 && (
<TableRow>
<TableCell colSpan={10} align="center" sx={{ py: 5 }}>
<Typography variant="body2" color="text.secondary">No option data available for selected expiry.</Typography>
</TableCell>
</TableRow>
)}
{rows.map((row, index) => {
const callOiPct = row.callOiChangePercent;
const putOiPct = row.putOiChangePercent;
const callOiBar = maxCallOi > 0 ? Math.round(((row.callOi ?? 0) / maxCallOi) * 100) : 0;
const putOiBar = maxPutOi > 0 ? Math.round(((row.putOi ?? 0) / maxPutOi) * 100) : 0;
const isAtm = atmStrike !== null && Number(row.strikePrice) === Number(atmStrike);
const rowBg = isAtm ? '#dce6f2' : index % 2 === 0 ? '#ffffff' : '#fbfdff';
return (
<TableRow
key={`${row.strikePrice}`}
sx={{
bgcolor: rowBg,
'&:hover': {
bgcolor: isAtm ? '#d3dfef' : '#f2f7fc',
},
}}
>
<TableCell align="right" sx={{ color: getPercentTone(callOiPct) }}>{formatPercentChange(callOiPct)}</TableCell>
<TableCell align="right">{formatNumber(toOiLakhs(row.callOi))}</TableCell>
<TableCell>
<Box sx={{ position: 'relative', minHeight: 32, display: 'flex', alignItems: 'center', bgcolor: '#f8f0e8', borderRadius: 1.5, overflow: 'hidden' }}>
<Box sx={{ position: 'absolute', inset: 0, width: `${callOiBar}%`, bgcolor: 'rgba(189,92,66,0.24)', borderRadius: 1.5 }} />
<Typography variant="body2" sx={{ position: 'relative', pl: 1.2, fontWeight: 700, color: '#2b3445' }}>{formatWholeNumber(row.callOi)}</Typography>
</Box>
</TableCell>
<TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{formatNumber(row.callLtp)}</TableCell>
<TableCell align="center" sx={{ fontWeight: 800, color: isAtm ? '#16385f' : '#172033' }}>
<Box>
<Typography variant="body2" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
{formatNumber(row.strikePrice, 0)}
</Typography>
{isAtm && (
<Typography variant="caption" sx={{ color: '#36597f', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
ATM
</Typography>
)}
</Box>
</TableCell>
<TableCell align="center" sx={{ fontVariantNumeric: 'tabular-nums', color: '#334155' }}>{formatNumber((row.putIv ?? row.callIv), 1)}</TableCell>
<TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{formatNumber(row.putLtp)}</TableCell>
<TableCell>
<Box sx={{ position: 'relative', minHeight: 32, display: 'flex', alignItems: 'center', bgcolor: '#edf7f1', borderRadius: 1.5, overflow: 'hidden' }}>
<Box sx={{ position: 'absolute', inset: 0, width: `${putOiBar}%`, bgcolor: 'rgba(61,154,109,0.24)', borderRadius: 1.5 }} />
<Typography variant="body2" sx={{ position: 'relative', pl: 1.2, fontWeight: 700, color: '#2b3445' }}>{formatWholeNumber(row.putOi)}</Typography>
</Box>
</TableCell>
<TableCell align="right">{formatNumber(toOiLakhs(row.putOi))}</TableCell>
<TableCell align="right" sx={{ color: getPercentTone(putOiPct) }}>{formatPercentChange(putOiPct)}</TableCell>
</TableRow>
);
})}
</TableBody>
</Table>
</TableContainer>
</Paper>
<Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between">
<Typography variant="caption" color="text.secondary">
Snapshot: {snapshot?.snapshotTs ? new Date(snapshot.snapshotTs).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium' }) : '--'}
</Typography>
<Typography variant="caption" color="text.secondary">
Auto-refresh uses 30-second intervals to stay within Upstox option-chain limits.
</Typography>
</Stack>
</Stack>
</CardContent>
</Card>
</Stack>
);
};
export { OptionChainPanel };
