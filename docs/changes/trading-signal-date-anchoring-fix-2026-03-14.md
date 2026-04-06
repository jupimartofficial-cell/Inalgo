# Trading Signal Date Anchoring Fix (2026-03-14)

## Change Summary

- **Status:** Complete
- **Scope:** Correct `trading_signal.signal_date` assignment so rows represent the candle trade date.
- **Area:** Backend trading analytics service + integration tests.

## Problem

- `TradingAnalyticsService.refreshTradingSignal(...)` used `LocalDate.now(Asia/Kolkata)` for `signalDate`.
- On non-trading days (weekends/holidays), refresh runs created new rows for "today" with stale values from the latest previous trading session.
- Result: duplicate values across adjacent dates in the Trading Signal grid.

## Fix

- Updated signal date derivation to use the latest candle timestamp in market timezone:
  - `signalDate = latestCandleTs.atZone(Asia/Kolkata).toLocalDate()`
- Added integration test to guarantee the persisted `signalDate` follows the latest candle trade date.

## Validation

### Local Calculation Validation

- Recomputed `Prev Close`, `Current Close`, `DMA 9`, `DMA 26`, `DMA 110` from the same candle set used by backend API.
- Verified all four rows (`Nifty 50`/`Nifty Bank` × `15m`/`60m`) match service output exactly.

### Internet Cross-Check

- Compared local close values with Yahoo Finance intraday index feed (`query2.finance.yahoo.com`) for `2026-03-13`.
- Observed alignment at `15:15 IST`:
  - Nifty 50: `23170.900390625` (~`23170.90`)
  - Nifty Bank: `53770.8984375` (~`53770.90`)

### Automated Tests

```bash
cd backend
mvn -Dtest=TradingAnalyticsServicePostgresIntegrationTest test

cd ../desktop
npm run test:e2e -- e2e/backtest.spec.ts
```

Results:
- Backend integration tests passed (including new signal-date regression test).
- Backtest E2E passed, including Trading Signal grid rendering scenario.

## Risk And Rollback

- **Risk:** Low. Change is limited to date selection for persistence keying.
- **Rollback:** Revert `TradingAnalyticsService` change and remove regression test if needed.

## Files Touched

- `backend/src/main/java/com/inalgo/trade/service/TradingAnalyticsService.java`
- `backend/src/test/java/com/inalgo/trade/service/TradingAnalyticsServicePostgresIntegrationTest.java`

## Default Skills Applied

- `$enterprise-delivery-defaults`
- `$enterprise-coding-standards`
- `$structured-change-documentation`
- `$spring-boot-react-postgresql-production-gate`
