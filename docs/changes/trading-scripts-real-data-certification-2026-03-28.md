# Trading Scripts Real-Data Certification (Attachment Parity)

## Change Summary
- **Status:** Complete
- **Date:** 2026-03-28
- Added a production-oriented real-data Trading Scripts certification harness that translates the attachment logic, compares behavioral parity, runs compile/backtest/publish gates, and optionally executes one guarded live order.

## Problem And Goal
- The repository had Trading Scripts v1 lifecycle coverage but lacked a deterministic real-data certification flow tied to the attached sample logic.
- Goal: certify Trading Scripts end-to-end with parity evidence, strict live guardrails, and durable artifacts suitable for release readiness.

## Implementation Summary
### Frontend / E2E
- Added `desktop/e2e/trading-scripts-real-data-certification.spec.ts`.
- The spec performs:
  - UI login + Trading Scripts route verification.
  - Real-data pull from backtest analytics (`trading-signals`, `trading-day-params`) for BANKNIFTY 5m window.
  - Attachment baseline evaluation over last 30 trading days.
  - Script draft create/update + compile parity checks on sampled actionable days.
  - Backtest metrics validation.
  - `PAPER_READY` and `LIVE_READY` publish validation.
  - Optional live order checkpoint behind explicit env gates and hard quantity/order caps.
  - Artifact report generation under `artifacts/trading-scripts-real-data/<timestamp>/certification-report.json`.

### Shared test utility
- Added `desktop/e2e/utils/tradingScriptSampleLogic.ts`.
- Utility responsibilities:
  - Normalize attachment `exitTime` (`3.20PM` to `15:20`).
  - Evaluate baseline decision intent from `trading_signal` + `trading_day_param` (`gapType`, `orbHigh/Low`, `signal`, `currentClose`).
  - Generate deterministic Trading Script source payload from baseline decision.

### Tooling
- Added npm command in `desktop/package.json`:
  - `test:e2e:trading-scripts-real-data`

### Documentation
- Updated `docs/features/trading-scripts/feature.md` with real-data harness and live guardrail notes.
- Updated `docs/features/trading-scripts/test-cases.md` with certification and live-guardrail cases.

## Files And Modules Touched
- `desktop/e2e/trading-scripts-real-data-certification.spec.ts`
- `desktop/e2e/utils/tradingScriptSampleLogic.ts`
- `desktop/package.json`
- `docs/features/trading-scripts/feature.md`
- `docs/features/trading-scripts/test-cases.md`

## Feature Impact
- New behavior:
  - Repeatable Trading Scripts real-data certification run with parity report output.
  - Optional one-order live validation with mandatory operator confirmation and strict hard caps.
- Preserved behavior:
  - Existing Trading Scripts UI/API lifecycle remains unchanged.
  - Existing mocked Trading Scripts E2E (`desktop/e2e/trading-scripts.spec.ts`) remains valid.

## API And Contract Impact
- No backend contract changes.
- Certification uses existing endpoints only:
  - `/api/v1/admin/trading-scripts/*`
  - `/api/v1/admin/backtest/trading-signals`
  - `/api/v1/admin/backtest/trading-day-params`
  - `/api/v1/admin/intra-trade/orders/place` (opt-in live checkpoint)

## Database Impact
- No schema changes.
- No migration changes.

## Validation Performed
- `cd desktop && npm run build`
- `cd desktop && npm run test:e2e -- e2e/trading-scripts.spec.ts`
- `cd desktop && npm run test:e2e -- e2e/trading-scripts-real-data-certification.spec.ts` (default skip expected without `REAL_DATA_E2E=1`)
- `cd desktop && REAL_DATA_E2E=1 npm run test:e2e -- e2e/trading-scripts-real-data-certification.spec.ts --reporter=line` (attempted; blocked by backend login rate limiting `429 Too many login attempts` in current local environment)
- `scripts/check-source-token-budget.sh`

## Risks And Follow-Ups
- Real-data certification requires available analytics rows for target instrument/timeframe in the selected date window.
- Live-order checkpoint is intentionally opt-in and requires explicit env confirmation; misconfiguration fails certification by design.
- Broker-side order success still depends on market session, account permissions, and token validity.
- Current local run hit admin-login throttling while repeatedly executing real-data runs; rerun after rate-limit cooldown or with a fresh backend instance.

## Handoff
- Scope completed: real-data Trading Scripts certification harness, translator helper, docs, and runner command.
- Decisions made: behavioral parity mode, 30-trading-day window, local default stack, live-order optional with max 1 order and qty 1.
- Assumptions: analytics data exists for `NSE_INDEX|Nifty Bank` 5m and admin credentials remain default unless overridden.
- Validation run: desktop build, mocked Trading Scripts E2E, new real-data spec (skip-mode), token-budget script.
- Known limitations: full live-order path cannot be validated without explicit live env flags and valid broker setup.
- Next owner / next step: execute `npm run test:e2e:trading-scripts-real-data` with `REAL_DATA_E2E=1` and, if needed, live flags in a controlled market session window.
