# Upstox Live Portfolio Sync Fix (2026-03-27)

## Change Summary

- **Status:** Complete
- **Area:** Intra P&L live Upstox portfolio sync
- **Scope:** Backend Upstox order/position parsing, targeted regression coverage, and feature documentation refresh

## Project Context (Onboarding Summary)

- **Project purpose:** Multi-tenant India-market trading platform for admin operations, intraday execution monitoring, and P&L review.
- **Tech stack:** Spring Boot 3.3 + Java 21 backend, React 18 + TypeScript + Vite frontend, PostgreSQL 16 + Flyway, Maven and npm validation flows.
- **Testing procedure for this scope:** `cd backend && mvn -Dtest=UpstoxOrderServiceTest test`; repo token-budget scan via `scripts/check-source-token-budget.sh`.
- **Certification rules applied:** controller-service separation, tenant-safe admin endpoints, external-provider payload validation, contract alignment for Upstox live portfolio APIs, and release handoff notes.

## Problem And Goal

- The `Intra P&L` Upstox portfolio tab stopped showing real positions and P&L on 2026-03-27.
- The visible failure was an order sync extraction error from `/v2/order/retrieve-all`, which caused the combined live portfolio refresh to fail and left positions/orders empty in the UI.
- Goal: restore live sync against the current Upstox response format without weakening tenant/auth boundaries or changing the frontend contract.

## Implementation Summary

### Backend

- Updated `UpstoxOrderService` to fetch raw JSON for Upstox order-book and positions APIs, then parse it with Jackson in a tolerant way.
- Added support for both documented payload shapes for the order book:
  - wrapped object with `data`
  - bare top-level array
- Stopped binding `order_timestamp` to `Instant`; Upstox documents it as a user-readable string (`YYYY-MM-DD HH:mm:ss`), so it is now treated as a string and no longer breaks deserialization.
- Mapped positions `last_price` to the internal LTP field, while still accepting the older `ltp` alias when present.

### Frontend

- No frontend API contract change was required.
- Existing `IntraPnlPage` summary cards and tables now receive live data again once backend sync succeeds.

### Tests

- Added `UpstoxOrderServiceTest` coverage for:
  - bare-array order-book payloads
  - wrapped order-book payloads
  - position payloads using `last_price`

## Files And Modules Touched

- `backend/src/main/java/com/inalgo/trade/upstox/UpstoxOrderDtos.java`
- `backend/src/main/java/com/inalgo/trade/upstox/UpstoxOrderService.java`
- `backend/src/test/java/com/inalgo/trade/upstox/UpstoxOrderServiceTest.java`
- `README.md`

## API And Contract Impact

- Backend admin endpoints remain unchanged:
  - `GET /api/v1/admin/intra-trade/upstox/orders`
  - `GET /api/v1/admin/intra-trade/upstox/positions`
- Internal provider contract handling is now more tolerant to the currently documented Upstox payload variants.
- No tenant-header, auth-token, or frontend response-shape change was introduced.

## Validation Performed

- `cd backend && mvn -Dtest=UpstoxOrderServiceTest test`
- `scripts/check-source-token-budget.sh`
  - repo-wide scan still reports pre-existing oversized files outside this fix scope
  - touched files in this fix remain within the token-budget threshold

## Risks And Rollback

- Risk is low and isolated to Upstox live portfolio parsing.
- The parser now explicitly rejects non-array `data` payloads, so materially different future Upstox schema breaks will still surface as visible errors instead of silent bad data.
- Rollback path: revert `UpstoxOrderService`, `UpstoxOrderDtos`, and the targeted test if Upstox payload assumptions need to be reworked again.

## Follow-Ups

- If another live provider payload drift occurs, capture the raw Upstox response body in a sanitized debug path or test fixture so future fixes can match production more directly.
- Consider splitting the combined UI refresh path so a transient order-book failure does not blank already-fetchable positions.

## Agent Handoff Note

- Open `backend/src/main/java/com/inalgo/trade/upstox/UpstoxOrderService.java` first for provider payload parsing behavior.
- Open `backend/src/test/java/com/inalgo/trade/upstox/UpstoxOrderServiceTest.java` next for the documented payload examples that now define the regression boundary.
- Do not break tenant validation in `IntraUpstoxPortfolioController` or the existing frontend response shape consumed by `IntraPnlPage`.

## Default Skills Applied

- `$enterprise-delivery-defaults`
- `$enterprise-coding-standards`
- `$structured-change-documentation`
- `$spring-boot-react-postgresql-production-gate`
