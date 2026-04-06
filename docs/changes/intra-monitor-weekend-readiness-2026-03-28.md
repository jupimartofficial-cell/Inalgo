# Intra Monitor Weekend Readiness Check (2026-03-28)

## Change summary
- Status: partial
- Scope: weekend validation, UI wording correction, release-readiness evidence

## Problem and goal
- Problem: Live market E2E cannot be executed on a Saturday, but weekend validation still needs to confirm there are no obvious blockers before the next trading session.
- Goal: validate the Live Monitor runtime path, Upstox market-data endpoints, order-routing configuration, and supporting UI behavior without placing live orders.

## Implementation summary
- Frontend: changed the `WAITING` runtime label from `Scanning Market` to `Waiting for Signal` so closed-market runtimes are not presented as actively scanning.
- Documentation: updated the intra-trade feature doc to reflect that live broker routing is implemented, while broker-status reconciliation remains limited.
- Validation: confirmed active live runtimes refresh to `WAITING_ENTRY` on a weekend, with no positions opened and no broker orders placed.

## Validation performed
- `cd backend && mvn -q -Dtest=IntraLiveOrderServiceTest,IntraMonitorActionServiceTest,IntraMonitorEmergencyServiceTest,UpstoxOrderServiceTest test`
- `cd desktop && npm run build`
- `curl -s -H 'X-Tenant-Id: local-desktop' 'http://localhost:8081/api/v1/upstox/intraday?instrumentKey=NSE_INDEX%7CNifty%20Bank&interval=5minute'`
- `curl -s -H 'X-Tenant-Id: local-desktop' 'http://localhost:8081/api/v1/upstox/option-contracts?instrumentKey=NSE_INDEX%7CNifty%20Bank'`
- Manual browser verification of `/intra/monitor` with live monitor tab selected

## Findings
- Weekend refreshes correctly return execution status `WAITING_ENTRY` with the note `Live scan is waiting for the next trading day`.
- Upstox option-contract lookup is returning live instrument metadata and lot sizes.
- Upstox order book and portfolio endpoints currently return empty datasets for the tenant, so there is no broker-order evidence available from the weekend validation alone.
- `intra_trade_order` currently has no persisted rows in the local database, which means production certification still requires the next live market entry/exit cycle to be observed and captured.

## Risks and follow-ups
- Production certification remains blocked until a market-hours live run creates at least one entry order, one exit order, persisted order rows, and audit evidence.
- Source-token budget still fails because of pre-existing oversized files elsewhere in the repo.

## Agent handoff note
- Continue from `/intra/monitor` during the next India trading session.
- Verify `ORDER_PLACED` audit rows, `intra_trade_order` inserts, Upstox order-book visibility, and P&L persistence from one real live entry/exit cycle.
