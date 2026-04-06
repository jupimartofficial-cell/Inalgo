# Upstox order base URL split (2026-03-27)

## Change summary
- Status: complete
- Scope: backend configuration + Upstox order client wiring

## Problem and goal
- Problem: Order placement/cancel endpoints use a different Upstox host than market data and portfolio reads.
- Goal: Introduce a dedicated order base URL and route entry/exit order calls through it.

## Implementation summary
- Backend: added `upstox.order-base-url` property and separate RestClient bean for order placement/cancel.
- Database: no changes.
- Frontend: no changes.
- Tests: updated `UpstoxOrderServiceTest` to construct both portfolio and order RestClients.

## Files and modules touched
- `backend/src/main/java/com/inalgo/trade/upstox/UpstoxClientConfig.java`
- `backend/src/main/java/com/inalgo/trade/upstox/UpstoxProperties.java`
- `backend/src/main/java/com/inalgo/trade/upstox/UpstoxClient.java`
- `backend/src/main/java/com/inalgo/trade/upstox/UpstoxOrderService.java`
- `backend/src/main/resources/application.yml`
- `backend/src/test/java/com/inalgo/trade/upstox/UpstoxOrderServiceTest.java`

## Feature impact
- Entry/exit order placement and cancel now use `upstox.order-base-url`.
- Order/position retrieval continues to use `upstox.base-url`.

## API and contract impact
- No changes to internal API contracts. External Upstox endpoints used for order placement/cancel are now configurable separately.

## Validation performed
- Not run in this step (pending live E2E within market hours).

## Risks and follow-ups
- Ensure `UPSTOX_ORDER_BASE_URL` is set correctly in environments.
- Live E2E validation still required before certification.

## Agent handoff note
- Verify order placement/cancel traffic uses `api-hft.upstox.com` (or configured host).
- Run Live Monitor E2E during market hours and capture order IDs + audit trail evidence.
- Start with `UpstoxClientConfig` and `UpstoxOrderService` if wiring changes are needed.
