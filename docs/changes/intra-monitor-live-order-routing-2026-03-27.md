# Intra Monitor Live Order Routing (2026-03-27)

## Change Summary

- **Status:** Implemented
- **Scope:** Wire live Intra Monitor runtimes to Upstox order placement + audit linkage
- **Area:** backend order routing, monitor runtime/position sync, audit trail, schema

## Problem And Goal

- Live Monitor runtimes were marking entries/exits based on intraday evaluation but never placed broker orders.
- Audit trail lacked order lifecycle events, preventing production certification.
- Goal: route live entry/exit orders through Upstox, persist broker order metadata, and expose audit events.

## Implementation Summary

### Backend

- Added live-order routing service to place Upstox orders for live entry and exit events.
- Added `intra_trade_order` persistence and new columns on `intra_position_snapshot` to track leg and order metadata.
- Updated Intra Monitor runtime sync to generate per-leg positions and trigger live order placement when executions enter or exit.
- Updated manual exit and emergency actions to place live exit orders before closing positions.
- Added audit events (`ORDER_PLACED`, `ORDER_FAILED`) for broker order lifecycle.

### Database

- Added `intra_trade_order` table for broker-order persistence.
- Extended `intra_position_snapshot` with leg metadata, instrument linkage, and quantity fields.

### Tests

- Added `IntraLiveOrderServiceTest` to assert entry/exit order routing behavior.
- Updated monitor action/emergency tests for the new dependency.

## Files And Modules Touched

- `backend/src/main/java/com/inalgo/trade/admin/IntraLiveOrderService.java`
- `backend/src/main/java/com/inalgo/trade/admin/IntraMonitorService.java`
- `backend/src/main/java/com/inalgo/trade/admin/IntraMonitorActionService.java`
- `backend/src/main/java/com/inalgo/trade/admin/IntraMonitorEmergencyService.java`
- `backend/src/main/java/com/inalgo/trade/entity/IntraPositionSnapshotEntity.java`
- `backend/src/main/java/com/inalgo/trade/entity/IntraTradeOrderEntity.java`
- `backend/src/main/java/com/inalgo/trade/repository/IntraTradeOrderRepository.java`
- `backend/src/main/resources/db/migration/V26__add_intra_live_order_tracking.sql`
- `backend/src/test/java/com/inalgo/trade/admin/IntraLiveOrderServiceTest.java`
- `backend/src/test/java/com/inalgo/trade/admin/IntraMonitorActionServiceTest.java`
- `backend/src/test/java/com/inalgo/trade/admin/IntraMonitorEmergencyServiceTest.java`
- `docs/features/intra-trade/feature.md`
- `docs/features/intra-trade/test-cases.md`

## Validation Performed

- `cd backend && mvn -q -Dtest=IntraLiveOrderServiceTest,IntraMonitorActionServiceTest,IntraMonitorEmergencyServiceTest test` ✅
- `scripts/check-source-token-budget.sh` ❌ (pre-existing oversized files; see output in task log)
- Live broker E2E verification pending next market window.

## Risks And Follow-Ups

- Partial exit order routing is supported but currently limited to one partial exit per leg (single `PARTIAL_EXIT` order record).
- UI still shows underlying instrument key for positions; broker instrument key is stored but not yet surfaced in UI.
- End-to-end live-order verification must be re-run during market hours.

## Rollback Notes

- Revert the V26 migration and order-routing service changes.
- Live orders would revert to non-broker simulation only.

## Handoff

- Scope completed: live order routing, order persistence, audit events, and monitor integration.
- Decisions made: per-leg position snapshots, order records in `intra_trade_order`, audit for order lifecycle.
- Assumptions: broker orders are market orders and follow strategy BUY/SELL side and lots.
- Validation run: pending.
- Known limitations: UI does not display broker order IDs yet; partial exits limited to one per leg.
- Next owner / next step: run live end-to-end validation within market hours and verify audit trail + Upstox order reconciliation.

## Default Skills Applied

- `$enterprise-delivery-defaults`
- `$enterprise-coding-standards`
- `$structured-change-documentation`
- `$spring-boot-react-postgresql-production-gate`
