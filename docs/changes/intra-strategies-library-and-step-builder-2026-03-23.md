# Intra Strategies Library + Step Builder (2026-03-23)

## Change Summary

- **Status:** Complete
- **Scope:** Replace Intra strategy authoring with a dedicated strategy library and 5-step builder workflow.
- **Area:** Spring Boot admin APIs + PostgreSQL schema + React Intra strategies/monitor integration.

## Project Context (Onboarding Summary)

- **Project purpose:** multi-tenant Indian trading platform for strategy authoring, intraday monitoring, and P&L review workflows.
- **Tech stack:** Spring Boot 3.3 + Java 21, React 18 + TypeScript + MUI, PostgreSQL + Flyway.
- **Testing procedure used:** backend compile + targeted unit tests, frontend type-check + build.
- **Certification rules applied:** tenant scoping, validator-driven contract checks, API pagination/filtering, release handoff documentation.

## Problem And Goal

- Existing `Intra Strategies` reused backtest strategy CRUD and a giant always-open form, mixing strategy management concerns with execution workflows.
- Goal:
  - add a dedicated `Strategy Library`,
  - convert strategy authoring to a 5-step wizard,
  - keep monitor and P&L flows intact while sourcing monitor strategies from published intra strategies.

## Implementation Summary

### Backend

- Added dedicated strategy domain:
  - `intra_strategy`
  - `intra_strategy_version`
  - `intra_strategy_perf_snapshot`
- Added migration:
  - `backend/src/main/resources/db/migration/V21__create_intra_strategy_tables.sql`
- Added APIs under `/api/v1/admin/intra-strategies`:
  - `GET /library`
  - `POST /draft`
  - `PUT /{strategyId}/draft`
  - `POST /{strategyId}/validate`
  - `POST /{strategyId}/publish`
  - `POST /{strategyId}/duplicate`
  - `POST /{strategyId}/archive`
  - `DELETE /{strategyId}`
  - `GET /{strategyId}/versions`
  - `GET /{strategyId}/versions/{version}`
  - `POST /import-from-backtest`
- Added server-side validation engine with:
  - step-tagged field errors,
  - summary errors,
  - warnings,
  - computed `paperEligible/liveEligible`.
- Added one-time import flow from existing backtest strategies with duplicate-safe handling.

### Frontend

- Added intra strategy API types/client:
  - `desktop/src/renderer/src/api/intraStrategies.types.ts`
  - `desktop/src/renderer/src/api/intraStrategies.ts`
- Rebuilt `Intra Strategies` page into:
  - `IntraStrategyLibrary` table with search/filter/sort/pagination and quick actions.
  - `IntraStrategyBuilder` wizard with 5 steps, Basic/Advanced toggle, inline + summary validation visibility.
  - Import dialog to copy selected backtest strategies.
- Updated `Intra Monitor` strategy source:
  - strategy selector now loads from intra strategy library and fetches latest version payload for selected strategy.

### Data And Contract Impact

- New strategy lifecycle states:
  - `DRAFT`
  - `PAPER_READY`
  - `LIVE_READY`
  - `ARCHIVED`
- Sorting/filtering contract supports:
  - `RECENT_EDITED`, `NAME`, `PERFORMANCE`
  - `status`, `instrument`, `timeframe`, `paperEligible`, `liveEligible`
- Existing Intra execution payload contract remains unchanged.

## Validation Performed

- Backend compile:
  - `cd backend && mvn -DskipTests compile`
- Backend targeted tests:
  - `cd backend && mvn -Dtest=IntraTradeServiceTest,IntraStrategyValidationEngineTest test`
- Frontend type/build:
  - `cd desktop && npm run lint`
  - `cd desktop && npm run build`
- Token-budget scan:
  - `scripts/check-source-token-budget.sh`
  - result remains failing because of pre-existing oversized legacy files (for example `desktop/src/renderer/src/App.tsx`, `backend/src/main/java/com/inalgo/trade/admin/IntraTradeService.java`).

## Risks And Follow-Ups

- Existing oversized legacy source files still violate repository token-budget limits and should be split in follow-up work.
- Strategy library performance sorting currently backfills missing performance snapshots from latest execution rows lazily during library reads.
- End-to-end Playwright coverage for new library/builder flows should be expanded in a follow-up PR.

## Handoff

- Scope completed: new intra strategy backend domain + APIs, wizard/library frontend, monitor strategy-source switch, docs updates.
- Decisions made: immutable version rows per save; archive as default lifecycle action; explicit hard delete guard against execution references.
- Assumptions: monitor consumes published/eligible intra strategy versions; import from backtest is explicit via user action.
- Validation run: backend compile/tests and frontend lint/build as listed above.
- Known limitations: token-budget gate still fails at repo level due pre-existing oversized legacy files.
- Next owner / next step: add targeted Playwright coverage for library actions (validate/publish/duplicate/archive/delete/import) and split remaining oversized legacy files.

## Default Skills Applied

- `$enterprise-delivery-defaults`
- `$enterprise-coding-standards`
- `$structured-change-documentation`
- `$spring-boot-react-postgresql-production-gate`
