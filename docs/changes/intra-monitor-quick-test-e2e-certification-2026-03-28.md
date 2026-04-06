# Intra Monitor Quick Test E2E Certification (2026-03-28)

## Change Summary
- Status: partial (Phase A complete, Phase B scheduled)
- Scope: `Backtest -> Intra Monitor -> Quick Test` certification for market status refresh, saved-strategy filtering, paper setup binding, and paper validation accuracy evidence
- Delivery mode: two-phase certification
  - Phase A: Saturday, March 28, 2026 (closed market)
  - Phase B: Monday, March 30, 2026 IST (open market)

## Project Context (Onboarding Summary)
- Project purpose: multi-tenant India trading platform for data sync, backtesting, intra monitoring, and P&L review.
- Tech stack: Spring Boot 3.3 + Java 21 backend, React 18 + TypeScript + Vite frontend, PostgreSQL + Flyway.
- Testing procedure used for this scope: `npm run lint`, `npm run build`, targeted Playwright E2E, authenticated runtime API checks.
- Certification rules applied: tenant isolation, controller/service boundary integrity, UI/API contract alignment, market-hours awareness, release-readiness evidence, and rollback-ready documentation.

## Problem And Goal
- Problem: Quick Test certification needed to prove five checks with current runtime behavior and real persisted execution evidence.
- Goal: certify default strategy visibility, market summary behavior, paper setup field propagation, and accuracy reporting now (Phase A), then finalize open-market evidence in Phase B.

## Implementation Summary

### Frontend
- Updated Quick Test saved-strategy status filter default from `ALL` to `ACTIVE`.
- Active default now excludes `ARCHIVED` strategies unless explicitly selected.
- Added explicit status options so operators can still switch to `All statuses` or `Archived` when needed.

### E2E Coverage
- Added Playwright coverage to verify:
  - archived strategies are hidden by default in Quick Test,
  - archived strategies appear when status filter is switched to `Archived`.

### Documentation
- Updated Intra Trade feature and test-case docs to record the new default filtering semantics.
- Added this dated certification note with Phase A evidence and Phase B execution checklist.

## Files And Modules Touched
- `desktop/src/renderer/src/components/intra-trade/useIntraMonitorController.ts`
- `desktop/src/renderer/src/components/intra-trade/IntraMonitorQuickTestLayout.tsx`
- `desktop/e2e/intra-trade-monitor.spec.ts`
- `docs/features/intra-trade/feature.md`
- `docs/features/intra-trade/test-cases.md`
- `docs/changes/intra-monitor-quick-test-e2e-certification-2026-03-28.md`

## Feature Impact

### New behavior
- Quick Test `Saved Strategies` list now defaults to active-only rows (`ARCHIVED` hidden initially).
- Operators can still inspect archived strategies via the status filter.

### Preserved behavior
- Quick Test still supports search, paging, and status-based filtering.
- Paper setup and validation-run cards remain unchanged in layout and actions.
- Intra monitor run and refresh contracts are unchanged.

## API And Contract Impact
- No backend API contract changes.
- UI-only filter default change in Quick Test (`ACTIVE` default instead of `ALL`).

## Database Impact
- None.

## Validation Performed

### Frontend static/build checks
- `cd desktop && npm run lint` ✅
- `cd desktop && npm run build` ✅

### Targeted E2E checks
- `cd desktop && npm run test:e2e -- intra-trade-routes.spec.ts intra-trade-monitor.spec.ts` ✅ (6 passed)
- `cd desktop && npm run test:e2e -- intra-trade-monitor.spec.ts -g \"historical backtest\"` ✅ (1 passed)

### Runtime/API certification (Phase A, closed market)
- Auth: `POST /api/v1/admin/login` with tenant `local-desktop` ✅
- `GET /api/v1/admin/intra-trade/monitor/market-summary?username=admin` sampled twice (5s apart):
  - `sessionStatus=Closed`
  - `marketTrend=DOWNTREND`
  - `freshnessSeconds` increased from `19` to `24`
  - stable `refreshedAt=2026-03-28T04:12:14.019080Z`
