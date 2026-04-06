# Trading Scripts

## Change Summary

- **Status:** Implemented
- **Feature area:** Scripted strategy authoring, compile, backtest, and publish
- **Primary users:** Tenant-scoped admins authoring automated trading strategies

## Problem And Goal

- Traders need a programmable workspace to author strategy logic, validate it safely, and publish it into the existing intra paper/live workflow.
- The goal is to provide a controlled JavaScript-based authoring environment with diagnostics, backtest feedback, and publish gates.

## Implementation Summary

### Backend

- Adds a tenant-scoped Trading Scripts domain with versioned source, compile artifacts, and performance snapshots.
- Exposes `/api/v1/admin/trading-scripts` CRUD, compile, validate, backtest, publish, archive, duplicate, and version endpoints.
- Links published Trading Scripts into the intra strategy lifecycle via `intra_strategy.source_trading_script_id`.

### Frontend

- Adds the `Trading Scripts` route at `/trading-scripts`.
- Provides a library grid with create, load, duplicate, archive, and delete actions.
- Hosts a Monaco-based editor with a snippet palette and diagnostics panel.
- Surfaces version history, backtest summary, and publish state in bottom lifecycle tabs.

### Worker Boundary

- Compilation runs in a separate Node worker process to isolate untrusted code.
- The Spring Boot app persists artifacts and orchestrates lifecycle without executing scripts in the JVM.

### UI Details

- Entry point: `Trading -> Trading Scripts` in the left navigation.
- Layout: library grid alongside the editor surface with snippet palette and diagnostics.
- Actions: save draft, compile, validate, backtest, publish to `PAPER_READY`, and publish to `LIVE_READY`.
- Lifecycle tabs: version history, backtest summary, and publish state remain visible below the editor.

## API And Contract Impact

- Base path: `/api/v1/admin/trading-scripts`
- Library and lifecycle endpoints:
  - `GET /library`
  - `POST /draft`
  - `PUT /{scriptId}/draft`
  - `POST /{scriptId}/compile`
  - `POST /{scriptId}/validate`
  - `POST /{scriptId}/backtest`
  - `POST /{scriptId}/publish`
  - `POST /{scriptId}/duplicate`
  - `POST /{scriptId}/archive`
  - `DELETE /{scriptId}`
  - `GET /{scriptId}/versions`
  - `GET /{scriptId}/versions/{version}`

## Database Impact

- `trading_script`
- `trading_script_version`
- `trading_script_perf_snapshot`

## Script Contract

Scripts must export `default defineScript({...})` and provide:
- `meta`
  - `name`
  - `instrumentKey`
  - `timeframeUnit`
  - `timeframeInterval`
  - `strategyType`
  - `marketSession`
- `inputs`
  - typed user-facing parameters persisted in compile artifacts
- `compiledStrategy`
  - normalized backtest payload used for v1 backtest/publish integration
- `onBar(ctx, state, api)`
  - evaluated on completed bars only

## Runtime Guardrails

Allowed imports:
- `@inalgo/market`
- `@inalgo/analytics`
- `@inalgo/options`
- `@inalgo/runtime`
- `@inalgo/strategy`

Disallowed capabilities:
- external HTTP/network calls
- dynamic import
- `require`
- `process`
- `global` / `globalThis`
- `eval` / `new Function`

## Persistence Model

Tables:
- `trading_script`
- `trading_script_version`
- `trading_script_perf_snapshot`

Linked publish model:
- published Trading Scripts materialize into `intra_strategy`
- linkage is stored on `intra_strategy.source_trading_script_id`

## Lifecycle

1. Save draft
2. Compile / validate
3. Backtest successful version
4. Publish `PAPER_READY`
5. Publish `LIVE_READY`

Live publish remains gated by:
- compile success
- successful backtest snapshot
- prior paper-ready publish
- intraday supported minute timeframe
- option-only leg resolution

## Config Keys

- `trading.scripts.enabled`
- `trading.scripts.worker-command`
- `trading.scripts.worker-script-path`
- `trading.scripts.worker-timeout-ms`
- `trading.scripts.worker-memory-mb`
- `trading.scripts.max-source-length`

## Operational Notes

Rollback path:
- disable `TRADING_SCRIPTS_ENABLED`
- preserve stored scripts, versions, and perf snapshots
- prevent further compile/publish actions while leaving historical records intact

## Real-Data Certification Harness

- Playwright real-data certification spec:
  - `desktop/e2e/trading-scripts-real-data-certification.spec.ts`
- Attachment logic translator and baseline evaluator helper:
  - `desktop/e2e/utils/tradingScriptSampleLogic.ts`
- Artifact output:
  - `artifacts/trading-scripts-real-data/<timestamp>/certification-report.json`
- Default certification scope:
  - tenant/user defaults to `local-desktop` / `admin`
  - `NSE_INDEX|Nifty Bank`, `minutes`, `5`
  - attachment exit-time normalization: `3.20PM` -> `15:20`
  - parity window: last `30` trading days

### Live-order guardrails (opt-in)

- Live orders are never attempted unless:
  - `REAL_DATA_E2E=1`
  - `LIVE_ORDER_E2E=1`
  - `CONFIRM_LIVE=YES`
- Hard cap for certification:
  - max `1` order
  - quantity must be exactly `1`
- Required live input when enabled:
  - `LIVE_ORDER_INSTRUMENT_TOKEN`
- Any guardrail mismatch marks the live checkpoint failed and the certification run fails.

## Files And Modules Touched

- `backend/src/main/java/com/inalgo/trade/admin/TradingScriptController.java`
- `backend/src/main/java/com/inalgo/trade/admin/TradingScriptWorkflowSupport.java`
- `backend/src/main/java/com/inalgo/trade/admin/TradingScriptWorkerClient.java`
- `backend/src/main/java/com/inalgo/trade/admin/TradingScriptMapperSupport.java`
- `desktop/src/renderer/src/components/trading-scripts/TradingScriptsPage.tsx`
- `desktop/src/renderer/src/components/trading-scripts/TradingScriptsLibraryPanel.tsx`
- `desktop/src/renderer/src/components/trading-scripts/TradingScriptsEditorPanel.tsx`
- `desktop/src/renderer/src/api/tradingScripts.ts`
- `scripts/trading-script-worker.mjs`

## Validation And Test Coverage

- Frontend deterministic specs:
  - `desktop/e2e/trading-scripts.spec.ts`
  - `desktop/e2e/trading-scripts-functional.spec.ts`
- Real-data certification:
  - `npm run test:e2e:trading-scripts-real-data`

## Risks And Follow-Ups

- Monaco editor load and worker startup remain sensitive to CSP and worker script delivery; re-validate if build tooling changes.
- Large bundle warnings remain present for the desktop renderer; consider route-level splitting if the editor grows.

## Agent Handoff Note

- Start with `desktop/src/renderer/src/components/trading-scripts/TradingScriptsPage.tsx` for UI state and routing behavior.
- Review `backend/src/main/java/com/inalgo/trade/admin/TradingScriptWorkflowSupport.java` for lifecycle gates and publish rules.
- Do not break the compile/backtest/publish gate order or the option-only live publish restriction.
