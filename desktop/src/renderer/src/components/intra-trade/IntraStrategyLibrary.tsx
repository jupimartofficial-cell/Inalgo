import {
  Card,
  CardContent,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  Paper,
} from '@mui/material';
import ArchiveRoundedIcon from '@mui/icons-material/ArchiveRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import type { IntraStrategyLibraryItem, IntraStrategySort, IntraStrategyStatus } from '../../api/admin';
import { formatInstrumentLabel, type InstrumentOption } from '../BacktestPanelShared';
import type { TimeframeOption } from '../backtestAdvancedConditionUtils';
import { friendlyStrategyStatus, formatPnlRupees } from './IntraTradeShared';

export const IntraStrategyLibrary = ({
  items,
  totalElements,
  page,
  rowsPerPage,
  loading,
  search,
  status,
  sort,
  instrument,
  timeframe,
  baseInstruments,
  baseTimeframes,
  onSearchChange,
  onStatusChange,
  onSortChange,
  onInstrumentChange,
  onTimeframeChange,
  onPageChange,
  onRowsPerPageChange,
  onEdit,
  onDuplicate,
  onArchive,
  onDelete,
}: {
  items: IntraStrategyLibraryItem[];
  totalElements: number;
  page: number;
  rowsPerPage: number;
  loading: boolean;
  search: string;
  status: '' | IntraStrategyStatus;
  sort: IntraStrategySort;
  instrument: string;
  timeframe: string;
  baseInstruments: InstrumentOption[];
  baseTimeframes: TimeframeOption[];
  onSearchChange: (value: string) => void;
  onStatusChange: (value: '' | IntraStrategyStatus) => void;
  onSortChange: (value: IntraStrategySort) => void;
  onInstrumentChange: (value: string) => void;
  onTimeframeChange: (value: string) => void;
  onPageChange: (value: number) => void;
  onRowsPerPageChange: (value: number) => void;
  onEdit: (item: IntraStrategyLibraryItem) => void;
  onDuplicate: (item: IntraStrategyLibraryItem) => void;
  onArchive: (item: IntraStrategyLibraryItem) => void;
  onDelete: (item: IntraStrategyLibraryItem) => void;
}) => (
  <Card>
    <CardContent>
      <Stack spacing={1.5}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
          <Typography variant="h6" fontWeight={700}>Strategy Library</Typography>
          <Chip label={loading ? 'Loading...' : `${totalElements} total`} size="small" variant="outlined" />
        </Stack>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25}>
          <TextField
            size="small"
            label="Search strategy name"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            fullWidth
          />
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Status</InputLabel>
            <Select label="Status" value={status} onChange={(e) => onStatusChange(e.target.value as '' | IntraStrategyStatus)}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="DRAFT">In Progress (Draft)</MenuItem>
              <MenuItem value="PAPER_READY">Ready to Test (Paper)</MenuItem>
              <MenuItem value="LIVE_READY">Ready to Trade (Live)</MenuItem>
              <MenuItem value="ARCHIVED">Archived</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Instrument</InputLabel>
            <Select label="Instrument" value={instrument} onChange={(e) => onInstrumentChange(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              {baseInstruments.map((row) => <MenuItem key={row.key} value={row.key}>{row.label}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Timeframe</InputLabel>
            <Select label="Timeframe" value={timeframe} onChange={(e) => onTimeframeChange(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              {baseTimeframes.map((row) => (
                <MenuItem key={`${row.unit}|${row.interval}`} value={`${row.unit}|${row.interval}`}>
                  {row.interval} {row.unit}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 170 }}>
            <InputLabel>Sort</InputLabel>
            <Select label="Sort" value={sort} onChange={(e) => onSortChange(e.target.value as IntraStrategySort)}>
              <MenuItem value="RECENT_EDITED">Recently edited</MenuItem>
              <MenuItem value="NAME">Name</MenuItem>
              <MenuItem value="PERFORMANCE">Performance</MenuItem>
            </Select>
          </FormControl>
        </Stack>

        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Instrument</TableCell>
                <TableCell>Timeframe</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Stage</TableCell>
                <TableCell>Can Run</TableCell>
                <TableCell align="right">Last P&amp;L</TableCell>
                <TableCell>Version</TableCell>
                <TableCell>Last modified</TableCell>
                <TableCell align="right">Quick actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{row.strategyName}</TableCell>
                  <TableCell>{formatInstrumentLabel(row.instrumentKey, baseInstruments)}</TableCell>
                  <TableCell>{row.timeframeInterval} {row.timeframeUnit}</TableCell>
                  <TableCell>{row.strategyType}</TableCell>
                  <TableCell>
                    {(() => { const s = friendlyStrategyStatus(row.status); return <Chip label={s.label} size="small" color={s.color} />; })()}
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      {row.paperEligible && <Chip label="Paper" size="small" color="info" variant="outlined" sx={{ fontSize: '0.68rem', height: 20 }} />}
                      {row.liveEligible && <Chip label="Live" size="small" color="success" variant="outlined" sx={{ fontSize: '0.68rem', height: 20 }} />}
                      {!row.paperEligible && !row.liveEligible && <Typography variant="caption" color="text.secondary">—</Typography>}
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    {row.latestPerformancePnl != null ? (
                      <Typography variant="caption" fontWeight={700} sx={{ color: row.latestPerformancePnl > 0 ? '#15803d' : row.latestPerformancePnl < 0 ? '#b91c1c' : 'text.secondary' }}>
                        {formatPnlRupees(row.latestPerformancePnl)}
                      </Typography>
                    ) : <Typography variant="caption" color="text.secondary">No runs</Typography>}
                  </TableCell>
                  <TableCell>v{row.version}</TableCell>
                  <TableCell>{row.lastModifiedAt ? new Date(row.lastModifiedAt).toLocaleString('en-IN') : '—'}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit">
                      <IconButton size="small" color="primary" onClick={() => onEdit(row)}>
                        <EditRoundedIcon sx={{ fontSize: 17 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Duplicate">
                      <IconButton size="small" onClick={() => onDuplicate(row)}>
                        <ContentCopyRoundedIcon sx={{ fontSize: 17 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Archive">
                      <IconButton size="small" color="warning" onClick={() => onArchive(row)}>
                        <ArchiveRoundedIcon sx={{ fontSize: 17 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => onDelete(row)}>
                        <DeleteOutlineRoundedIcon sx={{ fontSize: 17 }} />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    No strategies yet — click "Save Draft" above to create your first strategy.
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
          onPageChange={(_, p) => onPageChange(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            onRowsPerPageChange(Number(e.target.value));
            onPageChange(0);
          }}
          rowsPerPageOptions={[5, 10, 25, 50]}
          showFirstButton
          showLastButton
        />
      </Stack>
    </CardContent>
  </Card>
);
