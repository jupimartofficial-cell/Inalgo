import {
  Button,
  Card,
  CardContent,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import RuleRoundedIcon from '@mui/icons-material/RuleRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import UploadRoundedIcon from '@mui/icons-material/UploadRounded';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  archiveIntraStrategy,
  createIntraStrategyDraft,
  deleteIntraStrategy,
  duplicateIntraStrategy,
  fetchBacktestStrategies,
  fetchIntraStrategyLibrary,
  fetchIntraStrategyVersions,
  importIntraStrategiesFromBacktest,
  publishIntraStrategy,
  updateIntraStrategyDraft,
  validateIntraStrategy,
  type BacktestLegPayload,
  type BacktestStrategyPayload,
  type BacktestStrategyResponse,
  type IntraStrategyLibraryItem,
  type IntraStrategySort,
  type IntraStrategyStatus,
  type IntraStrategyValidationResult,
} from '../../api/admin';
import { createDefaultLeg } from '../BacktestPanelShared';
import { IntraAiGenerateDialog } from './IntraAiGenerateDialog';
import { IntraStrategyBuilder } from './IntraStrategyBuilder';
import { IntraStrategyLibrary } from './IntraStrategyLibrary';
import { toTimeframeKey } from './IntraTradeShared';
import { useIntraWorkspace } from './IntraWorkspaceContext';

