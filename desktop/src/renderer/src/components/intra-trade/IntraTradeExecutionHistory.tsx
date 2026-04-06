import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
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
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import type { IntraTradeExecutionSummary } from '../../api/admin';
import { formatDateTime } from '../AppShellShared';

const STATUS_TONE: Record<string, 'default' | 'success' | 'warning' | 'info' | 'error'> = {
  WAITING_ENTRY: 'warning',
  ENTERED: 'info',
  EXITED: 'success',
  COMPLETED: 'success',
  FAILED: 'error',
};

const MODE_LABEL: Record<string, string> = {
  LIVE: 'Live',
  PAPER: 'Paper',
  BACKTEST: 'Backtest',
};

export const IntraTradeExecutionHistory = ({
  executions,
  totalElements,
  page,
  rowsPerPage,
  loading,
  selectedExecutionId,
  onSelectExecution,
  onAddRun,
  onEditExecution,
  onDeleteExecution,
  onExitExecution,
  onRefreshList,
  onPageChange,
  onRowsPerPageChange,
  deletingExecutionId,
  exitingExecutionId,
}: {
  executions: IntraTradeExecutionSummary[];
  totalElements: number;
  page: number;
  rowsPerPage: number;
  loading: boolean;
  selectedExecutionId: number | null;
  onSelectExecution: (executionId: number) => void;
  onAddRun: () => void;
  onEditExecution: (executionId: number) => void;
  onDeleteExecution: (executionId: number) => void;
  onExitExecution: (executionId: number) => void;
  onRefreshList: () => void;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rowsPerPage: number) => void;
  deletingExecutionId: number | null;
  exitingExecutionId: number | null;
}) => (
  <Card>
    <CardContent>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box>
          <Typography variant="subtitle1" fontWeight={800}>Saved Runs</Typography>
          <Typography variant="caption" color="text.secondary">
            Backend-persisted live, paper, and historical executions for the signed-in user.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Button size="small" variant="outlined" startIcon={<AddRoundedIcon />} onClick={onAddRun}>
            Add Run
          </Button>
          <Tooltip title="Refresh saved runs">
            <span>
              <IconButton onClick={onRefreshList} disabled={loading} aria-label="Refresh Intra Trade runs">
                {loading ? <CircularProgress size={18} /> : <RefreshRoundedIcon />}
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ '& th': { fontWeight: 700, fontSize: '0.74rem', bgcolor: '#f8fafc' } }}>
              <TableCell>Mode</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Strategy</TableCell>
              <TableCell>Scan</TableCell>
              <TableCell align="right">Trades</TableCell>
              <TableCell align="right">P&L</TableCell>
              <TableCell>Evaluated</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {executions.map((execution) => (
              <TableRow
                hover
                key={execution.id}
                selected={selectedExecutionId === execution.id}
                onClick={() => onSelectExecution(execution.id)}
                sx={{ cursor: 'pointer' }}
              >
                <TableCell>
                  <Chip label={MODE_LABEL[execution.mode] ?? execution.mode} size="small" variant="outlined" />
                </TableCell>
                <TableCell>
                  <Chip label={execution.status.replace(/_/g, ' ')} size="small" color={STATUS_TONE[execution.status] ?? 'default'} />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight={700}>{execution.strategyName}</Typography>
                  <Typography variant="caption" color="text.secondary">{execution.statusMessage ?? 'No status message'}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="caption" display="block">{execution.scanInstrumentKey}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {execution.scanTimeframeInterval} {execution.scanTimeframeUnit}
                  </Typography>
                </TableCell>
                <TableCell align="right">{execution.executedTrades}</TableCell>
                <TableCell align="right">{execution.totalPnl?.toFixed?.(2) ?? execution.totalPnl}</TableCell>
                <TableCell>{execution.evaluatedAt ? formatDateTime(execution.evaluatedAt) : '—'}</TableCell>
                <TableCell align="right" onClick={(event) => event.stopPropagation()}>
                  <Tooltip title={execution.status === 'ENTERED' ? 'Exit the position before editing' : 'Edit saved run'}>
                    <span>
                      <IconButton
                        size="small"
                        aria-label={`Edit saved run ${execution.strategyName}`}
                        disabled={execution.status === 'ENTERED'}
                        onClick={() => onEditExecution(execution.id)}
                      >
                        <EditRoundedIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </span>
                  </Tooltip>
                  {execution.status === 'ENTERED' && (
                    <Tooltip title="Immediate exit">
                      <span>
                        <IconButton
                          size="small"
                          aria-label={`Exit saved run ${execution.strategyName}`}
                          disabled={exitingExecutionId === execution.id}
                          onClick={() => onExitExecution(execution.id)}
                        >
                          {exitingExecutionId === execution.id ? <CircularProgress size={16} /> : <LogoutRoundedIcon sx={{ fontSize: 16 }} />}
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}
                  <Tooltip title={execution.status === 'ENTERED' ? 'Exit the position before deleting' : 'Delete saved run'}>
                    <span>
                      <IconButton
                        size="small"
                        color="error"
                        aria-label={`Delete saved run ${execution.strategyName}`}
                        disabled={execution.status === 'ENTERED' || deletingExecutionId === execution.id}
                        onClick={() => onDeleteExecution(execution.id)}
                      >
                        {deletingExecutionId === execution.id ? <CircularProgress size={16} /> : <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />}
                      </IconButton>
                    </span>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {!executions.length && (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  No Intra Trade runs saved yet.
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
        onRowsPerPageChange={(event) => onRowsPerPageChange(parseInt(event.target.value, 10))}
        rowsPerPageOptions={[5, 10, 25]}
      />
    </CardContent>
  </Card>
);
