import { Alert, Card, CardContent, Chip, CircularProgress, Collapse, Grid, IconButton, Stack, Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography } from '@mui/material';
import AccountBalanceRoundedIcon from '@mui/icons-material/AccountBalanceRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchUpstoxOrders, fetchUpstoxPositions, type UpstoxOrderItem, type UpstoxPositionItem } from '../../../api/admin';
import { formatPnlRupees } from '../IntraTradeShared';
import { PnlSectionHeader } from './PnlSectionHeader';
import { fmtPrice, pnlBg, pnlColor } from './pnlUtils';

export const UpstoxPortfolioTab = ({
  token,
  tenantId,
  username,
}: {
  token: string;
  tenantId: string;
  username: string;
}) => {
  const [positions, setPositions] = useState<UpstoxPositionItem[]>([]);
  const [orders, setOrders] = useState<UpstoxOrderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [posOpen, setPosOpen] = useState(true);
  const [ordOpen, setOrdOpen] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setSyncError(null);
    try {
      const [posRes, ordRes] = await Promise.all([
        fetchUpstoxPositions(tenantId, token, username),
        fetchUpstoxOrders(tenantId, token, username),
      ]);
      setPositions(posRes.positions ?? []);
      setOrders(ordRes.orders ?? []);
      setLastRefreshed(new Date());
    } catch (error) {
      setSyncError((error as Error).message || 'Unable to fetch Upstox portfolio');
    } finally {
      setLoading(false);
    }
  }, [tenantId, token, username]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      void reload();
    }, 30_000);
    return () => clearInterval(id);
  }, [autoRefresh, reload]);

  const totalPnl = useMemo(() => positions.reduce((sum, p) => sum + (p.pnl ?? 0), 0), [positions]);
  const openPos = useMemo(() => positions.filter((p) => (p.netQuantity ?? 0) !== 0), [positions]);
  const filledOrders = useMemo(() => orders.filter((o) => o.status?.toUpperCase() === 'COMPLETE'), [orders]);

  const statusChipColor = (status: string): 'success' | 'error' | 'warning' | 'default' => {
    const s = status?.toUpperCase();
    if (s === 'COMPLETE') return 'success';
    if (s === 'REJECTED' || s === 'CANCELLED') return 'error';
    if (s === 'OPEN' || s === 'PENDING') return 'warning';
    return 'default';
  };

  return (
    <Stack spacing={2.5} data-testid="intra-pnl-upstox-tab">
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" spacing={1}>
        <Stack spacing={0.25}>
          <Stack direction="row" spacing={1} alignItems="center">
            <AccountBalanceRoundedIcon sx={{ color: 'primary.main' }} />
            <Typography variant="h6" fontWeight={800}>Upstox Live Portfolio</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Real-time positions and today&apos;s orders from Upstox.
            {lastRefreshed && (
              <Typography component="span" sx={{ ml: 1, color: 'text.disabled', fontSize: '0.75rem' }}>
                Last synced: {lastRefreshed.toLocaleTimeString('en-IN')}
              </Typography>
            )}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            size="small"
            label={autoRefresh ? 'Auto-refresh ON (30s)' : 'Auto-refresh OFF'}
            color={autoRefresh ? 'success' : 'default'}
            variant="outlined"
            onClick={() => setAutoRefresh((v) => !v)}
            sx={{ cursor: 'pointer' }}
            data-testid="intra-pnl-upstox-auto-refresh"
          />
          <Tooltip title="Refresh from Upstox">
            <span>
              <IconButton onClick={() => void reload()} disabled={loading} color="primary" size="small" data-testid="intra-pnl-upstox-refresh">
                {loading ? <CircularProgress size={18} /> : <RefreshRoundedIcon />}
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>

      <Grid container spacing={1.5}>
        {([
          { label: 'Total P&L (Day)', value: totalPnl, fmt: 'pnl' },
          { label: 'Open Positions', value: openPos.length, fmt: 'count' },
          { label: 'Orders Today', value: orders.length, fmt: 'count' },
          { label: 'Filled Orders', value: filledOrders.length, fmt: 'count' },
        ] as { label: string; value: number; fmt: 'pnl' | 'count' }[]).map(({ label, value, fmt }) => {
          const color = fmt === 'pnl' ? pnlColor(value) : 'text.primary';
          const bg = fmt === 'pnl' ? pnlBg(value) : undefined;
          return (
            <Grid item xs={12} sm={6} md={3} key={label}>
              <Card variant="outlined" sx={{ bgcolor: bg }}>
                <CardContent sx={{ pb: '12px !important' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{label}</Typography>
                    {fmt === 'pnl' && value !== 0 && (
                      value > 0
                        ? <TrendingUpRoundedIcon sx={{ fontSize: 16, color: '#15803d' }} />
                        : <TrendingDownRoundedIcon sx={{ fontSize: 16, color: '#b91c1c' }} />
                    )}
                  </Stack>
                  <Typography variant="h6" fontWeight={800} sx={{ color, mt: 0.25 }}>
                    {fmt === 'pnl' ? formatPnlRupees(value) : value.toString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Card>
        <CardContent>
          <PnlSectionHeader title="Positions" open={posOpen} onToggle={() => setPosOpen((v) => !v)} badge={positions.length} />
          <Collapse in={posOpen}>
            <Table size="small" sx={{ mt: 1 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Symbol</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Net Qty</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Avg Buy</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Avg Sell</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>LTP</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>P&L</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {positions.map((pos) => (
                  <TableRow key={pos.instrumentToken} hover sx={{ bgcolor: pnlBg(pos.pnl) }}>
                    <TableCell>
                      <Stack spacing={0}>
                        <Typography variant="body2" fontWeight={700}>{pos.tradingSymbol}</Typography>
                        <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem' }}>{pos.instrumentToken}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      <Chip size="small" label={pos.netQuantity} color={(pos.netQuantity ?? 0) > 0 ? 'success' : (pos.netQuantity ?? 0) < 0 ? 'error' : 'default'} variant="outlined" />
                    </TableCell>
                    <TableCell align="right">{fmtPrice(pos.avgBuyPrice)}</TableCell>
                    <TableCell align="right">{fmtPrice(pos.avgSellPrice)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>{fmtPrice(pos.ltp)}</TableCell>
                    <TableCell align="right"><Typography variant="body2" fontWeight={800} sx={{ color: pnlColor(pos.pnl) }}>{formatPnlRupees(pos.pnl ?? 0)}</Typography></TableCell>
                  </TableRow>
                ))}
                {positions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ color: 'text.secondary', py: 3 }}>
                      {loading ? 'Loading positions…' : 'No positions found for today.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Collapse>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <PnlSectionHeader title="Orders Today" open={ordOpen} onToggle={() => setOrdOpen((v) => !v)} badge={orders.length} />
          <Collapse in={ordOpen}>
            <Table size="small" sx={{ mt: 1 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Symbol</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Side</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Qty / Filled</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Price / Avg</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Tag</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {orders.map((ord) => (
                  <TableRow key={ord.orderId} hover>
                    <TableCell>
                      <Stack spacing={0}>
                        <Typography variant="body2" fontWeight={700}>{ord.tradingSymbol ?? ord.instrumentToken}</Typography>
                        <Typography variant="caption" color="text.disabled" sx={{ fontFamily: 'monospace', fontSize: '0.65rem' }}>{ord.orderId}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell><Chip size="small" label={ord.transactionType} color={ord.transactionType?.toUpperCase() === 'BUY' ? 'success' : 'error'} /></TableCell>
                    <TableCell align="right">
                      <Stack alignItems="flex-end" spacing={0}>
                        <Typography variant="body2" fontWeight={600}>{ord.quantity}</Typography>
                        {ord.filledQuantity > 0 && <Typography variant="caption" color="text.secondary">filled: {ord.filledQuantity}</Typography>}
                      </Stack>
                    </TableCell>
                    <TableCell>{ord.orderType}</TableCell>
                    <TableCell align="right">
                      <Stack alignItems="flex-end" spacing={0}>
                        <Typography variant="body2">{fmtPrice(ord.limitPrice)}</Typography>
                        {ord.averagePrice != null && ord.averagePrice > 0 && <Typography variant="caption" color="text.secondary">avg: {fmtPrice(ord.averagePrice)}</Typography>}
                      </Stack>
                    </TableCell>
                    <TableCell><Chip size="small" label={ord.status} color={statusChipColor(ord.status)} variant={ord.status?.toUpperCase() === 'COMPLETE' ? 'filled' : 'outlined'} /></TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', color: 'text.secondary', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ord.tag}</TableCell>
                  </TableRow>
                ))}
                {orders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ color: 'text.secondary', py: 3 }}>
                      {loading ? 'Loading orders…' : 'No orders found for today.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Collapse>
        </CardContent>
      </Card>

      {syncError && <Alert severity="error">Upstox sync failed: {syncError}</Alert>}
      {loading && <Alert severity="info">Syncing with Upstox…</Alert>}
    </Stack>
  );
};
