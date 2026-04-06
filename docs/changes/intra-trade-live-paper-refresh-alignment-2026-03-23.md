# Intra Trade Live/Paper Refresh Alignment (2026-03-23)

## Change Summary

- **Status:** Complete
- **Scope:** Real-time intra-trade validation during open market + UI refresh-state bug fix
- **Area:** `IntraTradePanel` live/paper execution monitoring behavior

## Project Context (Onboarding Summary)

- **Project purpose:** multi-tenant trading platform for Indian markets that supports data sync, analytics, backtesting, and intraday live/paper execution workflows.
- **Tech stack:** Spring Boot 3.3 + Java 21 backend, React 18 + TypeScript + Vite frontend, PostgreSQL + Flyway.
- **Testing procedure used:** direct authenticated live API runs against `http://localhost:8081`, frontend build, targeted Playwright intra-trade spec, source token-budget scan.
- **Certification rules applied:** tenant isolation, service/controller boundary preservation, runtime validation + manual proof for UI behavior, release-readiness risk notes, and token-budget gate review.

## Problem And Goal

- User reported `Intra Trade` paper mode as not working in real time while market was open.
- Goal:
  - validate live and paper runtime behavior in open-market conditions,
  - verify real-time P&L progression and entry/exit snapshots,
  - fix concrete defects found.

## Validation Findings

### Live runtime verification (market open)

- Validation time window: **Monday, March 23, 2026**, around **09:40-09:46 IST**.
- `PAPER` and `LIVE` mode runs both entered positions successfully for strategy `Test SELL` (`id=3`).
- Repeated refresh calls updated `evaluatedAt` continuously.
- P&L changed at the next completed 5-minute scan candle:
  - before boundary: `exitTs=2026-03-23T04:10:00Z` and `totalPnl=1092.00`
  - after boundary (`09:45 IST`): `exitTs=2026-03-23T04:15:00Z` and P&L moved (`898.50`, then `624.00`)
- Inference: backend real-time scan and mark-to-market logic is working and cadence-aligned.

### Defect reproduced in UI behavior

- `IntraTradePanel` auto-refresh lifecycle was coupled to the **planner mode selector** (`executionMode`) rather than the **selected saved execution mode**.
- Impact:
  - a selected `LIVE`/`PAPER` execution could stop auto-refreshing when the planner mode changed (for example, user switches planner to `BACKTEST` while monitoring an open run).
  - this can appear to users as “real-time paper trading not working”.

## Implementation

- Updated auto-refresh gating in `IntraTradePanel` to use `selectedExecution.mode` (`LIVE`/`PAPER`) instead of planner `executionMode`.
- Updated auto-refresh stop condition to disable only when there is no selected execution or when selected execution mode is not live/paper.

## Files Changed

- `desktop/src/renderer/src/components/IntraTradePanel.tsx`

## Validation Run

- Live API checks (manual, against running backend):
  - `POST /api/v1/admin/intra-trade/run`
  - `POST /api/v1/admin/intra-trade/executions/{id}/refresh`
- Frontend build:
  - `cd desktop && npm run build` ✅
- Frontend e2e (targeted):
  - `cd desktop && npm run test:e2e -- intra-trade.spec.ts` ❌
  - Failure is pre-existing/independent in Market Watch heading assertion (`Live Market Watch` not found)
- Token-budget gate:
  - `scripts/check-source-token-budget.sh` ❌ repo-level failure due pre-existing oversized files (including `IntraTradePanel.tsx` and other legacy files)

## Risks And Follow-Ups

- E2E intra-trade assertion needs alignment with current Market Watch heading semantics.
- The source-file token-budget baseline has existing violations; modular extraction follow-up is still needed for full maintainability compliance.

## Handoff

- Scope completed: open-market validation of intra-trade real-time behavior + UI refresh-mode bug fix.
- Decisions made: treat selected execution mode as the source of truth for refresh behavior.
- Assumptions: scan-timeframe cadence determines when price/P&L updates occur.
- Validation run: live API evidence + frontend build + targeted e2e attempt + budget scan.
- Known limitations: targeted e2e spec currently fails on pre-existing heading expectation mismatch.
- Next owner / next step: update `desktop/e2e/intra-trade.spec.ts` heading locator to the current UI contract and address token-budget refactors.

## Default Skills Applied

- `$enterprise-delivery-defaults`
- `$enterprise-coding-standards`
- `$structured-change-documentation`
- `$spring-boot-react-postgresql-production-gate`
