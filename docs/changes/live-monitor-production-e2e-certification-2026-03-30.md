# Live Monitor Production E2E Certification (2026-03-30)

## Change Summary

- **Status:** Partial (production certification denied for live-trading path)
- **Scope:** Validate `Backtest -> Intra Monitor -> Live Monitor` production-readiness gates on the local production-like stack
- **Area:** Backend runtime/order APIs, frontend E2E flows, release-readiness evidence

## Project Context (Onboarding Summary)

- **Project purpose:** tenant-scoped India-market trading platform for strategy authoring, intraday execution, monitoring, and P&L review.
- **Tech stack:** Spring Boot 3.3 + Java 21 backend, React 18 + TypeScript + Vite frontend, PostgreSQL + Flyway, Playwright E2E.
- **Testing procedure used:** backend targeted live-monitor tests + compile, frontend production build, targeted Playwright monitor suites, real-data certification harness, runtime/order API evidence capture, token-budget scan.
- **Certification rules applied:** tenant boundary enforcement, live-monitor contract validation, regression checks, release-readiness and rollback-risk evidence.

## Scope And Risk Classification

- **Delivery scope:** validation/release-readiness (backend + frontend + runtime integration)
- **Contract impact:** none (no API/schema contract changes made)
- **Risk level:** high (live-trading certification)
- **Operational impact:** rollout go/no-go evidence, production support/runbook decisioning

## Validation Performed

1. `cd backend && mvn -q -Dtest=IntraLiveOrderServiceTest,IntraMonitorActionServiceTest,IntraMonitorEmergencyServiceTest,IntraTradeServiceTest test` ✅
2. `cd backend && mvn -q -DskipTests compile` ✅
3. `cd desktop && npm run build` ✅
4. `cd desktop && npx playwright test e2e/intra-trade-monitor.spec.ts --reporter=line` ✅
5. `cd desktop && npx playwright test e2e/intra-trade-routes.spec.ts --reporter=line` ✅
   - fixed strict locator ambiguity by scoping assertions/clicks to the Trading-group list in `desktop/e2e/intra-trade-routes.spec.ts`
6. `cd desktop && REAL_DATA_E2E=1 npx playwright test e2e/intra-trade-real-data-certification.spec.ts --reporter=line` ✅
   - artifact: `artifacts/intra-real-data/2026-03-30T04-06-21-815Z/certification-report.json`
7. Controlled live-cycle execution via authenticated APIs (`X-Tenant-Id: local-desktop`) ⚠️
   - started all `LIVE_READY` strategies (`id=11,12,9,10`) as live runs
   - created executions: `86`, `87`, `88`, `89`
   - polled six refresh rounds; all remained `WAITING_ENTRY`
   - no run reached `ENTERED/PAUSED/PARTIAL_EXIT`, so no runtime-linked entry/exit broker order could be captured
   - artifact: `artifacts/live-monitor-live-cycle/2026-03-30T04-16-35-931Z/live-cycle-report.json`
8. Cleanup for controlled run ✅
   - exited temporary live runtimes for executions `86–89` (runtime ids `46–49`) with `CONFIRM LIVE` reason `Controlled certification cleanup`
9. `./scripts/check-source-token-budget.sh` ❌
   - repo-level red due pre-existing oversized files (unchanged in this task)

## Findings

1. Live Monitor UI and targeted monitor interaction tests pass in automation.
2. Real-data certification harness for monitor->P&L flow passes and produced a fresh artifact.
3. Controlled live-cycle run is still blocked by runtime state:
   - all four live runs remained `WAITING_ENTRY` during the polling window
   - no broker entry/exit order IDs were produced for the controlled run
   - no runtime-linked `ORDER_PLACED`/`ORDER_FAILED` evidence could be produced for executions `86–89`
4. The previous route regression is resolved; `intra-trade-routes.spec.ts` now passes after locator scoping.

## Production Certification Decision

- **Live Monitor production certification:** **DENIED** for live-trading path in this run.
- **Reason:** runtime/order/audit evidence still does not demonstrate a completed broker-linked live entry/exit cycle in this market-hours run.

## Risks And Follow-Ups

1. Re-run one controlled market-hours live strategy cycle when any `LIVE_READY` strategy is able to transition beyond `WAITING_ENTRY`, then capture:
   - at least one entry and one exit broker order,
   - persisted rows in `intra_trade_order`,
   - `ORDER_PLACED` (and any failure) audit events linked to runtime/execution.
2. Address repo token-budget violations separately; current failure is pre-existing but remains a release-readiness gate concern.

## Rollback Notes

- No code or schema changes were made in this task; rollback is not required.

## Handoff

- Scope completed: route-test ambiguity fix plus production-style Live Monitor validation with controlled live-cycle attempt and cleanup.
- Decisions made: deny production certification for live-trading path until broker-linked live-cycle evidence is observed in a run where runtime state progresses past `WAITING_ENTRY`.
- Assumptions: production certification for Live Monitor requires broker-order and audit traceability, not only UI/runtime status updates.
- Validation run: commands and artifacts listed above.
- Known limitations: controlled run did not move past `WAITING_ENTRY`, so broker entry/exit evidence was not produced.
- Next owner / next step: execute the same controlled live-cycle playbook during an interval when strategy entry conditions can trigger, then update this note with broker order IDs, runtime-linked audit evidence, and final go/no-go.

## Default Skills Applied

- `$enterprise-delivery-defaults`
- `$enterprise-coding-standards`
- `$structured-change-documentation`
- `$spring-boot-react-postgresql-production-gate`
