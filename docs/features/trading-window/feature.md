# Trading Window

## Change Summary

- **Status:** Implemented
- **Feature area:** Desktop trading analysis workspace
- **Primary users:** Admin users operating chart-heavy layouts

## Problem And Goal

- Traders need a persistent multi-chart workspace for market analysis without rebuilding their layout every session.
- The goal is to provide a tabbed chart desk with per-user persistence, chart controls, and guard rails on layout complexity.

## Implementation Summary

### Frontend

- Adds the `Trading window` section to the left navigation.
- Supports up to 5 tabs with 2 to 10 charts per tab.
- Provides per-chart controls for instrument, timeframe, lookback, layout, and height.
- Uses a shared advanced chart shell for both `Trading window` and `Historical Data`.
- Renders candles, bars, area, line, and baseline chart styles using `lightweight-charts`.
- Adds compare overlays, snapshots, fullscreen mode, theme toggles, and price-scale presets (`auto`, `log`, `percent`, `indexed`).
- Adds a drawing toolbar with trend line, horizontal line, vertical line, zone, text-note, and measure tools plus a drawings/object list.
- Renders volume, SMA(20), EMA(50), VWAP, Bollinger Bands, pivots, MACD, and RSI on the shared chart shell.
- Supports manual refresh and 45-second auto-refresh.

### UI Details

- Entry point: `Trading -> Trading window` in the left navigation.
- Layout: tabbed workspace with a resizable chart grid and per-chart control strip.
- Chart controls: instrument selector, timeframe selector, lookback range, chart type, and height controls.
- Workspace tools: compare overlays, snapshot capture, fullscreen toggle, theme toggle, and price-scale presets.
- Drawing tools: trend line, horizontal/vertical line, zone, text note, and measure, plus an object list.
- Guard rails: up to 5 tabs and 2-10 charts per tab enforced in the UI.
- Persistence: per-user layout loads automatically and saves via manual save or autosave.

### Backend

- Persists user layout preferences per tenant and username.
- Exposes load and save endpoints for `preferences_json`.

## Files And Modules Touched

- `desktop/src/renderer/src/components/TradingWindowPanel.tsx`
- `desktop/src/renderer/src/api/admin.ts`
- `backend/src/main/java/com/inalgo/trade/admin/TradingPreferenceService.java`
- `backend/src/main/java/com/inalgo/trade/admin/AdminController.java`
- `backend/src/main/resources/db/migration/V4__create_trading_preference.sql`
- `backend/src/test/java/com/inalgo/trade/admin/TradingPreferenceServiceTest.java`
- `desktop/e2e/trading-window.spec.ts`

## Feature Impact

- New behavior:
  - users can create, resize, delete, and persist multi-chart layouts
  - layouts reload automatically for the same tenant and username
  - trading charts now expose TradingView-style chart controls and drawing tools on the shared chart surface
- Preserved behavior:
  - chart constraints remain enforced
  - persistence remains scoped by tenant and username

## API And Contract Impact

- `GET /api/v1/admin/trading/preferences?username=<username>`
  - returns `preferences: null` when no saved layout exists
- `PUT /api/v1/admin/trading/preferences`
  - upserts `activeTabIndex` and `tabs[]` with chart definitions

## Database Impact

- Stores preferences in `trading_preference`.
- Unique key:
  - `(tenant_id, username)`
- Migration:
  - `backend/src/main/resources/db/migration/V4__create_trading_preference.sql`

## Validation And Test Coverage

- Backend:
  - `backend/src/test/java/com/inalgo/trade/admin/TradingPreferenceServiceTest.java`
- Frontend:
  - `desktop/e2e/trading-window.spec.ts`
- Typical commands:

```bash
cd backend
mvn -Dtest=TradingPreferenceServiceTest test

cd ../desktop
npm run lint
npm run build
npm run test:e2e
```

## Risks And Follow-Ups

- Keep payload validation aligned between frontend chart controls and backend preference constraints.
- Re-check chart performance if tab and chart limits increase.
- Drawing objects and compare overlays are browser-local UI state today; they do not persist through backend trading preferences.

## Agent Handoff Note

- Open `desktop/src/renderer/src/components/ProChartCanvas.tsx` first for the shared chart shell and then `desktop/src/renderer/src/components/TradingWindow.tsx` for layout behavior.
- Open `backend/src/main/java/com/inalgo/trade/admin/TradingPreferenceService.java` next for persistence rules.
- Do not break the 5-tab cap, the 2-to-10 chart rule, or tenant-scoped preference lookup.