- `GET /api/v1/admin/intra-strategies/library?username=admin&size=200`:
  - total rows: `10`
  - status mix: `ARCHIVED=6`, `LIVE_READY=4`
  - confirms active-only default materially affects visible strategy set
- `GET /api/v1/admin/intra-trade/executions?username=admin&size=100`:
  - paper/backtest rows: `29`
  - latest runs include scan instrument/timeframe metadata for setup binding checks
- Detailed accuracy evidence from persisted runs:
  - execution `76` (`BACKTEST`): `realWorldAccuracyPct=83.33`, `marketPricedTrades=122`, `fallbackPricedTrades=61`
  - execution `49` (`PAPER`): `realWorldAccuracyPct=100.00`, `marketPricedTrades=1`, `fallbackPricedTrades=0`
- Fresh real-data historical Quick Test execution (Intra Monitor API path):
  - `POST /api/v1/admin/intra-trade/run` with `mode=BACKTEST`, strategy `Simple Breakdown`, scan `NSE_INDEX|Nifty Bank`, timeframe `5 minutes`, window `2026-03-20` to `2026-03-27`
  - persisted execution `80` returned `status=COMPLETED`
  - accuracy: `realWorldAccuracyPct=100.00`, `marketPricedTrades=3`, `fallbackPricedTrades=0`, `rowsCount=3`

### Token-budget gate
- `scripts/check-source-token-budget.sh` ❌ (known pre-existing repo-wide failures, including `desktop/src/renderer/src/App.tsx` and other oversized files)
- Touched files in this change are also above repository limits and require later split work:
  - `desktop/src/renderer/src/components/intra-trade/useIntraMonitorController.ts`
  - `desktop/src/renderer/src/components/intra-trade/IntraMonitorQuickTestLayout.tsx`

## Accuracy Report (Observed Metrics Policy)
- Accuracy is reported from persisted run fields (`result.realWorldAccuracyPct`, `result.marketPricedTrades`, `result.fallbackPricedTrades`) without a hard pass threshold.
- Low-confidence rule used for certification narrative:
  - flag run when `fallbackPricedTrades > 0` or market/session context is stale/closed for live-refresh expectations.
- Phase A findings:
  - Backtest run `76` is low-confidence for pricing purity due to fallback usage (`61` fallback trades).
  - Paper run `49` shows full market-priced accuracy (`100%`, no fallback).

## Risks And Follow-Ups
- Phase B open-market validation is still required to certify live refresh behavior during active session conditions.
- Closed-market Phase A cannot prove `sessionStatus=Open` cadence and real-time paper-entry progression.
- Token-budget maintainability gate remains red due to pre-existing large files.

## Phase B Runbook (Monday, March 30, 2026 IST)
1. Open `Backtest -> Intra Monitor -> Quick Test` during market hours.
2. Keep status filter at default `Active only`; confirm archived rows remain hidden.
3. Select a live-ready strategy; verify paper setup instrument/timeframe controls.
4. Start a fresh `Run Paper Test`.
5. Verify persisted execution row carries selected `scanInstrumentKey`, `scanTimeframeUnit`, `scanTimeframeInterval`.
6. Confirm row appears under `Paper Validation Runs` with matching instrument/timeframe.
7. Capture market summary evidence with `sessionStatus=Open`, trend, and freshness progression.
8. Append final Phase B evidence and final certification status to this change note.

## Handoff
- Scope completed: Quick Test active-only default filter implementation, E2E coverage, Phase A runtime evidence, and certification documentation.
- Decisions made: observed-metric accuracy policy retained; no hard threshold gate.
- Assumptions: open-market Phase B will run on Monday, March 30, 2026 IST with reachable backend/frontend services.
- Known limitations: Phase B evidence pending; token-budget gate remains repo-red.
- Next owner / next step: execute Phase B runbook and update this note with final open-market certification outcome.

## Default Skills Applied
- `$enterprise-delivery-defaults`
- `$enterprise-coding-standards`
- `$structured-change-documentation`
- `$spring-boot-react-postgresql-production-gate`
