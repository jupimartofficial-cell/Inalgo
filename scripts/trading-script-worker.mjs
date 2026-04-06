import { createHash } from 'node:crypto';
import vm from 'node:vm';

const ALLOWED_IMPORTS = new Set([
  '@inalgo/market',
  '@inalgo/analytics',
  '@inalgo/options',
  '@inalgo/runtime',
  '@inalgo/strategy',
]);

const FORBIDDEN_PATTERNS = [
  { code: 'FORBIDDEN_REQUIRE', regex: /\brequire\s*\(/, message: 'CommonJS require is not allowed.' },
  { code: 'FORBIDDEN_PROCESS', regex: /\bprocess\b/, message: 'process is not available inside trading scripts.' },
  { code: 'FORBIDDEN_GLOBAL', regex: /\bglobalThis\b|\bglobal\b/, message: 'Host globals are not available inside trading scripts.' },
  { code: 'FORBIDDEN_EVAL', regex: /\beval\s*\(|new\s+Function\s*\(/, message: 'Dynamic code execution is not allowed.' },
  { code: 'FORBIDDEN_FETCH', regex: /\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b/, message: 'Network access is not allowed.' },
  { code: 'FORBIDDEN_IMPORT_CALL', regex: /\bimport\s*\(/, message: 'Dynamic import is not allowed.' },
];

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

function emit(payload) {
  process.stdout.write(JSON.stringify(payload));
}

function buildDiagnostic(severity, code, message, line = 1, column = 1, endLine = line, endColumn = column + 1) {
  return { severity, code, message, line, column, endLine, endColumn };
}

function lineForIndex(source, index) {
  const upto = source.slice(0, Math.max(0, index));
  const lines = upto.split(/\n/);
  return { line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1 };
}

function extractImports(source) {
  const imports = [];
  const diagnostics = [];
  const importRegex = /import\s+(?:[^'";]+\s+from\s+)?['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(importRegex)) {
    const specifier = match[1];
    imports.push(specifier);
    if (!ALLOWED_IMPORTS.has(specifier)) {
      const pos = lineForIndex(source, match.index ?? 0);
      diagnostics.push(buildDiagnostic('error', 'INVALID_IMPORT', `Import \"${specifier}\" is not allowed.`, pos.line, pos.column));
    }
  }
  return { imports, diagnostics };
}

function collectPatternDiagnostics(source) {
  const diagnostics = [];
  for (const pattern of FORBIDDEN_PATTERNS) {
    const match = source.match(pattern.regex);
    if (match && match.index != null) {
      const pos = lineForIndex(source, match.index);
      diagnostics.push(buildDiagnostic('error', pattern.code, pattern.message, pos.line, pos.column));
    }
  }
  return diagnostics;
}

function normalizeInputs(rawInputs) {
  if (!rawInputs || typeof rawInputs !== 'object' || Array.isArray(rawInputs)) {
    return [];
  }
  return Object.entries(rawInputs).map(([key, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return {
        key,
        label: typeof value.label === 'string' ? value.label : key,
        type: typeof value.type === 'string' ? value.type : typeof value.defaultValue,
        defaultValue: value.defaultValue ?? null,
        required: Boolean(value.required),
        description: typeof value.description === 'string' ? value.description : '',
      };
    }
    return {
      key,
      label: key,
      type: typeof value,
      defaultValue: value,
      required: false,
      description: '',
    };
  });
}

function validateDefinition(definition) {
  const diagnostics = [];
  if (!definition || typeof definition !== 'object') {
    diagnostics.push(buildDiagnostic('error', 'MISSING_DEFINITION', 'Script must export default defineScript({...}).'));
    return diagnostics;
  }
  const meta = definition.meta;
  if (!meta || typeof meta !== 'object') {
    diagnostics.push(buildDiagnostic('error', 'MISSING_META', 'Script meta is required.'));
  } else {
    for (const field of ['name', 'instrumentKey', 'timeframeUnit', 'timeframeInterval', 'strategyType']) {
      if (meta[field] == null || meta[field] === '') {
        diagnostics.push(buildDiagnostic('error', 'META_FIELD_REQUIRED', `meta.${field} is required.`));
      }
    }
  }
  if (typeof definition.onBar !== 'function') {
    diagnostics.push(buildDiagnostic('error', 'MISSING_ONBAR', 'Script must define onBar(ctx, state, api).'));
  }
  if (!definition.compiledStrategy || typeof definition.compiledStrategy !== 'object') {
    diagnostics.push(buildDiagnostic('error', 'MISSING_COMPILED_STRATEGY', 'Script must expose compiledStrategy for v1 backtest and publish flows.'));
  }
  return diagnostics;
}

async function compileSource(source) {
  const diagnostics = [
    ...collectPatternDiagnostics(source),
  ];
  const { imports, diagnostics: importDiagnostics } = extractImports(source);
  diagnostics.push(...importDiagnostics);

  let capturedDefinition = null;
  const context = vm.createContext({
    console: Object.freeze({ log() {}, warn() {}, error() {} }),
    defineScript(definition) {
      capturedDefinition = definition;
      return definition;
    },
  });

  try {
    if (typeof vm.SourceTextModule === 'function') {
      const module = new vm.SourceTextModule(source, {
        context,
        initializeImportMeta(meta) {
          meta.url = 'file:///trading-script.js';
        },
      });
      await module.link(async (specifier) => {
        if (!ALLOWED_IMPORTS.has(specifier)) {
          throw new Error(`Import ${specifier} is not allowed`);
        }
        return new vm.SyntheticModule([], function () {}, { context });
      });
      await module.evaluate({ timeout: 1000 });
      if (capturedDefinition == null && 'default' in module.namespace) {
        capturedDefinition = module.namespace.default;
      }
    } else {
      // Node runtimes without vm.SourceTextModule still support deterministic checks
      // for defineScript payloads after stripping ESM transport syntax.
      const fallbackSource = source
        .replace(/^\s*import\s+[^;]+;?\s*$/gm, '')
        .replace(/\bexport\s+default\s+/g, '');
      const script = new vm.Script(fallbackSource, { filename: 'trading-script.js' });
      script.runInContext(context, { timeout: 1000 });
    }
  } catch (error) {
    diagnostics.push(buildDiagnostic('error', 'COMPILE_ERROR', error instanceof Error ? error.message : 'Unable to compile script.'));
  }

  diagnostics.push(...validateDefinition(capturedDefinition));

  const valid = diagnostics.every((item) => item.severity !== 'error');
  const artifact = valid ? {
    meta: {
      name: capturedDefinition.meta.name,
      instrumentKey: capturedDefinition.meta.instrumentKey,
      timeframeUnit: capturedDefinition.meta.timeframeUnit,
      timeframeInterval: capturedDefinition.meta.timeframeInterval,
      strategyType: capturedDefinition.meta.strategyType,
      marketSession: capturedDefinition.meta.marketSession ?? '',
    },
    inputs: normalizeInputs(capturedDefinition.inputs),
    compiledStrategy: capturedDefinition.compiledStrategy,
    imports,
    notes: Array.isArray(capturedDefinition.notes) ? capturedDefinition.notes.filter((item) => typeof item === 'string') : [],
    runtimeHints: capturedDefinition.runtimeHints && typeof capturedDefinition.runtimeHints === 'object' ? capturedDefinition.runtimeHints : {},
    sourceHash: createHash('sha256').update(source).digest('hex'),
  } : null;

  return {
    compileStatus: valid ? 'SUCCESS' : 'FAILED',
    valid,
    diagnostics,
    artifact,
    warnings: valid ? [] : [],
  };
}

const raw = await readStdin();
const request = JSON.parse(raw || '{}');
if (request.action !== 'compile') {
  emit({ compileStatus: 'FAILED', valid: false, diagnostics: [buildDiagnostic('error', 'UNSUPPORTED_ACTION', 'Unsupported worker action.')], artifact: null, warnings: [] });
} else {
  const result = await compileSource(String(request.sourceJs ?? ''));
  emit(result);
}
