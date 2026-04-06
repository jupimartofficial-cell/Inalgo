# Live Monitor Promotion Gate Removal + Production E2E (2026-03-30)

## Change Summary

- **Status:** Partial
- **Scope:** Remove UI gating that blocked promoting from `Live Monitor` / `Quick Test` to live mode, then run production-style Live Monitor E2E validation.
- **Area:** Intra Monitor React UI behavior, Playwright regression specs, production-evidence artifacts.

## Project Context (Onboarding Summary)

- **Project purpose:** tenant-scoped India-market trading platform for strategy creation, monitoring, and P&L workflows.
- **Tech stack:** Spring Boot 3.3 + Java 21 backend, React + TypeScript + Vite frontend, PostgreSQL, Playwright E2E.
- **Testing procedure used:** frontend compile/build and targeted Playwright suites; production-like real-data cert and live-monitor runtime API evidence capture.
- **Certification rules applied:** tenant-safe authenticated APIs, explicit runtime/audit evidence for live path, regression pass on touched flows.

## Problem And Goal

- **Problem:** The `Go Live Readiness` checklist blocked promotion when warnings existed, preventing operators from starting live mode from `Live Monitor` even when they intentionally wanted to proceed.
- **Goal:** Allow promotion regardless of checklist warnings while preserving readiness visibility, then validate `Live Monitor` end to end for production decisioning.

## Implementation Summary

### Frontend

- Removed readiness-based disable logic from command-bar and quick-test promotion actions.
- Kept checklist rendering and warnings visible as advisory context.
- Removed readiness-based disable logic from promotion dialog `Start Live` confirmation button.

### Tests

- Updated monitor E2E assertion from “promotion is blocked when checks fail” to “promotion remains available while warnings are visible”.
- Kept explicit confirmation requirement validation (`Promote To Live` dialog + `Start Live`) intact.

## Files And Modules Touched

- `desktop/src/renderer/src/components/intra-trade/intraMonitorCommandBar.ts`
- `desktop/src/renderer/src/components/intra-trade/IntraMonitorQuickTestLayout.tsx`
- `desktop/src/renderer/src/components/intra-trade/IntraMonitorTraderView.tsx`
- `desktop/src/renderer/src/components/intra-trade/useIntraMonitorController.ts`
- `desktop/src/renderer/src/components/intra-trade/IntraMonitorPage.tsx`
- `desktop/e2e/intra-trade-monitor.spec.ts`

## Feature Impact

- **New behavior:** Promotion to live can be initiated even when readiness checks show warnings.
- **Preserved behavior:**
  - Warnings and checklist details are still displayed.
  - Promotion still requires explicit confirmation in the dialog.
  - Live guardrails for destructive runtime actions (`CONFIRM LIVE`) remain unchanged.

## Validation Performed

1. `cd desktop && npm run lint` ❌
   - pre-existing repository TypeScript issues in Monaco-related files (`tradingScriptMonaco.ts`, monaco type resolution) not caused by this change.
2. `cd desktop && npm run build` ✅
3. `cd desktop && npx playwright test e2e/intra-trade-monitor.spec.ts e2e/intra-trade-routes.spec.ts --reporter=line` ✅ (7 passed)
4. `cd desktop && REAL_DATA_E2E=1 npx playwright test e2e/intra-trade-real-data-certification.spec.ts --reporter=line` ✅
5. Production-style live monitor runtime check (authenticated API flow) ⚠️
   - artifact: `artifacts/live-monitor-post-change-e2e/2026-03-30T04-43-24-725Z/report.json`
   - live run started, but execution stayed `WAITING_ENTRY` during polling; no broker entry/exit evidence in this window.
6. `./scripts/check-source-token-budget.sh` ❌
   - repo-level pre-existing budget failures remain.

## Production E2E Decision

- **Live Monitor production certification:** **NO_GO** in this run.
- **Reason:** Post-change production run did not progress from `WAITING_ENTRY` to an entered/exited cycle, so broker-linked entry/exit evidence was not produced in the validation window.

## Risks And Follow-Ups

1. Re-run the same production live-monitor cycle during a window where strategy entry criteria can actually trigger, then capture:
   - broker entry and exit order IDs,
   - runtime-linked `ORDER_PLACED`/`ORDER_FAILED` evidence,
   - final `GO/NO_GO` decision with execution IDs.
2. Resolve unrelated repo TypeScript lint blockers (Monaco typing path) so `npm run lint` can be used as a strict gate again.
3. Address pre-existing token-budget violations as separate maintainability work.

## Handoff

- Scope completed: promotion gating removal + E2E validation pass.
- Decisions made: convert checklist from hard gate to advisory guidance.
- Known limitations: production live run remained `WAITING_ENTRY`; no broker entry/exit evidence yet.
- Next owner / next step: rerun production live cycle when entry conditions are active and append broker/audit evidence to this note.

## Default Skills Applied

- `$enterprise-delivery-defaults`
- `$enterprise-coding-standards`
- `$structured-change-documentation`
- `$spring-boot-react-postgresql-production-gate`
