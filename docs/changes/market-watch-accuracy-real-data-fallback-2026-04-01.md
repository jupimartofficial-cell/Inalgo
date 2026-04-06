# Market Watch Accuracy Real-Data Fallback (2026-04-01)

## Change Summary
- Status: complete for validated scope
- Scope: Market Watch Accuracy backend trend-matching logic, UI sparse-data notice copy, and integration coverage
- Trigger: Accuracy tab showed only `1` matched day despite recent real-time minute candles being present

## Problem And Goal
- Problem: Accuracy matching used only `days/1` candles, so recent sessions with only real-time `minutes/1` coverage were excluded from trend validation.
- Goal: Keep trend accuracy aligned with live market data by deriving per-day close from minute candles when daily candles are not yet available.

## Implementation Summary
- Backend:
  - Updated `computeDailyAccuracy` to build benchmark closes from:
    - daily candle close when available
    - otherwise latest `minutes/1` close for that trade date
  - Preserved existing precedence for `days/1` candles to avoid changing behavior where daily data is already present.
- Frontend:
  - Updated sparse-data notice text to avoid hard-coding "holiday/weekend" as the reason for unmatched days.
  - New message now indicates unmatched snapshot days currently have no benchmark candle match.
- Tests:
  - Added repository integration test validating minute fallback when daily candles are missing.

## Files And Modules Touched
- `backend/src/main/java/com/inalgo/trade/repository/MarketSentimentSnapshotRepository.java`
- `backend/src/test/java/com/inalgo/trade/repository/MarketSentimentSnapshotRepositoryIntegrationTest.java`
- `desktop/src/renderer/src/components/market-watch/MarketWatchAccuracyPanel.tsx`

## Feature Impact
- New behavior:
  - Accuracy matching now considers minute-derived daily closes when `days/1` candles are missing.
  - Matched-day count reflects recent real-time sessions more accurately.
- Preserved behavior:
  - Daily candles remain the preferred benchmark source.
  - Trend direction derivation (`BULL` / `BEAR` / `NEUTRAL`) remains unchanged.

## API And Contract Impact
- No endpoint shape changes.
- `GET /api/v1/admin/market-watch/accuracy` response schema is unchanged.
- Semantics change: `totalDays` now includes dates matched through minute fallback when daily benchmark candles are missing.

## Database Impact
- No schema or migration changes.
- Read-path only: query logic now reads both `days/1` and `minutes/1` candles for benchmark close construction.

## Validation Performed
- Backend tests:
  - `cd backend && mvn -Dtest=MarketSentimentSnapshotRepositoryIntegrationTest,MarketWatchServiceTest test`
- Frontend build:
  - `cd desktop && npm run build`
- Live-data validation against local running services (tenant `local-desktop`):
  - `POST /api/v1/admin/login`
  - `GET /api/v1/admin/market-watch/accuracy?lookbackDays=90`
  - DB comparison query confirmed matched-day improvement from `1` to `5` for both `INDIA_NEWS` and `GLOBAL_NEWS` when minute fallback is applied.
- Token-budget scan:
  - `scripts/check-source-token-budget.sh` (fails due pre-existing oversized files outside this scoped change)

## Risks And Follow-Ups
- Accuracy still depends on availability of either `days/1` or `minutes/1` Nifty candles; if both are missing, unmatched days remain expected.
- Running backend process must be restarted/redeployed to expose this logic in the live endpoint.
- Repository token-budget gate remains globally failing due unrelated legacy oversized files.

## Handoff
- Scope completed: minute-candle fallback for Market Watch Accuracy benchmark matching + sparse-data copy update + integration test.
- Decisions made: prefer `days/1` close, fallback to latest `minutes/1` close by trade date.
- Assumptions: minute candle latest close is an acceptable day-close proxy when daily rows lag.
- Validation run: targeted backend tests, frontend build, and live DB/API verification.
- Known limitations: existing running backend instance must be restarted to serve new accuracy semantics.
- Next owner / next step: restart backend, open Market Watch Accuracy tab, click `Run`, verify matched-day count increases on current tenant data.
