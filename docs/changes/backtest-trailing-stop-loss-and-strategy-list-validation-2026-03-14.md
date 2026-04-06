# Backtest Trailing Stop Loss And Strategy List Validation (2026-03-14)

## Change Summary

- **Status:** Complete
- **Scope:** Backtest P&L trailing stop-loss UI + run-logic support, plus strategy list add/edit/delete regression validation
- **Area:** `BacktestPanel` + `BacktestRunService` + backtest unit/e2e tests

## Problem And Goal

- Backtest strategy payloads already carried trailing settings, but the Backtest P&L screen did not expose a trailing stop-loss control and the run engine did not apply trailing-stop exits.
- Goal:
  - add explicit `Enable Trailing Stop Loss` + value control in Backtest P&L,
  - enforce trailing-stop exit behavior during simulation,
  - verify strategy save/edit/delete remains correct with trailing settings included.

## Implementation Summary

### Backend

- Updated `BacktestStrategyService#validateStrategyPayload`:
  - when `overallSettings.trailingEnabled=true`, `overallSettings.trailingTrigger` must be `> 0`.
- Updated `BacktestRunService#resolveExitDecision`:
  - computes trailing-stop threshold from `overallSettings.trailingTrigger` when trailing is enabled,
  - tracks peak unrealized strategy P&L after entry,
  - exits with new reason `TRAILING_STOP_LOSS` when live P&L drops to or below `peakPnl - trailingTrigger`.
- Added `TRAILING_STOP_LOSS` enum entry in run exit reasons so run notes are explicit.

### Frontend

- Updated `BacktestPanel` strategy form:
  - added `Trailing Stop Loss` toggle,
  - added `Trailing SL Value` numeric field (enabled only when trailing is on),
  - normalized loaded strategy `overallSettings` to preserve safe defaults on edit,
  - hardened numeric input parsing (`numberFromInput`) to avoid `NaN` payload values.
- Added `aria-label` to trailing switch for stable automation and accessibility (`Enable Trailing Stop Loss`).

### Tests

- Added backend test `runBacktest_triggersTrailingStopLossAfterProfitPeak` in `BacktestRunServiceTest`.
- Extended Playwright e2e `desktop/e2e/backtest.spec.ts` to verify:
  - trailing stop-loss values are submitted on create,
  - retained and editable on strategy edit,
  - present in run payload,
  - strategy list add/edit/delete flow remains functional.

## Files And Modules Touched

- `backend/src/main/java/com/inalgo/trade/admin/BacktestStrategyService.java`
- `backend/src/main/java/com/inalgo/trade/admin/BacktestRunService.java`
- `backend/src/test/java/com/inalgo/trade/admin/BacktestRunServiceTest.java`
- `desktop/src/renderer/src/components/BacktestPanel.tsx`
- `desktop/e2e/backtest.spec.ts`
- `README.md`

## Feature Impact

- **New behavior**
  - Backtest P&L includes `Enable Trailing Stop Loss` and `Trailing SL Value` inputs.
  - Backtest runs can exit earlier via trailing stop-loss using strategy-level P&L drawdown from peak.
- **Preserved behavior**
  - stop-loss and target early exits remain intact.
  - strategy list add/edit/delete flows remain intact and now carry trailing settings.
  - backtest API request/response shape is unchanged.

## API And Contract Impact

- No endpoint changes.
- Existing payload fields are reused (`overallSettings.trailingEnabled`, `overallSettings.trailingTrigger`).
- Validation contract tightened: trailing trigger must be positive when trailing is enabled.

## Database Impact

- No schema or migration changes.
- Strategy JSON persistence unchanged; trailing settings are stored in existing strategy JSON payload.

## Validation Performed

### Automated

```bash
cd backend
mvn -Dtest=BacktestRunServiceTest test
mvn test

cd ../desktop
npm run lint
npm run build
npm run test:e2e -- backtest.spec.ts
```

Results:
- backend targeted and full test suites passed,
- frontend type-check/build passed,
- backtest e2e passed.

### Issues Found And Fixed During Validation

- Initial e2e failed due ambiguous trailing-switch selector.
- Fix: added explicit trailing switch `aria-label` and updated Playwright locator.

## Risks And Follow-Ups

- Trailing-stop logic uses strategy-level P&L checkpoints from underlying-minute candles; no leg-level custom trailing modes are implemented in this change.
- `overallSettings.trailingMode` and `trailingLockProfit` remain persisted but are not used by run logic in this scope.

## Agent Handoff Note

- Start at `BacktestRunService#resolveExitDecision` for trailing-stop exit behavior.
- Open `BacktestPanel.tsx` for Backtest P&L risk controls and strategy edit-state normalization.
- Do not break:
  - tenant/user strategy ownership checks,
  - existing stop-loss/target triggers,
  - strategy-list edit/delete flow and pagination behavior.

## Default Skills Applied

- `$enterprise-delivery-defaults`
- `$enterprise-coding-standards`
- `$structured-change-documentation`
- `$spring-boot-react-postgresql-production-gate`
