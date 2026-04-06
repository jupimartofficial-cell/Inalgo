# Intra Trade Test Cases

## Scope

- Route-based navigation between build, run, and review pages
- Strategy library listing, filter/sort/pagination, and quick actions
- Strategy builder 5-step workflow and Basic/Advanced mode behavior
- Shared intra workspace context persistence across route changes
- Live Market Watch embedding in `Intra Monitor`
- Live, paper, and backtest execution persistence
- Saved run reopen, edit handoff, delete, immediate-exit, and refresh behavior
- Trend-conflict warning before execute

## Backend Cases

1. Create draft strategy from builder payload.
   Expected:
   - row is inserted in `intra_strategy`
   - version `1` row is inserted in `intra_strategy_version`
   - status is `DRAFT`
   - publish state is `DRAFT`

2. Save draft edit.
   Expected:
   - same strategy row is updated
   - new immutable version row is inserted with incremented version
   - status remains `DRAFT`

3. Validate strategy.
   Expected:
   - field and summary validation payload is returned
   - `paperEligible` and `liveEligible` are computed
   - latest version validation columns are refreshed

4. Publish strategy to `PAPER_READY` / `LIVE_READY`.
   Expected:
   - publish fails if eligibility is false for target
   - status transitions only after validator passes

5. Duplicate strategy.
   Expected:
   - new strategy row is created with copied payload
   - initial duplicate status is `DRAFT`

6. Archive and delete strategy.
   Expected:
   - archive sets status `ARCHIVED`
   - delete is blocked when executions reference the strategy id

7. Import from backtest strategies.
   Expected:
   - selected backtest rows are copied into `intra_strategy` + version `1`
   - already-imported rows return `skipped`

8. Run `BACKTEST` mode with a valid option strategy.
   Expected:
   - a row is inserted into `intra_trade_execution`
   - status is `COMPLETED`
   - historical result JSON is persisted

9. Run `LIVE` mode before the entry window.
   Expected:
   - execution is saved with `WAITING_ENTRY`
   - result payload is empty and notes explain the waiting state

10. Reject duplicate `LIVE` run when an active live runtime already exists for the same strategy.
    Expected:
    - request is rejected
    - validation explains that the live strategy is already running

11. Run `PAPER` mode after entry conditions produce a trade.
   Expected:
   - execution is saved with `ENTERED` or `EXITED`
   - total P&L and trade count are persisted

11a. Run `LIVE` mode and confirm broker entry order.
   Expected:
   - Upstox order is placed for each strategy leg at market price
   - `intra_trade_order` stores the entry order ID and tag
   - `intra_event_audit` includes `ORDER_PLACED`

11b. Exit a `LIVE` mode execution (auto exit or manual exit).
   Expected:
   - Upstox exit order is placed for each open leg
   - `intra_trade_order` stores the exit order ID and tag
   - `intra_event_audit` includes `ORDER_PLACED` for exit

12. Refresh an existing saved execution.
   Expected:
   - same row is updated in place
   - `evaluatedAt`, `status`, and result JSON reflect the latest snapshot

13. Submit a non-option leg strategy.
   Expected:
   - request is rejected
   - validation explains that Intra Trade currently supports option legs only

14. Submit `LIVE` or `PAPER` mode with a non-intraday strategy.
   Expected:
   - request is rejected
   - validation explains the current `INTRADAY`-only limit

15. Check trend conflict for a bullish strategy when the latest selected-instrument signal is `SELL`.
   Expected:
   - response returns `hasConflict=true`
   - response includes the strategy bias, current trend, and warning message

16. Exit an entered saved execution immediately.
   Expected:
   - request is accepted only for `ENTERED` live/paper executions
   - status becomes `EXITED`
   - result snapshot and notes reflect the immediate-exit action

17. Update a non-entered saved execution.
   Expected:
   - strategy snapshot, scan fields, and result snapshot are updated in place
   - entered executions are rejected for edit until exited

18. Delete a non-entered saved execution.
    Expected:
    - row is removed
    - entered executions are rejected for delete until exited

19. Runtime intervention safety for live mode.
    Expected:
    - pause/exit/partial-exit live actions require confirm flag, `CONFIRM LIVE` acknowledgement, and reason
    - request is rejected when confirmation payload is missing or invalid
    - intervention is appended to `intra_event_audit`

20. Emergency action fan-out.
    Expected:
    - bulk actions update runtime and/or position snapshot rows consistently
    - affected counts returned by API match updated rows
    - intervention reason and actor are persisted in audit feed

21. P&L dashboard aggregation.
    Expected:
    - realized/unrealized split aligns with open/closed status
    - max drawdown is computed from cumulative P&L progression
    - strategy performance and trade ledger totals reconcile with execution rows

22. P&L report export.
    Expected:
    - CSV, XLSX, and PDF export endpoints return downloadable payloads
    - export rows respect active dashboard filters (mode/date/strategy/instrument/account/status)

## Frontend Cases

1. Open `/intra/strategies` directly.
   Expected:
   - login still works on the route
   - `Intra Strategies` loads after sign-in
   - the shared intra workspace header is visible

2. Search/filter/sort in strategy library.
   Expected:
   - search by strategy name filters rows
   - status/instrument/timeframe filters narrow rows
   - sort supports recently edited, name, and performance

