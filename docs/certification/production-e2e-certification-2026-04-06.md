# Production-Style E2E Certification

## Change Summary

- **Date:** 2026-04-06
- **Status:** Passed for local production-style route certification
- **Scope:** Hands-on browser rendering across the running local frontend and backend without Playwright route mocks

## Method

- Started from the already running local services:
  - frontend: `http://localhost:5173`
  - backend: `http://localhost:8081`
- Verified backend health with tenant header:
  - `curl -H 'X-Tenant-Id: local-desktop' http://localhost:8081/actuator/health`
- Signed in through the real UI using the Flyway-seeded local admin account.
- Opened each major product route in headless Chromium.
- Captured a screenshot for each route under:
  - `artifacts/production-certification-2026-04-06/`
- Recorded console errors, page errors, and failed API responses for each route.

## Certificate Summary

- **Routes exercised:** 16
- **Routes passed:** 16
- **Routes failed:** 0
- **Console errors:** 0
- **Page errors:** 0
- **Failed API responses:** 0

## Certified Routes

| Feature | Route | Result |
|---|---:|---|
| Dashboard | `/` | PASS |
| Migration Jobs | `/migration` | PASS |
| Manage Triggers | `/triggers` | PASS |
| Historical Data | `/history` | PASS |
| Option Chain | `/option-chain` | PASS |
| Trading Window | `/trading-window` | PASS |
| Trading Scripts | `/trading-scripts` | PASS |
| Backtest P&L | `/backtest/pnl` | PASS |
| Intra Strategies | `/intra/strategies` | PASS |
| Intra Monitor | `/intra/monitor` | PASS |
| Intra P&L | `/intra/pnl` | PASS |
| Market Watch | `/market-signals/market-watch` | PASS |
| Trading Signal | `/market-signals/trading-signal` | PASS |
| Trading Param | `/market-signals/trading-param` | PASS |
| Market Trend | `/market-signals/market-trend` | PASS |
| Trading Desk | `/trading-desk/advanced` | PASS |

## Issues Found And Fixed

- Removed `frame-ancestors 'none'` from the frontend meta-delivered CSP because browsers ignore `frame-ancestors` in meta CSP and logged it on every route.
- Added Monaco Vite worker wiring for the Trading Scripts editor so TypeScript/JavaScript workers load correctly instead of falling back to main-thread execution.
- Fixed Monaco TypeScript type wiring so the frontend lint gate now passes.

## Limits And Follow-Ups

- This certificate proves route rendering and API integration against the local backend; it does not certify live broker order placement or real-money trading.
- Provider-dependent flows still require Upstox/OpenAI credentials and separate private-environment certification before a production release.
- Git history still must be cleaned or the repository must be published from a fresh sanitized import before public launch.
- Token-budget violations remain in existing oversized source files and require focused follow-up refactors.

## Handoff Note

- Evidence JSON: `artifacts/production-certification-2026-04-06/certificate.json`
- Screenshot evidence: `artifacts/production-certification-2026-04-06/*.png`
- Re-run this certification after any route, auth, Monaco editor, CSP, or launch-readiness change.
