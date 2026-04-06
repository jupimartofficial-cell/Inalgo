# Upstox Live Order ID Recovery + P&L Field Alias Fix (2026-03-30)

## Change Summary

- **Status:** Completed
- **Scope:** Fix false live-order failure when Upstox place-order response omits order ID, and improve position/P&L mapping for alternate Upstox field names.
- **Area:** Backend Upstox integration (`UpstoxOrderService`, DTO mapping, unit tests).

## Problem And Goal

- **Problem 1:** Live entry sometimes logs `Upstox order placement returned no order ID` even though broker order is successfully created.
- **Problem 2:** Position/P&L view can be inaccurate when Upstox payload uses alternate keys (`net_quantity`, `day_pnl`, `unrealized_pnl`) not mapped by DTO.
- **Goal:** Reliably recover broker order ID and normalize position/P&L parsing across supported Upstox payload variants.

## Implementation Summary

1. **Robust order ID extraction from place-order response**
   - Parse raw `/v2/order/place` payload and accept both `data.order_id` and `data.orderId` (plus array fallback).
2. **Order-book fallback by tag when place response lacks ID**
   - Query `/v2/order/retrieve-all` with retry/backoff.
   - Match by generated order tag and recover `order_id`.
3. **Position field alias coverage for P&L accuracy**
   - Map `quantity` with aliases `net_quantity`, `net_qty`.
   - Map `pnl` with aliases `day_pnl`, `unrealized_pnl`.
4. **Resilience hardening**
   - Handle order-book JSON parse failures without breaking retry loop.

## Files Touched

- `backend/src/main/java/com/inalgo/trade/upstox/UpstoxOrderService.java`
- `backend/src/main/java/com/inalgo/trade/upstox/UpstoxOrderDtos.java`
- `backend/src/test/java/com/inalgo/trade/upstox/UpstoxOrderServiceTest.java`

## Validation Performed

1. `cd backend && mvn -q -Dtest=UpstoxOrderServiceTest,IntraLiveOrderServiceTest test` ✅
   - verified place-order ID mapping for snake_case
   - verified fallback ID recovery from order book using tag
   - verified position mapping for `net_quantity` + `day_pnl`

## Risk And Rollback

- **Risk:** Order-book fallback depends on tag uniqueness and timely order-book visibility.
- **Mitigation:** Existing deterministic tag generation retained; retry attempts are bounded.
- **Rollback:** Revert the three touched files above to previous parser behavior.

## Handoff

- Scope completed: backend reliability fix for live order ID and P&L field mapping.
- Assumptions: Upstox may return variant payload shapes under live load.
- Known limitation: If order book visibility is delayed beyond retry window, fallback may still miss order ID.
- Next step: run one controlled market-hours live entry/exit cycle and capture runtime ID + recovered broker order IDs in audit trail.

## Default Skills Applied

- `$enterprise-delivery-defaults`
- `$enterprise-coding-standards`
- `$structured-change-documentation`
- `$spring-boot-react-postgresql-production-gate`