3. Create and validate a strategy through 5-step builder.
   Expected:
   - steps advance `Basic -> Entry -> Exit/Risk -> Position -> Review`
   - Advanced mode toggle is off by default
   - validation errors render inline and in summary

4. Duplicate/archive/delete from library quick actions.
   Expected:
   - duplicate opens copied draft in builder
   - archive updates status chip
   - delete removes unreferenced strategy

5. Import selected strategies from backtest.
   Expected:
   - import dialog shows backtest candidates
   - selected rows import to library and become editable drafts

6. Load a saved strategy in `Intra Strategies`.
   Expected:
   - strategy form fields populate
   - shared intra context keeps the strategy instrument aligned
   - `Open Intra Monitor` becomes the primary next step

7. Navigate from `Intra Strategies` to `Intra Monitor`.
   Expected:
   - route changes to `/intra/monitor`
   - selected strategy is preserved
   - shared header still shows the same workspace, mode, instrument, and timeframe

8. Run `Real Time Paper` from `Intra Monitor`.
   Expected:
   - request posts the selected mode, scan instrument, scan timeframe, and strategy snapshot
   - execution status card updates
   - `Open Intra P&L` can be used without losing the selected execution

9. Switch `Intra Monitor -> Quick Test` to `Historical Backtest`.
   Expected:
   - inline `Start date` and `End date` pickers render immediately in the `Paper Test Setup` card
   - changing either date updates the strategy snapshot used for execution
   - the primary CTA changes to `Run Historical Test`
   - execution posts `mode=BACKTEST` instead of the paper-run mode

10. Verify `Quick Test` saved strategy status filtering defaults to active-only.
   Expected:
   - saved strategy list initially excludes `ARCHIVED` rows
   - switching the status filter to `Archived` reveals archived rows
   - switching the status filter to `All statuses` shows archived and active rows together

11. Verify embedded live Market Watch in `Intra Monitor`.
   Expected:
   - board loads the signed-in user’s saved tiles
   - tile titles and primary values render
   - refresh countdown and manual refresh remain visible

12. Open `/intra/pnl` directly or via the monitor CTA.
   Expected:
   - saved execution history loads independently
   - selected execution detail renders without reopening the strategy builder

13. Refresh the selected execution from `Intra Monitor`.
   Expected:
   - refresh request is sent
   - selected execution updates without losing the current route context
   - advanced conditions that compare `currentClose` vs `previousClose` evaluate against the latest two completed candles for the selected scan timeframe

14. Trigger a trend-conflict warning before execute.
   Expected:
   - UI calls the trend-check API with the selected scan instrument and timeframe
   - operator is prompted before continuing when the strategy bias conflicts with the current trend

15. Exit an entered saved run from `Intra P&L`.
   Expected:
   - immediate-exit action is available for entered runs
   - selected result updates to exited state

16. Edit and delete a non-entered saved run from `Intra P&L`.
   Expected:
   - edit action routes the user to `/intra/monitor` with that run loaded into the shared workspace
   - delete removes the row after confirmation

17. Preserve shared route context across intra pages.
    Expected:
    - changing Paper/Live, instrument, or timeframe in one intra page is reflected in the shared header after navigating to the other intra pages
    - refresh on `/intra/strategies`, `/intra/monitor`, or `/intra/pnl` keeps the same page active

18. Intra Monitor live/paper segmentation and staleness.
    Expected:
    - trader mode switch clearly separates `Quick Test` and `Live Monitor`
    - command bar shows selected strategy, runtime state, market status, freshness, open positions, and MTM
    - market summary shows refresh timestamp and stale indicator
    - active live runtimes are execution-refreshed before the monitor snapshot reloads, so the runtime card, positions, and audit feed move together during polling
    - `Current signal` resolves from the latest stored trading signal for the runtime instrument/timeframe instead of staying `UNKNOWN` when execution notes are empty
    - event log stays time-ordered while polling updates
    - runtime waiting/open states respect configured India market-hours open, close, and holidays rather than hard-coded clock values

19. Intra Monitor destructive action confirmations.
    Expected:
    - runtime and position lists expose `Open` as the default row action
    - live `Exit`, `Partial exit`, and emergency live actions prompt for confirmation and reason from the detail panel or emergency section
    - paper actions continue with standard single-step reason capture

20. Intra Monitor paper-to-live promotion flow.
    Expected:
    - trader can select a saved strategy, run `Paper Test`, review the latest paper results, and open `Promote to Live`
    - readiness checklist shows market open state, signal freshness, strategy validation, risk controls, and recent paper run status
    - promotion dialog blocks `Start live` until all readiness checks pass

21. Intra P&L dashboard analytics and export controls.
   Expected:
   - top cards, strategy performance table, and trade ledger render for selected filters
   - daily/cumulative views refresh after filter changes
   - CSV/XLSX/PDF export actions trigger successful file downloads

## Regression Checks

1. `Backtest P&L` still saves and runs strategies.
2. `Strategy List` still loads and edits strategies.
3. `Market Signals -> Market Watch` still loads and saves the original tile layout.

## Suggested Execution

```bash
cd backend
mvn -Dtest=IntraTradeServiceTest,IntraStrategyValidationEngineTest test

cd ../desktop
npm run lint
npm run build
npm run test:e2e -- intra-trade-routes.spec.ts intra-trade-builder.spec.ts intra-trade-library.spec.ts intra-trade-monitor.spec.ts
```
