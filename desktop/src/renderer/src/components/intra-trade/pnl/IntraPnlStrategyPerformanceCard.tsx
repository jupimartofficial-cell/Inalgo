import { Card, CardContent, Collapse, InputAdornment, LinearProgress, Table, TableBody, TableCell, TableHead, TablePagination, TableRow, TextField, Typography } from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { PnlSectionHeader } from './PnlSectionHeader';
import { formatPnlRupees } from '../IntraTradeShared';
import { pnlColor } from './pnlUtils';
import type { IntraStrategyPerformanceRow } from '../../../api/admin';

export const IntraPnlStrategyPerformanceCard = ({
  open,
  onToggle,
  rows,
  search,
  onSearchChange,
  page,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
  sortBy,
  sortAsc,
  onSort,
}: {
  open: boolean;
  onToggle: () => void;
  rows: IntraStrategyPerformanceRow[];
  search: string;
  onSearchChange: (value: string) => void;
  page: number;
  rowsPerPage: number;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rowsPerPage: number) => void;
  sortBy: 'totalPnl' | 'winRate' | 'numberOfTrades';
  sortAsc: boolean;
  onSort: (sortBy: 'totalPnl' | 'winRate' | 'numberOfTrades') => void;
}) => {
  const pageRows = rows.slice(page * rowsPerPage, (page + 1) * rowsPerPage);
  const values = rows.map((r) => r.totalPnl);
  const topPnl = values.length > 0 ? Math.max(...values) : null;
  const bottomPnl = values.length > 0 ? Math.min(...values) : null;

  const sortArrow = (col: typeof sortBy) => (sortBy === col ? (sortAsc ? '↑' : '↓') : '');

  return (
    <Card data-testid="intra-pnl-strategy-card">
      <CardContent>
        <PnlSectionHeader title="Strategy Performance" open={open} onToggle={onToggle} badge={rows.length} />
        <Collapse in={open}>
          <TextField
            size="small"
            placeholder="Search strategy…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" /></InputAdornment> }}
            sx={{ maxWidth: 280, mt: 1 }}
            data-testid="intra-pnl-strategy-search"
          />
          <Table size="small" sx={{ mt: 1 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: '#f8fafc' }}>
                <TableCell sx={{ fontWeight: 700 }}>Strategy</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, cursor: 'pointer' }} onClick={() => onSort('numberOfTrades')}>Trades {sortArrow('numberOfTrades')}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, cursor: 'pointer' }} onClick={() => onSort('winRate')}>Win % {sortArrow('winRate')}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, cursor: 'pointer' }} onClick={() => onSort('totalPnl')}>Total P&L {sortArrow('totalPnl')}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Avg Trade</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Max Win</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Max Loss</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Drawdown</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Paper / Live</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pageRows.map((row) => {
                const highlight = row.totalPnl === topPnl ? '#ecfdf3' : row.totalPnl === bottomPnl ? '#fef2f2' : undefined;
                return (
                  <TableRow key={row.strategyName} hover sx={{ bgcolor: highlight }}>
                    <TableCell sx={{ fontWeight: 600, maxWidth: 180 }}>{row.strategyName}</TableCell>
                    <TableCell align="right">{row.numberOfTrades}</TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ color: !(row.winRate < 50) ? '#15803d' : '#b91c1c', fontWeight: 700 }}>
                        {row.winRate.toFixed(1)}%
                      </Typography>
                      <LinearProgress variant="determinate" value={Math.min(100, row.winRate)} sx={{ width: 54, ml: 'auto', height: 3, borderRadius: 1, bgcolor: '#fee2e2', '& .MuiLinearProgress-bar': { bgcolor: !(row.winRate < 50) ? '#15803d' : '#b91c1c' } }} />
                    </TableCell>
                    <TableCell align="right"><Typography variant="body2" fontWeight={800} sx={{ color: pnlColor(row.totalPnl) }}>{formatPnlRupees(row.totalPnl)}</Typography></TableCell>
                    <TableCell align="right"><Typography variant="body2" sx={{ color: pnlColor(row.avgTrade) }}>{formatPnlRupees(row.avgTrade)}</Typography></TableCell>
                    <TableCell align="right" sx={{ color: '#15803d', fontWeight: 600 }}>{formatPnlRupees(row.maxWin)}</TableCell>
                    <TableCell align="right" sx={{ color: '#b91c1c', fontWeight: 600 }}>{formatPnlRupees(row.maxLoss)}</TableCell>
                    <TableCell align="right" sx={{ color: '#b45309', fontWeight: 600 }}>{formatPnlRupees(row.drawdown)}</TableCell>
                    <TableCell align="right"><Typography variant="caption" sx={{ fontWeight: 700 }}>{row.paperTrades}P / {row.liveTrades}L</Typography></TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ color: 'text.secondary', py: 3 }}>
                    {search ? 'No matching strategies.' : 'No strategy performance data for selected filters.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {rows.length > rowsPerPage && (
            <TablePagination
              component="div"
              count={rows.length}
              page={page}
              onPageChange={(_, nextPage) => onPageChange(nextPage)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => onRowsPerPageChange(Number(e.target.value))}
              rowsPerPageOptions={[5, 10, 25]}
              labelRowsPerPage="Per page:"
            />
          )}
        </Collapse>
      </CardContent>
    </Card>
  );
};
