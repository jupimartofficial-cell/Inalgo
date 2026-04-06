import {
  Card,
  CardContent,
  Chip,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import type { BacktestStrategyResponse } from '../api/admin';
import {
  formatInstrumentLabel,
  normalizeStrategyType,
  type InstrumentOption,
} from './BacktestPanelShared';

export interface BacktestStrategyListViewProps {
  strategies: BacktestStrategyResponse[];
  totalElements: number;
  page: number;
  rowsPerPage: number;
  loadingList: boolean;
  baseInstruments: InstrumentOption[];
  onEdit: (row: BacktestStrategyResponse) => void;
  onDelete: (id: number) => void;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rowsPerPage: number) => void;
}

export const BacktestStrategyListView = ({
  strategies,
  totalElements,
  page,
  rowsPerPage,
  loadingList,
  baseInstruments,
  onEdit,
  onDelete,
  onPageChange,
  onRowsPerPageChange,
}: BacktestStrategyListViewProps) => {
  return (
    <Card>
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" fontWeight={700}>Strategy List</Typography>
            <Chip
              label={loadingList ? 'Loading…' : `${totalElements} saved`}
              size="small"
              variant="outlined"
            />
          </Stack>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead sx={{ '& th': { fontWeight: 700, fontSize: '0.72rem', bgcolor: '#f5f7fa', color: '#555' } }}>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Index</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Date Range</TableCell>
                  <TableCell>Legs</TableCell>
                  <TableCell>Conditions</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {strategies.map((row) => (
                  <TableRow key={row.id} hover sx={{ cursor: 'pointer' }} onClick={() => onEdit(row)}>
                    <TableCell sx={{ fontWeight: 600 }}>{row.strategyName}</TableCell>
                    <TableCell>{formatInstrumentLabel(row.underlyingKey, baseInstruments)}</TableCell>
                    <TableCell>
                      <Chip
                        label={normalizeStrategyType(row.strategyType)}
                        size="small"
                        variant="outlined"
                        color={normalizeStrategyType(row.strategyType) === 'INTRADAY' ? 'primary' : 'default'}
                      />
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.75rem', color: '#666' }}>
                      {row.strategy?.startDate ?? '—'} → {row.strategy?.endDate ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Chip label={`${row.legsCount ?? row.strategy?.legs?.length ?? 0} legs`} size="small" sx={{ fontSize: '0.68rem' }} />
                    </TableCell>
                    <TableCell>
                      {row.strategy?.advancedConditions?.enabled ? (
                        <Chip label="Advance" size="small" color="primary" variant="outlined" sx={{ fontSize: '0.68rem' }} />
                      ) : (
                        <Typography variant="caption" color="text.disabled">Basic</Typography>
                      )}
                    </TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <Tooltip title="Edit & Run">
                        <IconButton size="small" color="primary" onClick={() => onEdit(row)}>
                          <EditRoundedIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => onDelete(row.id)}>
                          <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {!loadingList && !strategies.length && (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                      No strategy saved yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={totalElements}
            page={page}
            onPageChange={(_, nextPage) => onPageChange(nextPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => { onRowsPerPageChange(Number(e.target.value)); onPageChange(0); }}
            rowsPerPageOptions={[5, 10, 25, 50]}
            showFirstButton
            showLastButton
          />
        </Stack>
      </CardContent>
    </Card>
  );
};
