# Trading Scripts Test Cases

## Library
- Create a new draft from the Trading Scripts page and verify a new library row is created.
- Load an existing script from the grid and verify source, compile status, and version history populate the editor.
- Duplicate a script and verify the copy appears with a `Copy of ...` name.
- Archive a script and verify its status changes to `ARCHIVED`.
- Delete a script with no linked executions and verify the row is removed.

## Editor And Compile
- Insert snippets by click and by drag-drop and verify source changes at the cursor/editor selection.
- Save a draft with valid source and verify the returned latest version matches the editor source.
- Compile a valid script and verify compile status becomes `SUCCESS`.
- Compile a script with a forbidden API such as `eval` or `fetch` and verify diagnostics show `FAILED`.
- Compile a script with an invalid import and verify diagnostics show an allowlist error.

## Backtest
- Backtest a compiled script and verify summary cards populate total P&L, trade count, and accuracy.
- Verify a successful backtest updates the library row performance columns.
- Attempt backtest with compile errors and verify the action is rejected safely.

## Publish
- Publish a compiled/backtested script as `PAPER_READY` and verify the Trading Script status updates.
- Attempt `LIVE_READY` publish before `PAPER_READY` and verify the backend rejects it.
- Attempt `LIVE_READY` publish with non-option legs and verify live eligibility remains false.
- Verify successful publish creates or updates the linked `intra_strategy` row via `source_trading_script_id`.

## Tenant And Safety
- Load library for tenant A and verify tenant B scripts are not returned.
- Attempt to load/update/delete another user’s script and verify the backend rejects the request.
- Disable `TRADING_SCRIPTS_ENABLED` and verify compile requests fail while stored drafts remain accessible.

## Real-Data Certification
- Run `npm run test:e2e:trading-scripts-real-data` with `REAL_DATA_E2E=1` and verify:
  - Trading Scripts login + route load succeeds.
  - Last 30 trading-day analytics window loads for `NSE_INDEX|Nifty Bank` on 5-minute timeframe.
  - Attachment baseline evaluator and translated script compile outputs match on sampled actionable days.
  - Compile returns `SUCCESS` and runtime decision metadata matches baseline decisions.
  - Backtest returns non-null summary metrics (`totalPnl`, `executedTrades`, `realWorldAccuracyPct`).
  - Publish transitions succeed in sequence: `PAPER_READY` then `LIVE_READY`.
  - Certification report is written under `artifacts/trading-scripts-real-data/<timestamp>/certification-report.json`.

## Live-Order Guardrail Cases (Opt-In)
- With `LIVE_ORDER_E2E=1` and missing `CONFIRM_LIVE=YES`, verify certification fails the live checkpoint.
- With `LIVE_ORDER_E2E=1` and `LIVE_ORDER_QTY` not equal to `1`, verify certification fails the live checkpoint.
- With `LIVE_ORDER_E2E=1`, `CONFIRM_LIVE=YES`, and valid `LIVE_ORDER_INSTRUMENT_TOKEN`, verify a single capped live order attempt is executed and recorded in the report.
