import { Button, Card, CardContent, Chip, Collapse, FormControl, Grid, InputLabel, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import { PnlSectionHeader } from './PnlSectionHeader';
import type { PnlFilterState } from './pnlTypes';

export const IntraPnlFiltersCard = ({
  open,
  filters,
  loading,
  onToggle,
  onFilterChange,
  onApply,
  onExport,
}: {
  open: boolean;
  filters: PnlFilterState;
  loading: boolean;
  onToggle: () => void;
  onFilterChange: (patch: Partial<PnlFilterState>) => void;
  onApply: () => void;
  onExport: (format: 'CSV' | 'XLSX' | 'PDF') => void;
}) => {
  const activeFilters = [
    filters.mode !== 'ALL' ? `Mode: ${filters.mode}` : null,
    filters.status !== 'ALL' ? `Status: ${filters.status}` : null,
    filters.preset === 'DAY' ? 'Range: Today' : null,
    filters.preset === 'WEEK' ? 'Range: Week' : null,
    filters.preset === 'MONTH' ? 'Range: Month' : null,
    filters.preset === 'CUSTOM' ? 'Range: Custom' : null,
    filters.strategyFilter ? `Strategy: ${filters.strategyFilter}` : null,
    filters.instrumentFilter ? `Instrument: ${filters.instrumentFilter}` : null,
    filters.accountFilter ? `Account: ${filters.accountFilter}` : null,
  ].filter(Boolean) as string[];

  const quickPresets: Array<{ label: string; value: PnlFilterState['preset'] }> = [
    { label: 'Today', value: 'DAY' },
    { label: 'Week', value: 'WEEK' },
    { label: 'Month', value: 'MONTH' },
    { label: 'Custom', value: 'CUSTOM' },
  ];

  return (
    <Card data-testid="intra-pnl-filters-card">
      <CardContent>
        <PnlSectionHeader
          title="Filters"
          open={open}
          onToggle={onToggle}
          testId="intra-pnl-filters-header"
          action={
            <Stack direction="row" spacing={0.75}>
              <Button size="small" variant="contained" onClick={onApply} disabled={loading} data-testid="intra-pnl-apply-filters">Apply</Button>
              <Button size="small" variant="outlined" startIcon={<DownloadRoundedIcon />} onClick={() => onExport('CSV')} data-testid="intra-pnl-export-csv">CSV</Button>
              <Button size="small" variant="outlined" startIcon={<DownloadRoundedIcon />} onClick={() => onExport('XLSX')} data-testid="intra-pnl-export-xlsx">XLSX</Button>
              <Button size="small" variant="outlined" startIcon={<DownloadRoundedIcon />} onClick={() => onExport('PDF')} data-testid="intra-pnl-export-pdf">PDF</Button>
            </Stack>
          }
        />
        <Collapse in={open}>
          <Stack spacing={1.25} sx={{ mt: 0.75 }}>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap data-testid="intra-pnl-quick-presets">
              {quickPresets.map((preset) => (
                <Button
                  key={preset.value}
                  size="small"
                  variant={filters.preset === preset.value ? 'contained' : 'outlined'}
                  onClick={() => onFilterChange({ preset: preset.value })}
                >
                  {preset.label}
                </Button>
              ))}
            </Stack>
            <Stack spacing={0.5}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                Active filters
              </Typography>
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap data-testid="intra-pnl-filters-active-chips">
                {activeFilters.map((chip) => (
                  <Chip key={chip} size="small" label={chip} variant="outlined" />
                ))}
              </Stack>
            </Stack>

            <Grid container spacing={1.5}>
              <Grid item xs={12} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Mode</InputLabel>
                  <Select label="Mode" value={filters.mode} onChange={(e) => onFilterChange({ mode: e.target.value as PnlFilterState['mode'] })} data-testid="intra-pnl-filter-mode">
                    <MenuItem value="ALL">All</MenuItem>
                    <MenuItem value="PAPER">Paper</MenuItem>
                    <MenuItem value="LIVE">Live</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select label="Status" value={filters.status} onChange={(e) => onFilterChange({ status: e.target.value as PnlFilterState['status'] })} data-testid="intra-pnl-filter-status">
                    <MenuItem value="ALL">All</MenuItem>
                    <MenuItem value="OPEN">Open</MenuItem>
                    <MenuItem value="CLOSED">Closed</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Range</InputLabel>
                  <Select label="Range" value={filters.preset} onChange={(e) => onFilterChange({ preset: e.target.value as PnlFilterState['preset'] })} data-testid="intra-pnl-filter-range">
                    <MenuItem value="DAY">Today</MenuItem>
                    <MenuItem value="WEEK">This Week</MenuItem>
                    <MenuItem value="MONTH">This Month</MenuItem>
                    <MenuItem value="CUSTOM">Custom Range</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              {filters.preset === 'CUSTOM' && (
                <>
                  <Grid item xs={12} md={2}>
                    <TextField type="date" size="small" label="From" value={filters.customFromDate} onChange={(e) => onFilterChange({ customFromDate: e.target.value })} fullWidth InputLabelProps={{ shrink: true }} />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <TextField type="date" size="small" label="To" value={filters.customToDate} onChange={(e) => onFilterChange({ customToDate: e.target.value })} fullWidth InputLabelProps={{ shrink: true }} />
                  </Grid>
                </>
              )}
              <Grid item xs={12} md={2}>
                <TextField size="small" label="Strategy" value={filters.strategyFilter} onChange={(e) => onFilterChange({ strategyFilter: e.target.value })} fullWidth />
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField size="small" label="Instrument" value={filters.instrumentFilter} onChange={(e) => onFilterChange({ instrumentFilter: e.target.value })} fullWidth />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField size="small" label="Account" value={filters.accountFilter} onChange={(e) => onFilterChange({ accountFilter: e.target.value })} fullWidth />
              </Grid>
            </Grid>
          </Stack>
        </Collapse>
      </CardContent>
    </Card>
  );
};
