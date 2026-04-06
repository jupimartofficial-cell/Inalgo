# Intra Trade

## Change Summary

- **Status:** Implemented
- **Feature area:** Route-based intraday build, run, and review workspace
- **Primary users:** Admin users preparing and reviewing option-only intraday executions

## Problem And Goal

- Traders needed the previous all-in-one `Intra Trade` screen split into a clearer journey:
  - build strategies,
  - monitor live or paper execution,
  - review saved execution P&L independently.
- The goal is to reduce cognitive load by separating setup, execution, and review while keeping shared trading context visible across the workflow.

## Innovation Analysis Applied

- Reused the existing Backtest strategy contract and builder so users still work with one strategy definition model.
- Split the UI into three dedicated pages under top-level `Intra` navigation:
  - `Intra Strategies`
  - `Intra Monitor`
  - `Intra P&L`
- Replaced the old always-open strategy form in `Intra Strategies` with:
  - `Strategy Library` (search/filter/sort/pagination + quick actions),
  - `Strategy Builder` 5-step wizard (Basic setup, Entry conditions, Exit & risk, Position setup, Review & save),
  - draft/validate/publish versioned lifecycle.
- Added route entry points for direct navigation and deep linking:
  - `/intra/strategies`
  - `/intra/monitor`
  - `/intra/pnl`
- Added a shared intra workspace header so mode, workspace, exchange, timezone, and market-session context stay visible when moving between pages.

## Implementation Summary

### Backend

- Added a dedicated tenant-scoped `Intra Strategy` domain with immutable versions:
  - `intra_strategy`
  - `intra_strategy_version`
  - `intra_strategy_perf_snapshot`
- Added `Intra Strategy` APIs:
  - `GET /api/v1/admin/intra-strategies/library`
  - `POST /api/v1/admin/intra-strategies/draft`
  - `PUT /api/v1/admin/intra-strategies/{strategyId}/draft`
  - `POST /api/v1/admin/intra-strategies/{strategyId}/validate`
  - `POST /api/v1/admin/intra-strategies/{strategyId}/publish`
  - `POST /api/v1/admin/intra-strategies/{strategyId}/duplicate`
  - `POST /api/v1/admin/intra-strategies/{strategyId}/archive`
  - `DELETE /api/v1/admin/intra-strategies/{strategyId}`
  - `GET /api/v1/admin/intra-strategies/{strategyId}/versions`
  - `GET /api/v1/admin/intra-strategies/{strategyId}/versions/{version}`
  - `POST /api/v1/admin/intra-strategies/import-from-backtest`
- Added server-side validation output for builder flows:
  - step-aware field errors,
  - summary errors,
  - warnings,
  - computed `paperEligible` / `liveEligible`.
- Added a tenant-scoped `Intra Trade` execution API:
  - `GET /api/v1/admin/intra-trade/executions`
  - `GET /api/v1/admin/intra-trade/executions/{executionId}`
  - `POST /api/v1/admin/intra-trade/run`
  - `POST /api/v1/admin/intra-trade/executions/{executionId}/refresh`
- Added `intra_trade_execution` persistence for saved runs.
- Added `Intra Monitor` and `Intra P&L` service separation:
  - `IntraMonitorService` for runtime snapshots, position snapshots, intervention APIs, and event/audit feed.
  - `IntraPnlService` for dashboard aggregates and report exports.
- Blocks starting a new `LIVE` run when an active live runtime already exists for the same strategy and user.
- Added runtime-state and analytics foundation tables:
  - `intra_runtime_strategy`
  - `intra_position_snapshot`
  - `intra_event_audit` (append-only audit/event stream)
  - `intra_pnl_daily`
- Added `intra_trade_execution` compatibility columns:
  - `exit_reason`
  - `account_ref`
- Reused the existing backtest strategy contract and run engine so:
  - historical backtest mode saves full historical results,
  - live and paper modes evaluate today’s intraday session and save the current execution snapshot.
- Enforced current feature boundaries:
  - option legs only,
  - live/paper modes require `INTRADAY`,
  - live/paper scan timeframe is minute-based.

### Frontend

- Replaced the old `Backtest -> Intra Trade` single-screen subsection with top-level `Intra` pages:
  - `Intra -> Intra Strategies`
  - `Intra -> Intra Monitor`
  - `Intra -> Intra P&L`
- `Intra Strategies` now owns:
  - strategy library browsing and quick actions (`Edit`, `Duplicate`, `Archive`, `Delete`),
  - one-time import wizard from existing backtest strategies,
  - 5-step builder wizard with Basic/Advanced mode toggle,
  - `Save Draft`, `Save & Validate`, `Publish Paper`, and `Publish Live` actions.
