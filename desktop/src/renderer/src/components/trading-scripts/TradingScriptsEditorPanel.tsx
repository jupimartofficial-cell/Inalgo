import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Divider,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import Editor, { loader } from '@monaco-editor/react';
import type { editor as MonacoEditorApi } from 'monaco-editor';
import type { MutableRefObject } from 'react';
import * as monacoEditor from 'monaco-editor';
import { useEffect, useState } from 'react';
import CodeRoundedIcon from '@mui/icons-material/CodeRounded';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import FormatAlignLeftRoundedIcon from '@mui/icons-material/FormatAlignLeftRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import KeyboardRoundedIcon from '@mui/icons-material/KeyboardRounded';
import type { TradingScriptCompileResponse } from '../../api/admin';
import { configureTradingScriptMonaco } from './tradingScriptMonaco';
import { TRADING_SCRIPT_SNIPPET_GROUPS } from './tradingScriptPalette';

loader.config({ monaco: monacoEditor });

const compileTone = (compile?: TradingScriptCompileResponse | null): 'default' | 'success' | 'warning' | 'error' => {
  if (!compile) return 'default';
  if (compile.valid) return 'success';
  if (compile.diagnostics.some((item) => item.severity?.toLowerCase() === 'error')) return 'error';
  return 'warning';
};

const EDITOR_SHORTCUTS = [
  { keys: 'Ctrl+S', action: 'Save Draft' },
  { keys: 'Ctrl+Enter', action: 'Compile' },
  { keys: 'Ctrl+Shift+B', action: 'Backtest' },
  { keys: 'Ctrl+/', action: 'Toggle Comment' },
  { keys: 'Alt+Shift+F', action: 'Format Code' },
  { keys: 'Ctrl+Z', action: 'Undo' },
  { keys: 'F12', action: 'Go to Definition' },
];

