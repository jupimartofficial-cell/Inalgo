# Intra Monitor Live Conditions + Market-Hours Alignment (2026-03-27)

## Change Summary

- **Status:** Complete
- **Scope:** Fix live/paper intra-monitor condition triggering and validate the Live Monitor workflow end to end
- **Area:** `backend/admin` intraday execution logic, monitor market summary, targeted backend tests, targeted Playwright monitor coverage

## Project Context (Onboarding Summary)

- **Project purpose:** tenant-scoped India-market trading platform for strategy authoring, intraday execution, monitoring, and P&L review.
- **Tech stack:** Spring Boot 3.3 + Java 21 backend, React 18 + TypeScript + Vite frontend, PostgreSQL + Flyway, Playwright E2E.
- **Testing procedure used:** targeted backend tests, backend compile, frontend production build, targeted Playwright intra-monitor and intra-route suites, repo token-budget scan.
- **Certification rules applied:** tenant boundary preservation, controller/service separation, configurable market-hours consistency, live/paper contract alignment, release-risk capture, and validation evidence recording.

## Problem And Goal

- Active live strategies in `Intra Monitor` were not reliably triggering strategy conditions with the intended market-time and scan-timeframe semantics.
- `Live Monitor` runtime cards could stay stale even while the UI polling countdown kept moving, which left `Current signal`, `Freshness`, and `Audit Trail` out of sync with the latest execution state.
- The goal was to restore correct live/paper evaluation behavior, make runtime refresh real-time instead of monitor-only polling, and re-certify the `Live Monitor` route flow end to end.

## Implementation Summary

### Backend

- Fixed intraday advanced-condition evaluation so:
  - `Trading Signal.currentClose` maps to the current completed scan candle.
  - `Trading Signal.previousClose` maps to the immediately previous completed scan candle.
- Aligned `IntraTradeScanWindowResolver` with configured India market hours:
  - configured market open/close are now used instead of hard-coded times
  - configured holidays now block same-day evaluation and defer runs to the next trading day
- Updated `IntraTradeService` to evaluate live/paper scans in the configured market zone and to use the market-hours-aware scan resolver.
- Updated `IntraMonitorMapper` market summary logic to use configured market open/close and zone when computing session status and trend freshness date anchoring.
- Updated `IntraMonitorMapper` runtime signal resolution so the selected runtime uses the latest persisted trading signal for the execution instrument and timeframe before falling back to note parsing, which removes the frequent `UNKNOWN` state in Live Monitor.
- Updated `IntraMonitorService` runtime mapping so freshness is derived from `dataRefreshedAt` at read time instead of surfacing stale persisted counters.
- Updated `IntraMonitorService` snapshot handling so monitor refresh audit events are appended only when the runtime state actually changes, avoiding noisy duplicate refresh rows while still recording real runtime movement.

### Frontend

- Updated the `Intra Monitor` auto-refresh timer to refresh active live executions first and reload the monitor snapshot after that execution refresh completes.
- Kept the existing paper quick-test auto-refresh behavior for actively scanning paper runs so Live Monitor and Quick Test both remain candle-aligned while polling.
- Fixed a `useIntraMonitorController` initialization-order regression that could blank the monitor route before the mode switcher rendered.

### Tests

- Added regression coverage for `currentClose` vs `previousClose` intraday evaluation.
- Added regression coverage for configured-holiday scan blocking.
- Added regression coverage for configured market-open alignment in live/paper scan windows.
- Added regression coverage for runtime signal resolution using the execution timeframe’s latest stored trading signal.
- Re-ran Playwright monitor and route suites after the real-time auto-refresh change to prove the monitor page still loads and polls correctly.

## Files And Modules Touched

- `backend/src/main/java/com/inalgo/trade/admin/BacktestConditionService.java`
- `backend/src/main/java/com/inalgo/trade/admin/IntraTradeScanWindowResolver.java`
- `backend/src/main/java/com/inalgo/trade/admin/IntraTradeService.java`
- `backend/src/main/java/com/inalgo/trade/admin/IntraMonitorMapper.java`
- `backend/src/main/java/com/inalgo/trade/admin/IntraMonitorService.java`
- `backend/src/test/java/com/inalgo/trade/admin/BacktestConditionServiceTest.java`
- `backend/src/test/java/com/inalgo/trade/admin/IntraMonitorMapperTest.java`
- `backend/src/test/java/com/inalgo/trade/admin/IntraTradeServiceTest.java`
- `backend/src/test/java/com/inalgo/trade/admin/IntraTradeScanWindowResolverTest.java`
- `desktop/src/renderer/src/components/intra-trade/useIntraMonitorController.ts`
- `desktop/e2e/intra-trade-monitor.spec.ts`
- `desktop/e2e/intra-trade-routes.spec.ts`

## Validation Performed

- `cd backend && mvn -q -Dtest=BacktestConditionServiceTest,IntraTradeServiceTest,IntraTradeScanWindowResolverTest,IntraMonitorMapperTest test` ✅
- `cd backend && mvn -q -DskipTests compile` ✅
- `cd desktop && npm run build` ✅
- `cd desktop && npx playwright test intra-trade-monitor.spec.ts intra-trade-routes.spec.ts --reporter=line` ✅
- `scripts/check-source-token-budget.sh` ❌
  - repo-level failure remains due to pre-existing oversized source files, including legacy and already-oversized intra/backtest modules outside the bounded fix scope

## Risks And Follow-Ups

- `BacktestConditionService.java` and `IntraTradeService.java` remain above the repo source-file budget and still need modular extraction follow-up.
- Live/paper runtime logic still depends on current-day analytics availability for the selected tenant/instrument/timeframe; missing analytics rows will continue to block condition satisfaction.
- The token-budget scan remains a repo-level merge-readiness gap unrelated to the correctness fix itself.

## Rollback Notes

- Revert the intraday condition-resolution and market-hours alignment changes in the backend admin services and tests.
- No schema or migration rollback is required for this fix.

## Handoff

- Scope completed: fixed intraday condition resolution for live/paper runs, aligned scan windows with configured market hours, restored real-time live execution refresh in the monitor loop, and revalidated the Live Monitor route flow.
- Decisions made: keep the fix in backend execution/monitor services rather than masking it in the React layer; reuse the existing market-hours configuration model already used by triggers/schedulers; derive the current monitor signal from stored trading-signal rows when available instead of inferring it only from execution notes.
- Assumptions: `Trading Signal.previousClose` should represent the previous completed intraday candle during live/paper evaluation rather than reusing the current candle close.
- Validation run: commands listed above.
- Known limitations: repo token-budget violations remain, and analytics freshness still gates whether live conditions can ever evaluate true.
- Next owner / next step: split oversized intraday/backtest service files and, if needed, add one real-stack integration test that exercises live/paper refresh against seeded analytics rows instead of mocked Playwright responses.

## Default Skills Applied

- `$enterprise-delivery-defaults`
- `$enterprise-coding-standards`
- `$structured-change-documentation`
- `$spring-boot-react-postgresql-production-gate`