- `Intra Monitor` owns strategy selection, execution mode, scan instrument/timeframe, execution status, immediate exit, and the embedded read-only `Market Watch` board.
- `Intra Monitor` now includes:
  - always-visible trading command bar with selected strategy, mode, runtime state, last scan, market status, data freshness, open positions, MTM, and a state-driven primary CTA
  - data-freshness indicator advances from the last market-summary refresh and flags stale data after the configured threshold
  - live and paper scan windows now follow the configured India market-hours calendar, including configured open/close overrides and holidays
  - intraday advanced-condition evaluation now compares `Trading Signal.currentClose` against the current completed candle and `Trading Signal.previousClose` against the prior completed candle so live trigger decisions stay timeframe-correct
  - live auto-refresh now refreshes active live executions before reloading runtime, position, and event snapshots so `Current signal`, `Freshness`, and `Audit Trail` stay aligned with the latest runtime evaluation
  - runtime signal badges prefer the latest stored trading signal for the execution instrument and timeframe, which prevents false `UNKNOWN` states when monitor notes are sparse
  - trader-mode split:
    - `Quick Test` for paper-first setup, recent saved strategies, one-click paper runs, and paper-to-live promotion
      - `Saved Strategies` default filter now opens in `Active only`, so archived strategies stay hidden unless explicitly selected
    - `Historical Backtest` selection inside `Quick Test` now exposes inline `Start date` and `End date` pickers and routes the CTA through the historical run path instead of the paper-run path
    - `Live Monitor` for active live runtimes, open positions, risk controls, and audit events
  - status-first master/detail layout with strategy/runtime selection on the left and detail panes on the right
  - paginated strategy, runtime, position, and event collections instead of unbounded full-screen grids
  - destructive actions moved out of list rows into detail panels and a collapsed emergency section
  - paper-to-live promotion checklist covering market-open state, data freshness, strategy publish status, risk controls, and recent paper validation
  - live destructive action confirmations (`CONFIRM LIVE` + reason capture)
- `Intra P&L` owns saved execution history and unified analytics:
  - summary cards (`Total`, `Today`, `Realized`, `Unrealized`, `Win rate`, `Avg gain/loss`, `Max drawdown`)
  - mode/date/strategy/instrument/account/status filters
  - daily and cumulative trend visual blocks
  - strategy performance table and trade ledger table
  - export actions for `CSV`, `XLSX`, and summary `PDF`
- Added shared intra workspace state persisted in browser session storage so strategy context, mode, instrument, and timeframe do not reset when switching intra pages.

### UI Details

- Entry points: `Intra -> Intra Strategies`, `Intra -> Intra Monitor`, and `Intra -> Intra P&L`.
- Shared header: workspace, mode, exchange, timezone, and market-session context remain visible across routes.
- Intra Strategies layout: library grid with quick actions plus a 5-step builder wizard (Basic, Entry, Exit/Risk, Position, Review).
- Intra Monitor layout: status-first master/detail with strategy/runtime selection on the left and detail panes on the right.
- Command bar: always-visible runtime context (strategy, mode, state, last scan, market status, freshness, MTM, and primary CTA).
- Quick Test: paper-first flow with recent strategies and paper-to-live promotion checklist.
- Live Monitor: runtime controls, open positions, emergency actions, and audit/event feed.
- Intra P&L layout: collapsible panels for filters, summary metrics, performance charts, strategy performance, and trade ledger.

## Feature Impact

- New behavior:
  - option-only intraday strategies move through a route-based build, run, and review flow instead of one setup-heavy page
  - strategy management is now isolated from execution/P&L with dedicated strategy lifecycle states:
    - `DRAFT`
    - `PAPER_READY`
    - `LIVE_READY`
    - `ARCHIVED`
  - strategy edits produce immutable versions and publish uses validator-driven eligibility
  - monitor strategy selector now reads from published intra-strategy library rows (drafts excluded by default)
  - shared intra context remains visible across strategy authoring, monitoring, and P&L review
  - each route can be opened independently through `/intra/strategies`, `/intra/monitor`, and `/intra/pnl`
  - selecting `Historical Backtest` from `Intra Monitor -> Quick Test` now keeps the chosen historical date range editable directly in the setup card before execution
  - `Quick Test` strategy list now defaults to active strategies (`ARCHIVED` excluded by default) while keeping explicit status filters for `All` and `Archived` views
  - saved runs can still be reopened, edited through monitor, deleted, immediately exited, and refreshed
  - duplicate live starts are rejected when a live runtime is already active for the same strategy and user
  - market summary session-state chips now use the same configured market-hours window as live/paper runtime evaluation
- Preserved behavior:
  - existing `Backtest P&L`, `Strategy List`, `Trading Signal`, `Trading Param`, and `Market Trend` flows remain available
  - existing backtest strategy CRUD contract is unchanged
  - Market Watch configuration still lives under `Market Signals -> Market Watch`

## API And Contract Impact

- New strategy library request filters:
  - `q`
  - `status`
  - `instrument`
  - `timeframe`
  - `paperEligible`
  - `liveEligible`
  - `sort` (`RECENT_EDITED`, `NAME`, `PERFORMANCE`)
- New execution modes:
  - `LIVE`
  - `PAPER`
  - `BACKTEST`
- Intra Trade run request includes:
  - `username`
  - optional `strategyId`
  - `mode`
  - `scanInstrumentKey`
  - `scanTimeframeUnit`
  - `scanTimeframeInterval`
  - `strategy`
