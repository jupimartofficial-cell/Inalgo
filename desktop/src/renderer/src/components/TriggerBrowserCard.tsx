import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import FilterAltRoundedIcon from '@mui/icons-material/FilterAltRounded';
import type { TriggerBrowserResponse, TriggerTimeframeFacetOption } from '../api/admin';
import {
  ALL_FILTER_VALUE,
  findTimeframeLabel,
  getDefaultFilterState,
  getInstrumentLabel,
  getTabLabel,
  type InstrumentOption,
  type TimeframeOption,
  type TriggerTab,
} from './ManageTriggersShared';
import { TriggerTable } from './TriggerTable';
import type { TriggerTableProps } from './TriggerTable';

export interface TriggerBrowserCardProps {
  browserData: TriggerBrowserResponse;
  activeTab: TriggerTab;
  filtersExpanded: boolean;
  filterInstrumentKey: string;
  filterTimeframeKey: string;
  filterJobNatureKey: string;
  visibleFilterInstrumentKey: string;
  visibleFilterTimeframeKey: string;
  visibleFilterJobNatureKey: string;
  activeFilterChips: string[];
  triggersPage: number;
  triggersRowsPerPage: number;
  baseInstruments: InstrumentOption[];
  baseTimeframes: TimeframeOption[];
  tableProps: Omit<TriggerTableProps, 'items' | 'totalElements' | 'triggersPage' | 'triggersRowsPerPage' | 'activeFilterChips' | 'activeTabOption' | 'activeTab' | 'summary' | 'baseInstruments' | 'baseTimeframes'>;
  onTabChange: (tab: TriggerTab) => void;
  onFiltersExpandedChange: (expanded: boolean) => void;
  onFilterInstrumentChange: (value: string) => void;
  onFilterTimeframeChange: (value: string) => void;
  onFilterJobNatureChange: (value: string) => void;
  onClearFilters: () => void;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rowsPerPage: number) => void;
}

