import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import ScienceRoundedIcon from '@mui/icons-material/ScienceRounded';
import TerminalRoundedIcon from '@mui/icons-material/TerminalRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Tooltip,
  Typography,
} from '@mui/material';
import type { editor as MonacoEditorApi } from 'monaco-editor';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  archiveTradingScript,
  backtestTradingScript,
  compileTradingScript,
  createTradingScriptDraft,
  deleteTradingScript,
  duplicateTradingScript,
  fetchTradingScriptLibrary,
  fetchTradingScriptVersion,
  fetchTradingScriptVersions,
  publishTradingScript,
  updateTradingScriptDraft,
  validateTradingScript,
  type TradingScriptBacktestSummary,
  type TradingScriptCompileResponse,
  type TradingScriptLibraryItem,
  type TradingScriptSort,
  type TradingScriptStatus,
  type TradingScriptVersion,
} from '../../api/admin';
import { insertSnippetAtCursor } from './tradingScriptMonaco';
import { TradingScriptsEditorPanel } from './TradingScriptsEditorPanel';
import { TradingScriptsLibraryPanel } from './TradingScriptsLibraryPanel';
import { TradingScriptsLifecyclePanel } from './TradingScriptsLifecyclePanel';
import { DEFAULT_TRADING_SCRIPT } from './tradingScriptTemplate';

type NotificationTone = 'success' | 'error' | 'info';

/** Compute which workflow step (0-3) we are at based on state */
const deriveWorkflowStep = (
  status: TradingScriptStatus | 'DRAFT' | null,
  compileValid: boolean,
  hasBacktest: boolean,
): number => {
  if (status === 'LIVE_READY') return 3;
  if (status === 'PAPER_READY') return 3;
  if (hasBacktest) return 2;
  if (compileValid) return 1;
  return 0;
};

const WORKFLOW_STEPS = ['Save Draft', 'Compile', 'Backtest', 'Publish'];

