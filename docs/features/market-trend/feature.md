# Market Trend

## Change Summary

- **Status:** Implemented
- **Feature area:** Backtest analytics market sentiment and trend monitoring
- **Primary users:** Admin users reviewing macro market context before running backtests

## Problem And Goal

- Traders need a single view that combines macro news-driven market posture with technical trend signals from Gift Nifty and S&P 500.
- The goal is to refresh this data automatically every 5 minutes in the backend, preserve tenant scoping, save reasons alongside the computed trend, and expose the result inside `Backtest -> Market Trend` with filters and pagination.

## Implementation Summary

### Backend

- Adds tenant-scoped `market_sentiment_snapshot` persistence with one row per market scope and snapshot timestamp.
- Adds a new backtest analytics API:
  - `GET /api/v1/admin/backtest/market-trends`
- Runs scheduled refresh through `MarketSentimentScheduler` every 5 minutes by default.
- Uses feed/API-first ingestion to reduce IP-blocking risk instead of broad page crawling:
  - Global news feeds:
    - Google News RSS
    - CNBC World RSS
    - CNBC Finance RSS
    - MarketWatch Markets RSS
    - Federal Reserve press releases RSS
  - India news feeds:
    - Google News India RSS
    - Economic Times Markets RSS
    - LiveMint Markets RSS
    - The Hindu BusinessLine Markets RSS
    - NDTV Profit RSS
  - Gift Nifty technical data:
    - ICICI Direct Gift Nifty page for current value
    - ICICI Direct market API for 1Y history
  - S&P 500 technical data:
    - Yahoo chart API for current value and daily history
- Computes:
  - `Global Market Trend` via keyword-based market-impact scoring across monitored categories
  - `Indian Market Trend` via India-focused keyword-based market-impact scoring
  - `Gift Nifty` via current price vs EMA 9 / EMA 21 / EMA 110
  - `S&P 500` via current price vs EMA 9 / EMA 21 / EMA 110
- Saves the computed reason string, source counts, evidence counts, current values, EMAs, and timestamps.
- Adds optional OpenAI-backed secondary analysis when a tenant-level OpenAI API key is configured.
  - Uses the OpenAI `Responses` API with `gpt-5-mini`
  - Stores separate AI fields: analysis, reason, confidence, model, and timestamp
  - Leaves the original rule-based trend as the primary deterministic signal

### Frontend

- Adds `Market Trend` as a new Backtest child menu.
- Adds `AI Analyse` as a separate column in the market-trend grid.
- Adds an admin token-management card for OpenAI in the migration/admin section, following the existing Upstox token update pattern.
- Adds `Market trend` as a trigger job in `Manage Triggers` so operators can control cadence manually.
- Adds a filterable, paginated grid for:
  - market scope
  - trend status
  - snapshot date range
- Shows trend, AI analysis, current value, EMAs, source/evidence counts, and the saved reason text.

### UI Details

- Entry point: `Backtest -> Market Trend` in the left navigation.
- Filters: market scope, trend status, and snapshot date range with pagination.
- Grid columns: trend status, AI analysis, current value and EMAs, source/evidence counts, and reason text.
- Token management: OpenAI token card lives in the migration/admin section and mirrors the existing Upstox token UX.

### Database

- New Flyway migration:
  - `backend/src/main/resources/db/migration/V16__create_market_sentiment_snapshot.sql`
  - `backend/src/main/resources/db/migration/V17__add_market_sentiment_ai_analysis.sql`
  - `backend/src/main/resources/db/migration/V18__extend_admin_trigger_constraints_for_market_sentiment.sql`
- New table:
  - `market_sentiment_snapshot`
- Uniqueness:
  - `(tenant_id, market_scope, snapshot_at)`

### Config

- New config block in `application.yml`:
  - `market.sentiment.enabled`
  - `market.sentiment.tenant-id`
  - `market.sentiment.cron`
  - `market.sentiment.request-timeout-seconds`
  - `market.sentiment.news-lookback-hours`
  - `market.sentiment.max-feed-items-per-source`
  - `openai.enabled`
  - `openai.base-url`
  - `openai.market-analysis-model`
  - `openai.request-timeout-seconds`
  - `openai.reasoning-effort`
  - `openai.max-evidence-items`

## Files And Modules Touched

