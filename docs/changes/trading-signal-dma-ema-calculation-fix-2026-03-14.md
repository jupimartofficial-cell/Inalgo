# Trading Signal DMA/EMA Calculation Fix (2026-03-14)

## Change Summary

- **Status:** Complete
- **Scope:** Correct DMA (`dma_9`, `dma_26`, `dma_110`) computation in trading-signal refresh.
- **Area:** Backend trading analytics service and integration tests.

## Problem And Goal

- `TradingAnalyticsService.refreshTradingSignal(...)` calculated EMA values from only the latest 110 candles and seeded EMA from the first candle of that truncated slice.
- This underweighted earlier price history and produced lower DMA110 values than chart tools (for example, Bank Nifty 15m DMA110 drifted below expected).
- Goal: align EMA behavior with standard chart EMA logic (chronological series, SMA seed, recursive EMA continuation).

## Implementation Summary

### Backend

- Updated trading-signal refresh to fetch only latest 2 candles for `currentClose` / `previousClose`.
- Added paged ascending candle scan to compute EMA values across the full available candle series.
- Introduced EMA accumulators for 9/26/110 periods that:
  - initialize with SMA of first `period` candles
  - continue with standard EMA multiplier recursion for each subsequent candle
- Returned computed values through an internal `EmaResult` bundle.

### Repository

- Added ascending paged lookup method in `CandleRepository`:
  - `findByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeIntervalOrderByCandleTsAsc(...)`

### Tests

- Updated EMA expectations in `TradingAnalyticsServicePostgresIntegrationTest` to use full-series EMA with SMA seed.
- Added regression test to verify `dma110` depends on historical series beyond the latest 110-bar window.

## Files And Modules Touched

- `backend/src/main/java/com/inalgo/trade/service/TradingAnalyticsService.java`
- `backend/src/main/java/com/inalgo/trade/repository/CandleRepository.java`
- `backend/src/test/java/com/inalgo/trade/service/TradingAnalyticsServicePostgresIntegrationTest.java`

## Feature Impact

- **Changed behavior:** Trading-signal DMA values now follow full-series EMA semantics and should align with chart EMA references more closely.
- **Preserved behavior:** Trading signal upsert keying, tenant scoping, and BUY/SELL/HOLD signal ordering logic remain unchanged.

## API And Contract Impact

- No API endpoint, request, response, or auth-header contract changes.

## Database Impact

- No schema or migration changes for this fix.

## Validation Performed

```bash
cd backend
mvn -Dtest=TradingAnalyticsServicePostgresIntegrationTest test
```

Result:
- Pass (`Tests run: 10, Failures: 0, Errors: 0`)

## Risks And Rollback

- **Risk:** Medium-low. EMA now scans full candle history (paged), increasing read volume for large streams during refresh.
- **Mitigation:** Query is paged (`EMA_PAGE_SIZE=2000`) to bound memory usage.
- **Rollback:** Revert changes in `TradingAnalyticsService`, `CandleRepository`, and related test updates to restore prior truncated EMA behavior.

## Agent Handoff Note

- For future DMA/EMA work, start in `TradingAnalyticsService.refreshTradingSignal(...)` and `computeExponentialAverages(...)`.
- Preserve:
  - tenant-scoped candle queries
  - chronological EMA pass
  - SMA seeding before EMA recursion
- If performance tuning is needed later, optimize with persisted incremental EMA state rather than reducing historical correctness.

## Default Skills Applied

- `$enterprise-delivery-defaults`
- `$enterprise-coding-standards`
- `$structured-change-documentation`
- `$spring-boot-react-postgresql-production-gate`
