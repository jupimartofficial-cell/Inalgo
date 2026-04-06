# Trading Analytics Migration Backfill Job (2026-03-14)

## Change Summary

- **Status:** Complete
- **Scope:** Add migration-job support to backfill `trading_signal` and `trading_day_param` from historical dates through current date for selected instrument/timeframe streams.
- **Area:** Backend migration runtime + trading analytics service + admin migration contracts + migration UI.

## Problem And Goal

- Trading Signal and Trading Param datasets needed a repeatable migration-style backfill path for backtesting datasets, not just trigger-driven single-run refreshes.
- Existing migration jobs handled candle ingestion only and could not represent multiple job families per instrument/timeframe stream.

Goal:
- Add a dedicated migration job type that can be started from the migration job controls for a chosen instrument/timeframe and backfill both analytics tables safely/idempotently.

## Implementation Summary

### Backend

- Added new migration job type: `TRADING_ANALYTICS_BACKFILL`.
- Extended admin migration runtime keying to include job type:
  - job key format now supports `instrument|timeframeUnit|timeframeInterval|jobType`.
  - backward compatibility preserved for legacy 3-part keys (`CANDLE_SYNC` assumed).
- Added analytics-backfill execution path in `AdminMigrationService`:
  - runs `TradingAnalyticsService.backfillTradingAnalytics(...)`.
  - marks runtime job `COMPLETED` at 100% on success.
  - fails with no-data message when no eligible candles exist for the selected range.
- Added trading-analytics range backfill workflow in `TradingAnalyticsService`:
  - computes EMA stream in chronological order across available candle history.
  - upserts one signal row per trade date in requested range for chosen timeframe.
  - refreshes one trading-day-param row per processed trade date.
  - remains idempotent via existing upsert contracts.

### Database

- Added Flyway migration:
  - `V15__add_job_type_to_admin_migration_job.sql`
- Schema updates:
  - `admin_migration_job.job_type` column (default `CANDLE_SYNC`).
  - unique constraint updated to include `job_type`.
  - tenant/status index replaced with tenant/job_type/status index.

### Frontend

- Updated migration job contract to accept `jobType` in `/admin/migrations/jobs` payload.
- Updated runtime job keying to include job type so actions target the right stream.
- Added migration job-type chip in runtime job cards for operator clarity.

## Files And Modules Touched

- `backend/src/main/java/com/inalgo/trade/admin/AdminMigrationService.java`
- `backend/src/main/java/com/inalgo/trade/service/TradingAnalyticsService.java`
- `backend/src/main/java/com/inalgo/trade/admin/AdminDtos.java`
- `backend/src/main/java/com/inalgo/trade/entity/AdminMigrationJobEntity.java`
- `backend/src/main/java/com/inalgo/trade/repository/AdminMigrationJobRepository.java`
- `backend/src/main/java/com/inalgo/trade/repository/CandleRepository.java`
- `backend/src/main/resources/db/migration/V15__add_job_type_to_admin_migration_job.sql`
- `backend/src/test/java/com/inalgo/trade/admin/AdminMigrationServiceTest.java`
- `desktop/src/renderer/src/api/admin.ts`
- `desktop/src/renderer/src/App.tsx`
- `README.md`

## Feature Impact

- New behavior:
  - Migration jobs now include analytics backfill streams in addition to candle sync streams.
  - Operators can run analytics backfill for selected instrument/timeframe from the existing migration controls.
- Preserved behavior:
  - Candle migration state machine and Upstox chunk migration behavior remain unchanged.
  - Existing migration action endpoints (`start/pause/resume/stop`) remain the same.
  - Legacy migration job keys without `jobType` still map to candle sync streams.

## API And Contract Impact

- Updated response shape:
  - `GET /api/v1/admin/migrations/jobs` now includes `jobType` per item.
- Action endpoint path variables now accept 4-part keys:
  - `/api/v1/admin/migrations/{jobKey}/start`
  - `/api/v1/admin/migrations/{jobKey}/pause`
  - `/api/v1/admin/migrations/{jobKey}/resume`
  - `/api/v1/admin/migrations/{jobKey}/stop`
- Backward compatibility:
  - 3-part `jobKey` remains supported and resolves to `CANDLE_SYNC`.

## Validation Performed

```bash
cd backend
mvn -Dtest=AdminMigrationServiceTest,TradingAnalyticsServicePostgresIntegrationTest test
mvn test

cd ../desktop
npm run build
npm run test:e2e
```

Results:
- Backend targeted tests passed.
- Full backend suite passed (`106` tests, `0` failures, `0` errors).
- Frontend build passed.
- Full Playwright suite passed (`24` tests).

## Risks And Rollback

- **Risk:** Migration runtime now seeds additional analytics jobs per instrument/timeframe, increasing runtime-card volume.
- **Risk:** Analytics backfill scans historical candles chronologically for EMA correctness, which can be heavy for large minute datasets.
- **Rollback:**
  1. Revert service/entity/repository/UI changes in this note.
  2. Revert Flyway `V15` via restore-from-backup strategy if schema rollback is required.

## Handoff

- Scope completed:
  - Added production migration job path for Trading Signal + Trading Param historical backfill.
- Decisions made:
  - Reused existing migration controls/endpoints instead of introducing a separate admin endpoint.
  - Added job-type dimension to avoid collisions with candle-sync streams.
- Assumptions:
  - Selected instrument/timeframe streams already have candle history available for meaningful backfill.
- Validation run:
  - Backend targeted and full suite + frontend build + full E2E.
- Known limitations:
  - Analytics backfill currently completes as one run (no mid-run progress checkpoints persisted).
- Next owner / next step:
  - If runtime observability is needed, add phase-level metrics and persisted intermediate progress for analytics backfill.

## Default Skills Applied

- `$enterprise-delivery-defaults`
- `$enterprise-coding-standards`
- `$structured-change-documentation`
- `$spring-boot-react-postgresql-production-gate`
