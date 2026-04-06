# Intra Monitor + Intra P&L Foundation (2026-03-23)

## Change Summary

- **Status:** Implemented (phase foundation + monitor + pnl modules)
- **Scope:** Runtime monitor and analytics split for route-based Intra Trade workspace
- **Area:** `backend/admin` services + intra routes + frontend intra monitor/pnl pages

## Project Context (Onboarding Summary)

- **Project purpose:** tenant-scoped India-market trading platform for data sync, strategy execution, runtime monitoring, and performance analysis.
- **Tech stack:** Spring Boot 3.3 / Java 21 backend, React 18 + TypeScript + Vite frontend, PostgreSQL + Flyway migrations, Playwright E2E.
- **Validation procedure used:** backend compile + targeted backend tests (`IntraTradeServiceTest`, `IntraStrategyValidationEngineTest`), frontend production build, targeted Playwright intra route suite, token-budget gate scan.
- **Certification rules applied:** tenant boundary enforcement (`X-Tenant-Id`), controller/service/repository separation, live-action guardrails for destructive operations, release-risk and rollback documentation, and source-budget review.

## Problem And Goal

- The existing Intra route split still required stronger runtime observability and safer manual intervention for live operations.
- Users needed one screen to answer: what is running, what positions are open, what is current P&L, and whether intervention is required.
- Users also needed one clean P&L surface across Paper and Live, including exports.

## Implementation Details

### Backend

- Added `IntraMonitorService` and `IntraMonitorController` under `/api/v1/admin/intra-trade/monitor`.
- Added `IntraPnlService` and `IntraPnlController` under `/api/v1/admin/intra-trade/pnl`.
- Added persistence foundation migration:
  - `intra_runtime_strategy`
  - `intra_position_snapshot`
  - `intra_event_audit` (append-only intervention/events)
  - `intra_pnl_daily`
- Extended `intra_trade_execution` with `exit_reason` and `account_ref` for analytics/filter and legacy mapping.
- Wired `IntraTradeController` run/refresh/update/exit/delete actions to refresh monitor and P&L snapshots.
- Enforced live destructive-action payload checks (`confirmLiveAction`, `CONFIRM LIVE`, `reason`) before runtime/position mutation.
- Implemented P&L exports for `CSV`, `XLSX`, and summary `PDF`.

### Frontend

- Added API clients and DTO modules:
  - `intraMonitor.ts` / `intraMonitor.types.ts`
  - `intraPnlAnalytics.ts` / `intraPnlAnalytics.types.ts`
- Replaced `IntraMonitorPage` with monitor-focused layout:
  - market summary strip with freshness/stale signal
  - running runtime table with pause/resume/exit/partial actions
  - active position table with exit/partial/manual-watch actions
  - emergency action panel
  - event/signal timeline
  - live-action confirmation prompts and audit reasons
- Replaced `IntraPnlPage` with single-view analytics:
  - summary cards
  - mode/date/strategy/instrument/account/status filters
  - daily and cumulative trend blocks
  - strategy performance and trade ledger tables
  - CSV/XLSX/PDF export actions

## Contract Impact

- New monitor endpoints and intervention contract payloads (including live guardrail fields).
- New P&L dashboard and export endpoints.
- Existing intra execution endpoints retained and enhanced by monitor/pnl sync side effects.

## Migration And Compatibility Notes

- Legacy `intra_trade_execution` rows are backfilled for `exit_reason` and `account_ref` where possible.
- Unknown legacy values are labeled as `unknown` for explicit downstream handling.
- Existing route split (`/intra/strategies`, `/intra/monitor`, `/intra/pnl`) remains intact.

## Validation Results

- `cd backend && mvn -q -DskipTests compile` ✅
- `cd backend && mvn -q -Dtest=IntraTradeServiceTest,IntraStrategyValidationEngineTest test` ✅
- `cd desktop && npm run build` ✅
- `cd desktop && npm run test:e2e -- intra-trade.spec.ts` ❌
  - timed out waiting for a hardcoded seeded strategy row in the existing test fixture; test stubs need alignment with the current intra-strategy library contract.
- `scripts/check-source-token-budget.sh` ❌
  - repo has pre-existing oversized files; this change also touches oversized monitor/pnl module files that need follow-up modularization.

## Risks And Follow-Ups

- **Token-budget compliance:** `IntraMonitorService`, `IntraPnlService`, and `IntraMonitorPage` exceed file-budget limits and should be split by responsibility.
- **E2E fixture drift:** `desktop/e2e/intra-trade.spec.ts` still assumes older seeded behavior and should be updated to mock the new intra-strategy library + monitor/pnl APIs.
- **Live authority scope:** live controls are runtime-state authoritative in app scope; broker lifecycle remains best-effort integration.
- **Real-time transport:** polling is implemented; WebSocket push remains future extension.

## Rollback Notes

- Feature can be rolled back by reverting frontend intra monitor/pnl page wiring and backend monitor/pnl controllers/services.
- DB rollback requires explicit reverse migration for V22 objects if full revert is required.

## Default Skills Applied

- `$enterprise-delivery-defaults`
- `$enterprise-coding-standards`
- `$structured-change-documentation`
- `$spring-boot-react-postgresql-production-gate`
