# Intra Monitor Trader Workflow Refactor (2026-03-23)

## Change Summary

- **Status:** Complete
- **Scope:** Rework `Intra Monitor` into a trader-first command surface for quick paper testing and faster live monitoring
- **Area:** React renderer intra-monitor workflow, documentation, and validation

## Project Context (Onboarding Summary)

- **Project purpose:** multi-tenant Indian trading platform for strategy authoring, intraday execution, monitoring, and P&L review.
- **Tech stack:** Spring Boot 3.3 + Java 21 backend, React 18 + TypeScript + Vite frontend, PostgreSQL + Flyway.
- **Testing procedure used:** frontend production build and repo source token-budget scan.
- **Certification rules applied:** tenant-scoped API reuse, no backend contract drift, trader-action safety for live controls, documentation handoff, and touched-file token-budget compliance.

## Problem And Goal

- The previous monitor screen stacked multiple dense grids and inline actions into one page.
- Traders had no immediate answer to the core question: "Is this strategy running right now?"
- Goal:
  - surface current runtime health immediately,
  - separate paper-first testing from live monitoring,
  - reduce accidental destructive actions,
  - support a clear paper-to-live promotion path.

## Implementation Summary

### Trader workflow redesign

- Added a persistent trading command bar that always shows:
  - selected strategy
  - current trader mode
  - runtime state
  - last scan time
  - market status
  - data freshness
  - open positions count
  - MTM
  - one state-driven primary CTA
- Primary CTA now shifts by workflow state:
  - `Run Paper Test`
  - `Start Live`
  - `Resume`
  - `Exit Now`
  - `View P&L`

### Mode split

- Added explicit trader modes:
  - `Quick Test`
  - `Live Monitor`
- `Quick Test` now centers on:
  - saved strategy selection
  - compact paper-run setup
  - recent paper results
  - promotion readiness and live handoff
- `Live Monitor` now centers on:
  - active live runtimes
  - selected runtime detail
  - open positions
  - audit/event trail
  - collapsed emergency controls

### Layout, wording, and action simplification

- Replaced the grid-heavy main view with a status-first master/detail layout.
- Added pagination and filtering for:
  - saved strategies
  - live runtimes
  - positions
  - events
- Reduced list-row actions to a single default `Open` action.
- Moved `Pause`, `Resume`, `Partial Exit`, `Exit`, and watch handoff actions into detail panels or the collapsed emergency section.
- Tightened trader-facing copy after a manual workflow pass:
  - `Recent Strategies` -> `Saved Strategies`
  - `Quick Test Planner` -> `Paper Test Setup`
  - `Recent Paper Runs` -> `Paper Validation Runs`
  - `Paper to Live Promotion` -> `Promote Live Strategy`
  - `Live Strategy List` -> `Active Live Strategies`
  - `Runtime Event Trail` -> `Audit Trail`
- Restored the historical quick-test path inside `Paper Test Setup`:
  - selecting `Historical Backtest` now shows inline `Start date` and `End date` pickers
  - the quick-test CTA switches to `Run Historical Test`
  - the quick-test execution handler now uses `BACKTEST` only for historical runs and keeps paper/live guardrails unchanged

### Paper-to-live promotion

- Added a promotion dialog that blocks live start until readiness checks pass.
- Added a checklist for:
  - market open state
  - signal freshness
  - strategy validation / live eligibility
  - risk controls configured
  - recent paper-run availability

### Code structure

- Split monitor rendering and controller logic into smaller focused modules:
  - `desktop/src/renderer/src/components/intra-trade/IntraMonitorPage.tsx`
  - `desktop/src/renderer/src/components/intra-trade/useIntraMonitorController.ts`
  - `desktop/src/renderer/src/components/intra-trade/IntraMonitorTraderView.tsx`
  - `desktop/src/renderer/src/components/intra-trade/IntraMonitorQuickTestLayout.tsx`
  - `desktop/src/renderer/src/components/intra-trade/IntraMonitorLiveLayout.tsx`
  - `desktop/src/renderer/src/components/intra-trade/intraMonitorCommandBar.ts`
  - `desktop/src/renderer/src/components/intra-trade/intraMonitorExecution.ts`
  - `desktop/src/renderer/src/components/intra-trade/intraMonitorHelpers.ts`

## API And Contract Impact

- No backend API or database schema changed.
- Existing intra-monitor and intra-trade admin endpoints are reused.
- UI contract changed from multi-grid monitor to a mode-based command-and-detail workflow.

## Validation Run

- `cd desktop && npm run build` ✅
- `./scripts/check-source-token-budget.sh` ❌
  - repo-level failure remains due to many pre-existing oversized files outside this change set
  - touched monitor files created in this refactor remain within the 500-line / 20,000-byte limit

## Risks And Follow-Ups

- The broader intra-trade E2E suite now covers command bar state, trader-mode switching, promotion gating, route deep-link reliability, builder mode switching, and strategy-library lifecycle flows.
- Repo-level token-budget debt remains in unrelated legacy files and still prevents a clean global script result.
- The primary command bar intentionally derives state from the selected strategy/runtime; if future product direction needs account-wide global status, add a dedicated account-health API rather than overloading row data.

## Handoff

- Scope completed: trader-first `Intra Monitor` workflow refactor, command bar, mode split, master/detail layouts, promotion flow, and docs.
- Decisions made: keep backend contracts unchanged; keep live destructive actions behind existing guard dialog; use master/detail instead of restoring another table-heavy layout.
- Assumptions: traders benefit more from explicit `Quick Test` vs `Live Monitor` separation than from mixed live/paper lists on one canvas.
- Validation run: frontend build and source token-budget scan.
- Known limitations: repo token-budget script still fails due to pre-existing oversized files outside this change set.
- Next owner / next step: split other oversized E2E suites such as `app-sections.spec.ts`, `backtest.spec.ts`, and `trading-window.spec.ts`.

## Default Skills Applied

- `$enterprise-delivery-defaults`
- `$enterprise-coding-standards`
- `$structured-change-documentation`
- `$spring-boot-react-postgresql-production-gate`
