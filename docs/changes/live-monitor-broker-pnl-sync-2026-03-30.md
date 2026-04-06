# Live Monitor Broker P&L Sync Accuracy Fix (2026-03-30)

## Change Summary

- **Status:** Completed
- **Scope:** Make `Live Monitor` runtime and open-position P&L display broker-synced values from Upstox portfolio positions instead of stale strategy-calculated MTM for live runs.
- **Area:** Backend monitor response shaping (`IntraMonitorService`) and repository query support.

## Onboarding Summary (Required)

- **Project purpose:** Multi-tenant trading platform for strategy backtest/paper/live workflows with monitor and audit operations.
- **Tech stack:** Spring Boot 3.3 / Java 21 backend, React + TypeScript frontend, PostgreSQL with Flyway, Playwright for E2E.
- **Testing procedure used for this fix:** targeted backend unit tests for monitor service + Upstox order integration (`mvn -Dtest=... test`).
- **Certification rules applied:** tenant-scoped API behavior preserved, monitor contract compatibility preserved, provider-failure fallback preserved, and regression tests added for new logic paths.

## Problem And Goal

- **Problem:** `Live Monitor` cards could show low/incorrect P&L (e.g., `₹+362`) while broker terminal showed significantly different live day P&L, because monitor values were sourced from internal scan snapshots rather than Upstox position marks.
- **Goal:** For live/open monitor views, prefer broker position marks (LTP + P&L) when ownership is unambiguous, while keeping safe fallback behavior.

## Implementation Summary

1. **Runtime MTM override for live monitor rows**
   - `listRuntimes` now computes live MTM from Upstox `/portfolio/short-term-positions`.
   - Uses runtime-position instrument ownership mapping and only applies broker P&L when an instrument token is uniquely owned by one runtime in the active set.
   - Falls back to stored runtime MTM when mapping is ambiguous or broker data unavailable.

2. **Position mark override for live/open rows**
   - `listPositions` now overrides `currentPrice` (LTP) and `unrealizedPnl` from broker positions for uniquely owned live-open instruments.
   - Keeps existing realized P&L and fallback behavior for ambiguous/shared instruments.

3. **Repository support for efficient enrichment**
   - Added repository methods to fetch open live positions and execution-scoped position sets used for broker mapping.

4. **Safety behavior**
   - Upstox fetch errors no longer break monitor APIs; service logs warning and returns existing stored values.

## Files Touched

- `backend/src/main/java/com/inalgo/trade/admin/IntraMonitorService.java`
- `backend/src/main/java/com/inalgo/trade/admin/IntraMonitorBrokerPnlSupport.java`
- `backend/src/main/java/com/inalgo/trade/repository/IntraPositionSnapshotRepository.java`
- `backend/src/test/java/com/inalgo/trade/admin/IntraMonitorBrokerPnlSupportTest.java`

## Validation Performed

1. `cd backend && mvn -q -Dtest=IntraMonitorBrokerPnlSupportTest,UpstoxOrderServiceTest,IntraLiveOrderServiceTest test` ✅
   - verifies runtime broker-MTM override path
   - verifies live position LTP/unrealized P&L override path
   - verifies shared-instrument collision guard fallback behavior

## Risk And Rollback

- **Risk:** If two active runtimes share the same live instrument token, broker P&L cannot be reliably attributed per runtime.
- **Mitigation:** Explicit collision guard prevents incorrect double-allocation; service falls back to stored MTM for ambiguous tokens.
- **Rollback:** Revert the four touched files above.

## Handoff

- Scope completed: Live monitor now prefers broker-synced marks for live P&L where attribution is safe.
- Known limitation: Shared instrument tokens across runtimes remain fallback to stored values by design.
- Next step: run one live monitor market-hours check and compare runtime card P&L vs Upstox terminal for a uniquely owned instrument runtime.

## Default Skills Applied

- `$enterprise-delivery-defaults`
- `$enterprise-coding-standards`
- `$structured-change-documentation`
- `$spring-boot-react-postgresql-production-gate`
