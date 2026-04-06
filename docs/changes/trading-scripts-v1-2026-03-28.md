# Trading Scripts v1

## Scope completed
- Added a new tenant-scoped Trading Scripts backend domain with versioned source, compile artifacts, and perf snapshots.
- Added `/api/v1/admin/trading-scripts` CRUD, compile, backtest, publish, archive, duplicate, and version endpoints.
- Added a separate Node worker boundary for script compilation and static runtime-rule enforcement.
- Added a new desktop `Trading Scripts` route with Monaco editor, snippet palette, diagnostics, version history, backtest summary, and publish controls.
- Linked published Trading Scripts into the existing intra strategy lifecycle through `intra_strategy.source_trading_script_id`.

## Decisions made
- v1 source is JavaScript with Monaco diagnostics rather than TypeScript transpilation.
- Backtest and publish continue to rely on normalized `compiledStrategy` payloads so existing engines remain the runtime source of truth.
- Live publish remains restricted to option-only strategies.

## Assumptions
- Existing intra monitor/live execution flows remain canonical after publish.
- Worker execution is compile-only in this phase; the worker contract is ready for further runtime isolation work.

## Validation run
- `cd backend && mvn -DskipTests compile`
- `cd desktop && npm run build`

## Known limitations
- `scripts/check-source-token-budget.sh` still fails at repository scope because the repo already contains multiple oversized legacy files, including pre-existing dirty shell files outside this feature slice.
- No dedicated Trading Scripts Playwright spec was executed in this turn.

## Next owner / next step
- Add dedicated backend/service tests and Playwright coverage for compile/backtest/publish flows.
- Consider route-level code splitting for Monaco to reduce the renderer bundle size.
