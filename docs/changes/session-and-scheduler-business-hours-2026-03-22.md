# Session And Scheduler Business-Hours Guard

## Change Summary

- Date: 2026-03-22
- Status: complete for validated scope
- Scope: backend auth session duration, admin trigger scheduling, built-in schedulers, runtime configuration, and backend tests

## Project Context

- Project purpose: multi-tenant trading admin console and backend for candle sync, option-chain refresh, trading analytics, and trigger-managed operations for Indian traders.
- Tech stack: Spring Boot 3.3 / Java 21 backend, PostgreSQL + Flyway, React 18 + TypeScript + Vite frontend.
- Testing procedure used for this change:
  - `cd backend && mvn -Dtest=AdminAuthServiceTest,AdminTriggerServiceTest,AdminTriggerServiceBusinessHoursTest,UpstoxSchedulersTest test`
  - `cd .. && scripts/check-source-token-budget.sh`
- Certification rules applied:
  - controller/service/repository separation preserved
  - tenant-scoped trigger execution preserved
  - scheduler behavior documented and regression-tested
  - release-readiness notes captured for config defaults and rollback

## Delivery Classification

- Delivery scope: backend/API
- Contract impact: internal-only runtime behavior change
- Risk level: medium
- Operational impact:
  - config: `ADMIN_SESSION_MINUTES` default increased to `360`
  - config: new `market.hours.*` runtime guard defaults for India market hours
  - rollout: scheduled jobs and admin triggers now defer outside India business hours
  - rollback: restore previous config defaults or revert the scheduler guard changes

## Implementation Summary

### Backend changes

- Increased the default admin session lifetime from 30 minutes to 6 hours.
- Added a centralized India market-hours service that:
  - evaluates business-window eligibility in `Asia/Kolkata`
  - treats Saturday/Sunday as closed days
  - supports a configurable holiday list
- Wired the guard into:
  - `AdminTriggerService`
  - `MarketSentimentScheduler`
  - `UpstoxMigrationScheduler`
  - `UpstoxOptionChainScheduler`
- Deferred due admin triggers to the next business-window opening when they become due outside allowed hours instead of executing immediately.

### Documentation changes

- Updated `README.md` and `CLAUDE.md` for the new session default and market-hours config.
- Updated the `Manage Triggers` feature doc and test cases to reflect business-window execution rules.

## Files And Modules Touched

- `backend/src/main/java/com/inalgo/trade/admin/AdminProperties.java`
- `backend/src/main/java/com/inalgo/trade/admin/AdminTriggerService.java`
- `backend/src/main/java/com/inalgo/trade/admin/TriggerScheduleHelper.java`
- `backend/src/main/java/com/inalgo/trade/service/IndiaMarketHoursProperties.java`
- `backend/src/main/java/com/inalgo/trade/service/IndiaMarketHoursService.java`
- `backend/src/main/java/com/inalgo/trade/service/MarketSentimentScheduler.java`
- `backend/src/main/java/com/inalgo/trade/upstox/UpstoxMigrationScheduler.java`
- `backend/src/main/java/com/inalgo/trade/upstox/UpstoxOptionChainScheduler.java`
- `backend/src/test/java/com/inalgo/trade/admin/AdminAuthServiceTest.java`
- `backend/src/test/java/com/inalgo/trade/admin/AdminTriggerServiceTest.java`
- `backend/src/test/java/com/inalgo/trade/admin/AdminTriggerServiceBusinessHoursTest.java`
- `backend/src/test/java/com/inalgo/trade/upstox/UpstoxSchedulersTest.java`

## Feature Impact

- New behavior:
  - admin sessions last 6 hours by default
  - built-in cron schedulers run only during the India business window
  - due admin triggers are deferred to the next India business-window opening when needed
- Preserved behavior:
  - triggers remain independent of an active admin browser session after they are started
  - tenant-scoped execution and job dispatch behavior stay unchanged

## Validation Run

- Backend targeted tests: pass
- Token-budget script: fails at repo level because of pre-existing oversized files outside this change; touched files for this task were kept within the per-file line budget

## Known Limitations

- India exchange holidays are only enforced when the `market.hours.holidays` list is configured; with the default empty list, Monday-Friday is treated as the business-day set.
- This change does not alter frontend login UX beyond the backend session lifetime.

## Handoff

- Scope completed: session default increase, India business-hour guard, scheduler wiring, tests, and runtime docs.
- Decisions made: centralized the market-window check so triggers and built-in schedulers share one policy.
- Assumptions: default market window is `Asia/Kolkata`, `09:15` to `15:30`, with holidays supplied through config when needed.
- Validation run: targeted backend tests passed; repo token-budget scan still reports unrelated legacy files.
- Known limitations: holiday enforcement is config-driven rather than bundled with an exchange calendar feed.
- Next owner / next step: if the team wants strict NSE/BSE holiday enforcement without manual config, add a maintained exchange-holiday source and feed it into `IndiaMarketHoursProperties`.
