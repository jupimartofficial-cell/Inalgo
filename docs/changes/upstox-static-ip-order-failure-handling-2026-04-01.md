# Upstox Static IP Order Failure Handling (2026-04-01)

## Change Summary

- Status: complete
- Scope: backend live-order error handling and test coverage
- Area: `UpstoxOrderService` + `IntraLiveOrderService`

## Project Context (Onboarding Summary)

- Project purpose: multi-tenant Indian trading platform for historical data sync, strategy execution, and live/paper monitoring.
- Tech stack: Spring Boot 3.3 + Java 21 backend, React + TypeScript frontend, PostgreSQL + Flyway.
- Testing procedure used for this scope:
  - `cd backend && mvn -q -Dtest=UpstoxOrderServiceTest,IntraLiveOrderServiceTest test`
  - `scripts/check-source-token-budget.sh` (repo-wide check; existing unrelated violations remain)
- Certification rules applied:
  - feature/test/verification/security/performance gates from `docs/AI_AGENT_DEVELOPMENT.md`
  - release-readiness + rollback expectations from `docs/ENTERPRISE_DELIVERY_STANDARD.md`
  - architecture and coding constraints from `docs/ENTERPRISE_CODING_STANDARD.md`

## Problem And Goal

- Problem: live order placement failures from Upstox static IP restrictions (`UDAPI1154`) surfaced as generic `ValidationException` messages and produced noisy error-stack logs in live-order sync.
- Goal: classify this provider rejection explicitly and record actionable operator guidance in runtime audit trails and logs.

## Delivery Classification

- Delivery scope: backend/API
- Contract impact: internal-only
- Risk level: low
- Operational impact: support runbook and incident triage clarity for live order failures

## Implementation Summary

- Added typed `UpstoxOrderException` with:
  - reason enum (`STATIC_IP_RESTRICTION`, `PROVIDER_REJECTION`, `API_CONNECTIVITY`)
  - provider `errorCode`
  - HTTP status
- Updated `UpstoxOrderService.placeOrder(...)`:
  - parse Upstox error payloads
  - map `UDAPI1154` to `STATIC_IP_RESTRICTION`
  - raise `UpstoxOrderException` for provider rejections and API connectivity failures
- Updated `IntraLiveOrderService`:
  - handle `UpstoxOrderException` explicitly before generic exception handling
  - write actionable audit reason for static IP blocks:
    - whitelist runtime egress IP for the Upstox app and retry
  - downgrade known provider rejection logging from stack-trace `error` to structured `warn`

## Files Touched

- `backend/src/main/java/com/inalgo/trade/upstox/UpstoxOrderException.java`
- `backend/src/main/java/com/inalgo/trade/upstox/UpstoxOrderService.java`
- `backend/src/main/java/com/inalgo/trade/admin/IntraLiveOrderService.java`
- `backend/src/test/java/com/inalgo/trade/upstox/UpstoxOrderServiceTest.java`
- `backend/src/test/java/com/inalgo/trade/admin/IntraLiveOrderServiceTest.java`

## Validation Performed

- `cd backend && mvn -q -Dtest=UpstoxOrderServiceTest,IntraLiveOrderServiceTest test` ✅
  - includes new `UDAPI1154` mapping assertion
  - includes live-order audit-path assertion for actionable static-IP reason
- `scripts/check-source-token-budget.sh` ⚠️
  - repo has pre-existing violations in unrelated large files
  - touched files in this change stayed within limits

## Risks And Rollback

- Risk: low. Changes are limited to error classification and failure messaging.
- Rollback:
  1. revert `UpstoxOrderException` addition and the two service updates
  2. re-run targeted backend tests above

## Handoff

- Scope completed: typed Upstox order failure classification plus live-order audit/log improvements for static-IP blocks.
- Decisions made: keep external API contracts unchanged and contain behavior to internal error handling.
- Assumptions: `UDAPI1154` remains the Upstox code for static IP restrictions.
- Known limitations: this change does not remove provider-side static IP restrictions; it makes runtime handling operationally clear.
- Next owner / next step: ensure production/runtime egress IPs are allowlisted for the configured Upstox app and `UPSTOX_ORDER_BASE_URL` route.

## Default Skills Applied

- `$enterprise-delivery-defaults`
- `$enterprise-coding-standards`
- `$structured-change-documentation`
- `$spring-boot-react-postgresql-production-gate`
