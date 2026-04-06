# Backtest Trading Analytics Grids (2026-03-14)

## Change Summary

- **Status:** Complete
- **Scope:** Add Backtest menu sub-sections for trading analytics table visibility
- **Area:** Admin backtest APIs + desktop Backtest UI navigation and grids

## Problem And Goal

- Backtest only exposed `Backtest P&L` and `Strategy List`.
- Operators needed direct UI visibility of `trading_signal` and `trading_day_param` table data for verification and operational review.

Goal:
- Add two Backtest sub-sections:
  - `Trading Param`
  - `Trading Signal`
- Serve both sections from tenant-scoped backend APIs with paginated responses.

## Implementation Summary

### Backend

- Added `BacktestAnalyticsService` for tenant-scoped, paginated reads:
  - `listTradingSignals(...)`
  - `listTradingDayParams(...)`
- Added repository search methods with optional filter support:
  - `TradingSignalRepository#search(...)`
  - `TradingDayParamRepository#search(...)`
- Updated optional-filter query expressions to use `COALESCE(...)` instead of `:param IS NULL OR ...` so PostgreSQL can type nullable parameters correctly in prepared statements.
- Added admin endpoints:
  - `GET /api/v1/admin/backtest/trading-signals`
  - `GET /api/v1/admin/backtest/trading-day-params`
- Added response DTOs:
  - `TradingSignalResponse`
  - `TradingDayParamResponse`

### Frontend

- Extended Backtest subsection state to include:
  - `trading-param`
  - `trading-signal`
- Added two new Backtest sidebar entries in expanded and collapsed modes:
  - `Trading Param`
  - `Trading Signal`
- Added paginated data grids in `BacktestPanel` for both views.
- Added admin API client methods:
  - `fetchTradingSignals(...)`
  - `fetchTradingDayParams(...)`

### Tests

- Added backend unit tests:
  - `BacktestAnalyticsServiceTest`
- Added backend PostgreSQL integration coverage for null optional filters:
  - `BacktestAnalyticsServicePostgresIntegrationTest`
- Added Playwright regression coverage:
  - `Backtest Trading Signal and Trading Param sections render grid data`

## Files And Modules Touched

- `backend/src/main/java/com/inalgo/trade/admin/BacktestAnalyticsService.java`
- `backend/src/main/java/com/inalgo/trade/admin/AdminController.java`
- `backend/src/main/java/com/inalgo/trade/admin/AdminDtos.java`
- `backend/src/main/java/com/inalgo/trade/repository/TradingSignalRepository.java`
- `backend/src/main/java/com/inalgo/trade/repository/TradingDayParamRepository.java`
- `backend/src/test/java/com/inalgo/trade/admin/BacktestAnalyticsServiceTest.java`
- `backend/src/test/java/com/inalgo/trade/TradeBackendApplicationTests.java`
- `desktop/src/renderer/src/App.tsx`
- `desktop/src/renderer/src/components/BacktestPanel.tsx`
- `desktop/src/renderer/src/api/admin.ts`
- `desktop/e2e/backtest.spec.ts`
- `README.md`

## Feature Impact

- **New behavior**
  - Backtest navigation now includes `Trading Param` and `Trading Signal`.
  - Both views render paginated table data from backend analytics tables.
- **Preserved behavior**
  - Existing `Backtest P&L` and `Strategy List` flows remain unchanged.
  - Backtest strategy create/edit/delete and run contracts remain unchanged.

## API And Contract Impact

- Added tenant-authenticated admin read APIs:
  - `GET /api/v1/admin/backtest/trading-signals`
    - filters: `instrumentKey`, `timeframeUnit`, `timeframeInterval`, `fromDate`, `toDate`, `page`, `size`
  - `GET /api/v1/admin/backtest/trading-day-params`
    - filters: `instrumentKey`, `fromDate`, `toDate`, `page`, `size`
- No breaking contract changes to existing backtest APIs.

## Database Impact

- No schema or migration changes.
- Existing `trading_signal` and `trading_day_param` tables are read via paginated repository queries.

## Validation Performed

```bash
cd backend
mvn -Dtest=BacktestAnalyticsServiceTest,TradeBackendApplicationTests test
mvn test

cd ../desktop
npm run lint
npm run build
npm run test:e2e -- backtest.spec.ts
npm run test:e2e
```

Results:
- backend targeted tests passed
- backend full suite passed
- frontend type-check/build passed
- backtest e2e passed
- full Playwright suite passed

## Risks And Follow-Ups

- Grid queries currently rely on default page sizes; if table volume grows further, add explicit UI filters for instrument/date/timeframe for faster narrowing.
- No export/download flow was added in this scope.

## Agent Handoff Note

- Entry points:
  - `BacktestAnalyticsService` for query shaping and tenant validation
  - `App.tsx` Backtest sidebar subsection handling
  - `BacktestPanel.tsx` analytics grid rendering and pagination
- What is done:
  - new Backtest submenus and data grids are implemented and validated
- What remains:
  - optional UX enhancements (advanced filters/export) if requested
- Do not break:
  - tenant header + admin token enforcement
  - existing Backtest strategy/P&L contracts

## Default Skills Applied

- `$enterprise-delivery-defaults`
- `$enterprise-coding-standards`
- `$structured-change-documentation`
- `$spring-boot-react-postgresql-production-gate`
