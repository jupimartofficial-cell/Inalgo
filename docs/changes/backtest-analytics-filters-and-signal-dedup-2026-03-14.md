# Backtest Analytics Filters And Trading Signal De-dup (2026-03-14)

## Change Summary

- **Status:** Complete
- **Scope:** Add Trading Param/Trading Signal filters and prevent duplicate logical trading-signal rows for the same day.
- **Area:** Backtest analytics API + desktop Backtest UI + trading-signal persistence hardening.

## Problem And Goal

- Operators needed filter controls in the `Trading Param` and `Trading Signal` grids to inspect records by index, timeframe, signal, and trade date quickly.
- `trading_signal` rows should be unique per tenant/day/key tuple (`signal_date`, `instrument_key`, `timeframe`), but duplicate logical rows were observed.

Goal:
- Add practical grid filters in both views.
- Harden persistence so logically equivalent signal keys do not create duplicate rows.

## Implementation Summary

### Backend

- Extended `GET /api/v1/admin/backtest/trading-signals` with optional `signal` filter.
- Wired `signal` filtering through:
  - `AdminController#backtestTradingSignals(...)`
  - `BacktestAnalyticsService#listTradingSignals(...)`
  - `TradingSignalRepository#search(...)`
- Added strict signal-filter validation in service (`BUY`/`SELL`/`HOLD` only).
- Hardened trading-signal refresh key normalization:
  - validates/canonicalizes timeframe via `SupportedTimeframe.requireSupported(...)`
  - trims instrument key before candle lookup/upsert

### Database

- Added Flyway migration:
  - `V14__dedupe_and_canonicalize_trading_signal.sql`
- Migration behavior:
  - removes duplicate logical rows (partitioned by normalized tenant/index/timeframe/date key)
  - canonicalizes stored `instrument_key` (trim) and `timeframe_unit` (lowercase trimmed)
  - adds check constraints to enforce canonical format for future writes
  - reasserts unique index existence on tenant/index/timeframe/date tuple

### Frontend

- Added filter toolbars in `BacktestPanel`:
  - `Trading Signal`: index, timeframe, signal, from date, to date + Apply/Reset
  - `Trading Param`: index, from date, to date + Apply/Reset
- Updated API client contract:
  - `fetchTradingSignals(...)` now supports optional `signal` query param.

## API And Contract Impact

- Updated endpoint:
  - `GET /api/v1/admin/backtest/trading-signals`
- New optional query param:
  - `signal` (`BUY` | `SELL` | `HOLD`)
- Existing filters (`instrumentKey`, `timeframeUnit`, `timeframeInterval`, `fromDate`, `toDate`, `page`, `size`) remain unchanged.

## Validation Performed

```bash
cd backend
mvn -Dtest=BacktestAnalyticsServiceTest,BacktestAnalyticsServicePostgresIntegrationTest,TradingAnalyticsServicePostgresIntegrationTest test

cd ../desktop
npm run build
npm run test:e2e -- e2e/backtest.spec.ts
```

Results:
- Backend targeted tests passed.
- Frontend build passed.
- Backtest E2E suite (3 tests) passed, including the updated Trading Signal/Trading Param filter assertions.

## Risks And Rollback

- **Risk:** Low to medium. Migration modifies existing `trading_signal` rows to canonical form and deletes duplicate logical rows while preserving the latest record.
- **Rollback:**
  1. Revert code changes in controller/service/repository/UI.
  2. For DB rollback, restore from pre-migration backup if historical duplicate rows must be recovered exactly.

## Handoff

- Scope completed:
  - Signal API filter, UI filters in both grids, duplicate-prevention hardening, migration-based dedupe.
- Decisions made:
  - Kept day-param API contract unchanged; applied filters only where schema supports them.
  - Enforced canonical trading-signal key formatting at both service and DB levels.
- Assumptions:
  - Existing trigger/jobs use supported timeframe combinations.
- Validation run:
  - backend targeted tests + frontend build + backtest e2e.
- Known limitations:
  - Trading Param table has no timeframe column; timeframe filtering was not added there by design.
- Next owner / next step:
  - Optional: add server-provided facet APIs for dynamic filter option lists if operator catalog expands.

## Default Skills Applied

- `$enterprise-delivery-defaults`
- `$enterprise-coding-standards`
- `$structured-change-documentation`
- `$spring-boot-react-postgresql-production-gate`
