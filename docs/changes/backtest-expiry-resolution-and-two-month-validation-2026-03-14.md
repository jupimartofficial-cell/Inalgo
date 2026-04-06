# Backtest Expiry Resolution And Two-Month Validation (2026-03-14)

## Change Summary

- **Status:** Complete
- **Scope:** Backtest expiry resolution and P&L validation hardening
- **Area:** `BacktestRunService` + expired/active option catalog resolution

## Problem And Goal

- Backtest runs were selecting already-expired contracts for near-current trade dates (for example March 11-13 selecting March 10 expiries), which forced synthetic fallback pricing and reduced P&L realism.
- Futures `WEEKLY` legs frequently degraded to underlying fallback because weekly futures contracts do not usually exist.
- Positional exits were calendar-day based, so Friday entries could try to exit on Saturday.

Goal:
- Ensure date-to-expiry resolution matches expected weekly/monthly behavior.
- Improve market-priced execution coverage.
- Validate backtest behavior with real data for at least two months across configuration variants.

## Implementation Summary

### Backend

- `ExpiredInstrumentCatalogService`
  - Added `getOptionExpiries(...)` that merges:
    - expired expiries (`/v2/expired-instruments/expiries`)
    - active option expiries (`/v2/option/contract`)
  - Enhanced option contract lookup fallback:
    - if expired option contract catalog is empty for an expiry, fetch active option contracts and option-chain rows and cache them.

- `BacktestRunService`
  - Split expiry caching for options vs futures and refreshes cached expiries when the trade date moves beyond known range.
  - Option leg history source now switches by expiry age:
    - expired contracts -> expired historical endpoint
    - active contracts -> active historical/intraday path
  - Futures `WEEKLY` contract resolution now falls back to nearest monthly futures expiry when weekly futures contract is unavailable.
  - Positional exit date now skips weekends to next trading day.
  - Leg exit timestamp is now capped at leg expiry cutoff when strategy exit is later than contract expiry.

### Tests

- `ExpiredInstrumentCatalogServiceTest`
  - Added coverage for merged active+expired option expiries.
  - Added coverage for active option fallback when expired option catalog is empty.
- `BacktestRunServiceTest`
  - Added coverage for option-expiry cache refresh across date ranges.
  - Added coverage for weekly futures fallback to monthly futures contracts.
  - Added coverage for positional weekend exit behavior.

## Files And Modules Touched

- `backend/src/main/java/com/inalgo/trade/admin/BacktestRunService.java`
- `backend/src/main/java/com/inalgo/trade/upstox/ExpiredInstrumentCatalogService.java`
- `backend/src/test/java/com/inalgo/trade/admin/BacktestRunServiceTest.java`
- `backend/src/test/java/com/inalgo/trade/upstox/ExpiredInstrumentCatalogServiceTest.java`
- `README.md`

## Feature Impact

- **New behavior**
  - March-dated option backtests now resolve to March weekly/monthly expiries (validated with live data).
  - Weekly futures legs use monthly futures contracts when no weekly futures contract exists.
  - Positional exits no longer attempt Saturday/Sunday exits.
  - Contract-expiry-aware leg exit capping reduces post-expiry synthetic exit usage.

- **Preserved behavior**
  - Backtest API contracts unchanged.
  - Strategy normalization/validation contracts unchanged.
  - Existing stop-loss/target simulation flow unchanged.

## API And Contract Impact

- No REST contract changes.
- No request/response DTO shape changes.

## Database Impact

- No schema or migration changes.
- Existing cache tables (`expired_instrument_expiry_cache`, `expired_derivative_contract_cache`) are reused with richer option catalog population.

## Validation Performed

### Automated

```bash
cd backend
mvn -Dtest=BacktestRunServiceTest,ExpiredInstrumentCatalogServiceTest test
mvn test
```

Results:
- `mvn test` passed.
- Backtest-specific targeted tests passed (with one intentional skip on weekend-dependent current-day intraday test).

### Live backtest validation (real data)

- Runtime: patched backend started on `http://localhost:8082`.
- Tenant: `local-desktop`.
- Date ranges:
  - March spot check: `2026-03-11` to `2026-03-13`
  - Two-month validation: `2026-01-01` to `2026-02-28`

March expiry mapping checks:
- Weekly options: `2026-03-11/12/13 -> 2026-03-17`
- Monthly options: `2026-03-11/12/13 -> 2026-03-30`

Two-month baseline checks:
- Weekly options (intraday): `executedTrades=40`, `realWorldAccuracyPct=100.00`
- Monthly options (intraday): `executedTrades=40`, `realWorldAccuracyPct=100.00`

Full configuration matrix (56 cases over 2 months):
- Dimensions: `strategyType x segment x position x expiryType x optionType x strikeType`
- Summary:
  - `total_cases=56`
  - `zero_trades=0`
  - `low_accuracy(<100)=32`
  - `fallback_cases=32`
- Group-level highlights:
  - `INTRADAY/OPTIONS`: avg accuracy `100.00`
  - `INTRADAY/FUTURES`: avg accuracy `96.25`
  - `POSITIONAL/FUTURES`: avg accuracy `96.05`
  - `POSITIONAL/OPTIONS`: avg accuracy `96.93` (range `96.71` to `97.37`)

## Risks And Follow-Ups

- Remaining fallback-pricing in futures cases is tied to incomplete market-contract candle availability for some dates (especially around weekly-to-monthly mapping and near-expiry transitions).
- Remaining fallback in positional option cases occurs on specific dates where option candle continuity is missing even after weekend-skip and expiry-cap logic.
- Follow-up candidates:
  - Add explicit holiday-calendar-aware exit-date logic (not just weekend skip).
  - Add optional strict mode to skip trades with missing contract candles instead of applying synthetic fallback.
  - Add persisted validation report endpoint for backtest accuracy metrics by run.

## Agent Handoff Note

- Entry points:
  - `BacktestRunService#resolveExpiryDate`, `#resolveFutureContract`, `#determineExitDate`
  - `ExpiredInstrumentCatalogService#getOptionExpiries`, `#getOptionContracts`
- What is complete:
  - Expiry-month/week contract selection correctness for March checks.
  - Two-month real-data validation and matrix coverage.
  - Regressions covered by unit/integration tests.
- What remains:
  - Improve residual fallback-pricing for edge-date contract gaps.
- Do not break:
  - Tenant-scoped data isolation.
  - Backtest DTO contract.
  - Idempotent candle upsert and cache persistence behavior.
