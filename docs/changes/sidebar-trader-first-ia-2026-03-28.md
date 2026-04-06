# Trader-First Sidebar IA And Command Palette (2026-03-28)

## Change Summary

- **Status:** Complete (with one existing migration-spec test gap still open)
- **Scope:** Sidebar information-architecture refactor for trader-first access speed
- **Area:** React renderer shell navigation, route state mapping, and e2e nav coverage

## Problem And Goal

- The left navigation had grown into a flat high-density list with deep children under `Backtest`, increasing scan and click cost for trader-critical paths.
- Goal:
  - prioritize intraday execution paths,
  - introduce grouped IA with predictable expansion,
  - provide user-configurable quick access,
  - add keyboard jump (`Ctrl/Cmd+K`) for fast route navigation.

## Implementation Summary

### Frontend

- Replaced flat sidebar with grouped navigation sections:
  - `Quick Access`
  - `Trading`
  - `Analytics`
  - `Admin`
- Added single-expand section behavior in expanded mode.
- Added pin/unpin support for nav destinations and surfaced pinned destinations in `Quick Access`.
- Added command palette (`Ctrl/Cmd+K`) with searchable route destinations and pin controls.
- Promoted `Intra` workflows to top-level navigation state:
  - `Intra Strategies`
  - `Intra Monitor`
  - `Intra P&L`
- Kept existing URL paths stable (`/intra/*`, `/backtest/*`, `/market-signals/*`, etc.) while remapping shell state.
- Extended persisted session payload to include:
  - `intraSubSection`
  - `pinnedNavItemKeys`
  - `expandedNavGroup`
- Added backward-compat migration for older sessions that stored intra pages inside `backtestSubSection`.

### Backend

- None.

### Database

- None.

### Test updates

- Updated `desktop/e2e/app-sections.spec.ts` for grouped sidebar behavior.
- Added a dedicated IA test:
  - grouped expansion checks,
  - pinning behavior,
  - command palette jump behavior,
  - top-level Intra route navigation.
- Added screenshot capture in the IA test for visual verification.

## Files And Modules Touched

- `desktop/src/renderer/src/components/AppSidebar.tsx`
- `desktop/src/renderer/src/App.tsx`
- `desktop/src/renderer/src/components/AppShellShared.tsx`
- `desktop/src/renderer/src/appRoutes.ts`
- `desktop/e2e/app-sections.spec.ts`
- `README.md`
- `docs/features/intra-trade/feature.md`

## Feature Impact

- New behavior:
  - trader-priority grouped navigation with pin-based quick access
  - `Ctrl/Cmd+K` command palette route jump
  - top-level `Intra` navigation state
- Preserved behavior:
  - route URL compatibility
  - mobile drawer behavior
  - backend/API contracts

## API And Contract Impact

- No backend API changes.
- Internal frontend contract changes:
  - expanded `NavSection` with `intra`
  - explicit `IntraSubSection`
  - updated route state builder/resolver signatures
  - persisted session shape extended for nav personalization state

## Database Impact

- None.

## Validation Performed

- `cd desktop && npm run lint` ✅
- `cd desktop && npm run build` ✅
- `cd desktop && npx playwright test e2e/app-sections.spec.ts --grep "Trader-first grouped navigation supports pinning and command palette jump"` ✅
- `cd desktop && npm run test:e2e -- app-sections.spec.ts` ⚠️
  - 7/9 tests passing
  - 2 migration-focused specs still fail in this branch due pre-existing test setup mismatch around authenticated migration-screen bootstrapping in Playwright (not a compile or build blocker)
- `scripts/check-source-token-budget.sh` ⚠️
  - repo-level failure remains due existing oversized files (including legacy `App.tsx` and other longstanding files)

## Risks And Follow-Ups

- Migration E2E tests still require cleanup for deterministic auth/setup behavior in that specific spec fixture.
- Sidebar and app shell files remain above the source-file budget threshold due existing monolithic structure; further extraction is recommended.
- Command palette currently prioritizes label/alias text match only; weighted recency ranking is a future improvement.

## Agent Handoff Note

- **Done:** Trader-first grouped navigation, pin-based quick access, top-level Intra IA, and command palette were implemented.
- **Where to continue:** Start with `desktop/src/renderer/src/components/AppSidebar.tsx` for IA behavior and `desktop/src/renderer/src/App.tsx` + `desktop/src/renderer/src/appRoutes.ts` for route-state integration.
- **Do not break:** URL compatibility, mobile drawer flow, and subsection routing for `Backtest`, `Intra`, and `Market Signals`.
- **Artifact:** `artifacts/sidebar-trader-ia.png`.

## Default Skills Applied

- `$enterprise-delivery-defaults`
- `$enterprise-coding-standards`
- `$structured-change-documentation`
- `$spring-boot-react-postgresql-production-gate`
