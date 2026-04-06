# Intra P&L Trader UX + Real-Data Certification Workflow (2026-03-28)

## Change Summary
- Status: complete for requested implementation scope
- Scope: `Backtest -> Intra P&L` UX optimization, maintainability refactor, and non-mocked real-data certification workflow scaffolding
- Area: React Intra P&L screen, Playwright E2E workflows, delivery evidence

## Problem And Goal
- Problem:
  - `IntraPnlPage` was monolithic and above maintainability budget before this change.
  - Trader-facing status observability and quick risk cues were not consolidated in one strip.
  - There was no dedicated real-data E2E certification flow for `Backtest -> Intra Monitor -> Intra P&L` with structured artifacts.
- Goal:
  - Improve trader readability and section usefulness without changing backend contracts.
  - Split the P&L screen into focused UI modules.
  - Add a reusable real-data certification workflow with JSON evidence and screenshots.

## Implementation Summary

### Frontend
- Refactored `IntraPnlPage` into an orchestrator plus focused P&L modules under `components/intra-trade/pnl/`:
  - section header with keyboard-accessible collapse control,
  - filters card with compact presets and export actions,
  - summary card with fixed drawdown risk styling,
  - chart card with scale guidance and actionable empty states,
  - strategy performance card with top/bottom P&L emphasis and sorting,
  - trade ledger card with Date/Time/P&L sorting and sticky header,
  - Upstox tab module with existing sync contract retained.
- Added trader-focused status strip:
  - active filter chips,
  - last dashboard refresh timestamp,
  - risk cue (`OPEN` exposure count + unrealized P&L sign).
- Added trader-focused filters refinements inside `Filters`:
  - quick preset row (`Today`, `Week`, `Month`, `Custom`),
  - explicit active-filter chips row for the currently applied filter context.
- Replaced custom button tab strip with accessible MUI `Tabs`/`Tab` semantics.
- Added stable `data-testid` hooks for key P&L controls and sections used by E2E.

### E2E
- Added `desktop/e2e/intra-pnl-ui.spec.ts`:
  - verifies status strip, quick presets, active-filter chips, collapse/expand behavior, ledger sort interaction, and Upstox tab rendering in mocked flow.
- Added `desktop/e2e/intra-trade-real-data-certification.spec.ts`:
  - non-mocked workflow with env-driven tenant/user/strategy/date range,
  - validates login -> monitor historical run -> P&L navigation -> CSV export -> Upstox tab render,
  - emits `certification-report.json` plus monitor/P&L screenshots into artifact directory,
  - records open/closed market branch from monitor UI.
  - hardened to support UI label variants (`Market Open`/`MARKET OPEN`, etc.) and non-empty Upstox render outcomes.
- Added npm script:
  - `npm run test:e2e:intra-real-data`

### Backend / Database
- No backend API or schema changes in this task.

## Files And Modules Touched
- `desktop/src/renderer/src/components/intra-trade/IntraPnlPage.tsx`
- `desktop/src/renderer/src/components/intra-trade/pnl/*` (new modular P&L components)
- `desktop/e2e/intra-pnl-ui.spec.ts`
- `desktop/e2e/intra-trade-real-data-certification.spec.ts`
- `desktop/package.json`
- `docs/changes/intra-pnl-trader-ux-and-real-data-certification-2026-03-28.md`

## Feature Impact

### New behavior
- Intra P&L now shows a consolidated trader status strip with active filter and exposure context.
- Trade ledger supports explicit sorting for `Date/Time` and `P&L`.
- Strategy performance rows highlight top/bottom P&L strategies by default.
- Real-data certification workflow can be run as a dedicated E2E lane with artifact output.

### Preserved behavior
- Existing dashboard and export API contracts remain unchanged:
  - `/api/v1/admin/intra-trade/pnl/dashboard`
  - `/api/v1/admin/intra-trade/pnl/export`
  - `/api/v1/admin/intra-trade/upstox/positions`
  - `/api/v1/admin/intra-trade/upstox/orders`
- Existing monitor and backtest flows remain untouched in implementation.

## API And Contract Impact
- Backend contract impact: none.
- Frontend contract impact:
  - no DTO shape changes,
  - additional `data-testid` attributes for deterministic test selectors.

## Database Impact
- None.

## Validation Performed
- `cd desktop && npm run lint` ✅
- `cd desktop && npm run build` ✅
- `cd desktop && npm run test:e2e -- e2e/intra-pnl-ui.spec.ts` ✅
- `cd desktop && npm run test:e2e -- e2e/intra-trade-routes.spec.ts` ✅
- `cd desktop && npm run test:e2e -- e2e/intra-trade-monitor.spec.ts` ✅
- `cd desktop && npm run test:e2e:intra-real-data` ✅ (executed with `REAL_DATA_E2E=1` and local stack)
- `scripts/check-source-token-budget.sh` ❌
  - repo-level failure remains due pre-existing oversized files.
  - touched files in this change are within budget.

## Risks And Follow-Ups
- Real-data certification script requires reachable local stack and valid credentials/data; it is intentionally opt-in (`REAL_DATA_E2E=1`).
- Open-market branch evidence for Monday, March 30, 2026 IST still depends on runtime market conditions and available strategy data at execution time.
- Existing unrelated oversized files continue to block full repo token-budget pass.

## Agent Handoff Note
- Done:
  - P&L UI refactor, trader-status strip, section usability updates, and real-data E2E scaffolding.
- Remains:
  - execute the real-data certification lane with live credentials/data and archive produced artifacts.
- Continue from:
  - `desktop/src/renderer/src/components/intra-trade/IntraPnlPage.tsx`
  - `desktop/e2e/intra-trade-real-data-certification.spec.ts`
- Do not break:
  - existing dashboard/export request query contract and Upstox tab endpoint usage.

## Default Skills Applied
- `$enterprise-delivery-defaults`
- `$enterprise-coding-standards`
- `$structured-change-documentation`
- `$spring-boot-react-postgresql-production-gate`
