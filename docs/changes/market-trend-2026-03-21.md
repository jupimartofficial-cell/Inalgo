# Market Trend Change Note

## Change Summary

- Date: 2026-03-21
- Status: complete for validated scope
- Scope: backend ingestion, scheduler, persistence, API, frontend Backtest child view, OpenAI advisory analysis, and tests

## Project Context

- Project purpose: multi-tenant trading admin console and backend for candle sync, backtesting, option-chain monitoring, and trading analytics for Indian traders.
- Tech stack: Spring Boot 3.3 / Java 21 backend, PostgreSQL + Flyway, React 18 + TypeScript + Vite frontend, Playwright E2E.
- Testing procedure used for this change:
  - `cd backend && mvn -Dtest=MarketSentimentServiceTest,BacktestAnalyticsServiceTest,UpstoxSchedulersTest test`
  - `cd desktop && npm run build`
  - `cd desktop && npm run test:e2e -- backtest.spec.ts`
  - `cd .. && scripts/check-source-token-budget.sh`
- Certification rules applied:
  - tenant-scoped admin auth
  - explicit DTO/controller/service/repository separation
  - paging and bounded reads on the new list API
  - scheduled job failure isolation
  - documentation updates for new config, endpoint, and feature behavior

## Delivery Classification

- Delivery scope: cross-layer
- Contract impact: external and user-visible
- Risk level: medium
- Operational impact:
  - config: new `market.sentiment.*` properties
  - config: new `openai.*` properties
  - migration: new `market_sentiment_snapshot` table plus AI analysis columns
  - rollout: scheduler begins refreshing after deployment when enabled
  - rollback: disable via `MARKET_SENTIMENT_ENABLED=false` or revert migration/code
  - observability: scheduler warnings on provider failures

## Decisions Made

- Used RSS/official feeds and lightweight API endpoints instead of a broad crawler to reduce provider blocking risk.
- Kept news classification keyword-based and explainable so saved reasons are auditable.
- Stored snapshots per refresh timestamp instead of only keeping the latest row so the UI can filter recent history.
- Extracted market-trend UI state into `useMarketSentimentView.ts` to keep the touched `BacktestPanel.tsx` inside the repo byte budget.
- Added tenant-scoped OpenAI token management through `app_property` instead of static config so operators can rotate credentials from the UI.
- Used OpenAI `Responses` API structured outputs with `gpt-5-mini` for the advisory classifier, while keeping the deterministic rule-based trend as the primary signal.
- Exposed market-trend refresh as `MARKET_SENTIMENT_REFRESH` in `Manage Triggers` and made the fixed cron scheduler defer to trigger-managed cadence when such a trigger exists.

## Validation Run

- Backend tests: pass
- Frontend build: pass
- Backtest E2E spec: pass
- Token budget script: fails at repo level because of pre-existing oversized files unrelated to this change

## Known Limitations

- Gift Nifty current-value parsing depends on ICICI Direct page markup and API shape.
- AI analysis depends on a valid tenant OpenAI API key and external OpenAI availability.
- Repo-wide token-budget compliance is still blocked by existing legacy files outside this change, most notably `desktop/src/renderer/src/App.tsx`.

## Next Step

- If this feature needs higher signal quality later, add a secondary evidence table for matched articles and reduce the oversized `App.tsx` surface by extracting migration/admin state into dedicated hooks/components.
