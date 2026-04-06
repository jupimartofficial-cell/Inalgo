# Backtest Advance Conditions (2026-03-14)

## Change Summary

- **Status:** Complete
- **Scope:** Add advanced entry/exit conditions to Backtest strategy authoring and run execution
- **Area:** `BacktestPanel` + new advanced-condition editor + `BacktestRunService` + trading analytics repositories/tests

## Problem And Goal

- Backtest strategies only supported time-based entry/exit with strategy-level stop-loss, target, and trailing-stop controls.
- Trading analytics data already existed in `trading_signal` and `trading_day_param`, but users could not express condition-driven entries or exits against those fields.
- Goal:
  - add an `Advance conditions` section between `Backtest` and `Leg Builder`,
  - allow users to build nested `and/or` groups for `Entry` and `Exit`,
  - expose all usable `Trading Signal` and `Trading Param` columns for expression operands,
  - join signal/param values by trade date, instrument, and timeframe during backtest execution,
  - preserve existing strategy save/edit/run flows.

## Implementation Summary

### Backend

- Extended backtest strategy DTO payloads with `advancedConditions`.
- Added `BacktestConditionService` to:
  - normalize persisted advanced-condition payloads,
  - validate group/rule structure, comparator compatibility, and field references,
  - load `Trading Signal` and `Trading Param` rows for the run date range,
  - evaluate entry/exit condition trees at runtime.
- Added backtest-range read queries to:
  - `TradingSignalRepository`
  - `TradingDayParamRepository`
- Updated `BacktestStrategyService` to validate and normalize `advancedConditions` before persistence.
- Updated `BacktestRunService` to:
  - gate trade entry when advanced entry conditions are enabled and false,
  - evaluate advanced exit conditions during checkpoint scanning,
  - record explicit skip notes when entry conditions fail,
  - emit `EXIT_CONDITION` as a run exit reason when advanced exit conditions trigger.

### Frontend

- Added `BacktestAdvancedConditionsEditor` and inserted it between the Backtest form and Leg Builder.
- Implemented:
  - `Basic` / `Advance` toggle,
  - separate `Entry` and `Exit` condition trees,
  - nested group creation,
  - `and/or` joins,
  - timeframe selection per rule,
  - operand selection from `Trading Signal` and `Trading Param` fields,
  - comparator selection,
  - literal or field-to-field comparisons.
- Extended backtest API types so strategies can save, edit, and run with `advancedConditions`.
- Normalized default and loaded strategy state so old strategies remain compatible.

### Tests

- Added `BacktestConditionServiceTest` coverage for:
  - numeric and string condition evaluation,
  - invalid comparator/field validation rejection.
- Updated `BacktestRunServiceTest` wiring for the new condition service dependency.
- Added Playwright e2e coverage to verify:
  - advanced conditions are authored in the UI,
  - strategy save/edit persists the condition tree,
  - run payloads include `advancedConditions`.

## Files And Modules Touched

- `backend/src/main/java/com/inalgo/trade/admin/AdminDtos.java`
- `backend/src/main/java/com/inalgo/trade/admin/BacktestConditionService.java`
- `backend/src/main/java/com/inalgo/trade/admin/BacktestRunService.java`
- `backend/src/main/java/com/inalgo/trade/admin/BacktestStrategyService.java`
- `backend/src/main/java/com/inalgo/trade/repository/TradingDayParamRepository.java`
- `backend/src/main/java/com/inalgo/trade/repository/TradingSignalRepository.java`
- `backend/src/test/java/com/inalgo/trade/admin/BacktestConditionServiceTest.java`
- `backend/src/test/java/com/inalgo/trade/admin/BacktestRunServiceTest.java`
- `desktop/src/renderer/src/api/admin.ts`
- `desktop/src/renderer/src/components/BacktestAdvancedConditionsEditor.tsx`
- `desktop/src/renderer/src/components/BacktestPanel.tsx`
- `desktop/src/renderer/src/App.tsx`
- `desktop/e2e/backtest.spec.ts`
- `README.md`

