# Manage Triggers UI Refinement And Collapsible Nav

## Onboarding Context

- **Project purpose:** InAlgo provides a multi-tenant admin console and Spring Boot backend for candle sync, analytics, option-chain workflows, backtesting, and trading operations for Indian traders.
- **Tech stack:** Backend uses Java 21, Spring Boot 3.3, Spring Data JPA, PostgreSQL 16, and Flyway; frontend uses React 18, TypeScript, Vite, and MUI 6.
- **Testing procedure:** Touched-area frontend validation uses `cd desktop && npm run lint`, `cd desktop && npm run build`, and `cd desktop && npm run test:e2e -- app-sections.spec.ts`.
- **Certification rules:** `docs/AI_AGENT_DEVELOPMENT.md` requires feature tracking, touched-area tests, manual verification artifacts for UI changes, and explicit review of security/performance concerns such as tenant scoping, validation, pagination, and query behavior.

## Change Summary

- **Title:** Refine Manage Triggers layout and add a collapsible desktop navigation rail
- **Date:** 2026-03-14
- **Status:** Complete

## Problem And Goal

- Operators were losing configured-trigger context because the creation form always occupied the top of the screen.
- The desktop shell also lacked a compact navigation mode for narrower working layouts.
- The goal was to improve trigger-screen alignment, default the create form to a collapsed state, and let the left navigation collapse to an icon rail with tooltips.

## Implementation Summary

### Frontend changes

- Converted the create or edit area in `ManageTriggersPanel.tsx` into a controlled accordion.
- Defaulted new-trigger mode to collapsed and auto-expanded the editor when a row enters edit mode.
- Added summary chips to the collapsed trigger-editor header so the current job, instrument, timeframe, and cadence remain visible before expansion.
- Tightened trigger-browser alignment by stretching the summary metric grid and forcing table body cells to align from the top.
- Added safe fallback values for the trigger-filter selects so empty browser responses do not produce out-of-range MUI warnings.
- Updated the desktop sidebar in `App.tsx` to support a persisted collapsed icon-rail mode with tooltip-backed navigation buttons and compact backtest sub-navigation.
- Added a desktop toolbar toggle for collapsing and expanding the navigation rail.

### Backend changes

- None.

### Database changes

- None.

### Test changes

- Extended `desktop/e2e/app-sections.spec.ts` to verify the collapsed navigation rail and the default-collapsed trigger editor workflow.

## Files And Modules Touched

- `desktop/src/renderer/src/components/ManageTriggersPanel.tsx`
- `desktop/src/renderer/src/App.tsx`
- `desktop/e2e/app-sections.spec.ts`
- `README.md`
- `docs/features/manage-triggers/feature.md`

## Feature Impact

- New behavior:
  - `Create Trigger` starts collapsed by default.
  - Editing a trigger expands the form automatically.
  - The desktop sidebar can collapse into an icon rail with tooltips.
- Preserved behavior:
  - Trigger creation still saves new rows in `STOPPED`.
  - Existing Manage Triggers browser filters, pagination, and lifecycle actions remain unchanged at contract level.
  - Mobile navigation still uses the temporary drawer behavior.

## API And Contract Impact

- No API or backend contract changes.

## Database Impact

- No schema, migration, or index changes.

## Validation Performed

- Commands run:
  - `cd desktop && npm run lint`
  - `cd desktop && npm run build`
  - `cd desktop && npm run test:e2e -- app-sections.spec.ts`
- Manual verification:
  - Captured a UI screenshot artifact at `artifacts/manage-triggers-collapsed-nav.png`.
  - Confirmed the desktop nav collapses to icon-only mode and `Manage Triggers` still opens correctly from the rail.
  - Confirmed `Create Trigger` is collapsed by default and edit mode expands it automatically.

## Risks And Follow-Ups

- The sidebar collapsed state is stored in browser session storage; if session storage is cleared, the drawer returns to expanded mode.
- The renderer bundle still exceeds Vite's default chunk warning threshold; this task did not address bundle splitting.

## Agent Handoff Note

- **Done:** Manage Triggers now defaults to a collapsed editor, row alignment is tightened, and the desktop shell supports a tooltip-backed collapsed nav rail.
- **Where to continue:** Open `desktop/src/renderer/src/components/ManageTriggersPanel.tsx` for trigger-screen behavior and `desktop/src/renderer/src/App.tsx` for shell navigation behavior.
- **Do not break:** The `STOPPED`-by-default trigger rule, the existing trigger browser query parameters, and the mobile drawer flow.
- **Verification artifact:** Review `artifacts/manage-triggers-collapsed-nav.png` before making further visual changes to this area.