export const TradingScriptsEditorPanel = ({
  sourceJs,
  setSourceJs,
  compile,
  editorRef,
  onInsertSnippet,
  onSave,
  onCompile,
  onBacktest,
}: {
  sourceJs: string;
  setSourceJs: (value: string) => void;
  compile: TradingScriptCompileResponse | null;
  editorRef: MutableRefObject<MonacoEditorApi.IStandaloneCodeEditor | null>;
  onInsertSnippet: (snippet: string) => void;
  onSave?: () => void;
  onCompile?: () => void;
  onBacktest?: () => void;
}) => {
  const [darkTheme, setDarkTheme] = useState(true);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [cursorInfo, setCursorInfo] = useState({ line: 1, col: 1, chars: sourceJs.length });
  const [monacoStatus, setMonacoStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [monacoError, setMonacoError] = useState<string | null>(null);

  const diagnostics = compile?.diagnostics ?? [];
  const tone = compileTone(compile);

  useEffect(() => {
    let active = true;
    loader
      .init()
      .then(() => {
        if (!active) return;
        setMonacoStatus('ready');
        setMonacoError(null);
      })
      .catch((error) => {
        if (!active) return;
        const msg = error instanceof Error ? error.message : 'Unknown Monaco initialization error';
        setMonacoError(msg);
        setMonacoStatus('error');
      });
    return () => {
      active = false;
    };
  }, []);

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleFormat = () => {
    editorRef.current?.getAction('editor.action.formatDocument')?.run();
  };

  return (
    <Card sx={{ border: darkTheme ? '1px solid #333' : undefined, bgcolor: darkTheme ? '#1e1e1e' : undefined }}>
      <CardContent sx={{ p: '12px !important' }}>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5}>

          {/* ── Snippet Palette ── */}
          <Stack spacing={1} sx={{ width: { lg: 260 }, flexShrink: 0 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="subtitle2" fontWeight={800} color={darkTheme ? 'grey.300' : 'text.primary'}>
                Snippets
              </Typography>
              <Tooltip title="Keyboard shortcuts">
                <IconButton size="small" onClick={() => setShowShortcuts((prev) => !prev)}>
                  <KeyboardRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>

            <Collapse in={showShortcuts}>
              <Paper variant="outlined" sx={{ p: 1, bgcolor: darkTheme ? '#252526' : '#f5f5f5', borderColor: darkTheme ? '#444' : undefined }}>
                <Typography variant="caption" fontWeight={700} color={darkTheme ? 'grey.400' : 'text.secondary'}>
                  Keyboard Shortcuts
                </Typography>
                <Stack spacing={0.25} mt={0.5}>
                  {EDITOR_SHORTCUTS.map(({ keys, action }) => (
                    <Stack key={keys} direction="row" justifyContent="space-between" spacing={1}>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace', bgcolor: darkTheme ? '#3a3a3a' : '#e0e0e0', px: 0.5, borderRadius: 0.5, color: darkTheme ? '#ce9178' : '#c62828' }}>
                        {keys}
                      </Typography>
                      <Typography variant="caption" color={darkTheme ? 'grey.400' : 'text.secondary'} noWrap>{action}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Paper>
            </Collapse>

            <Box sx={{ overflowY: 'auto', maxHeight: 560 }}>
              <Stack spacing={0.75}>
                {TRADING_SCRIPT_SNIPPET_GROUPS.map((group) => {
                  const collapsed = collapsedGroups.has(group.key);
                  return (
                    <Paper
                      key={group.key}
                      variant="outlined"
                      sx={{
                        p: 1,
                        borderRadius: 1.5,
                        bgcolor: darkTheme ? '#252526' : '#fafafa',
                        borderColor: darkTheme ? '#3a3a3a' : undefined,
                      }}
                    >
                      <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        sx={{ cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => toggleGroup(group.key)}
                      >
                        <Typography variant="caption" fontWeight={800} color={darkTheme ? 'grey.300' : 'text.primary'}>
                          {group.title}
                        </Typography>
                        {collapsed ? (
                          <ExpandMoreRoundedIcon sx={{ fontSize: 14, color: darkTheme ? 'grey.500' : 'text.secondary' }} />
                        ) : (
                          <ExpandLessRoundedIcon sx={{ fontSize: 14, color: darkTheme ? 'grey.500' : 'text.secondary' }} />
                        )}
                      </Stack>
                      <Collapse in={!collapsed}>
                        <Stack spacing={0.5} mt={0.75}>
                          {group.snippets.map((snippet) => (
                            <Button
                              key={snippet.label}
                              size="small"
                              variant="outlined"
                              draggable
                              onDragStart={(event) => event.dataTransfer.setData('text/plain', snippet.insert)}
                              onClick={() => onInsertSnippet(snippet.insert)}
                              sx={{
                                justifyContent: 'flex-start',
                                textAlign: 'left',
                                textTransform: 'none',
                                py: 0.5,
                                px: 0.75,
                                minHeight: 0,
                                borderColor: darkTheme ? '#555' : undefined,
                                color: darkTheme ? 'grey.300' : undefined,
                                '&:hover': { borderColor: '#4fc3f7', color: '#4fc3f7', bgcolor: darkTheme ? '#1e3a4a' : undefined },
                              }}
                            >
                              <Stack alignItems="flex-start" sx={{ width: '100%' }}>
                                <Typography variant="caption" fontWeight={700} sx={{ lineHeight: 1.3 }}>
                                  {snippet.label}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color={darkTheme ? 'grey.500' : 'text.secondary'}
                                  sx={{ fontSize: '0.65rem', lineHeight: 1.2 }}
                                >
                                  {snippet.caption}
                                </Typography>
                              </Stack>
                            </Button>
                          ))}
                        </Stack>
                      </Collapse>
                    </Paper>
                  );
                })}
              </Stack>
            </Box>
          </Stack>

          {/* ── Editor ── */}
          <Stack spacing={0} sx={{ flex: 1, minWidth: 0 }}>
            {/* Editor toolbar */}
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{
                px: 1.5,
                py: 0.5,
                bgcolor: darkTheme ? '#2d2d2d' : '#f5f5f5',
                borderTopLeftRadius: 6,
                borderTopRightRadius: 6,
                border: '1px solid',
                borderColor: darkTheme ? '#444' : '#e0e0e0',
                borderBottom: 'none',
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1}>
                <CodeRoundedIcon sx={{ fontSize: 14, color: darkTheme ? '#4fc3f7' : '#1976d2' }} />
                <Typography variant="caption" fontWeight={700} color={darkTheme ? 'grey.300' : 'text.primary'} sx={{ fontFamily: 'monospace' }}>
                  strategy.js
                </Typography>
                <Chip
                  size="small"
                  label={compile?.compileStatus ?? 'PENDING'}
                  color={tone === 'success' ? 'success' : tone === 'error' ? 'error' : tone === 'warning' ? 'warning' : 'default'}
                  sx={{ height: 18, fontSize: '0.6rem' }}
                />
              </Stack>
              <Stack direction="row" spacing={0.5}>
                <Tooltip title="Format document (Alt+Shift+F)">
                  <IconButton size="small" onClick={handleFormat} sx={{ color: darkTheme ? 'grey.400' : undefined }}>
                    <FormatAlignLeftRoundedIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title={darkTheme ? 'Switch to Light theme' : 'Switch to Dark theme'}>
                  <IconButton size="small" onClick={() => setDarkTheme((prev) => !prev)} sx={{ color: darkTheme ? 'grey.400' : undefined }}>
                    {darkTheme ? <LightModeRoundedIcon sx={{ fontSize: 16 }} /> : <DarkModeRoundedIcon sx={{ fontSize: 16 }} />}
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>

            {/* Monaco editor */}
            <Paper
              variant="outlined"
              sx={{
                overflow: 'hidden',
                borderRadius: 0,
                borderTopLeftRadius: 0,
                borderTopRightRadius: 0,
                borderColor: darkTheme ? '#444' : undefined,
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const snippet = event.dataTransfer.getData('text/plain');
                if (snippet) onInsertSnippet(snippet);
              }}
            >
              {monacoStatus !== 'error' && (
                <Editor
                  height="520px"
                  language="javascript"
                  theme={darkTheme ? 'vs-dark' : 'vs'}
                  value={sourceJs}
                  loading={(
                    <Box
                      sx={{
                        height: 520,
                        bgcolor: darkTheme ? '#1e1e1e' : '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Typography variant="caption" color={darkTheme ? 'grey.500' : 'text.secondary'}>
                        Loading editor…
                      </Typography>
                    </Box>
                  )}
                  onMount={(editor, monaco) => {
                    try { configureTradingScriptMonaco(monaco); } catch { /* non-fatal */ }
                    editorRef.current = editor;
                    setMonacoStatus('ready');
                    setMonacoError(null);
                    editor.onDidChangeCursorPosition((e) => {
                      setCursorInfo({ line: e.position.lineNumber, col: e.position.column, chars: editor.getValue().length });
                    });
                    try {
                      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => onSave?.());
                      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => onCompile?.());
                      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyB, () => onBacktest?.());
                    } catch { /* keybindings may conflict — non-fatal */ }
                  }}
                  onChange={(value) => {
                    setSourceJs(value ?? '');
                    setCursorInfo((prev) => ({ ...prev, chars: (value ?? '').length }));
                  }}
                  options={{
                    minimap: { enabled: true, scale: 1 },
                    fontSize: 13,
                    lineHeight: 20,
                    lineNumbersMinChars: 3,
                    automaticLayout: true,
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    folding: true,
                    foldingStrategy: 'indentation',
                    renderLineHighlight: 'all',
                    smoothScrolling: true,
                    cursorBlinking: 'smooth',
                    cursorSmoothCaretAnimation: 'on',
                    bracketPairColorization: { enabled: true },
                    guides: { bracketPairs: true, indentation: true },
                    suggest: { showKeywords: true, showSnippets: true },
                    quickSuggestions: { other: true, comments: false, strings: false },
                    scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
                  }}
                />
              )}
              {monacoStatus === 'error' && (
                <Stack spacing={1} sx={{ p: 1.25 }}>
                  <Alert severity="error" sx={{ py: 0 }}>
                    Editor failed to initialize. Falling back to plain text mode.
                  </Alert>
                  <Typography variant="caption" color={darkTheme ? 'grey.500' : 'text.secondary'}>
                    {monacoError ?? 'Monaco loader initialization failed.'}
                  </Typography>
                  <TextField
                    multiline
                    minRows={20}
                    maxRows={20}
                    fullWidth
                    label="Mini IDE source"
                    value={sourceJs}
                    onChange={(event) => {
                      const value = event.target.value;
                      setSourceJs(value);
                      setCursorInfo((prev) => ({ ...prev, chars: value.length }));
                    }}
                  />
                </Stack>
              )}
            </Paper>

            {/* Status bar */}
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{
                px: 1.5,
                py: 0.25,
                bgcolor: darkTheme ? '#007acc' : '#1976d2',
                borderBottomLeftRadius: 6,
                borderBottomRightRadius: 6,
              }}
            >
              <Stack direction="row" spacing={1.5}>
                <Typography variant="caption" sx={{ color: '#fff', fontSize: '0.65rem', fontFamily: 'monospace' }}>
                  Ln {cursorInfo.line}, Col {cursorInfo.col}
                </Typography>
                <Typography variant="caption" sx={{ color: '#cce5ff', fontSize: '0.65rem', fontFamily: 'monospace' }}>
                  {cursorInfo.chars.toLocaleString()} chars
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1.5}>
                <Typography variant="caption" sx={{ color: '#cce5ff', fontSize: '0.65rem' }}>JavaScript</Typography>
                <Typography variant="caption" sx={{ color: '#cce5ff', fontSize: '0.65rem' }}>UTF-8</Typography>
                <Typography variant="caption" sx={{ color: '#cce5ff', fontSize: '0.65rem' }}>Spaces: 2</Typography>
              </Stack>
            </Stack>

            <Typography variant="caption" color={darkTheme ? 'grey.500' : 'text.secondary'} sx={{ mt: 0.5 }}>
              Drag snippets into the editor · Ctrl+S Save · Ctrl+Enter Compile · Ctrl+Shift+B Backtest
            </Typography>
          </Stack>

          {/* ── Diagnostics ── */}
          <Stack spacing={1} sx={{ width: { lg: 300 }, flexShrink: 0 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="subtitle2" fontWeight={800} color={darkTheme ? 'grey.300' : 'text.primary'}>
                Diagnostics
              </Typography>
              {diagnostics.length > 0 && (
                <Chip
                  size="small"
                  label={`${diagnostics.length} issue${diagnostics.length === 1 ? '' : 's'}`}
                  color={tone === 'error' ? 'error' : 'warning'}
                  sx={{ height: 18, fontSize: '0.65rem' }}
                />
              )}
            </Stack>

            <Paper
              variant="outlined"
              sx={{
                p: 1.25,
                minHeight: 480,
                maxHeight: 580,
                overflow: 'auto',
                bgcolor: darkTheme ? '#1e1e1e' : '#fafafa',
                borderColor: darkTheme ? '#333' : undefined,
              }}
            >
              <Stack spacing={1}>
                {/* Compile status badge */}
                <Stack direction="row" alignItems="center" spacing={1}>
                  {tone === 'success' && <CheckCircleOutlineRoundedIcon color="success" sx={{ fontSize: 18 }} />}
                  {tone === 'error' && <ErrorOutlineRoundedIcon color="error" sx={{ fontSize: 18 }} />}
                  {tone === 'warning' && <WarningAmberRoundedIcon color="warning" sx={{ fontSize: 18 }} />}
                  {tone === 'default' && <InfoOutlinedIcon color="disabled" sx={{ fontSize: 18 }} />}
                  <Typography variant="caption" fontWeight={700} color={darkTheme ? 'grey.300' : 'text.primary'}>
                    {compile?.compileStatus ?? 'PENDING'}
                  </Typography>
                </Stack>

                {/* Compile-level warnings */}
                {compile?.warnings?.map((warning) => (
                  <Alert key={warning} severity="warning" sx={{ py: 0, fontSize: '0.75rem' }}>
                    {warning}
                  </Alert>
                ))}

                {diagnostics.length === 0 && !compile && (
                  <Typography variant="caption" color={darkTheme ? 'grey.500' : 'text.secondary'}>
                    Compile your script to see diagnostics, type info, and normalized metadata here.
                  </Typography>
                )}

                {diagnostics.length === 0 && compile?.valid && (
                  <Alert severity="success" sx={{ py: 0, fontSize: '0.75rem' }}>
                    No issues found. Script compiled successfully.
                  </Alert>
                )}

                {/* Diagnostics list */}
                {diagnostics.map((item, index) => {
                  const isError = item.severity?.toLowerCase() === 'error';
                  return (
                    <Paper
                      key={`${item.code ?? 'diag'}-${index}`}
                      variant="outlined"
                      sx={{
                        p: 1,
                        bgcolor: isError
                          ? (darkTheme ? '#3a1a1a' : '#fff5f5')
                          : (darkTheme ? '#2a2a1a' : '#fffde7'),
                        borderColor: isError ? '#c62828' : '#f57f17',
                        cursor: item.line != null ? 'pointer' : 'default',
                      }}
                      onClick={() => {
                        if (item.line != null && editorRef.current) {
                          editorRef.current.revealLineInCenter(item.line);
                          editorRef.current.setPosition({ lineNumber: item.line, column: 1 });
                          editorRef.current.focus();
                        }
                      }}
                    >
                      <Stack direction="row" alignItems="flex-start" spacing={0.75}>
                        {isError
                          ? <ErrorOutlineRoundedIcon color="error" sx={{ fontSize: 14, mt: 0.1, flexShrink: 0 }} />
                          : <WarningAmberRoundedIcon color="warning" sx={{ fontSize: 14, mt: 0.1, flexShrink: 0 }} />}
                        <Stack spacing={0.25}>
                          <Stack direction="row" spacing={0.75} alignItems="center">
                            <Typography variant="caption" fontWeight={700} color={isError ? 'error.main' : 'warning.main'}>
                              {item.code ?? (isError ? 'Error' : 'Warning')}
                            </Typography>
                            {item.line != null && (
                              <Typography variant="caption" sx={{ fontFamily: 'monospace', color: darkTheme ? 'grey.500' : 'text.secondary' }}>
                                line {item.line}
                              </Typography>
                            )}
                          </Stack>
                          <Typography variant="caption" color={darkTheme ? 'grey.300' : 'text.primary'} sx={{ lineHeight: 1.4 }}>
                            {item.message}
                          </Typography>
                        </Stack>
                      </Stack>
                    </Paper>
                  );
                })}

                {/* Declared Inputs */}
                {compile?.artifact?.inputs?.length ? (
                  <>
                    <Divider sx={{ borderColor: darkTheme ? '#333' : undefined }} />
                    <Typography variant="caption" fontWeight={800} color={darkTheme ? 'grey.300' : 'text.primary'}>
                      Declared Inputs ({compile.artifact.inputs.length})
                    </Typography>
                    {compile.artifact.inputs.map((item) => (
                      <Paper
                        key={item.key}
                        variant="outlined"
                        sx={{
                          p: 0.75,
                          bgcolor: darkTheme ? '#252526' : '#f5f5f5',
                          borderColor: darkTheme ? '#3a3a3a' : undefined,
                        }}
                      >
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                          <Typography variant="caption" fontWeight={700} color={darkTheme ? '#4fc3f7' : 'primary.main'}>
                            {item.key}
                          </Typography>
                          <Chip
                            size="small"
                            label={item.type ?? 'unknown'}
                            sx={{ height: 16, fontSize: '0.6rem', bgcolor: darkTheme ? '#1e3a4a' : undefined }}
                          />
                        </Stack>
                        <Typography variant="caption" color={darkTheme ? 'grey.500' : 'text.secondary'} sx={{ fontSize: '0.68rem' }}>
                          {item.label ?? item.key} · default: {String(item.defaultValue ?? '—')}
                        </Typography>
                      </Paper>
                    ))}
                  </>
                ) : null}

                {/* Compiled meta */}
                {compile?.artifact?.meta && (
                  <>
                    <Divider sx={{ borderColor: darkTheme ? '#333' : undefined }} />
                    <Typography variant="caption" fontWeight={800} color={darkTheme ? 'grey.300' : 'text.primary'}>
                      Script Meta
                    </Typography>
                    {[
                      ['Name', compile.artifact.meta.name],
                      ['Instrument', compile.artifact.meta.instrumentKey],
                      ['Timeframe', `${compile.artifact.meta.timeframeInterval} ${compile.artifact.meta.timeframeUnit}`],
                      ['Strategy', compile.artifact.meta.strategyType],
                      ['Session', compile.artifact.meta.marketSession ?? 'REGULAR'],
                    ].map(([label, value]) => (
                      <Stack key={label} direction="row" justifyContent="space-between" spacing={0.5}>
                        <Typography variant="caption" color={darkTheme ? 'grey.500' : 'text.secondary'} sx={{ fontSize: '0.68rem' }}>
                          {label}
                        </Typography>
                        <Typography variant="caption" fontWeight={600} color={darkTheme ? 'grey.300' : 'text.primary'} sx={{ fontSize: '0.68rem', textAlign: 'right' }}>
                          {value ?? '—'}
                        </Typography>
                      </Stack>
                    ))}
                  </>
                )}
              </Stack>
            </Paper>

            {/* Compile progress */}
            {compile && !compile.valid && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                  Error rate
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(100, (diagnostics.filter((d) => d.severity?.toLowerCase() === 'error').length / Math.max(1, diagnostics.length)) * 100)}
                  color="error"
                  sx={{ height: 4, borderRadius: 2 }}
                />
              </Box>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
};
