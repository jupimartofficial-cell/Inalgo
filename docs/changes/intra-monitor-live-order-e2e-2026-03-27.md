# Intra Monitor Live Order E2E Validation (2026-03-27)

## Change Summary

- **Status:** Partial (live order routing not wired to runtime)
- **Scope:** End-to-end validation for `Backtest -> Intra Monitor -> Live Monitor` with live Upstox environment
- **Area:** Intra Monitor Live Monitor runtime, Upstox order/position APIs, audit trail

## Project Context (Onboarding Summary)

- **Project purpose:** tenant-scoped India-market trading platform for strategy authoring, intraday execution, monitoring, and P&L review.
- **Tech stack:** Spring Boot 3.3 + Java 21 backend, React 18 + TypeScript + Vite frontend, PostgreSQL + Flyway, Playwright E2E.
- **Testing procedure expected:** `cd backend && mvn test`, `cd desktop && npm run build`, targeted Playwright suites, token-budget scan.
- **Certification rules applied:** tenant isolation, controller/service separation, contract alignment, live/paper semantics, validation evidence, release-readiness + rollback notes.

## Execution Window

- **Live market window:** 2026-03-27 09:15–15:30 IST
- **Validation time:** 2026-03-27 15:09–15:15 IST

## Validation Evidence

### UI Observation (Live Monitor)

- Live Monitor shows active runtimes, auto-refresh, and audit feed.
- Screenshot captured: `artifacts/live-monitor-2026-03-27.png`.

### Runtime Status (Backend)

`GET /api/v1/admin/intra-trade/monitor/runtimes?username=admin&status=ACTIVE` returned:

- LIVE runtime `Simple Breakdown` transitioned to `EXITED` at 15:15 IST (exit window met).
- LIVE runtime `OHL First candle BreakDown` remained `ENTERED` with MTM updates.
- Additional LIVE runtimes remained `WAITING` (no entry signal yet).

### Upstox Orders and Positions

`GET /api/v1/admin/intra-trade/orders` returned completed BUY/SELL orders for `NSE_FO|52393`.

`GET /api/v1/admin/intra-trade/positions` returned `netQuantity=0` and P&L for the same instrument.

**Mismatch found:** the live runtime executions currently tracked by `intra_trade_execution` and the runtime rows in `intra_runtime_strategy` reference different instrument keys (`NSE_FO|52395` for Simple Breakdown) and do not store broker order IDs. There is no persisted linkage between runtime/execution and Upstox orders.

### Audit Trail

`intra_event_audit` shows only:

- `SNAPSHOT_REFRESHED`
- `STRATEGY_STARTED`
- `MANUAL_EXIT`
- `POSITION_EXIT`

No order-placement or order-exit audit events are recorded.

## Key Findings

1. **Active Live Strategies are scanning and updating runtime status** (WAITING / ENTERED / EXITED) based on intraday evaluation.
2. **Real Upstox orders exist in the tenant**, but there is **no deterministic linkage** between Active Live Strategies and Upstox order placement.
3. **Live execution flow does not invoke `/admin/intra-trade/orders/place`** automatically; order placement is exposed only as an API endpoint and is not wired into the live runtime engine.
4. **Audit Trail does not record broker order creation or broker exit actions**, so order lifecycle is not traceable from Live Monitor.

## Production Certification Status

**Not certified for live trading.**

Blocking gaps:

- Live runtime engine does not place or exit broker orders.
- Audit trail does not capture order placement/exit events.
- Execution records do not persist broker order IDs for reconciliation.

## Risks And Follow-Ups

- Live mode currently simulates entry/exit using intraday candles only. Without order routing, Active Live Strategies can drift from actual broker state.
- Without order IDs in the execution/audit trail, reconciliation with Upstox is manual and fragile.

## Required Next Steps

1. Wire live runtime entry/exit into Upstox order placement.
2. Persist broker order IDs and link them to `intra_trade_execution` and `intra_runtime_strategy`.
3. Append `ORDER_PLACED` / `ORDER_EXITED` (and failure) events to `intra_event_audit`.
4. Add validation tests + update feature docs/test cases to cover broker-order lifecycle.

## Handoff

- Scope completed: UI live monitor verification, backend runtime status verification, Upstox orders/positions inspection, audit trail inspection.
- Decisions made: blocked production certification until order-routing integration exists.
- Assumptions: live trading certification requires runtime->broker order linkage and audit traceability.
- Validation run: manual UI observation + backend API calls (see above).
- Known limitations: no automated tests or broker order linkage yet.
- Next owner / next step: implement live order routing and audit trail integration in `IntraTradeService`/`IntraMonitorService`, then re-run end-to-end validation within market hours.

## Default Skills Applied

- `$enterprise-delivery-defaults`
- `$enterprise-coding-standards`
- `$structured-change-documentation`
- `$spring-boot-react-postgresql-production-gate`
