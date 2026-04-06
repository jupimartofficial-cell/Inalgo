# Advanced Conditions Empty Default (2026-03-22)

## Change Summary

- **Status:** Complete
- **Scope:** Fix Advanced Conditions UI so strategy-level and leg-level editors start empty and can return to empty
- **Area:** `BacktestAdvancedConditionsEditor` behavior in `Backtest P&L` and `Leg Builder`

## Problem And Goal

- The Advanced Conditions editor was seeding a default undeletable rule whenever Advance mode was enabled.
- This affected both:
  - `Entry / Exit Conditions`
  - `Leg Builder` -> `Entry / Exit Filter`
- Goal:
  - keep Advance mode empty by default
  - allow users to explicitly add the first condition or group
  - allow deleting the last root condition to return to an empty state

## Implementation Summary

### Frontend

- Updated `BacktestAdvancedConditionsEditor.tsx` so enabling Advance no longer auto-creates entry/exit groups.
- Added empty-state cards for Entry and Exit with explicit:
  - `Add condition`
  - `Group ()`
- Updated root condition deletion so removing the last remaining root rule clears the section back to `null` instead of leaving an undeletable single rule.
- Preserved the in-progress comparator/type reconciliation logic already present in the local editor code.

## Files And Modules Touched

- `desktop/src/renderer/src/components/BacktestAdvancedConditionsEditor.tsx`
- `docs/changes/advanced-conditions-empty-default-2026-03-22.md`

## Feature Impact

- New behavior:
  - Advance mode opens with empty Entry and Exit sections until the user explicitly adds a rule or group
  - deleting the final root condition restores the empty state
- Preserved behavior:
  - nested group editing still works
  - comparator/type filtering still works
  - Backtest execution flow still runs from the UI

## Validation Performed

### Commands Run

- `cd desktop && npm run build`

### Real Browser Validation

- Logged into the running app on `http://localhost:5173`
- Opened `Backtest -> Backtest P&L`
- Verified `Entry / Exit Conditions`:
  - enabling Advance showed empty Entry and Exit sections
  - adding the first Entry condition worked
  - deleting that root Entry condition returned the section to empty
- Verified `Leg Builder -> Entry / Exit Filter`:
  - enabling Advance showed empty Entry and Exit sections
  - adding the first Entry condition worked
  - deleting that root Entry condition returned the section to empty
  - `Clear Filter` returned the leg to no-filter state and restored the inactive filter icon
- Ran a real Backtest from the UI after the change:
  - strategy name set to `UI Empty Advanced Smoke`
  - Backtest completed successfully with visible result cards and trade log

## Risks And Follow-Ups

- This change is UI-focused. Backend validation still rejects enabled advanced conditions if both entry and exit remain empty at submission time; the current validated happy path is:
  - keep Basic mode enabled when no conditions are intended, or
  - enable Advance and add conditions explicitly
- `desktop/src/renderer/src/components/BacktestAdvancedConditionsEditor.tsx` remains a complex file and may benefit from future extraction if more editor features are added.

## Handoff

- Scope completed: empty-state fix for both Advanced Conditions entry points plus live UI validation.
- Decisions made: represent “no conditions yet” with `null` entry/exit instead of auto-generated default groups.
- Validation run: production-style browser interaction against the local running app and frontend build.
- Next owner / next step: if desired, align backend validation to treat `enabled=true` with both groups empty as equivalent to Basic mode instead of rejecting save/run.

## Default Skills Applied

- `$enterprise-delivery-defaults`
- `$enterprise-coding-standards`
- `$structured-change-documentation`
- `$spring-boot-react-postgresql-production-gate`
