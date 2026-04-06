# Intraday Leg Conditions Validation (2026-03-22)

## Change Summary

- **Status:** Complete with external-data blocker noted
- **Scope:** Real-data intraday/backtest validation, leg-condition runtime fix, and two-month P&L verification
- **Area:** `BacktestRunService`, `BacktestConditionService`, `Intra Trade` / `Backtest` execution flow

## Problem And Goal

- The user requested an end-to-end validation of intraday entry/exit behavior, leg conditions, and recent trading outcomes using real repository data instead of synthetic test-case scripts.
- Validation uncovered a concrete production bug:
  - per-leg `legConditions` configured in the UI and persisted in strategy JSON were ignored by the backend run engine
- Goal:
  - enforce leg-level entry and exit conditions during backtest and intraday execution
  - re-run recent intraday strategies over the last two months of stored market data
  - record P&L, pricing accuracy, and remaining blockers

## Implementation Summary

### Backend

- Added an overload in `BacktestConditionService` so the engine can build evaluation contexts for strategy-level conditions and per-leg conditions independently.
- Updated `BacktestRunService` to:
  - prepare a condition context for each leg
  - skip legs whose leg-entry filters fail on the trade date
  - resolve early leg exits from leg-exit filters
  - surface explicit notes when a leg is skipped or closed by its own filter
  - propagate full-position early exit notes when every active leg exits through leg filters before the strategy exit time
- Added `PreparedLegExit` / `LEG_EXIT_CONDITION` runtime support in `BacktestRunModels`.

### Tests

- Added targeted `BacktestRunServiceTest` coverage for:
  - skipping a filtered leg while still trading the remaining leg
  - closing a leg on the earliest eligible checkpoint when a leg-exit filter is true
- Re-ran:
  - `mvn -Dtest=BacktestRunServiceTest,IntraTradeServiceTest,BacktestConditionServiceTest test`

### Documentation

- Updated `README.md` to document that per-leg filters are now enforced during execution.
- Added this change note with validation evidence and handoff context.

## Files And Modules Touched

- `backend/src/main/java/com/inalgo/trade/admin/BacktestConditionService.java`
- `backend/src/main/java/com/inalgo/trade/admin/BacktestRunService.java`
- `backend/src/main/java/com/inalgo/trade/admin/BacktestRunModels.java`
- `backend/src/test/java/com/inalgo/trade/admin/BacktestRunServiceTest.java`
- `README.md`

## Feature Impact

- New behavior:
  - per-leg entry filters now suppress only the legs whose conditions fail instead of being ignored
  - per-leg exit filters can close a leg before the strategy-level scheduled exit
  - intraday/backtest notes now explain when a leg was skipped or exited by its own filter
- Preserved behavior:
  - strategy-level advanced entry/exit conditions still gate the overall trade date
  - overall stop-loss, target, and trailing-stop logic remains in place
  - Intra Trade `BACKTEST` mode still reuses the same backtest engine and now benefits from the leg-condition fix automatically

## Validation Performed

### Onboarding Summary

- **Project purpose:** multi-tenant trade platform for Indian index data sync, backtesting, market analytics, and intraday execution workflows
- **Tech stack:** Spring Boot 3.3 / Java 21 backend, React 18 / TypeScript / Vite frontend, PostgreSQL 16+ with Flyway, local runtime on `http://localhost:8081`
- **Testing procedure:** backend targeted Maven tests, direct authenticated admin API runs, PostgreSQL data inspection, repo token-budget scan
- **Certification rules:** follow tenant isolation, idempotent sync behavior, validation + manual verification gates, release-readiness notes, and source-file token-budget review from repo enterprise docs

### Commands Run

- `cd backend && mvn -Dtest=BacktestRunServiceTest,IntraTradeServiceTest,BacktestConditionServiceTest test`
- `scripts/check-source-token-budget.sh`
- direct API validation on the running backend:
  - `POST /api/v1/admin/backtest/run`
  - `POST /api/v1/admin/intra-trade/run`

### Real-Data Validation Findings

- Baseline strategy `Test SELL` over the saved March range still returned:
  - `executedTrades=3`
  - `totalPnl=32728.50`
  - `realWorldAccuracyPct=100.00`
