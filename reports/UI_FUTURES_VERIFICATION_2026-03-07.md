# UI Futures Verification (2026-03-07)

## Scope
Validated UI behavior for:
- Migration jobs
- Historical data filters
- Trading window chart instrument selection and data fetch path

with instruments:
- `NSE_FO|51714` (NIFTY FUT 30 MAR 26)
- `NSE_FO|51701` (BANKNIFTY FUT 30 MAR 26)
- `BSE_FO|825565` (SENSEX FUT 25 MAR 26)

## Changes
- Added futures to frontend base instrument catalog in `desktop/src/renderer/src/App.tsx`.
- Added Playwright test `UI supports futures instruments in filters and trading charts` in `desktop/e2e/trading-window.spec.ts`.
- Updated trading-window doc to mention quick-pick includes configured futures.

## Verification commands
- `cd desktop && npm run lint` ✅
- `cd desktop && npm run build` ✅
- `cd desktop && npm run test:e2e` ✅ (4/4 passed)

## Result
UI flows that depend on instrument catalogs and chart data requests now include futures and pass E2E coverage.