export const TradingScriptsPage = ({
  token,
  tenantId,
  username,
  baseInstruments,
  onNotify,
}: {
  token: string;
  tenantId: string;
  username: string;
  baseInstruments: Array<{ key: string; label: string; exchange: string }>;
  onNotify: (payload: { msg: string; severity: NotificationTone }) => void;
}) => {
  const editorRef = useRef<MonacoEditorApi.IStandaloneCodeEditor | null>(null);

  const [items, setItems] = useState<TradingScriptLibraryItem[]>([]);
  const [selectedScript, setSelectedScript] = useState<TradingScriptLibraryItem | null>(null);
  const [versions, setVersions] = useState<TradingScriptVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [sourceJs, setSourceJs] = useState(DEFAULT_TRADING_SCRIPT);
  const [compile, setCompile] = useState<TradingScriptCompileResponse | null>(null);
  const [backtest, setBacktest] = useState<TradingScriptBacktestSummary | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  const [loadingList, setLoadingList] = useState(false);
  const [loadingVersion, setLoadingVersion] = useState(false);
  const [saving, setSaving] = useState(false);
  const [runningCompile, setRunningCompile] = useState(false);
  const [runningBacktest, setRunningBacktest] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<TradingScriptStatus | ''>('');
  const [instrument, setInstrument] = useState('');
  const [timeframe, setTimeframe] = useState('');
  const [compileStatus, setCompileStatus] = useState('');
  const [sort, setSort] = useState<TradingScriptSort>('RECENT_EDITED');
  const [page] = useState(0);
  const [rowsPerPage] = useState(10);

  const currentScriptId = selectedScript?.id ?? null;
  const workflowStep = deriveWorkflowStep(
    selectedScript?.status ?? 'DRAFT',
    compile?.valid === true,
    backtest != null,
  );

  const reloadLibrary = useCallback(async () => {
    setLoadingList(true);
    try {
      const response = await fetchTradingScriptLibrary(tenantId, token, {
        username,
        q: search || undefined,
        status,
        instrument: instrument || undefined,
        timeframe: timeframe || undefined,
        compileStatus: compileStatus || undefined,
        sort,
        page,
        size: rowsPerPage,
      });
      setItems(response.content);
    } catch (error) {
      onNotify({ msg: (error as Error).message || 'Unable to load trading script library', severity: 'error' });
    } finally {
      setLoadingList(false);
    }
  }, [compileStatus, instrument, onNotify, page, rowsPerPage, search, sort, status, tenantId, timeframe, token, username]);

  useEffect(() => {
    void reloadLibrary();
  }, [reloadLibrary]);

  const applyDetails = useCallback((item: TradingScriptLibraryItem, latest: TradingScriptVersion, summary?: TradingScriptBacktestSummary | null) => {
    setSelectedScript(item);
    setVersions((current) => {
      const filtered = current.filter((candidate) => candidate.scriptId === item.id && candidate.version !== latest.version);
      return [latest, ...filtered].sort((left, right) => right.version - left.version);
    });
    setSelectedVersion(latest.version);
    setSourceJs(latest.sourceJs);
    setCompile(latest.compile);
    setBacktest(summary ?? null);
  }, []);

  const handleCreateNew = useCallback(() => {
    setSelectedScript(null);
    setVersions([]);
    setSelectedVersion(null);
    setSourceJs(DEFAULT_TRADING_SCRIPT);
    setCompile(null);
    setBacktest(null);
    setActiveTab(0);
  }, []);

  const loadScript = useCallback(async (item: TradingScriptLibraryItem) => {
    setLoadingVersion(true);
    try {
      const nextVersions = await fetchTradingScriptVersions(tenantId, token, item.id, username);
      const latest = nextVersions[0];
      if (!latest) {
        throw new Error('No versions were found for this script');
      }
      applyDetails(item, latest, {
        totalPnl: item.latestPerformancePnl,
        executedTrades: item.latestExecutedTrades,
        realWorldAccuracyPct: item.latestRealWorldAccuracyPct,
        notes: [],
      });
      setVersions(nextVersions);
    } catch (error) {
      onNotify({ msg: (error as Error).message || 'Unable to load trading script', severity: 'error' });
    } finally {
      setLoadingVersion(false);
    }
  }, [applyDetails, onNotify, tenantId, token, username]);

  const loadVersion = useCallback(async (versionNumber: number) => {
    if (!currentScriptId) return;
    setLoadingVersion(true);
    try {
      const version = await fetchTradingScriptVersion(tenantId, token, currentScriptId, versionNumber, username);
      setSelectedVersion(version.version);
      setSourceJs(version.sourceJs);
      setCompile(version.compile);
      setVersions((current) => {
        const filtered = current.filter((candidate) => candidate.version !== version.version);
        return [version, ...filtered].sort((left, right) => right.version - left.version);
      });
    } catch (error) {
      onNotify({ msg: (error as Error).message || 'Unable to load trading script version', severity: 'error' });
    } finally {
      setLoadingVersion(false);
    }
  }, [currentScriptId, onNotify, tenantId, token, username]);

  const saveDraft = useCallback(async () => {
    setSaving(true);
    try {
      const response = currentScriptId == null
        ? await createTradingScriptDraft(tenantId, token, { username, builder: { sourceJs } })
        : await updateTradingScriptDraft(tenantId, token, currentScriptId, { username, builder: { sourceJs } });
      applyDetails(response.script, response.latestVersion, response.latestBacktest);
      await reloadLibrary();
      onNotify({ msg: currentScriptId == null ? 'Draft created' : 'Draft saved', severity: 'success' });
      return response.script.id;
    } catch (error) {
      onNotify({ msg: (error as Error).message || 'Unable to save draft', severity: 'error' });
      return null;
    } finally {
      setSaving(false);
    }
  }, [applyDetails, currentScriptId, onNotify, reloadLibrary, sourceJs, tenantId, token, username]);

  const ensureSavedScriptId = useCallback(async () => currentScriptId ?? saveDraft(), [currentScriptId, saveDraft]);

  const handleCompile = useCallback(async (validateOnly = false) => {
    const scriptId = await ensureSavedScriptId();
    if (!scriptId) return;
    setRunningCompile(true);
    try {
      const result = validateOnly
        ? await validateTradingScript(tenantId, token, scriptId, { username })
        : await compileTradingScript(tenantId, token, scriptId, { username });
      setCompile(result);
      await reloadLibrary();
      onNotify({ msg: result.valid ? (validateOnly ? 'Validation passed' : 'Compiled — no errors') : 'Compile reported issues', severity: result.valid ? 'success' : 'info' });
    } catch (error) {
      onNotify({ msg: (error as Error).message || 'Unable to compile', severity: 'error' });
    } finally {
      setRunningCompile(false);
    }
  }, [ensureSavedScriptId, onNotify, reloadLibrary, tenantId, token, username]);

  const handleBacktest = useCallback(async () => {
    const scriptId = await ensureSavedScriptId();
    if (!scriptId) return;
    setRunningBacktest(true);
    try {
      const response = await backtestTradingScript(tenantId, token, scriptId, { username });
      setBacktest(response.summary);
      await reloadLibrary();
      onNotify({ msg: 'Backtest completed against real data', severity: 'success' });
      setActiveTab(1);
    } catch (error) {
      onNotify({ msg: (error as Error).message || 'Unable to backtest', severity: 'error' });
    } finally {
      setRunningBacktest(false);
    }
  }, [ensureSavedScriptId, onNotify, reloadLibrary, tenantId, token, username]);

  const handlePublish = useCallback(async (targetStatus: 'PAPER_READY' | 'LIVE_READY') => {
    const scriptId = await ensureSavedScriptId();
    if (!scriptId) return;
    setPublishing(true);
    try {
      const response = await publishTradingScript(tenantId, token, scriptId, { username, targetStatus });
      applyDetails(response.script, response.latestVersion, response.latestBacktest);
      await reloadLibrary();
      onNotify({ msg: `Published as ${targetStatus === 'PAPER_READY' ? 'Paper Ready' : 'Live Ready'}`, severity: 'success' });
      setActiveTab(2);
    } catch (error) {
      onNotify({ msg: (error as Error).message || 'Unable to publish', severity: 'error' });
    } finally {
      setPublishing(false);
    }
  }, [applyDetails, ensureSavedScriptId, onNotify, reloadLibrary, tenantId, token, username]);

  const handleInsertSnippet = useCallback((snippet: string) => {
    insertSnippetAtCursor(editorRef.current, snippet);
    if (editorRef.current == null) {
      setSourceJs((current) => `${current}${current.endsWith('\n') ? '' : '\n'}${snippet}`);
      return;
    }
    setSourceJs(editorRef.current.getValue());
  }, []);

  const runRowAction = useCallback(async (
    handler: (item: TradingScriptLibraryItem) => Promise<void>,
    item: TradingScriptLibraryItem,
  ) => {
    try {
      await handler(item);
    } catch (error) {
      onNotify({ msg: (error as Error).message || 'Action failed', severity: 'error' });
    }
  }, [onNotify]);

  const statusColor = selectedScript?.status === 'LIVE_READY'
    ? 'success'
    : selectedScript?.status === 'PAPER_READY'
    ? 'warning'
    : selectedScript?.status === 'COMPILED'
    ? 'info'
    : 'default';

  return (
    <Stack spacing={2} data-testid="trading-scripts-page">

      {/* ── Page header ── */}
      <Card
        sx={{
          background: 'linear-gradient(135deg, #0d1117 0%, #161b22 50%, #0d2137 100%)',
          border: '1px solid #30363d',
          color: '#e6edf3',
        }}
      >
        <CardContent sx={{ py: '14px !important' }}>
          <Stack spacing={1.5}>
            <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" alignItems={{ lg: 'flex-start' }} spacing={2}>
              <Stack spacing={0.5}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography variant="h5" fontWeight={800} sx={{ color: '#e6edf3' }}>Trading Scripts</Typography>
                  <Chip
                    size="small"
                    label="IDE"
                    sx={{ height: 18, fontSize: '0.6rem', bgcolor: '#1f6feb', color: '#fff', fontWeight: 700 }}
                  />
                </Stack>
                <Typography variant="body2" sx={{ color: '#8b949e', maxWidth: 780 }}>
                  Build JS strategies · drag-in market variables · compile with live diagnostics · backtest against real OHLCV data · promote to paper or live
                </Typography>
              </Stack>

              {/* Action buttons */}
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap alignItems="center">
                <Tooltip title="Start a blank new script draft">
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<AddRoundedIcon />}
                    onClick={handleCreateNew}
                    sx={{ borderColor: '#30363d', color: '#e6edf3', '&:hover': { borderColor: '#58a6ff', color: '#58a6ff' } }}
                  >
                    New
                  </Button>
                </Tooltip>
                <Tooltip title="Save draft (Ctrl+S)">
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<SaveRoundedIcon />}
                    onClick={() => void saveDraft()}
                    disabled={saving}
                    sx={{ borderColor: '#30363d', color: saving ? '#8b949e' : '#e6edf3', '&:hover': { borderColor: '#58a6ff', color: '#58a6ff' } }}
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </Button>
                </Tooltip>
                <Tooltip title="Compile script (Ctrl+Enter)">
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<TerminalRoundedIcon />}
                    onClick={() => void handleCompile(false)}
                    disabled={runningCompile}
                    sx={{ borderColor: '#30363d', color: runningCompile ? '#8b949e' : '#e6edf3', '&:hover': { borderColor: '#58a6ff', color: '#58a6ff' } }}
                  >
                    {runningCompile ? 'Compiling…' : 'Compile'}
                  </Button>
                </Tooltip>
                <Tooltip title="Validate only (no version bump)">
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<ScienceRoundedIcon />}
                    onClick={() => void handleCompile(true)}
                    disabled={runningCompile}
                    sx={{ borderColor: '#30363d', color: '#e6edf3', '&:hover': { borderColor: '#58a6ff', color: '#58a6ff' } }}
                  >
                    Validate
                  </Button>
                </Tooltip>
                <Tooltip title="Backtest against real historical data (Ctrl+Shift+B)">
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<PlayArrowRoundedIcon />}
                    onClick={() => void handleBacktest()}
                    disabled={runningBacktest}
                    sx={{ bgcolor: '#238636', '&:hover': { bgcolor: '#2ea043' }, '&:disabled': { bgcolor: '#21262d' } }}
                  >
                    {runningBacktest ? 'Backtesting…' : 'Backtest'}
                  </Button>
                </Tooltip>
              </Stack>
            </Stack>

            {/* Workflow stepper */}
            <Box sx={{ pt: 0.5 }}>
              <Stepper activeStep={workflowStep} alternativeLabel sx={{ '& .MuiStepLabel-label': { color: '#8b949e', fontSize: '0.7rem' }, '& .MuiStepLabel-label.Mui-active': { color: '#58a6ff' }, '& .MuiStepLabel-label.Mui-completed': { color: '#3fb950' }, '& .MuiStepConnector-line': { borderColor: '#30363d' } }}>
                {WORKFLOW_STEPS.map((label) => (
                  <Step key={label}>
                    <StepLabel
                      StepIconProps={{
                        sx: {
                          color: '#21262d',
                          '&.Mui-active': { color: '#1f6feb' },
                          '&.Mui-completed': { color: '#238636' },
                        },
                      }}
                    >
                      {label}
                    </StepLabel>
                  </Step>
                ))}
              </Stepper>
            </Box>

            {/* Status chips */}
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
              <Chip
                size="small"
                label={selectedScript ? selectedScript.scriptName : 'Unsaved draft'}
                sx={{
                  bgcolor: '#21262d',
                  color: '#e6edf3',
                  border: '1px solid #30363d',
                  fontFamily: 'monospace',
                  fontSize: '0.72rem',
                  height: 22,
                }}
              />
              <Chip
                size="small"
                label={selectedScript?.status ?? 'DRAFT'}
                color={statusColor}
                sx={{ height: 22, fontSize: '0.7rem' }}
              />
              {compile && (
                <Chip
                  size="small"
                  icon={compile.valid ? <CheckRoundedIcon sx={{ fontSize: 12 }} /> : undefined}
                  label={`Compile: ${compile.compileStatus}`}
                  color={compile.valid ? 'success' : compile.compileStatus === 'FAILED' ? 'error' : 'default'}
                  sx={{ height: 22, fontSize: '0.7rem' }}
                />
              )}
              {compile?.artifact?.meta && (
                <Chip
                  size="small"
                  label={`${compile.artifact.meta.timeframeInterval} ${compile.artifact.meta.timeframeUnit}`}
                  variant="outlined"
                  sx={{ height: 22, fontSize: '0.7rem', borderColor: '#30363d', color: '#8b949e' }}
                />
              )}
              {selectedVersion != null && (
                <Chip
                  size="small"
                  label={`v${selectedVersion}`}
                  variant="outlined"
                  sx={{ height: 22, fontSize: '0.7rem', borderColor: '#30363d', color: '#8b949e' }}
                />
              )}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* ── Main body ── */}
      <Stack direction={{ xs: 'column', xl: 'row' }} spacing={2} alignItems="stretch">
        <TradingScriptsLibraryPanel
          items={items}
          currentScriptId={currentScriptId}
          loading={loadingList}
          search={search}
          setSearch={setSearch}
          status={status}
          setStatus={setStatus}
          instrument={instrument}
          setInstrument={setInstrument}
          timeframe={timeframe}
          setTimeframe={setTimeframe}
          compileStatus={compileStatus}
          setCompileStatus={setCompileStatus}
          sort={sort}
          setSort={setSort}
          baseInstruments={baseInstruments}
          onRefresh={() => void reloadLibrary()}
          onLoad={(item) => void loadScript(item)}
          onDuplicate={(item) => void runRowAction(async (target) => {
            const response = await duplicateTradingScript(tenantId, token, target.id, { username });
            applyDetails(response.script, response.latestVersion, response.latestBacktest);
            await reloadLibrary();
            onNotify({ msg: 'Script duplicated', severity: 'success' });
          }, item)}
          onArchive={(item) => void runRowAction(async (target) => {
            await archiveTradingScript(tenantId, token, target.id, { username });
            if (currentScriptId === target.id) {
              setSelectedScript((current) => (current == null ? current : { ...current, status: 'ARCHIVED' }));
            }
            await reloadLibrary();
            onNotify({ msg: 'Script archived', severity: 'info' });
          }, item)}
          onDelete={(item) => void runRowAction(async (target) => {
            await deleteTradingScript(tenantId, token, target.id, username);
            if (currentScriptId === target.id) handleCreateNew();
            await reloadLibrary();
            onNotify({ msg: 'Script deleted', severity: 'info' });
          }, item)}
        />

        <Stack spacing={2} sx={{ flex: 1, minWidth: 0 }}>
          <TradingScriptsEditorPanel
            sourceJs={sourceJs}
            setSourceJs={setSourceJs}
            compile={compile}
            editorRef={editorRef}
            onInsertSnippet={handleInsertSnippet}
            onSave={() => void saveDraft()}
            onCompile={() => void handleCompile(false)}
            onBacktest={() => void handleBacktest()}
          />
          <TradingScriptsLifecyclePanel
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            versions={versions}
            selectedVersion={selectedVersion}
            onLoadVersion={(version) => void loadVersion(version)}
            backtest={backtest}
            compile={compile}
            status={selectedScript?.status ?? 'DRAFT'}
            publishing={publishing}
            onPublish={(target) => void handlePublish(target)}
          />
        </Stack>
      </Stack>

      {(loadingVersion || loadingList) && (
        <Alert severity="info" sx={{ py: 0.5 }}>Refreshing trading scripts…</Alert>
      )}
    </Stack>
  );
};
