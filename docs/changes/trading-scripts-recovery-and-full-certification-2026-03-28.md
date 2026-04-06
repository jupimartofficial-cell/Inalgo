# Trading Scripts Recovery + Full Certification (2026-03-28)

## Change Summary
- Status: partial (Trading Scripts recovery complete; full deterministic certification blocked by pre-existing cross-feature E2E drift)
- Scope: Monaco IDE recovery, Trading Scripts E2E contract stabilization, deterministic + real-data certification execution
- Area: frontend runtime editor initialization, CSP policy, Playwright certification

## Problem And Goal
- Reported issues:
  - Trading Scripts IDE not loading scripts (editor stuck on `Loading editor…`)
  - Need end-to-end backtesting validation with mandatory real-data certification
  - Need full feature validation and production certification decision
- Goal for this pass:
  - restore Trading Scripts editor reliability
  - align stale Trading Scripts E2E assertions with current UI contract
  - execute requested certification matrix and issue pass/fail decision with blockers

## Implementation Summary

### Frontend Fixes
- Replaced Monaco CDN-dependent initialization with local bundled Monaco loader configuration.
- Added Monaco initialization lifecycle handling:
  - explicit init status tracking (`loading` / `ready` / `error`)
  - error fallback banner and plain-text `Mini IDE source` fallback editor when Monaco fails
- Updated CSP to permit Monaco workers (`worker-src 'self' blob:`) while keeping `script-src 'self'`.

### Test Contract Stabilization
- Updated Trading Scripts deterministic E2E specs to match current UI semantics:
  - replaced brittle `Version 3 · Loaded` assertions with version badge + loaded state checks
  - aligned action button expectations (`Duplicate script`, `Archive script`, `Delete script permanently`)
  - aligned script-meta timeframe assertions (`Timeframe` + `15 minutes`)

## Files And Modules Touched
- `desktop/src/renderer/src/components/trading-scripts/TradingScriptsEditorPanel.tsx`
- `desktop/index.html`
- `desktop/e2e/trading-scripts.spec.ts`
- `desktop/e2e/trading-scripts-functional.spec.ts`

## Validation Performed

### Build / Compile Gates
- `cd desktop && npm run build` ✅ pass
- `cd backend && mvn -DskipTests compile` ✅ pass

### Backend Quality Gates
- `cd backend && mvn -Dtest=BacktestRunServiceTest,IntraTradeServiceTest,OptionChainServiceTest,AdminTriggerServiceTest,TradingPreferenceServiceTest,ApiSecurityRegressionTest,ApiRateLimitFilterTest test` ✅ pass
  - Result: 51 run, 0 fail, 0 error, 1 skipped

### Deterministic E2E Sweep (requested full feature matrix)
- `cd desktop && npm run test:e2e -- e2e/login.spec.ts e2e/app-sections.spec.ts e2e/option-chain.spec.ts e2e/trading-window.spec.ts e2e/backtest.spec.ts e2e/market-watch.spec.ts e2e/intra-trade-routes.spec.ts e2e/intra-trade-library.spec.ts e2e/intra-trade-builder.spec.ts e2e/intra-trade-monitor.spec.ts e2e/intra-pnl-ui.spec.ts e2e/trading-scripts.spec.ts e2e/trading-scripts-functional.spec.ts e2e/security.spec.ts e2e/security-practices.spec.ts` ❌ fail
  - Result: 27 passed, 15 failed
  - Trading Scripts deterministic suites now pass
  - Remaining failures are cross-feature UI contract/navigation drift outside Trading Scripts scope

### Mandatory Real-Data Certification (no live order path)
- `cd desktop && REAL_DATA_E2E=1 LIVE_ORDER_E2E=0 npm run test:e2e:trading-scripts-real-data` ✅ pass
- `cd desktop && REAL_DATA_E2E=1 LIVE_ORDER_E2E=0 npm run test:e2e:intra-real-data` ✅ pass

### Maintainability Gate
- `./scripts/check-source-token-budget.sh` ❌ fail
  - Repository-wide pre-existing oversized-file baseline remains
  - Touched `TradingScriptsEditorPanel.tsx` remains over policy threshold after fix

## Production Gate Status
- Backend gate: pass
- Frontend build gate: pass
- Trading Scripts deterministic gate: pass
- Mandatory real-data gate: pass
- Full deterministic cross-feature gate: fail (15 failing tests)
- Token-budget maintainability gate: fail (pre-existing baseline + touched oversized file)
- Overall production certificate: **DENIED** for full-platform certification in this run

## Risks And Follow-Ups
- Full feature E2E suite has broad selector and navigation drift (Backtest, Trading Window, Option Chain, Market Watch, Migration, Intra routes).
- Sidebar/nav architecture updates appear to have invalidated legacy selector assumptions in several specs.
- Token-budget gate requires planned modularization/refactor beyond this bug-fix scope.

## Rollback
- Revert frontend files:
  - `desktop/src/renderer/src/components/trading-scripts/TradingScriptsEditorPanel.tsx`
  - `desktop/index.html`
- Revert E2E contract updates if desired:
  - `desktop/e2e/trading-scripts.spec.ts`
  - `desktop/e2e/trading-scripts-functional.spec.ts`
- No backend schema/API/config migrations were introduced.

## Handoff
- Scope completed:
  - Trading Scripts Monaco loader recovery and CSP worker support
  - Trading Scripts deterministic E2E stabilization
  - mandatory real-data certification execution
- Decisions made:
  - keep live-order path disabled (`LIVE_ORDER_E2E=0`)
  - issue full production certificate only if deterministic + mandatory real-data pass together
- Assumptions:
  - local services remain at `localhost:8081` and `localhost:5173`
  - tenant/user defaults: `local-desktop` / `admin`
- Validation run:
  - all commands listed above with pass/fail outcomes
- Known limitations:
  - full deterministic platform sweep still fails outside Trading Scripts scope
  - token-budget gate remains unresolved
- Next owner / next step:
  1. Repair failing deterministic E2E contracts for non-Trading-Scripts features.
  2. Re-run full deterministic suite.
  3. Address token-budget violations for merge-readiness compliance.

## Default Skills Applied
- `$enterprise-delivery-defaults`
- `$enterprise-coding-standards`
- `$structured-change-documentation`
- `$spring-boot-react-postgresql-production-gate`