- Saved execution response includes:
  - execution identity and timestamps
  - mode and status
  - strategy snapshot
  - saved backtest-compatible result payload
- Additional execution actions:
  - `POST /api/v1/admin/intra-trade/trend-check`
  - `PUT /api/v1/admin/intra-trade/executions/{executionId}`
  - `POST /api/v1/admin/intra-trade/executions/{executionId}/exit`
  - `DELETE /api/v1/admin/intra-trade/executions/{executionId}`
- Monitor/runtime APIs:
  - `GET /api/v1/admin/intra-trade/monitor/market-summary`
  - `GET /api/v1/admin/intra-trade/monitor/runtimes`
  - `GET /api/v1/admin/intra-trade/monitor/positions`
  - `GET /api/v1/admin/intra-trade/monitor/events`
  - `POST /api/v1/admin/intra-trade/monitor/runtimes/{runtimeId}/pause`
  - `POST /api/v1/admin/intra-trade/monitor/runtimes/{runtimeId}/resume`
  - `POST /api/v1/admin/intra-trade/monitor/runtimes/{runtimeId}/exit`
  - `POST /api/v1/admin/intra-trade/monitor/runtimes/{runtimeId}/partial-exit`
  - `POST /api/v1/admin/intra-trade/monitor/positions/{positionId}/exit`
  - `POST /api/v1/admin/intra-trade/monitor/positions/{positionId}/partial-exit`
  - `POST /api/v1/admin/intra-trade/monitor/positions/{positionId}/manual-watch`
  - `POST /api/v1/admin/intra-trade/monitor/emergency`
- P&L/reporting APIs:
  - `GET /api/v1/admin/intra-trade/pnl/dashboard`
  - `GET /api/v1/admin/intra-trade/pnl/export?format=CSV|XLSX|PDF`

## Database Impact

- New table:
  - `intra_trade_execution`
- New tables:
  - `intra_strategy`
  - `intra_strategy_version`
  - `intra_strategy_perf_snapshot`
- Stores:
  - tenant/user scope
  - optional source strategy id
  - mode and status
  - scan instrument/timeframe
  - strategy snapshot JSON
  - result snapshot JSON
  - total P&L
  - executed trade count
  - evaluation and audit timestamps
- Migration:
  - `backend/src/main/resources/db/migration/V20__create_intra_trade_execution.sql`
  - `backend/src/main/resources/db/migration/V21__create_intra_strategy_tables.sql`
  - `backend/src/main/resources/db/migration/V22__create_intra_monitor_and_pnl_foundation.sql`

## Important Scope Note

- `LIVE` mode now places broker orders through the Upstox order API using the strategy-defined BUY/SELL side and lots.
- Live entry and exit orders are recorded in `intra_trade_order` and audited in `intra_event_audit`.
- Strategy evaluation still depends on intraday analytics availability; missing analytics can delay live entries.

## Validation And Test Coverage

- Backend:
  - `mvn -Dtest=IntraTradeServiceTest test`
- Frontend:
  - `npm run lint`
  - `npm run build`
- Frontend regression:
  - `npm run test:e2e -- intra-trade-routes.spec.ts intra-trade-builder.spec.ts intra-trade-library.spec.ts intra-trade-monitor.spec.ts`
- Token-budget gate:
  - `scripts/check-source-token-budget.sh`
  - expected repo-level failure still exists because of unrelated legacy oversized files such as `desktop/src/renderer/src/App.tsx`

## Risks And Follow-Ups

- Live/paper execution currently depends on the existing backtest pricing engine and current-day candle availability.
- Trend warnings depend on current-day trading-signal freshness for the selected instrument and timeframe; when no signal is available the UI does not block execution.
- Direct live-market validation was blocked on Sunday, March 22, 2026 because NSE/BSE were closed; cadence alignment was covered with targeted backend tests instead.
- Broker order placement for live entry and exit is implemented through Upstox and persisted in `intra_trade_order`.
- Order-status reconciliation against the broker order book is still limited to on-demand order-book and position fetches; there is no continuous broker-status sync yet.
- Live position management remains strategy-driven through monitor runtimes and stored position snapshots rather than a broker-led reconciliation loop.
- Live Market Watch inside Intra Trade is read-only by design; tile editing remains in the Market Watch screen.
- `desktop/src/renderer/src/App.tsx` remains above the repo source-file budget and should be split further in follow-up work.

## Agent Handoff Note

- Open `desktop/src/renderer/src/components/intra-trade/IntraWorkspaceContext.tsx` first for the shared route state.
- Open the route pages in `desktop/src/renderer/src/components/intra-trade/` next for the split build, run, and review workflow.
- Open `backend/src/main/java/com/inalgo/trade/admin/IntraTradeService.java` next for execution-mode rules and persisted snapshot behavior.
- Do not break:
  - option-only validation,
  - tenant/user scoping on saved runs,
  - reuse of the saved Market Watch layout,
  - live order routing through Upstox for runtime entry and exit actions.
