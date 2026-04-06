# Intra Strategy Library Quick Actions + Duplicate Sync (2026-03-23)

## Change Summary

- **Status:** Complete
- **Scope:** Intra Strategy Library quick-action lifecycle validation and duplicate state-sync fix
- **Area:** React UI (`Intra Strategies`, `Intra Monitor`) + E2E coverage

## Problem And Goal

- Operators reported end-to-end issues to validate Strategy Library quick actions, especially after duplicating a strategy.
- Goal: ensure `Edit`, `Duplicate`, `Archive`, and `Delete` quick actions work end to end in the grid and prevent downstream monitor-state mismatch after duplication.

## Implementation Summary

### Frontend changes

- Updated duplicate flow in `IntraStrategiesPage` to fully sync workspace state after duplicating a strategy:
  - sync `scanInstrumentKey` from duplicated strategy underlying
  - sync `scanTimeframeKey` from duplicated latest version timeframe
  - clear selected/editing execution context to avoid stale monitor state
- Kept existing behavior for edit/archive/delete actions and notifications.

### E2E changes

- Strengthened `E2E-04` in `desktop/e2e/intra-trade.spec.ts` to validate full quick-action lifecycle in Strategy Library:
  - `Edit` loads builder data
  - `Duplicate` creates new library item and shows success feedback
  - `Archive` transitions status to archived
  - `Delete` removes row from library
- Added post-duplicate navigation check to `Intra Monitor` to verify scan instrument/timeframe are correctly aligned with duplicated strategy.
- Added monitor API stubs required by the flow to keep the test deterministic.

## Files And Modules Touched

- `desktop/src/renderer/src/components/intra-trade/IntraStrategiesPage.tsx`
- `desktop/e2e/intra-trade.spec.ts`

## Feature Impact

- New/updated behavior:
  - Duplicating a strategy now updates monitor scan context to the duplicated strategy’s instrument/timeframe.
  - Quick-action E2E coverage now verifies all grid actions and post-duplicate monitor sync.
- Preserved behavior:
  - Existing strategy draft/validate/publish flows are unchanged.
  - Existing library reload and notifications remain intact.

## API And Contract Impact

- No backend API contract changes.
- Existing endpoints reused:
  - `POST /api/v1/admin/intra-strategies/{id}/duplicate`
  - `POST /api/v1/admin/intra-strategies/{id}/archive`
  - `DELETE /api/v1/admin/intra-strategies/{id}`
  - `GET /api/v1/admin/intra-strategies/library`

## Database Impact

- None.

## Validation Performed

- `cd desktop && npm run test:e2e -- intra-trade.spec.ts --grep "E2E-04"`
- `cd desktop && npm run test:e2e -- intra-trade.spec.ts`
- `cd desktop && npm run lint`
- `cd desktop && npm run build`
- `cd backend && mvn -q -Dtest=IntraStrategyServiceTest,IntraTradeServiceTest test`
- `scripts/check-source-token-budget.sh` (fails due pre-existing repository-wide oversized files; no new violation introduced by touched files)

## Risks And Follow-Ups

- Remaining risk is limited to unmocked backend behavior in production-like environments; unit and E2E contracts for this flow are now covered.
- Repo-wide token-budget gate is still failing due existing oversized files outside this change scope.

## Agent Handoff Note

- Start from `IntraStrategiesPage.handleDuplicate` if further strategy-library state sync changes are needed.
- Keep `scanInstrumentKey` and `scanTimeframeKey` aligned whenever strategy payload source changes.
- Do not break quick-action notifications and library reload semantics used by E2E tests.
