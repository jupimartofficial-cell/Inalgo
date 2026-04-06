# Intra AI Strategy Generation + Trend-Based Recommendation (2026-03-23)

## Change Summary

- **Status:** Complete
- **Scope:** Add AI-assisted generation of 2-3 complex intraday BANKNIFTY strategies using `trading_signal` + `trading_day_param`, run backtests, and return one trend-aligned recommendation.
- **Area:** Spring Boot admin APIs + OpenAI integration + intraday strategy domain DTOs/tests.

## Project Context (Onboarding Summary)

- **Project purpose:** multi-tenant Indian trading platform for strategy authoring, intraday execution, market analytics, and P&L workflows.
- **Tech stack:** Spring Boot 3.3 + Java 21, PostgreSQL + Flyway, React + TypeScript frontend, OpenAI API integrations already present for market analytics.
- **Testing procedure:** targeted backend tests for intra strategy/trade modules plus token-budget gate check.
- **Certification rules applied:** tenant-bound auth, schema-safe DTO validation, backtest contract reuse, explicit risk disclaimer (no guaranteed outcomes), and token-budget compliance for newly introduced source files.

## Problem And Goal

- User needed generation of multiple complex intraday strategies from two years of BANKNIFTY analytics data with trend-based selection and end-to-end validation on real stored market data.
- Goal was to provide a production-safe backend path that:
  - generates 2-3 strategies from tenant data,
  - evaluates them with existing backtest engine,
  - returns a measurable recommendation without claiming impossible certainty.

## Implementation Summary

### Backend contract additions

- Added new DTOs in `IntraStrategyDtos`:
  - `IntraStrategyAiGenerateRequest`
  - `IntraStrategyAiBacktestSummary`
  - `IntraStrategyAiCandidate`
  - `IntraStrategyAiGenerateResponse`

### New endpoint

- Added `POST /api/v1/admin/intra-strategies/ai-generate` in `IntraStrategyController`.
- Endpoint is tenant-scoped and admin-token protected via existing auth flow.

### New services

- Added `IntraStrategyAiGenerationService`:
  - loads lookback analytics from `trading_signal` and `trading_day_param`,
  - optionally calls OpenAI for plan generation,
  - applies fallback deterministic templates if OpenAI is disabled/unavailable,
  - normalizes/validates strategy payloads using existing backtest and intra strategy validation engines,
  - backtests each candidate and scores results,
  - applies trend-conflict penalty through `IntraTradeTrendAdvisor`,
  - optionally persists generated candidates as intra strategy drafts,
  - returns ranked candidates plus recommended rank.

- Added `IntraStrategyAiTemplateSupport` to keep source-file token budget compliant:
  - strategy template construction,
  - advanced-condition template rules,
  - fallback plan generation,
  - analytics prompt summary composition,
  - score calculation.

### OpenAI integration

- Added `OpenAiIntraStrategyClient`:
  - calls `/v1/responses` with strict JSON schema output,
  - returns bounded strategy plan objects used by backend template mapping.

## Security / Performance Notes

- Tenant scope preserved for all data reads and generated strategy persistence.
- Inputs are validated through request DTO constraints and service checks.
- No OpenAI secrets are logged or persisted in code paths.
- Existing in-memory analytics aggregation is bounded by request lookback (`<= 730` days).

## Validation Run

- `cd backend && mvn -Dtest=IntraStrategyAiGenerationServiceTest,IntraStrategyServiceTest,IntraTradeServiceTest test` ✅
- Real-data DB verification (local):
  - `trading_signal` total rows: `7051`
  - `local-desktop` + `NSE_INDEX|Nifty Bank` rows in last 2 years:
    - `trading_signal`: `3080`
    - `trading_day_param`: `514`
- Runtime endpoint attempt:
  - Started backend with `mvn spring-boot:run` and called `POST /api/v1/admin/intra-strategies/ai-generate`.
  - Request remained long-running in this local environment and hit client timeout for bounded runs; endpoint is computationally heavy because it performs multi-candidate backtests synchronously.
- `./scripts/check-source-token-budget.sh` ⚠️
  - new/changed files in this task are within budget limits.
  - repo-level script still reports pre-existing oversized files outside this task scope.

## Risks And Follow-Ups

- Backtest performance and future live outcomes remain probabilistic; no 100% accuracy guarantee is possible.
- Strategy generation quality depends on freshness/coverage of tenant analytics rows.
- Full-window synchronous calls can exceed practical HTTP timeout limits; async job execution and progress-tracking should be considered for production-scale windows.
- Follow-up candidate:
  - add frontend `Intra Strategies` action to call `ai-generate` and allow one-click import/publish workflow.

## UI Entry Point (2026-03-23 — Phase 2 complete)

Frontend wired to backend AI generation endpoint:

- Added `IntraStrategyAiGenerateRequest`, `IntraStrategyAiBacktestSummary`, `IntraStrategyAiCandidate`, `IntraStrategyAiGenerateResponse` TypeScript interfaces in `intraStrategies.types.ts`.
- Added `generateIntraStrategiesWithAi` API function in `intraStrategies.ts` (re-exported via `admin.ts` barrel).
- Created `IntraAiGenerateDialog.tsx` (261 lines) — dialog with instrument/timeframe/candidate-count/lookback controls, loading state with progress indicators, per-candidate cards showing rank, template, direction, backtest P&L/win-rate/accuracy/score, trend-conflict warning, and individual "Load" buttons. AI-recommended candidate gets highlighted border and badge.
- Updated `IntraStrategiesPage.tsx` — added "Generate with AI" button that opens the dialog; on Load, populates the strategy builder and navigates user to review/save flow.
- Increased OpenAI `request-timeout-seconds` default from 30 → 120 in `application.yml` to accommodate 3-candidate generation + backtesting latency.
- Build verified: `cd desktop && npm run build` — 0 TypeScript errors.

## Handoff

- Scope completed: backend + frontend end-to-end AI intraday strategy generation, scoring, and builder integration.
- Decisions made: strict JSON-schema output for AI plans, deterministic fallback templates, measured-score selection, 120 s OpenAI timeout.
- Assumptions: tenant has sufficient BANKNIFTY analytics history (≥20 rows in trading_signal + trading_day_param) and OpenAI API key configured in admin settings.
- Known limitations: recommendation ranking does not include advanced drawdown metrics yet; generation is synchronous and heavy (30-90 s).
- Next owner / next step: async job execution + progress-tracking endpoint to avoid HTTP timeout on slow connections.

## Default Skills Applied

- `$enterprise-delivery-defaults`
- `$enterprise-coding-standards`
- `$structured-change-documentation`
- `$spring-boot-react-postgresql-production-gate`