export const TriggerBrowserCard = ({
  browserData,
  activeTab,
  filtersExpanded,
  visibleFilterInstrumentKey,
  visibleFilterTimeframeKey,
  visibleFilterJobNatureKey,
  activeFilterChips,
  triggersPage,
  triggersRowsPerPage,
  baseInstruments,
  baseTimeframes,
  tableProps,
  onTabChange,
  onFiltersExpandedChange,
  onFilterInstrumentChange,
  onFilterTimeframeChange,
  onFilterJobNatureChange,
  onClearFilters,
  onPageChange,
  onRowsPerPageChange,
}: TriggerBrowserCardProps) => {
  const muiTheme = useTheme();
  const isCompact = useMediaQuery(muiTheme.breakpoints.down('md'));

  const tabOptions: Array<{ value: TriggerTab; label: string; count: number }> = browserData.tabs.length > 0
    ? browserData.tabs
      .filter((tab): tab is { value: TriggerTab; label: string; count: number } =>
        tab.value === 'CANDLE_SYNC' || tab.value === 'OTHERS')
    : [
      { value: 'CANDLE_SYNC', label: 'Candle Sync', count: 0 },
      { value: 'OTHERS', label: 'Others', count: 0 },
    ];
  const activeTabOption = tabOptions.find((tab) => tab.value === activeTab);
  const activeInstrument = browserData.instruments.find((option) => option.value === visibleFilterInstrumentKey);
  const activeTimeframe = browserData.timeframes.find((option) => option.value === visibleFilterTimeframeKey);
  const activeJobNature = browserData.jobNatures.find((option) => option.value === visibleFilterJobNatureKey);

  return (
    <Card>
      <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
        <Box sx={{ px: { xs: 2, md: 3 }, pt: { xs: 2, md: 2.5 }, pb: 1.5 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1}>
            <Box>
              <Typography variant="h6" fontWeight={700}>Configured Triggers</Typography>
              <Typography variant="body2" color="text.secondary">
                Split sync jobs from the rest, then narrow the view with collapsible filters built for larger job catalogs.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
              <Chip label={`Running ${browserData.summary.runningCount}`} color="info" size="small" />
              <Chip label={`Attention ${browserData.summary.attentionCount}`} color={browserData.summary.attentionCount > 0 ? 'error' : 'default'} size="small" />
              <Chip label={`One-time ${browserData.summary.oneTimeCount}`} variant="outlined" size="small" />
            </Stack>
          </Stack>
        </Box>

        <Tabs
          value={activeTab}
          onChange={(_, nextTab: TriggerTab) => {
            const defaults = getDefaultFilterState(nextTab);
            onTabChange(nextTab);
            onFilterInstrumentChange(defaults.instrumentKey);
            onFilterTimeframeChange(defaults.timeframeKey);
            onFilterJobNatureChange(defaults.jobNatureKey);
            onPageChange(0);
          }}
          variant={isCompact ? 'fullWidth' : 'standard'}
          sx={{ px: { xs: 1, md: 2 }, borderTop: '1px solid', borderBottom: '1px solid', borderColor: 'divider' }}
        >
          {tabOptions.map((tab) => (
            <Tab
              key={tab.value}
              value={tab.value}
              label={`${tab.label} (${tab.count})`}
            />
          ))}
        </Tabs>

        <Accordion
          expanded={filtersExpanded}
          onChange={(_, expanded) => onFiltersExpandedChange(expanded)}
          disableGutters
          elevation={0}
          square
        >
          <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={1.25} sx={{ width: '100%' }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <FilterAltRoundedIcon color="action" />
                <Box>
                  <Typography variant="subtitle1" fontWeight={700}>Advanced Filters</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Instrument, timeframe, and job-nature slices for {getTabLabel(activeTabOption, activeTab)}
                  </Typography>
                </Box>
              </Stack>
              <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                <Chip label={`${browserData.summary.filteredTotal} matching`} size="small" color="primary" variant="outlined" />
                {activeFilterChips.length === 0 ? (
                  <Chip label="No active filters" size="small" variant="outlined" />
                ) : activeFilterChips.map((label) => (
                  <Chip key={label} label={label} size="small" variant="outlined" />
                ))}
              </Stack>
            </Stack>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" sx={{ mb: 0.75 }}>Instrument</Typography>
                <FormControl fullWidth size="small">
                  <InputLabel>Instrument</InputLabel>
                  <Select
                    value={visibleFilterInstrumentKey}
                    label="Instrument"
                    onChange={(event) => {
                      onFilterInstrumentChange(event.target.value);
                      onPageChange(0);
                    }}
                  >
                    <MenuItem value={ALL_FILTER_VALUE}>All instruments</MenuItem>
                    {browserData.instruments.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {getInstrumentLabel(baseInstruments, option.value)} ({option.count})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" sx={{ mb: 0.75 }}>Timeframe</Typography>
                <FormControl fullWidth size="small">
                  <InputLabel>Timeframe</InputLabel>
                  <Select
                    value={visibleFilterTimeframeKey}
                    label="Timeframe"
                    onChange={(event) => {
                      onFilterTimeframeChange(event.target.value);
                      onPageChange(0);
                    }}
                  >
                    <MenuItem value={ALL_FILTER_VALUE}>All timeframes</MenuItem>
                    {browserData.timeframes.map((option: TriggerTimeframeFacetOption) => (
                      <MenuItem key={option.value} value={option.value}>
                        {findTimeframeLabel(baseTimeframes, option.timeframeUnit, option.timeframeInterval, option.label)} ({option.count})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" sx={{ mb: 0.75 }}>Job nature</Typography>
                <FormControl fullWidth size="small">
                  <InputLabel>Job nature</InputLabel>
                  <Select
                    value={visibleFilterJobNatureKey}
                    label="Job nature"
                    onChange={(event) => {
                      onFilterJobNatureChange(event.target.value);
                      onPageChange(0);
                    }}
                  >
                    <MenuItem value={ALL_FILTER_VALUE}>All job natures</MenuItem>
                    {browserData.jobNatures.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label} ({option.count})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Stack
              direction={{ xs: 'column', md: 'row' }}
              justifyContent="space-between"
              alignItems={{ md: 'center' }}
              spacing={1.5}
              sx={{ mt: 2 }}
            >
              <Typography variant="body2" color="text.secondary">
                Use the tab split to separate heavy candle-sync operations from analytics jobs, then page up to 100 rows at a time without losing the current operator context.
              </Typography>
              <Button
                variant="text"
                color="inherit"
                onClick={onClearFilters}
                disabled={activeFilterChips.length === 0}
              >
                Clear filters
              </Button>
            </Stack>
          </AccordionDetails>
        </Accordion>

        <TriggerTable
          {...tableProps}
          items={browserData.items}
          totalElements={browserData.totalElements}
          triggersPage={triggersPage}
          triggersRowsPerPage={triggersRowsPerPage}
          activeFilterChips={activeFilterChips}
          activeTabOption={activeTabOption}
          activeTab={activeTab}
          summary={browserData.summary}
          baseInstruments={baseInstruments}
          baseTimeframes={baseTimeframes}
          onPageChange={onPageChange}
          onRowsPerPageChange={onRowsPerPageChange}
        />
      </CardContent>
    </Card>
  );
};
