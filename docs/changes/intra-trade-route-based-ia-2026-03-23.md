# Intra Trade Route-Based IA Split (2026-03-23)

## Change Summary

- **Status:** Complete
- **Scope:** Split the old `Intra Trade` single-screen workflow into route-based build, run, and review pages
- **Area:** React renderer shell, sidebar navigation, intra-trade workspace UI, docs, and e2e coverage

## Project Context (Onboarding Summary)

- **Project purpose:** multi-tenant Indian trading platform for backtesting, market analytics, and intraday execution workflows.
- **Tech stack:** Spring Boot 3.3 + Java 21 backend, React 18 + TypeScript + Vite frontend, PostgreSQL + Flyway.
- **Testing procedure used:** frontend type check, renderer build, targeted intra-trade Playwright coverage, and source token-budget scan.
- **Certification rules applied:** route contract clarity, shell/UI separation, tenant-scoped saved-run behavior, documentation updates, and release-handoff notes.

## Problem And Goal

- The existing `Backtest -> Intra Trade` screen mixed strategy authoring, live monitoring, and P&L review into one setup-heavy page.
- Goal:
  - separate the user journey into `Build -> Run -> Review`,
  - make each intra module directly reachable by URL,
  - preserve trading context across the three pages.

## Implementation Summary

### Frontend shell and routes

- Added `react-router-dom`.
- Added route mapping for the renderer shell and direct intra routes:
  - `/intra/strategies`
  - `/intra/monitor`
  - `/intra/pnl`
- Updated the `Backtest` sidebar children to:
  - `Backtest P&L`
  - `Strategy List`
  - `Intra Strategies`
  - `Intra Monitor`
  - `Intra P&L`
- Updated breadcrumb text and section restoration to respect the active intra route.

### Intra workspace split

- Added shared intra workspace state and session persistence in:
  - `desktop/src/renderer/src/components/intra-trade/IntraWorkspaceContext.tsx`
- Added a shared workspace header showing:
  - workspace label
  - trade mode
  - exchange context
  - timezone
  - India market-session status
- Split the old one-page UI into:
  - `IntraStrategiesPage`
  - `IntraMonitorPage`
  - `IntraPnlPage`

### Behavior preserved

- Existing intra-trade backend endpoints remain unchanged.
- Existing saved strategy CRUD and saved execution CRUD/exit flows remain tenant-scoped.
- Embedded read-only Market Watch remains available during monitoring.

## Files And Modules Touched

- `desktop/src/renderer/src/App.tsx`
- `desktop/src/renderer/src/main.tsx`
- `desktop/src/renderer/src/appRoutes.ts`
- `desktop/src/renderer/src/components/AppSidebar.tsx`
- `desktop/src/renderer/src/components/intra-trade/`
- `desktop/e2e/intra-trade.spec.ts`
- `README.md`
- `docs/features/intra-trade/feature.md`
- `docs/features/intra-trade/test-cases.md`

## API And Contract Impact

- No backend API or database contract changed.
- Renderer route contract changed:
  - `Backtest -> Intra Strategies` -> `/intra/strategies`
  - `Backtest -> Intra Monitor` -> `/intra/monitor`
  - `Backtest -> Intra P&L` -> `/intra/pnl`

## Validation Run

- `cd desktop && npm run lint` ✅
- `cd desktop && npm run build` ✅
- `cd desktop && npm run test:e2e -- intra-trade.spec.ts` ✅
- `scripts/check-source-token-budget.sh` ❌
  - repo-level failure remains because of pre-existing oversized files, including touched legacy shell files such as `desktop/src/renderer/src/App.tsx`

## Risks And Follow-Ups

- The renderer app still carries large legacy shell files, especially `App.tsx`, so further extraction is still warranted.
- The route sync currently uses one shell-level mapper; keep it aligned if future top-level sections gain direct URLs.
- Intra monitor still derives broker/exchange context from the selected instrument because there is no true account-level broker selector in the current repo.

## Handoff

- Scope completed: renderer route support, intra IA split, shared intra workspace header/state, docs, and targeted spec updates.
- Decisions made: keep the new IA under the existing `Backtest` parent; keep backend contracts unchanged; use session storage to preserve intra workspace state across page switches.
- Assumptions: workspace/account context is represented by tenant + username for v1; exchange context is derived from the selected instrument.
- Validation run: frontend lint and build.
- Known limitations: token-budget scan still fails on pre-existing oversized files, especially the legacy shell file `desktop/src/renderer/src/App.tsx`.
- Next owner / next step: continue splitting `App.tsx` and optionally route additional non-intra sections if the shell moves fully route-first.

## Default Skills Applied

- `$enterprise-delivery-defaults`
- `$enterprise-coding-standards`
- `$structured-change-documentation`
- `$spring-boot-react-postgresql-production-gate`
