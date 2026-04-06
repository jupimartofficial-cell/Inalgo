# Backtest Expired Catalog Fallback (2026-03-21)

## Onboarding Context

- **Project purpose:** Multi-tenant trade operations console for migration, option-chain monitoring, trading analytics, and backtest execution workflows.
- **Tech stack:** Spring Boot 3.3 + Java 21 backend, React 18 + TypeScript + Vite frontend, PostgreSQL + Flyway migrations, Playwright E2E for UI validation.
- **Testing procedure used:** `cd backend && mvn test`; `cd desktop && npm run lint && npm run build && npm run test:e2e`; `node scripts/validate-backtest-advance-conditions.mjs`.
- **Certification rules applied:** Feature and validation gates from `docs/AI_AGENT_DEVELOPMENT.md`, release-readiness and rollback expectations from `docs/ENTERPRISE_DELIVERY_STANDARD.md`, and architecture/security/performance boundaries from `docs/ENTERPRISE_CODING_STANDARD.md`.

## Change Summary

- **Status:** Complete
- **Scope:** Fix real-data backtest failures when expired-contract catalog refresh calls Upstox with invalid token.
- **Area:** `ExpiredInstrumentCatalogService` resilience and live validation script defaults.

## Problem And Goal

- Real-data futures backtests for older trade dates could fail with HTTP 400 because expired expiry/contract refresh propagated Upstox auth errors (`401`) instead of degrading gracefully.
- Goal: keep backtest execution operational with cached data or existing fallback pricing paths when provider refresh fails.

## Implementation Summary

- Updated expired instrument catalog retrieval to fail soft:
  - `getExpiries` now returns cached expiries when provider fetch fails.
  - `getOptionExpiries` now retains cached expiries when expired-expiry refresh fails.
  - contract fetch path now returns cached/empty contract list when provider fetch fails, allowing downstream backtest fallback logic to continue.
- Updated `scripts/validate-backtest-advance-conditions.mjs` default API base URL from `http://localhost:8082/api/v1` to `http://localhost:8081/api/v1` to match backend defaults in repo runbooks.
- Added regression tests for provider-failure fallback behavior in expired catalog service.

## Files And Modules Touched

- `backend/src/main/java/com/inalgo/trade/upstox/ExpiredInstrumentCatalogService.java`
- `backend/src/test/java/com/inalgo/trade/upstox/ExpiredInstrumentCatalogServiceTest.java`
- `scripts/validate-backtest-advance-conditions.mjs`

## Validation Performed

- `cd backend && mvn -Dtest=ExpiredInstrumentCatalogServiceTest,BacktestRunServiceTest test` ✅
- `cd backend && mvn test` ✅
- `cd desktop && npm run lint && npm run build && npm run test:e2e` ✅ (25/25)
- `BACKTEST_OUTPUT_PATH=/tmp/backtest-advance-condition-matrix-2026-03-21-after-fix.json node scripts/validate-backtest-advance-conditions.mjs` ✅
  - 14/14 successful real-data scenarios
  - 14/14 executed trade scenarios
  - average reported real-world accuracy: 100%

## Risks And Follow-Ups

- Backtests now continue through provider failures, but notes still include upstream auth failures when live refresh cannot run.
- Upstox token health remains an operational requirement for fresh provider sync, even though cached/fallback paths are now resilient.

## Handoff

- Scope completed: expired catalog provider-failure handling and real-data backtest validation recovery.
- Decisions made: prefer graceful fallback to cached/empty catalog data over failing the whole backtest run.
- Assumptions: existing local candle and contract fallback logic is acceptable when provider refresh is unavailable.
- Validation run: backend unit/integration tests, frontend lint/build/e2e, and live backtest matrix script.
- Known limitations: if cache is empty and provider is unavailable, contract selection may rely on broader fallback pricing notes.
- Next owner / next step: optional follow-up to emit explicit API-level warning fields when provider refresh is skipped due auth failure.

## Default Skills Applied

- `$enterprise-delivery-defaults`
- `$enterprise-coding-standards`
- `$structured-change-documentation`
- `$spring-boot-react-postgresql-production-gate`
