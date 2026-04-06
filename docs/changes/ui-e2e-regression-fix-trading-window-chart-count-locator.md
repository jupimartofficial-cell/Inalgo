# UI E2E Regression Fix - Trading Window Chart Count Locator

## Onboarding Context

- **Project purpose:** Multi-tenant admin console and backend for migration operations, option chain, backtesting, and trading-window workflows.
- **Tech stack:** Spring Boot 3.3 + Java 21 backend, React 18 + TypeScript + Vite frontend, PostgreSQL 16 with Flyway migrations.
- **Testing procedure used:** `cd desktop && npm run test:e2e`, `cd desktop && npm run lint`, `cd desktop && npm run build`.
- **Certification focus:** UI regression coverage, contract-safe behavior, and stable automated verification for user-visible flows.

## Change Summary

- **Date:** 2026-03-14
- **Status:** Complete
- **Scope:** Fix Playwright strict-locator failure in trading-window E2E flow.

## Problem And Goal

- Full UI E2E run failed in `desktop/e2e/trading-window.spec.ts` because `getByText('2 charts')` matched both the chart-count chip and tooltip text (`Minimum 2 charts required`).
- Goal: make the assertion deterministic without changing runtime UI behavior.

## Implementation Summary

- Updated chart-count assertions in `desktop/e2e/trading-window.spec.ts` to use exact text matching:
  - `getByText('2 charts', { exact: true })`
  - `getByText('3 charts', { exact: true })`
- No backend, API, or database behavior changed.

## Validation Performed

- `cd desktop && npm run test:e2e -- e2e/trading-window.spec.ts` -> pass (6/6)
- `cd desktop && npm run test:e2e` -> pass (22/22)
- `cd desktop && npm run lint` -> pass
- `cd desktop && npm run build` -> pass
- `cd backend && mvn test` -> fail due existing unrelated test: `BacktestRunServiceTest.runBacktest_usesIntradayCandlesForCurrentTradingDay`

## Risks And Follow-Ups

- The fix removes a flaky/ambiguous selector path in Playwright and reduces false failures in UI validation.
- Backend `mvn test` currently has one failing test unrelated to this UI locator change and should be investigated separately.

## Agent Handoff Note

- **Done:** Full desktop E2E suite rerun and passing after trading-window selector hardening.
- **Where to continue:** `desktop/e2e/trading-window.spec.ts` for future trading-window test maintenance.
- **Do not break:** Chart-count assertions should remain exact-match to avoid tooltip collisions under Playwright strict mode.
