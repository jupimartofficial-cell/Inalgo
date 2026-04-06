# Intra Trade Saved Runs Controls (2026-03-23)

## Change Summary

- **Status:** Complete
- **Scope:** Saved Runs row actions, immediate exit, trend-conflict warning, and end-to-end validation
- **Area:** backend Intra Trade execution API + frontend Intra Trade planner/history workflow

## Project Context (Onboarding Summary)

- **Project purpose:** multi-tenant Indian trading platform for market data sync, analytics, backtesting, and intraday live/paper execution.
- **Tech stack:** Spring Boot 3.3 + Java 21 backend, React 18 + TypeScript + Vite frontend, PostgreSQL + Flyway.
- **Testing procedure used:** targeted backend Maven test, frontend build, targeted Playwright intra-trade spec, and live runtime API validation on the running stack.
- **Certification rules applied:** tenant/user isolation, controller/service boundary preservation, runtime validation notes, and release-readiness documentation.

## Problem And Goal

- The user requested richer Saved Runs controls in `Intra Trade`, immediate exit for entered positions, and an alert when an intended position conflicts with the current market trend of the selected instrument.
- Goal:
  - add edit/delete/exit actions to Saved Runs,
  - warn before save or execute when strategy bias conflicts with the latest instrument trend,
  - validate the full Intra Trade flow and fix issues found.

## Implementation Summary

### Backend

- Added tenant-scoped Intra Trade APIs for:
  - trend check
  - saved-run update
  - immediate exit
  - saved-run delete
- Added trend warning logic using the latest available `trading_signal` row for the selected instrument and scan timeframe.
- Added protections:
  - only entered executions can be exited immediately
  - entered executions cannot be edited or deleted until exited

### Frontend

- Extended Saved Runs grid with:
  - `Add Run`
  - `Edit`
  - `Delete`
  - `Immediate Exit`
- Added edit mode so running from the planner can update an existing saved run in place.
- Added pre-save and pre-run trend warning confirmation when current trend conflicts with strategy bias.
- Fixed a live selector-state defect found during browser validation where a newly saved strategy id rendered before the Saved Strategy options list refreshed, causing an out-of-range MUI warning.

## Validation Run

- `cd backend && mvn -Dtest=IntraTradeServiceTest test` ✅
- `cd desktop && npm run build` ✅
- `cd desktop && npm run test:e2e -- intra-trade.spec.ts` ✅
- Live runtime validation on the running backend during market hours:
  - confirmed live/paper entry and mark-to-market updates
  - confirmed scan-cadence P&L movement on completed candle boundaries
  - confirmed live trend-conflict warning before save
  - confirmed immediate exit from the Saved Runs grid flips an `ENTERED` row to `EXITED` with updated P&L

## Risks And Follow-Ups

- Trend warning depends on current `trading_signal` freshness for the selected instrument/timeframe.
- `desktop/src/renderer/src/components/IntraTradePanel.tsx` remains above the repository source-file budget baseline and still needs follow-up extraction work.

## Handoff

- Scope completed: Saved Runs CRUD/exit actions, trend warning, spec updates, and targeted/live validation.
- Decisions made: trend conflict is advisory, not blocking; editing entered runs remains disallowed until exit for safety.
- Assumptions: the latest instrument trading signal is the most appropriate current-trend source for intraday warning logic.
- Validation run: backend test, frontend build, Playwright spec, and live runtime checks.
- Known limitations: source-budget baseline is still exceeded in pre-existing large UI files.
- Next owner / next step: split `IntraTradePanel.tsx` and related view logic into smaller modules.

## Default Skills Applied

- `$enterprise-delivery-defaults`
- `$enterprise-coding-standards`
- `$structured-change-documentation`
- `$spring-boot-react-postgresql-production-gate`