## Feature Impact

- **New behavior**
  - Backtest strategies can use condition-based `Entry` and `Exit` rules sourced from trading analytics data.
  - Users can combine conditions with nested `and/or` groups.
  - Entry conditions skip trade creation when false; exit conditions can close a running position before the scheduled exit time.
- **Preserved behavior**
  - Existing time-based backtest configuration remains available.
  - Stop-loss, target, and trailing-stop handling remain active.
  - Strategy save/edit/delete flows remain unchanged for strategies that do not use advanced conditions.

## API And Contract Impact

- No endpoint additions or path changes.
- Backtest strategy request/response payloads now optionally include `advancedConditions`.
- Validation contract now rejects:
  - unsupported fields,
  - unsupported comparator/operand combinations,
  - malformed nested groups.

## Database Impact

- No schema or migration changes.
- Advanced-condition trees are stored in the existing backtest strategy JSON payload.

## Validation Performed

### Automated

```bash
cd backend
mvn -Dtest=BacktestRunServiceTest,BacktestConditionServiceTest test
mvn test

cd ../desktop
npm run lint
npm run build
npm run test:e2e -- backtest.spec.ts
npm run test:e2e
```

Results:
- targeted backend tests passed,
- full backend suite passed,
- frontend lint/build passed,
- targeted and full Playwright suites passed.

### Real-Data Validation

- Ran backtest requests against the patched backend on `http://localhost:8082`.
- Verified positive entry execution with string-based condition:
  - `Trading Signal.signal == "SELL"` on `15m`
- Verified negative entry gating:
  - `Trading Signal.signal == "BUY"` on a date where stored signal was `SELL`
  - run returned `executedTrades: 0` with skip note confirming advanced entry conditions blocked the trade
- Verified numeric field-to-field condition:
  - `Trading Signal.currentClose LOWER_THAN Trading Signal.dma9`
- Observed live response metrics including `realWorldAccuracyPct` and fallback trade counts.

## Issues Found And Fixed During Validation

- Initial Playwright flow tried to run immediately after save, but strategy create resets the form and does not keep the saved row selected.
- Fix: update e2e to reopen the saved strategy from `Strategy List` before asserting the run payload.
- Existing backend on `:8081` was stale and did not include the new payload contract.
- Fix: run real-data validation against the patched Spring Boot instance on `:8082`.

## Risks And Rollback

- Advanced conditions depend on available `Trading Signal` and `Trading Param` rows for the selected date/instrument/timeframe. Missing analytics data will prevent a condition from evaluating true.
- Exit-condition evaluation is constrained by the same underlying checkpoint cadence already used by the backtest engine.
- Rollback path:
  - revert the advanced-condition DTO/UI/service changes,
  - strategies without `advancedConditions` remain backward compatible because the field is optional.

## Handoff

- Scope completed: Backtest advanced-condition UI, persistence, validation, runtime evaluation, and regression coverage.
- Decisions made: reused existing strategy JSON persistence; used trading analytics tables as the condition source of truth; kept the feature optional behind `Basic/Advance`.
- Assumptions: analytics rows are tenant-correct and keyed closely enough by date/instrument/timeframe for backtest joins; audit/id columns should not be user-selectable operands.
- Validation run: backend targeted tests, full backend suite, frontend lint/build, targeted e2e, full e2e, and real-data API runs on `:8082`.
- Known limitations: no schema-driven UI grouping of fields by semantic category yet; exit timing is limited by available evaluation checkpoints.
- Next owner / next step: optional UX refinement for operand discovery/search if the field list grows further.

## Default Skills Applied

- `$enterprise-delivery-defaults`
- `$enterprise-coding-standards`
- `$structured-change-documentation`
- `$spring-boot-react-postgresql-production-gate`
