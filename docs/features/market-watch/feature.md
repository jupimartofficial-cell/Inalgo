# Market Watch

## Change Summary

- **Status:** Implemented and validated with live tenant data
- **Feature area:** Market Signals real-time monitoring workspace
- **Primary users:** Admin users monitoring live trading analytics and candles

## Problem And Goal

- Traders need a dense real-time watchboard under `Market Signals` so they can monitor critical market columns without reopening multiple grids.
- The goal is to let users assemble small movable tiles from `Trading Signal`, `Trading Param`, `Market Sentiment`, and `Candles`, choose the primary column each tile emphasizes, auto-refresh the data, and persist the layout in the backend.

## Implementation Summary

### Backend

- Persists per-tenant, per-user Market Watch layouts in `market_watch_config`.
- Serves tenant-scoped Market Watch APIs:
  - `GET /api/v1/admin/market-watch/config`
  - `PUT /api/v1/admin/market-watch/config`
  - `GET /api/v1/admin/market-watch/data`
- Normalizes stored legacy layouts so older saved tiles gain a safe default `primaryField`.
- Returns a generic tile payload that exposes:
  - the chosen primary field label and value
  - status label and tone
  - a bounded list of supporting fields
  - formatted update time
- Excludes irrelevant audit columns such as ids and update timestamps from tile configuration.

### Frontend

- Adds the `Market Watch` child screen under `Market Signals`.
- Renders a compact multi-column watchboard with:
  - chosen-column emphasis per tile
  - drag handle plus move-earlier and move-later controls
  - configurable refresh cadence
  - configurable grid columns
  - live refresh countdown
- Adds a tile editor that supports:
  - source selection
  - instrument selection where relevant
  - timeframe selection where relevant
  - market-scope selection for sentiment tiles
  - primary column selection for the chosen source
- Persists tile edits, order, refresh interval, and grid width through the backend config API.
- Hardens the `Accuracy` tab report parsing so `Run` does not blank the screen when the backend response is missing expected keys or uses legacy key variants (`india` / `global`).
- When the accuracy payload is invalid, shows a user-visible error instead of crashing the React tree.
- Accuracy tab now evaluates trend accuracy by market session windows using benchmark minute candles:
  - `Market Open` (`09:15-09:30` IST)
  - `Market Middle` (`11:30-14:30` IST)
  - `Market Close` (`14:30-15:30` IST)
- Accuracy tab now includes a candle timeframe selector (`5 min` or `15 min`) and displays reference window period labels directly in the UI.

### UI Details

- Entry point: `Market Signals -> Market Watch` in the left navigation.
- Layout: tile grid with a header row that exposes refresh cadence, grid width, and save action.
- Tile controls: move earlier/later, drag handle, and edit action for source/field selection.
- Data emphasis: each tile promotes a chosen primary column with status tone and update time.
- Persistence: layout and tile configuration are stored per user and reloaded on page open.

### UI Direction

- The watchboard uses a “trading desk / mission control” layout with compact cards, prominent status chips, and a strong primary metric per tile.
- Research-driven choices applied:
  - dense cards with a clear scan hierarchy instead of oversized panels
  - visible refresh state so polling is operationally transparent
  - move controls on every tile so the layout can be rearranged without hidden gestures

## Files And Modules Touched

- `backend/src/main/java/com/inalgo/trade/admin/MarketWatchController.java`
- `backend/src/main/java/com/inalgo/trade/admin/MarketWatchDtos.java`
- `backend/src/main/java/com/inalgo/trade/admin/MarketWatchService.java`
- `backend/src/main/java/com/inalgo/trade/entity/MarketWatchConfigEntity.java`
- `backend/src/main/java/com/inalgo/trade/repository/MarketWatchConfigRepository.java`
- `backend/src/main/resources/db/migration/V19__create_market_watch_config.sql`
- `desktop/src/renderer/src/components/market-watch/MarketWatchPanel.tsx`
- `desktop/src/renderer/src/components/market-watch/MarketWatchTileCard.tsx`
- `desktop/src/renderer/src/components/market-watch/TileConfigDialog.tsx`
- `desktop/src/renderer/src/components/market-watch/catalog.ts`
- `desktop/src/renderer/src/api/admin.ts`
- `desktop/src/renderer/src/api/admin.types.ts`

