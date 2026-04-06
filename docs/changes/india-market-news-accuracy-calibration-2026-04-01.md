# India Market News Accuracy Calibration (2026-04-01)

## Change Summary
- Status: complete for validated scope
- Scope: `INDIA_NEWS` trend prediction calibration using real Nifty 50 minute candles
- Trigger: user-reported low India news trend accuracy and weak directional capture

## Problem And Goal
- Problem:
  - India news predictions were dominated by `NEUTRAL`/`BEAR` labels and under-represented bullish sessions.
  - Web-search and RSS news inference ran without a direct real-market sanity check.
- Goal:
  - Ground weak India-news predictions in real intraday benchmark movement.
  - Improve directional signal quality using real market data while preserving tenant scoping and existing API contracts.

## Implementation Summary
- Backend:
  - Updated `MarketSentimentService` to calibrate only `INDIA_NEWS` predictions using live `NSE_INDEX|Nifty 50` `minutes/5` candles.
  - Calibration rule:
    - Compute intraday change % from first market-open candle (`09:15 IST`) to latest available candle at snapshot time.
    - If absolute move is below `0.15%`, keep prediction unchanged.
    - If model prediction is `NEUTRAL`, or weak and opposite to benchmark direction, switch to benchmark direction (`BULL`/`BEAR`).
  - Expanded India market momentum keyword scoring to capture common bullish/bearish market-language patterns.
- Tests:
  - Added/updated `MarketSentimentServiceTest` for:
    - bullish India headline classification signal
    - web-search `NEUTRAL` prediction calibration to `BULL` when real candle move is positive

## Files And Modules Touched
- `backend/src/main/java/com/inalgo/trade/service/MarketSentimentService.java`
- `backend/src/test/java/com/inalgo/trade/service/MarketSentimentServiceTest.java`

## Feature Impact
- New behavior:
  - `INDIA_NEWS` trend output now includes a conservative real-data calibration path.
  - Reason text now records when calibration was applied and the benchmark move used.
- Preserved behavior:
  - Non-India scopes (`GLOBAL_NEWS`, technical scopes) are unchanged.
  - Market Watch accuracy endpoint contract is unchanged.
  - Tenant isolation remains unchanged.

## API And Contract Impact
- No endpoint shape change.
- No request parameter or response schema change.
- Semantic update:
  - `market_sentiment_snapshot.trend_status` for `INDIA_NEWS` may be calibrated using same-day Nifty intraday move.

## Database Impact
- No schema or migration changes.
- Read-path enhancement only: uses existing `candles` data for intraday calibration.

## Validation Performed
- Real data baseline checks (PostgreSQL on local tenant `local-desktop`):
  - Verified existing `market_sentiment_snapshot` and Nifty candle coverage.
  - Computed 60-day India-news window accuracy from real DB rows:
    - 5-minute benchmark:
      - `OPEN`: `0.0%` trend accuracy (`4` matched days)
      - `MIDDLE`: `33.3%` trend accuracy (`6` matched days)
      - `CLOSE`: `33.3%` trend accuracy (`3` matched days)
    - 15-minute benchmark:
      - `OPEN`: `25.0%` trend accuracy (`4` matched days)
      - `MIDDLE`: `33.3%` trend accuracy (`6` matched days)
      - `CLOSE`: `33.3%` trend accuracy (`3` matched days)
- Backend tests:
  - `cd backend && mvn -Dtest=MarketSentimentServiceTest,MarketSentimentSnapshotRepositoryIntegrationTest,MarketWatchServiceTest test`
- Token-budget scan:
  - `scripts/check-source-token-budget.sh` still fails due pre-existing oversized files.
  - `MarketSentimentService.java` remains above budget and is a known follow-up refactor candidate.

## Risks And Follow-Ups
- Calibration depends on availability/freshness of `minutes/5` Nifty candles; if missing, service falls back to original prediction.
- If market is choppy near flat levels, calibration intentionally does not override (`< 0.15%` threshold).
- Follow-up recommended:
  - extract market-news scoring/calibration into a dedicated component so `MarketSentimentService.java` meets token-budget constraints.

## Handoff
- Scope completed: India-news real-data calibration and test coverage.
- Decisions made: apply calibration only for `INDIA_NEWS`, only when benchmark move is meaningful, and only on neutral/weak-opposite predictions.
- Assumptions: Nifty 50 intraday direction is the most relevant benchmark for India-news trend labeling in this product.
- Validation run: real DB baseline SQL checks + targeted backend tests.
- Known limitations: historical snapshots are not retroactively recomputed; improvement applies to new refreshes.
- Next owner / next step: restart backend, trigger `/api/v1/admin/market-watch/refresh`, then re-run `/api/v1/admin/market-watch/accuracy` and compare post-change 7-14 day trend metrics.