- `backend/src/main/java/com/inalgo/trade/service/MarketSentimentService.java`
- `backend/src/main/java/com/inalgo/trade/service/MarketSentimentAiService.java`
- `backend/src/main/java/com/inalgo/trade/service/MarketSentimentClient.java`
- `backend/src/main/java/com/inalgo/trade/service/MarketSentimentScheduler.java`
- `backend/src/main/java/com/inalgo/trade/service/OpenAiConfig.java`
- `backend/src/main/java/com/inalgo/trade/service/OpenAiProperties.java`
- `backend/src/main/java/com/inalgo/trade/service/OpenAiTokenService.java`
- `backend/src/main/java/com/inalgo/trade/service/OpenAiMarketAnalysisClient.java`
- `backend/src/main/java/com/inalgo/trade/admin/BacktestAdminController.java`
- `backend/src/main/java/com/inalgo/trade/admin/BacktestAnalyticsService.java`
- `backend/src/main/java/com/inalgo/trade/admin/AdminDtos.java`
- `backend/src/main/java/com/inalgo/trade/entity/MarketSentimentSnapshotEntity.java`
- `backend/src/main/java/com/inalgo/trade/repository/MarketSentimentSnapshotRepository.java`
- `backend/src/main/resources/db/migration/V16__create_market_sentiment_snapshot.sql`
- `desktop/src/renderer/src/components/BacktestMarketTrendView.tsx`
- `desktop/src/renderer/src/components/BacktestPanel.tsx`
- `desktop/src/renderer/src/components/useMarketSentimentView.ts`
- `desktop/src/renderer/src/components/AppSidebar.tsx`
- `desktop/src/renderer/src/api/admin.ts`
- `desktop/src/renderer/src/api/admin.types.ts`

## Feature Impact

- New behavior:
  - automatic 5-minute market-trend refresh for the configured tenant
  - persisted news-driven and technical trend rows
  - new `Backtest -> Market Trend` UI section
- Preserved behavior:
  - existing Backtest P&L, Strategy List, Trading Signal, and Trading Param flows stay unchanged
  - tenant-scoped backtest APIs still require the admin token and `X-Tenant-Id`

## API And Contract Impact

- Added endpoint:
  - `GET /api/v1/admin/backtest/market-trends`
  - `GET /api/v1/admin/openai/token`
  - `POST /api/v1/admin/openai/token`
- Added trigger job:
  - `MARKET_SENTIMENT_REFRESH`
  - appears under `Manage Triggers -> Others`
  - uses a system instrument key `SYSTEM|MARKET_TREND`
- Query params:
  - `marketScope`
  - `trendStatus`
  - `fromSnapshotAt`
  - `toSnapshotAt`
  - `page`
  - `size`
- Response fields include:
  - `marketScope`
  - `marketName`
  - `evaluationType`
  - `trendStatus`
  - `reason`
  - `currentValue`
  - `ema9`
  - `ema21`
  - `ema110`
  - `sourceCount`
  - `evidenceCount`
  - `sourceNames`
  - `dataAsOf`
  - `aiAnalysis`
  - `aiReason`
  - `aiConfidence`
  - `aiModel`
  - `aiUpdatedAt`
  - `snapshotAt`

## Validation And Test Coverage

- Backend:
  - `mvn -Dtest=MarketSentimentServiceTest,BacktestAnalyticsServiceTest,UpstoxSchedulersTest test`
- Frontend:
  - `npm run build`
  - `npm run test:e2e -- backtest.spec.ts`
- Source-file token-budget gate:
  - `scripts/check-source-token-budget.sh`
  - result: still fails due unrelated pre-existing oversized files already present in the repo; touched feature files remain within the file budget after extracting market-trend state from `BacktestPanel.tsx`

## Risks And Follow-Ups

- News classification remains keyword-based and intentionally transparent; OpenAI analysis is stored separately as an advisory signal.
- External feed/API providers can change markup or payload shape. Gift Nifty is the most provider-sensitive path because it depends on ICICI Direct page/API structure.
- Static `market.sentiment.cron` remains as a fallback only when no running or paused `MARKET_SENTIMENT_REFRESH` admin trigger exists for the tenant.
- `scripts/check-source-token-budget.sh` still fails at repo level because of unrelated legacy files such as `desktop/src/renderer/src/App.tsx` and `backend/src/main/java/com/inalgo/trade/admin/BacktestRunService.java`.
- The frontend production bundle remains large (`dist/assets/index-*.js` > 500 kB minified warning). This change did not introduce code splitting.

## Agent Handoff Note

- Open `backend/src/main/java/com/inalgo/trade/service/MarketSentimentService.java` first for scoring rules and technical trend calculation.
- Open `backend/src/main/java/com/inalgo/trade/service/MarketSentimentClient.java` next for provider selection and scraping boundaries.
- Open `desktop/src/renderer/src/components/BacktestMarketTrendView.tsx` and `desktop/src/renderer/src/components/useMarketSentimentView.ts` for UI behavior.
- Do not break tenant scoping, the 5-minute scheduler cadence, or the feed/API-first ingestion approach that avoids broad crawling.
