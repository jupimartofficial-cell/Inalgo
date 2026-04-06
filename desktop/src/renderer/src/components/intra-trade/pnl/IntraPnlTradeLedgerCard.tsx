import { Box, Card, CardContent, Chip, Collapse, FormControl, InputAdornment, InputLabel, MenuItem, Select, Stack, Table, TableBody, TableCell, TableHead, TablePagination, TableRow, TextField, Typography } from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import type { IntraTradeLedgerRow } from '../../../api/admin';
import { PnlSectionHeader } from './PnlSectionHeader';
import { fmtDate, pnlBg, pnlColor } from './pnlUtils';
import { formatPnlRupees } from '../IntraTradeShared';

export const IntraPnlTradeLedgerCard = ({
  open,
  onToggle,
  rows,
  search,
  onSearchChange,
  modeFilter,
  onModeFilterChange,
  statusFilter,
  onStatusFilterChange,
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
  rows: IntraTradeLedgerRow[];
  search: string;
  onSearchChange: (value: string) => void;
  modeFilter: 'ALL' | 'PAPER' | 'LIVE';
  onModeFilterChange: (mode: 'ALL' | 'PAPER' | 'LIVE') => void;
  statusFilter: 'ALL' | 'OPEN' | 'CLOSED';
  onStatusFilterChange: (status: 'ALL' | 'OPEN' | 'CLOSED') => void;
  page: number;
  rowsPerPage: number;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rowsPerPage: number) => void;
  sortBy: 'dateTime' | 'pnl';
  sortAsc: boolean;
  onSort: (sortBy: 'dateTime' | 'pnl') => void;
}) => {
  const pageRows = rows.slice(page * rowsPerPage, (page + 1) * rowsPerPage);
  const sortArrow = (col: typeof sortBy) => (sortBy === col ? (sortAsc ? '↑' : '↓') : '');

  return (
    <Card data-testid="intra-pnl-ledger-card">
      <CardContent>
        <PnlSectionHeader title="Trade Ledger" open={open} onToggle={onToggle} badge={rows.length} />
        <Collapse in={open}>
          <Stack spacing={1} sx={{ mt: 1 }}>
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
              <TextField
                size="small"
                placeholder="Search instrument / strategy…"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" /></InputAdornment> }}
                sx={{ minWidth: 240 }}
                data-testid="intra-pnl-ledger-search"
              />
              <FormControl size="small" sx={{ minWidth: 110 }}>
                <InputLabel>Mode</InputLabel>
                <Select label="Mode" value={modeFilter} onChange={(e) => onModeFilterChange(e.target.value as 'ALL' | 'PAPER' | 'LIVE')}>
                  <MenuItem value="ALL">All</MenuItem>
                  <MenuItem value="PAPER">Paper</MenuItem>
                  <MenuItem value="LIVE">Live</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 110 }}>
                <InputLabel>Status</InputLabel>
                <Select label="Status" value={statusFilter} onChange={(e) => onStatusFilterChange(e.target.value as 'ALL' | 'OPEN' | 'CLOSED')}>
                  <MenuItem value="ALL">All</MenuItem>
                  <MenuItem value="OPEN">Open</MenuItem>
                  <MenuItem value="CLOSED">Closed</MenuItem>
                </Select>
              </FormControl>
            </Stack>

            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 700 }}>
                <TableHead sx={{ position: 'sticky', top: 0, zIndex: 2 }}>
                  <TableRow sx={{ bgcolor: '#f8fafc' }}>
                    <TableCell sx={{ fontWeight: 700, cursor: 'pointer' }} onClick={() => onSort('dateTime')}>Date {sortArrow('dateTime')}</TableCell>
                    <TableCell sx={{ fontWeight: 700, cursor: 'pointer' }} onClick={() => onSort('dateTime')}>Time {sortArrow('dateTime')}</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Instrument</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Strategy</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Mode</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Qty</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, cursor: 'pointer' }} onClick={() => onSort('pnl')}>P&L {sortArrow('pnl')}</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Exit Reason</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pageRows.map((row) => (
                    <TableRow key={row.executionId + '-' + row.date + '-' + row.time} hover sx={{ bgcolor: pnlBg(row.pnl) }}>
                      <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{fmtDate(row.date)}</TableCell>
                      <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{row.time}</TableCell>
                      <TableCell sx={{ fontWeight: 600, fontSize: '0.82rem' }}>{row.instrument}</TableCell>
                      <TableCell sx={{ fontSize: '0.82rem', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.strategy}</TableCell>
                      <TableCell><Chip size="small" label={row.tradeMode} color={row.tradeMode === 'LIVE' ? 'success' : 'info'} sx={{ height: 18, fontSize: '0.65rem' }} /></TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.82rem' }}>{row.quantity}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}><Typography variant="body2" fontWeight={800} sx={{ color: pnlColor(row.pnl) }}>{formatPnlRupees(row.pnl)}</Typography></TableCell>
                      <TableCell sx={{ fontSize: '0.78rem', color: 'text.secondary', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.exitReason}</TableCell>
                      <TableCell>
                        <Chip size="small" label={row.status} color={row.status === 'OPEN' ? 'warning' : 'default'} variant={row.status === 'OPEN' ? 'filled' : 'outlined'} sx={{ height: 18, fontSize: '0.65rem' }} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} align="center" sx={{ color: 'text.secondary', py: 3 }}>
                        {search || modeFilter !== 'ALL' || statusFilter !== 'ALL'
                          ? 'No trades match the current filters.'
                          : 'No trade ledger rows for selected filters.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Box>
            <TablePagination
              component="div"
              count={rows.length}
              page={page}
              onPageChange={(_, nextPage) => onPageChange(nextPage)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => onRowsPerPageChange(Number(e.target.value))}
              rowsPerPageOptions={[10, 25, 50, 100]}
              labelRowsPerPage="Per page:"
            />
          </Stack>
        </Collapse>
      </CardContent>
    </Card>
  );
};