export const IntraStrategiesPage = ({
  token,
  tenantId,
  username,
  onNotify,
}: {
  token: string;
  tenantId: string;
  username: string;
  onNotify: (payload: { msg: string; severity: 'success' | 'error' | 'info' }) => void;
}) => {
  const navigate = useNavigate();
  const {
    baseInstruments,
    baseTimeframes,
    strategy,
    setStrategy,
    strategyId,
    setStrategyId,
    setSelectedExecution,
    setEditingExecutionId,
    setScanInstrumentKey,
    setScanTimeframeKey,
  } = useIntraWorkspace();

  const [items, setItems] = useState<IntraStrategyLibraryItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [validation, setValidation] = useState<IntraStrategyValidationResult | null>(null);
  const [activeStep, setActiveStep] = useState(0);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | IntraStrategyStatus>('');
  const [instrument, setInstrument] = useState('');
  const [timeframe, setTimeframe] = useState('');
  const [sort, setSort] = useState<IntraStrategySort>('RECENT_EDITED');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalElements, setTotalElements] = useState(0);

  const [timeframeUnit, setTimeframeUnit] = useState('minutes');
  const [timeframeInterval, setTimeframeInterval] = useState(5);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [marketSession, setMarketSession] = useState('REGULAR_MARKET');

  const [importOpen, setImportOpen] = useState(false);
  const [importCandidates, setImportCandidates] = useState<BacktestStrategyResponse[]>([]);
  const [selectedImportIds, setSelectedImportIds] = useState<number[]>([]);
  const [importing, setImporting] = useState(false);
  const [aiGenerateOpen, setAiGenerateOpen] = useState(false);

  const reloadLibrary = useCallback(async () => {
    setLoadingList(true);
    try {
      const response = await fetchIntraStrategyLibrary(tenantId, token, {
        username,
        q: search || undefined,
        status: status || undefined,
        instrument: instrument || undefined,
        timeframe: timeframe || undefined,
        sort,
        page,
        size: rowsPerPage,
      });
      setItems(response.content);
      setTotalElements(response.totalElements);
    } catch (error) {
      onNotify({ msg: (error as Error).message || 'Unable to load strategy library', severity: 'error' });
    } finally {
      setLoadingList(false);
    }
  }, [instrument, onNotify, page, rowsPerPage, search, sort, status, tenantId, timeframe, token, username]);

  useEffect(() => {
    void reloadLibrary();
  }, [reloadLibrary]);

  const updateStrategyField = <K extends keyof BacktestStrategyPayload>(key: K, value: BacktestStrategyPayload[K]) =>
    setStrategy((current) => ({ ...current, [key]: value }));

  const addLeg = () => setStrategy((current) => ({
    ...current,
    legs: [...current.legs, createDefaultLeg(current.legs.length + 1)],
  }));

  const updateLeg = (legIndex: number, patch: Partial<BacktestLegPayload>) =>
    setStrategy((current) => ({
      ...current,
      legs: current.legs.map((leg, index) => (index === legIndex ? { ...leg, ...patch } : leg)),
    }));

  const deleteLeg = (legIndex: number) =>
    setStrategy((current) => ({ ...current, legs: current.legs.filter((_, index) => index !== legIndex) }));

  const builderPayload = useMemo(() => ({
    strategy,
    timeframeUnit,
    timeframeInterval,
    advancedMode,
    marketSession,
  }), [advancedMode, marketSession, strategy, timeframeInterval, timeframeUnit]);

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const response = strategyId == null
        ? await createIntraStrategyDraft(tenantId, token, { username, builder: builderPayload })
        : await updateIntraStrategyDraft(tenantId, token, strategyId, { username, builder: builderPayload });
      setStrategyId(response.strategy.id);
      setStrategy(response.latestVersion.strategy);
      setScanInstrumentKey(response.latestVersion.strategy.underlyingKey);
      setValidation(response.latestVersion.validation);
      onNotify({ msg: strategyId == null ? 'Draft saved' : 'Draft updated', severity: 'success' });
      await reloadLibrary();
    } catch (error) {
      onNotify({ msg: (error as Error).message || 'Unable to save draft', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleValidate = async () => {
    if (strategyId == null) {
      await handleSaveDraft();
      return;
    }
    setValidating(true);
    try {
      const result = await validateIntraStrategy(tenantId, token, strategyId, { username });
      setValidation(result);
      onNotify({ msg: result.valid ? 'Validation passed' : 'Validation found issues', severity: result.valid ? 'success' : 'info' });
      await reloadLibrary();
    } catch (error) {
      onNotify({ msg: (error as Error).message || 'Unable to validate strategy', severity: 'error' });
    } finally {
      setValidating(false);
    }
  };

  const handlePublish = async (targetStatus: 'PAPER_READY' | 'LIVE_READY') => {
    if (strategyId == null) {
      onNotify({ msg: 'Save draft first', severity: 'error' });
      return;
    }
    setPublishing(true);
    try {
      const response = await publishIntraStrategy(tenantId, token, strategyId, { username, targetStatus });
      setValidation(response.latestVersion.validation);
      onNotify({ msg: `Published as ${targetStatus}`, severity: 'success' });
      await reloadLibrary();
    } catch (error) {
      onNotify({ msg: (error as Error).message || 'Unable to publish strategy', severity: 'error' });
    } finally {
      setPublishing(false);
    }
  };

  const loadItem = async (item: IntraStrategyLibraryItem) => {
    try {
      const versions = await fetchIntraStrategyVersions(tenantId, token, item.id, username);
      const latest = versions[0];
      if (!latest) return;
      setStrategyId(item.id);
      setStrategy(latest.strategy);
      setValidation(latest.validation);
      setTimeframeUnit(latest.timeframeUnit);
      setTimeframeInterval(latest.timeframeInterval);
      setAdvancedMode(latest.advancedMode);
      setScanInstrumentKey(latest.strategy.underlyingKey);
      setSelectedExecution(null);
      setEditingExecutionId(null);
      onNotify({ msg: `Loaded ${item.strategyName}`, severity: 'info' });
    } catch (error) {
      onNotify({ msg: (error as Error).message || 'Unable to load strategy version', severity: 'error' });
    }
  };

  const handleDuplicate = async (item: IntraStrategyLibraryItem) => {
    try {
      const response = await duplicateIntraStrategy(tenantId, token, item.id, { username });
      setStrategyId(response.strategy.id);
      setStrategy(response.latestVersion.strategy);
      setValidation(response.latestVersion.validation);
      setTimeframeUnit(response.latestVersion.timeframeUnit);
      setTimeframeInterval(response.latestVersion.timeframeInterval);
      setAdvancedMode(response.latestVersion.advancedMode);
      setScanInstrumentKey(response.latestVersion.strategy.underlyingKey);
      setScanTimeframeKey(toTimeframeKey(response.latestVersion.timeframeUnit, response.latestVersion.timeframeInterval));
      setSelectedExecution(null);
      setEditingExecutionId(null);
      await reloadLibrary();
      onNotify({ msg: 'Strategy duplicated', severity: 'success' });
    } catch (error) {
      onNotify({ msg: (error as Error).message || 'Unable to duplicate strategy', severity: 'error' });
    }
  };

  const handleArchive = async (item: IntraStrategyLibraryItem) => {
    try {
      await archiveIntraStrategy(tenantId, token, item.id, { username });
      await reloadLibrary();
      onNotify({ msg: 'Strategy archived', severity: 'info' });
    } catch (error) {
      onNotify({ msg: (error as Error).message || 'Unable to archive strategy', severity: 'error' });
    }
  };

  const handleDelete = async (item: IntraStrategyLibraryItem) => {
    try {
      await deleteIntraStrategy(tenantId, token, item.id, username);
      if (strategyId === item.id) {
        setStrategyId(null);
      }
      await reloadLibrary();
      onNotify({ msg: 'Strategy deleted', severity: 'info' });
    } catch (error) {
      onNotify({ msg: (error as Error).message || 'Unable to delete strategy', severity: 'error' });
    }
  };

  const openImport = async () => {
    setImportOpen(true);
    try {
      const backtest = await fetchBacktestStrategies(tenantId, token, username, 0, 200);
      setImportCandidates(backtest.content);
    } catch (error) {
      onNotify({ msg: (error as Error).message || 'Unable to load backtest strategies', severity: 'error' });
    }
  };

  const runImport = async () => {
    setImporting(true);
    try {
      const response = await importIntraStrategiesFromBacktest(tenantId, token, {
        username,
        strategyIds: selectedImportIds.length ? selectedImportIds : undefined,
      });
      const imported = response.results.filter((item) => item.status === 'imported').length;
      onNotify({ msg: `Import completed. Imported ${imported} strategy(ies).`, severity: 'success' });
      setImportOpen(false);
      setSelectedImportIds([]);
      await reloadLibrary();
    } catch (error) {
      onNotify({ msg: (error as Error).message || 'Unable to import from backtest', severity: 'error' });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Stack spacing={2.5}>
      <Card>
        <CardContent sx={{ pb: '12px !important' }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={1.5}>
              <Stack spacing={0.25}>
                <Typography variant="h5" fontWeight={800}>Intra Strategies</Typography>
                <Typography variant="body2" color="text.secondary">
                  Strategy library and step builder for draft, validation, publish, and reuse.
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Button variant="outlined" size="small" startIcon={<UploadRoundedIcon />} onClick={openImport}>
                  Import from Backtest
                </Button>
                <Button variant="contained" size="small" startIcon={<SaveRoundedIcon />} onClick={handleSaveDraft} disabled={saving}>
                  {saving ? 'Saving…' : 'Save Draft'}
                </Button>
                <Button variant="outlined" size="small" startIcon={<RuleRoundedIcon />} onClick={handleValidate} disabled={validating}>
                  {validating ? 'Validating…' : 'Save & Validate'}
                </Button>
                <Button variant="outlined" size="small" onClick={() => void handlePublish('PAPER_READY')} disabled={publishing || strategyId == null}>
                  Publish Paper
                </Button>
                <Button variant="outlined" size="small" color="success" onClick={() => void handlePublish('LIVE_READY')} disabled={publishing || strategyId == null}>
                  Publish Live
                </Button>
                <Button variant="outlined" size="small" color="secondary" startIcon={<AutoAwesomeRoundedIcon />} onClick={() => setAiGenerateOpen(true)}>
                  Generate with AI
                </Button>
                <Button variant="contained" color="success" size="small" endIcon={<ArrowForwardRoundedIcon />} onClick={() => navigate('/intra/monitor')}>
                  Open Intra Monitor
                </Button>
              </Stack>
            </Stack>
            {(saving || validating || publishing) && <LinearProgress sx={{ borderRadius: 1 }} />}
          </Stack>
        </CardContent>
      </Card>

      <IntraStrategyLibrary
        items={items}
        totalElements={totalElements}
        page={page}
        rowsPerPage={rowsPerPage}
        loading={loadingList}
        search={search}
        status={status}
        instrument={instrument}
        timeframe={timeframe}
        sort={sort}
        baseInstruments={baseInstruments}
        baseTimeframes={baseTimeframes}
        onSearchChange={(value) => { setSearch(value); setPage(0); }}
        onStatusChange={(value) => { setStatus(value); setPage(0); }}
        onSortChange={(value) => { setSort(value); setPage(0); }}
        onInstrumentChange={(value) => { setInstrument(value); setPage(0); }}
        onTimeframeChange={(value) => { setTimeframe(value); setPage(0); }}
        onPageChange={setPage}
        onRowsPerPageChange={setRowsPerPage}
        onEdit={(item) => void loadItem(item)}
        onDuplicate={(item) => void handleDuplicate(item)}
        onArchive={(item) => void handleArchive(item)}
        onDelete={(item) => void handleDelete(item)}
      />

      <IntraStrategyBuilder
        strategy={strategy}
        timeframeUnit={timeframeUnit}
        timeframeInterval={timeframeInterval}
        advancedMode={advancedMode}
        marketSession={marketSession}
        baseInstruments={baseInstruments}
        baseTimeframes={baseTimeframes}
        validation={validation}
        activeStep={activeStep}
        setActiveStep={setActiveStep}
        setAdvancedMode={setAdvancedMode}
        setMarketSession={setMarketSession}
        setTimeframeUnit={setTimeframeUnit}
        setTimeframeInterval={setTimeframeInterval}
        onSetStrategy={setStrategy}
        onUpdateField={updateStrategyField}
        onAddLeg={addLeg}
        onUpdateLeg={updateLeg}
        onDeleteLeg={deleteLeg}
      />

      <IntraAiGenerateDialog
        open={aiGenerateOpen}
        token={token}
        tenantId={tenantId}
        username={username}
        baseInstruments={baseInstruments.map((opt) => ({ key: opt.key, label: opt.label }))}
        baseTimeframes={baseTimeframes.map((opt) => ({
          key: toTimeframeKey(opt.unit, opt.interval),
          label: opt.label,
          unit: opt.unit,
          interval: opt.interval,
        }))}
        onClose={() => setAiGenerateOpen(false)}
        onLoadStrategy={(aiStrategy, tfUnit, tfInterval) => {
          setStrategy(aiStrategy);
          setTimeframeUnit(tfUnit);
          setTimeframeInterval(tfInterval);
          setStrategyId(null);
          setValidation(null);
          setAdvancedMode(Boolean(aiStrategy.advancedConditions?.enabled));
          onNotify({ msg: 'AI strategy loaded into builder — review and save as draft', severity: 'success' });
          setAiGenerateOpen(false);
        }}
      />

      <Dialog open={importOpen} onClose={() => setImportOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Import from Backtest Strategies</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Select existing backtest strategies to copy into Intra Strategy Library.
          </Typography>
          <List dense>
            {importCandidates.map((item) => (
              <ListItem
                key={item.id}
                secondaryAction={(
                  <Checkbox
                    edge="end"
                    checked={selectedImportIds.includes(item.id)}
                    onChange={(e) => {
                      setSelectedImportIds((current) => e.target.checked
                        ? [...current, item.id]
                        : current.filter((id) => id !== item.id));
                    }}
                  />
                )}
              >
                <ListItemText
                  primary={item.strategyName}
                  secondary={`${item.strategyType} · ${item.underlyingKey}`}
                />
              </ListItem>
            ))}
          </List>
          <FormControlLabel
            control={(
              <Checkbox
                checked={selectedImportIds.length === 0}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedImportIds([]);
                  }
                }}
              />
            )}
            label="Import all (leave selection empty)"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void runImport()} disabled={importing}>
            {importing ? 'Importing…' : 'Import'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};
