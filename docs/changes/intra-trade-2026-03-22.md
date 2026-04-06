# Intra Trade (2026-03-22)

## Change Summary

- **Status:** Complete
- **Scope:** Add an intraday execution workspace with saved live, paper, and backtest runs plus embedded Market Watch context
- **Area:** backend Intra Trade execution API + persistence + frontend Backtest child screen

## Problem And Goal

- The repo had strategy authoring, historical backtests, and Market Watch, but no single workspace that combined:
  - intraday strategy selection,
  - saved strategy reuse,
  - live market context,
  - live/paper result persistence.
- Goal:
  - add `Intra Trade`,
  - keep the screen close to `Backtest P&L`,
  - show the user’s live Market Watch layout on the same page,
  - save run results in the backend.

## Implementation Summary

### Backend

- Added `IntraTradeController`, `IntraTradeService`, `IntraTradeDtos`, `IntraTradeExecutionEntity`, and `IntraTradeExecutionRepository`.
- Added `V20__create_intra_trade_execution.sql`.
- Reused `BacktestStrategyService` and `BacktestRunService` so live/paper/backtest modes share the existing strategy and pricing contract.
- Added explicit Intra Trade validation:
  - option legs only,
  - live/paper require `INTRADAY`,
  - live/paper scan timeframe must be minute-based.
- Patched live/paper scan execution so the selected scan timeframe is actually applied during runtime:
  - wait for the first completed post-entry scan candle,
  - evaluate up to the latest completed scan candle for the saved cadence,
  - reuse the saved scan timeframe during refresh.

### Frontend

- Added `Backtest -> Intra Trade`.
- Added:
  - `IntraTradePanel.tsx`
  - `IntraTradeMarketWatchBoard.tsx`
  - `IntraTradeExecutionHistory.tsx`
  - API/types split in `intraTrade.ts` and `intraTrade.types.ts`
- Reused `BacktestStrategyForm` and `BacktestResultsPanel`.
- Reused saved Market Watch config/data as a read-only live context board inside the new screen.

### Documentation

- Added stable feature docs:
  - `docs/features/intra-trade/feature.md`
  - `docs/features/intra-trade/test-cases.md`
- Added this change note.
- Updated `README.md` feature references.

## Files And Modules Touched

- `backend/src/main/java/com/inalgo/trade/admin/IntraTradeController.java`
- `backend/src/main/java/com/inalgo/trade/admin/IntraTradeService.java`
- `backend/src/main/java/com/inalgo/trade/admin/IntraTradeDtos.java`
- `backend/src/main/java/com/inalgo/trade/entity/IntraTradeExecutionEntity.java`
- `backend/src/main/java/com/inalgo/trade/repository/IntraTradeExecutionRepository.java`
- `backend/src/main/resources/db/migration/V20__create_intra_trade_execution.sql`
- `backend/src/test/java/com/inalgo/trade/admin/IntraTradeServiceTest.java`
- `desktop/src/renderer/src/components/IntraTradePanel.tsx`
- `desktop/src/renderer/src/components/intra-trade/IntraTradeMarketWatchBoard.tsx`
- `desktop/src/renderer/src/components/intra-trade/IntraTradeExecutionHistory.tsx`
- `desktop/src/renderer/src/api/intraTrade.ts`
- `desktop/src/renderer/src/api/intraTrade.types.ts`
- `desktop/e2e/intra-trade.spec.ts`

## Feature Impact

- New behavior:
  - saved strategies can launch live, paper, or backtest executions from one screen
  - same-user Market Watch tiles are visible on the same screen
  - saved runs can be reopened and refreshed
- Preserved behavior:
  - existing backtest strategy CRUD contract remains unchanged
  - Market Watch configuration still lives in its original screen

## API And Contract Impact

- New Intra Trade endpoints:
  - `GET /api/v1/admin/intra-trade/executions`
  - `GET /api/v1/admin/intra-trade/executions/{executionId}`
  - `POST /api/v1/admin/intra-trade/run`
  - `POST /api/v1/admin/intra-trade/executions/{executionId}/refresh`
- Live mode note:
  - execution snapshots are persisted
  - broker order placement is not implemented in this repo

## Database Impact

- Added `intra_trade_execution`.
- No existing table or contract was modified.
- Rollback:
  - disable navigation usage,
  - revert API/controller/service/entity/repository additions,
  - revert Flyway `V20` only before shared environments have applied it.

## Validation Performed

- `cd backend && mvn -Dtest=IntraTradeServiceTest test`
- `cd backend && mvn -Dtest=IntraTradeServiceTest,BacktestRunServiceTest,BacktestConditionServiceTest,OptionChainServiceTest test`
- `cd desktop && npm run build`
- `cd desktop && npm run test:e2e -- intra-trade.spec.ts`
- `scripts/check-source-token-budget.sh`
  - repo-level failure is still expected because of unrelated legacy oversized files such as `desktop/src/renderer/src/App.tsx`
- Real-data API validation against the running stack on `http://localhost:8081`:
  - `POST /api/v1/admin/backtest/run` with saved strategy `Test SELL` (`id=3`) over `2026-03-01` through `2026-03-21`
  - `POST /api/v1/admin/intra-trade/run` in `BACKTEST` mode with the same strategy and tenant `local-desktop`
  - both runs returned `executedTrades=3`, `totalPnl=32728.50`, `realWorldAccuracyPct=100.00`
  - option-chain expiry lookup for `NSE_INDEX|Nifty Bank` included `2026-03-30`, which matched the monthly option expiry selected in the run output

## Risks And Follow-Ups

- Live mode is broker-ready in contract shape only; it is not broker-routed yet.
- Direct live-market validation was not possible on Sunday, March 22, 2026 because the exchange was closed, so live/paper cadence behavior was validated with targeted backend tests rather than open-market execution.
- App shell still contains pre-existing oversized files, especially `App.tsx`.
- A future broker integration should extend the current `LIVE` mode contract instead of introducing a parallel execution model.

## Handoff

- Scope completed: backend execution persistence, frontend workspace, embedded live Market Watch, saved run reopen/refresh, and docs.
- Decisions made: placed the feature under `Backtest`; reused existing strategy authoring and result contracts; kept Market Watch read-only inside Intra Trade.
- Assumptions: users benefit from a single intraday workspace more than from creating a separate strategy format; live mode must stay explicit about missing broker routing.
- Validation run: targeted backend unit test, frontend build, and targeted Playwright spec.
- Known limitations: no broker order placement; live/paper depend on current-day candle coverage.
- Next owner / next step: add broker routing and position reconciliation behind the existing `LIVE` execution contract.

## Default Skills Applied

- `$enterprise-delivery-defaults`
- `$enterprise-coding-standards`
- `$structured-change-documentation`
- `$spring-boot-react-postgresql-production-gate`
