# Backtest Advance Conditions UX And Validation (2026-03-15)

## Change Summary

- **Status:** Complete
- **Scope:** Refine Backtest usability, fix Advance Conditions alignment, add a readable condition-query preview, and run broader live-data validation
- **Area:** `BacktestPanel` + `BacktestAdvancedConditionsEditor` + Playwright backtest coverage + real-data validation tooling

## Problem And Goal

- The initial Advance Conditions feature was functional but visually dense once nested groups were added.
- Users also lacked a plain-language way to confirm the full query that the backtest engine would evaluate.
- Goal:
  - fix alignment and spacing issues in the Advance Conditions section,
  - make the overall Backtest flow easier to understand,
  - add a single-text query preview below Leg Builder,
  - validate the supported condition/comparator set and group combinations against live stored analytics data.

## Implementation Summary

### Frontend

- Refactored the Advance Conditions editor layout:
  - each rule now renders as `Left expression` / `Comparator` / `Right expression`,
  - group headers explain the current join behavior,
  - nested groups use clearer indentation and visual boundaries,
  - boolean literal values use a dedicated selector instead of free-text input.
- Added Backtest guidance text and workflow copy at the top of the Backtest form.
- Added a `Strategy Logic Preview` card below Leg Builder that renders:
  - a full summary sentence,
  - the current `Entry` query,
  - the current `Exit` query.
- Extracted reusable condition metadata and summary helpers into `backtestAdvancedConditionUtils.ts`.

### Validation Tooling

- Added `scripts/validate-backtest-advance-conditions.mjs` to:
  - authenticate against the admin API,
  - fetch live `Trading Signal` and `Trading Param` rows,
  - construct supported comparator and group-combination scenarios from actual data,
  - run live backtests for each scenario,
  - report executed-trade counts and `realWorldAccuracyPct`.

### Tests

- Extended `desktop/e2e/backtest.spec.ts` to verify:
  - the logic-preview card renders,
  - the preview updates when Advance Conditions are enabled and edited,
  - saved strategies preserve the previewable query state on edit/run.

## Files And Modules Touched

- `desktop/src/renderer/src/components/BacktestAdvancedConditionsEditor.tsx`
- `desktop/src/renderer/src/components/BacktestPanel.tsx`
- `desktop/src/renderer/src/components/backtestAdvancedConditionUtils.ts`
- `desktop/e2e/backtest.spec.ts`
- `scripts/validate-backtest-advance-conditions.mjs`
- `README.md`

## Feature Impact

- **New behavior**
  - Advance Conditions uses a more readable, grouped rule layout.
  - Backtest now shows the full condition query under Leg Builder for user confirmation.
  - Live-data validation can be repeated with a repository script instead of ad-hoc manual API calls.
- **Preserved behavior**
  - strategy save/edit/run flows remain unchanged,
  - existing Backtest P&L and strategy list behavior remain unchanged,
  - advanced-condition payloads and backend contract remain unchanged.

## API And Contract Impact

- No endpoint or payload changes.
- Validation tooling reuses existing admin APIs.

## Database Impact

- No schema or migration changes.

## Validation Performed

### Automated

```bash
cd desktop
npm run lint
npm run build
npm run test:e2e -- backtest.spec.ts
npm run test:e2e
```

Results:
- frontend type-check passed,
- frontend production build passed,
- targeted Backtest e2e passed,
- full Playwright suite passed (`25` tests).

### Screenshot Artifact

- Captured live UI screenshot after the layout change:
  - `/var/folders/y2/7vpg96g556s81jk_fy002ltw0000gn/T/playwright-mcp-output/1773512209623/page-2026-03-14T19-04-22-146Z.png`

### Real-Data Validation

Command used:

```bash
BACKTEST_OUTPUT_PATH=/tmp/backtest-advance-condition-matrix-2026-03-15.json \
node scripts/validate-backtest-advance-conditions.mjs
```

Observed live-data coverage:
- `Trading Signal` rows loaded: `313`
- `Trading Param` rows loaded: `53`
- Timeframes covered by live data:
  - `minutes|1`
  - `minutes|5`
  - `minutes|15`
  - `minutes|30`
  - `minutes|60`
  - `days|1`
  - `weeks|1`
  - `months|1`

Observed live-data scenario coverage:
- supported comparator cases:
  - `EQUAL_TO`
  - `HIGHER_THAN`
  - `HIGHER_THAN_EQUAL_TO`
  - `LOWER_THAN`
  - `LOWER_THAN_EQUAL_TO`
  - `UP_BY`
  - `DOWN_BY`
  - `CROSSES_ABOVE`
  - `CROSSES_BELOW`
- group logic cases:
  - `AND`
  - `OR`
  - nested `AND` + `OR`
  - combined entry + exit scenario

Observed live-data results:
- total scenarios run: `14`
- successful runs: `14`
- runs with executed trades: `14`
- average reported `realWorldAccuracyPct`: `100.00`
- all observed runs priced from market data (`fallbackPricedTrades: 0`)

## Issues Found And Fixed During Validation

- Targeted e2e initially failed because the new preview card now switches from `Basic mode only` to default generated conditions as soon as Advance mode is enabled.
- Fix: updated the assertion to verify the actual generated preview text before editing it.

## Risks And Notes

- The new validation script covers the supported comparator set and representative group combinations using live rows in the selected date range. It does not exhaust the full combinatorial cross-product of every field against every other field because that would include many semantically invalid or unsupported pairings.
- `UP_BY` and `DOWN_BY` are validated against the engine’s current directional numeric-comparison behavior.
- The screenshot artifact is stored in a local temporary directory rather than under version control.

## Handoff

- Scope completed: Advance Conditions UX pass, Backtest logic preview, automated Playwright updates, and repeatable live-data validation script.
- Decisions made: keep the backend contract unchanged; improve readability through UI structure and preview text instead of adding more configuration controls.
- Assumptions: users benefit more from query readability and preview fidelity than from a denser single-row form layout.
- Validation run: `npm run lint`, `npm run build`, targeted Backtest Playwright, full Playwright suite, and `scripts/validate-backtest-advance-conditions.mjs` against `:8082`.
- Known limitations: the validation script uses the currently available live data window and therefore depends on stored analytics coverage for each comparator scenario.
- Next owner / next step: optional follow-up for searchable field/comparator pickers if the operand list grows further.

## Default Skills Applied

- `$enterprise-delivery-defaults`
- `$enterprise-coding-standards`
- `$structured-change-documentation`
- `$spring-boot-react-postgresql-production-gate`
