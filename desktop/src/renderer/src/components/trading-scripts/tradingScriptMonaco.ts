import type * as Monaco from 'monaco-editor';

let typingsRegistered = false;

interface JavaScriptDefaults {
  setCompilerOptions(options: Record<string, unknown>): void;
  setDiagnosticsOptions(options: Record<string, unknown>): void;
  addExtraLib(content: string, filePath?: string): unknown;
}

interface MonacoWithJavaScriptDefaults {
  languages: {
    typescript: {
      javascriptDefaults: JavaScriptDefaults;
    };
  };
}

const SCRIPT_TARGET_ES2022 = 9;
const MODULE_KIND_ESNEXT = 99;
const MODULE_RESOLUTION_NODE_JS = 2;

const PLATFORM_TYPINGS = [
  "declare module '@inalgo/market' {",
  '  export const candles: { recent(count: number): Array<{ open: number; high: number; low: number; close: number; volume?: number }> };',
  '}',
  "declare module '@inalgo/analytics' {",
  '  export const indicators: Record<string, unknown>;',
  '}',
  "declare module '@inalgo/options' {",
  '  export const optionChain: { nearestExpiry(): string; }',
  '}',
  "declare module '@inalgo/runtime' {",
  '  export const runtime: { tenantId(): string; user(): string; }',
  '}',
  "declare module '@inalgo/strategy' {",
  '  export const helpers: Record<string, unknown>;',
  '}',
  '',
  "type TradingActionType = 'HOLD' | 'ENTER' | 'EXIT' | 'ADJUST_LEGS';",
  '',
  'interface TradingActionResult {',
  '  type: TradingActionType;',
  '  reason?: string;',
  '  direction?: "LONG" | "SHORT";',
  '  legs?: unknown;',
  '}',
  '',
  'interface TradingScriptDefinition {',
  '  meta: {',
  '    name: string;',
  '    instrumentKey: string;',
  '    timeframeUnit: string;',
  '    timeframeInterval: number;',
  '    strategyType: string;',
  '    marketSession?: string;',
  '  };',
  '  inputs?: Record<string, unknown>;',
  '  notes?: string[];',
  '  runtimeHints?: Record<string, unknown>;',
  '  compiledStrategy: unknown;',
  '  onBar(ctx: TradingScriptContext, state: TradingScriptState, api: TradingScriptApi): TradingActionResult;',
  '}',
  '',
  'interface TradingScriptContext {',
  '  bar: { open: number; high: number; low: number; close: number; volume?: number; ts?: string; };',
  '  series: Array<{ open: number; high: number; low: number; close: number; volume?: number; ts?: string; }>;',
  '  instrument: { key: string; exchange?: string; symbol?: string; };',
  '}',
  '',
  'interface TradingScriptState {',
  '  positionOpen: boolean;',
  '  livePnl: number;',
  '  lastAction?: TradingActionResult;',
  '}',
  '',
  'interface TradingScriptApi {',
  '  signals: { latest(name: string): { active: boolean; value?: number; reason?: string; }; };',
  '  trends: { marketBias(): "BULLISH" | "BEARISH" | "NEUTRAL"; };',
  '  clock: { minutesToClose(): number; sessionLabel(): string; };',
  '  legs: { atmCallBuy(lots: number): unknown; atmPutBuy(lots: number): unknown; };',
  '  actions: {',
  '    hold(payload?: { reason?: string; }): TradingActionResult;',
  '    enter(payload: { reason?: string; direction?: "LONG" | "SHORT"; legs?: unknown; }): TradingActionResult;',
  '    exit(payload?: { reason?: string; }): TradingActionResult;',
  '    adjustLegs(payload: { reason?: string; legs?: unknown; }): TradingActionResult;',
  '  };',
  '}',
  '',
  'declare function defineScript(definition: TradingScriptDefinition): TradingScriptDefinition;',
].join('\n');

export const configureTradingScriptMonaco = (monaco: unknown) => {
  const compiler = (monaco as MonacoWithJavaScriptDefaults).languages.typescript.javascriptDefaults;
  compiler.setCompilerOptions({
    allowJs: true,
    checkJs: true,
    target: SCRIPT_TARGET_ES2022,
    module: MODULE_KIND_ESNEXT,
    moduleResolution: MODULE_RESOLUTION_NODE_JS,
    allowNonTsExtensions: true,
    noEmit: true,
  });
  compiler.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
  });

  if (!typingsRegistered) {
    compiler.addExtraLib(PLATFORM_TYPINGS, 'file:///node_modules/@types/inalgo-trading/index.d.ts');
    typingsRegistered = true;
  }
};

export const insertSnippetAtCursor = (
  editor: Monaco.editor.IStandaloneCodeEditor | null,
  snippet: string,
) => {
  if (!editor) {
    return;
  }
  const selection = editor.getSelection();
  if (!selection) {
    return;
  }
  editor.executeEdits('trading-scripts-snippet', [
    {
      range: selection,
      text: snippet,
      forceMoveMarkers: true,
    },
  ]);
  editor.focus();
};
