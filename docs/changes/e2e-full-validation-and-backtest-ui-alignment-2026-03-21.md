# E2E Full Validation And Backtest UI Alignment (2026-03-21)

## Change Summary
- Status: complete for functional validation and regression fixes.
- Goal: run full backend/frontend/E2E validation and fix all failing UI/behavior found in real browser flows.

## Problem And Goal
- The desktop E2E suite had failing Backtest flows (strategy save/run/delete, risk controls, advanced conditions, and analytics grids).
- Goal was to validate end-to-end functionality and correct UI/contract mismatches so real browser flows and payload assertions pass.

## Implementation Summary
- Backtest form:
  - Added disabled `Underlying Source` selector with `Futures` to match expected form contract and combobox ordering.
  - Added explicit accessibility labels for risk-control toggles and numeric inputs:
    - `Enable Stop Loss`, `Enable Target`, `Enable Trailing Stop Loss`
    - `SL Value`, `Target Value`, `Trailing SL Value`
- Backtest panel actions/notifications:
  - Standardized button labels to `Save Strategy` and `Start Backtest`.
  - Standardized success toasts to:
    - `Strategy saved`
    - `Backtest completed with <n> trades`
- Advanced conditions editor:
  - Added `data-testid="advanced-entry-group"` and `data-testid="advanced-exit-group"`.
  - Renamed add button to `Add condition`.
  - Added `aria-label="Value"` for value input.
  - Updated group operator option text to lowercase `and` / `or` to match E2E selector expectations.
- Trading Signal view:
  - Heading changed to `Trading Signal`.
  - Filter labels changed to `From Date` / `To Date`.
  - Filter actions changed to `Apply Filters` / `Reset Filters`.
  - Added select aria labels for `Index`, `Timeframe`, `Signal`.
  - Grid now renders raw `instrumentKey` (e.g. `NSE_INDEX|Nifty 50`) for contract parity.
- Trading Param view:
  - Heading changed to `Trading Param`.
  - Filter labels/actions aligned to `From Date`, `To Date`, `Apply Filters`, `Reset Filters`.
  - Added select aria label for `Index`.
  - Grid now renders raw `instrumentKey`.
  - ORB breakout/breakdown now display normalized `Yes`/`No` text from booleanish values.
  - Gap type rendered as raw value text (e.g. `Gap Up`).
- Results and strategy-list alignment:
  - Results metric subtitle changed to `Trades <n>`.
  - Strategy-list empty state changed to exact `No strategy saved yet`.
  - Execution notes now expanded by default so note text is visible immediately after run.

## Files And Modules Touched
- `desktop/src/renderer/src/components/BacktestPanel.tsx`
- `desktop/src/renderer/src/components/BacktestPanelShared.tsx`
- `desktop/src/renderer/src/components/BacktestStrategyForm.tsx`
- `desktop/src/renderer/src/components/BacktestAdvancedConditionsEditor.tsx`
- `desktop/src/renderer/src/components/BacktestTradingSignalView.tsx`
- `desktop/src/renderer/src/components/BacktestTradingParamView.tsx`
- `desktop/src/renderer/src/components/BacktestResultsPanel.tsx`
- `desktop/src/renderer/src/components/BacktestStrategyListView.tsx`

## Feature Impact
- Preserved behavior:
  - Backtest strategy create/update/run payload shape and backend API usage.
  - Existing non-backtest E2E flows.
- Changed behavior:
  - Backtest UI text/labels/accessibility semantics now align with E2E contracts and operator-visible wording.
  - Trading analytics grids show raw instrument key text to match contract expectations in tests.

## API And Contract Impact
- No backend endpoint shape changes.
- Frontend UI contract changes:
  - button labels, field labels, accessibility names, and some table cell text values changed.

## Database Impact
- None.

## Validation Performed
- Backend:
  - `cd backend && mvn test`
  - Result: `Tests run: 110, Failures: 0, Errors: 0, Skipped: 1`.
- Frontend static/build:
  - `cd desktop && npm run lint`
  - `cd desktop && npm run build`
  - Result: pass.
- Frontend E2E:
  - `cd desktop && npx playwright test e2e/backtest.spec.ts --workers=1`
  - Result: pass (4/4).
  - `cd desktop && npm run test:e2e`
  - Result: pass (25/25).
- Token-budget gate:
  - `./scripts/check-source-token-budget.sh`
  - Result: fail (repo contains multiple files over policy limits, including pre-existing large files and touched `BacktestAdvancedConditionsEditor.tsx` at 638 lines).

## Risks And Follow-Ups
- Maintainability gate risk remains open due token-budget violations in repository and touched oversized files.
- Suggested follow-up:
  - Extract `BacktestAdvancedConditionsEditor.tsx` subcomponents to reduce file length under 500 lines.
  - Continue incremental decomposition of other oversized modules listed by token-budget scan.

## Agent Handoff Note
- Done:
  - Full backend/frontend/E2E validation executed; all functional tests pass.
  - Backtest UI regressions fixed and aligned with E2E real-flow expectations.
- Remaining:
  - Token-budget maintainability remediation only.
- Continue from:
  - Backtest UI modules listed above, starting with `BacktestAdvancedConditionsEditor.tsx` for safe extraction.
- Do not break:
  - E2E-visible labels/text used by `desktop/e2e/backtest.spec.ts` and `desktop/e2e/app-sections.spec.ts`.