## Feature Impact

- New behavior:
  - each tile can emphasize a selected relevant column from its source table
  - every tile can be reordered
  - tile order and chosen columns persist for the user
  - the screen refreshes using the saved cadence and shows the countdown
- Preserved behavior:
  - tenant scoping remains enforced
  - saved layouts remain per user
  - real data still comes from the latest tenant-scoped rows in `trading_signal`, `trading_day_param`, `market_sentiment_snapshot`, and `candles`

## API And Contract Impact

- Request shape for saved config tiles now includes:
  - `primaryField`
- Data response for each tile now includes:
  - `primaryField`
  - `primaryLabel`
  - `primaryValue`
  - `statusLabel`
  - `statusTone`
  - `updatedAt`
  - `fields[]`
- Stable source values:
  - `TRADING_SIGNAL`
  - `TRADING_PARAM`
  - `MARKET_SENTIMENT`
  - `CANDLE`
- Accuracy API:
  - `GET /api/v1/admin/market-watch/accuracy?lookbackDays=<n>&candleIntervalMinutes=<5|15>`
  - Response now includes:
    - `candleIntervalMinutes`
    - scope-level `windows[]` (`OPEN`, `MIDDLE`, `CLOSE`) with per-window metrics and `referencePeriod`

## Database Impact

- Layout persistence table:
  - `market_watch_config`
- Unique key:
  - `(tenant_id, username)`
- Migration:
  - `backend/src/main/resources/db/migration/V19__create_market_watch_config.sql`
- Backward-compatibility rule:
  - older saved JSON without `primaryField` is normalized on read and save

## Validation Performed

- Backend:
  - `cd backend && mvn -Dtest=MarketWatchServiceTest test`
- Frontend:
  - `cd desktop && npm run lint`
  - `cd desktop && npm run build`
  - `cd desktop && npm run test:e2e -- market-watch.spec.ts`
  - `cd desktop && npm run build` (accuracy-tab response-normalization fix)
- Live DB/API validation:
  - authenticated against tenant `local-desktop`
  - verified real rows exist in `trading_signal`, `trading_day_param`, `market_sentiment_snapshot`, and `candles`
  - verified `GET /api/v1/admin/market-watch/config` and `GET /api/v1/admin/market-watch/data` return live tenant data
  - verified in-browser edit of `Nifty overall` from `Gap Type` to `Prev Close`, then saved and confirmed persisted config
- Token-budget scan:
  - `scripts/check-source-token-budget.sh`
  - result: repo-level failure remains due unrelated legacy oversized files such as `desktop/src/renderer/src/App.tsx`, `backend/src/main/java/com/inalgo/trade/admin/AdminDtos.java`, and `backend/src/main/java/com/inalgo/trade/admin/BacktestConditionService.java`
  - touched Market Watch source files are within the budget after the panel split

## Risks And Follow-Ups

- The production bundle still emits the pre-existing large-chunk warning during `npm run build`.
- Real-time refresh is polling-based; if tile count grows significantly beyond the current cap, revisit batching and backend fetch cost.
- The shared `AdminDtos.java` file still exceeds the repo token-budget threshold, but this task avoided expanding it by moving Market Watch contracts into `MarketWatchDtos.java`.

## Agent Handoff Note

- Open `backend/src/main/java/com/inalgo/trade/admin/MarketWatchService.java` first for layout normalization and source-to-field mapping.
- Open `desktop/src/renderer/src/components/market-watch/MarketWatchPanel.tsx` next for refresh cadence, persistence, and reorder flow.
- Do not break tenant scoping, persisted per-user layouts, or the exclusion of irrelevant audit columns from tile configuration.