- Reproduction of the bug before the fix:
  - a probe strategy with a second leg gated by an impossible leg-entry condition still produced `firstRowLegCount=2`
  - P&L doubled from `32728.50` to `65457.00`
- After the fix:
  - the same probe strategy produced `firstRowLegCount=1`
  - P&L returned to `32728.50`
  - notes included leg-specific skip messages such as `Skipped leg-2 on 2026-03-04 because leg entry conditions were not met`
- Leg-exit probe after the fix:
  - first row exited at `2026-03-02T04:06:00Z` (`09:36` IST)
  - notes included `leg exit condition hit` and `Advance exit condition hit`

### Two-Month P&L And Accuracy (`2026-01-22` through `2026-03-20`)

- Strategy `test`
  - `executedTrades=40`
  - `totalPnl=-104250.00`
  - `realWorldAccuracyPct=100.00`
  - `marketPricedTrades=40`
  - `fallbackPricedTrades=0`
- Strategy `Live UI Risk Controls 2026-03-14-1943`
  - `executedTrades=40`
  - `totalPnl=-9304.85`
  - `realWorldAccuracyPct=93.75`
  - `marketPricedTrades=35`
  - `fallbackPricedTrades=5`
- Strategy `Test SELL`
  - `executedTrades=4`
  - `totalPnl=43063.50`
  - `realWorldAccuracyPct=100.00`
  - `marketPricedTrades=4`
  - `fallbackPricedTrades=0`
- `Intra Trade` `BACKTEST` run for strategy `Test SELL`
  - `status=COMPLETED`
  - `totalPnl=43063.50`
  - `executedTrades=4`
  - `realWorldAccuracyPct=100.00`

### Day-Trend Evidence

- Confirmed `Trading Signal` rows for `NSE_INDEX|Nifty Bank` on executed dates:
  - `2026-03-04`: `15m=SELL`, `60m=SELL`
  - `2026-03-06`: `5m=SELL`, `15m=SELL`, `60m=SELL`
  - `2026-03-11`: `5m=SELL`, `15m=SELL`, `60m=SELL`
- Confirmed `Trading Day Param` rows on the same dates still reflected day state such as `orb_breakdown=Yes` on `2026-03-06` and `2026-03-11`
- Inference:
  - the saved `Test SELL` strategy’s entry logic is correctly aligning with recent bearish day-trend analytics from stored tenant data

## Risks And Follow-Ups

- **Credential blocker:** recent derivative candle sync attempts for some option instruments fail with `401 UNAUTHORIZED` from Upstox (`UDAPI100050`). This is an environment/data issue, not a code bug in this patch. A fresh tenant Upstox token is required to eliminate those sync-failure notes and recover full real-time derivative coverage.
- **Market-closed limitation:** direct open-market `LIVE` / `PAPER` entry-exit execution could not be validated on Sunday, **March 22, 2026**. The current runtime correctly returns `WAITING_ENTRY` with `Live scan is waiting for the next trading day`.
- **Historical data gap:** `NSE_INDEX|Nifty Bank` minute candles are absent locally for **March 3, 2026**, so strategies without entry filters may skip that date due to missing underlying candles.
- **Token-budget gate:** touched files `BacktestRunService.java`, `BacktestConditionService.java`, and `BacktestRunServiceTest.java` remain above the repository token-budget standard. This was already true before the fix; a follow-up extraction/refactor is still recommended.

## Handoff

- Scope completed: reproduced the leg-condition production bug, fixed it in the backend engine, added regression coverage, and validated two months of real stored market data.
- Decisions made: enforced leg filters at execution time without changing the saved strategy contract or UI payload shape.
- Assumptions: strategy-level advanced conditions remain the top-level trade-date gate; leg filters refine individual leg participation and early exit timing.
- Validation run: targeted Maven tests, direct API runs, and PostgreSQL inspection against tenant `local-desktop`.
- Known limitations: no new Upstox credential was available, so `401` sync failures remain for some derivative refresh attempts.
- Next owner / next step: refresh the tenant Upstox token, re-run the two-month matrix, and split oversized backtest engine files to satisfy the source-budget standard.

## Default Skills Applied

- `$enterprise-delivery-defaults`
- `$enterprise-coding-standards`
- `$structured-change-documentation`
- `$spring-boot-react-postgresql-production-gate`
