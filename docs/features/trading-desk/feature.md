# Trading Desk (Advanced)

## Change Summary

- **Status:** Implemented
- **Feature area:** Full-screen trading desk workspace
- **Primary users:** Admin users monitoring live markets and placing intraday orders

## Problem And Goal

- Traders need a consolidated, low-latency workspace that combines market watch, charts, option chain, and live account data.
- The goal is to provide a single-screen desk that supports real-time monitoring and quick intraday actions without leaving the admin console.

## Implementation Summary

### Frontend

- Full-screen `Advanced Trading Desk` route under `Trading Desk` navigation.
- Left `Market Watch` list with configurable instruments, ordering, and refresh cadence.
- Center chart tabs with instrument/timeframe controls and shared `ProChartCanvas` renderer.
- Right `Option Chain` panel with expiry selection, ATM-centered strike view, OI bars, and call/put action buttons.
- Bottom panel tabs for `Positions`, `Orders`, and `News` feeds (Global/India).
- Local per-user configuration persistence via `localStorage` for watchlist, refresh timers, and option-chain controls.
- Inline order placement dialog wired to intraday order API with validation.

### UI Details

- Entry point: `Trading Desk -> Advanced Trading Desk` in the left navigation.
- Layout: full-screen workspace split into market watch (left), charts (center), option chain (right), and bottom detail tabs.
- Chart tabs: up to 5 tabs with instrument/timeframe controls and tab labels that mirror the selected watchlist label.
- Option chain actions: BUY/SELL buttons open the order dialog and remain disabled when instrument keys are missing.
- Bottom tabs: Positions, Orders, and News with empty-state messaging when no data is returned.
- Persistence: per-user watchlist and refresh cadence stored in `localStorage`.

### Backend

- Uses existing tenant-scoped APIs for historical candles, option-chain snapshots, Upstox orders/positions, and news feeds.
- Option-chain snapshot rows include call and put instrument keys so the desk can place orders against real tokens.

## Files And Modules Touched

- `desktop/src/renderer/src/components/AdvancedTradingDesk.tsx`
- `desktop/src/renderer/src/api/admin.types.ts`
- `backend/src/main/java/com/inalgo/trade/upstox/OptionChainService.java`
- `backend/src/main/java/com/inalgo/trade/admin/AdminController.java`
- `backend/src/main/java/com/inalgo/trade/admin/AdminDtos.java`

## Feature Impact

- New behavior:
  - option-chain rows now surface call and put instrument keys used for order placement
  - market watch price refresh aligns with each instrument's configured timeframe
  - order dialog blocks placement when instrument keys or limit prices are invalid
- Preserved behavior:
  - existing option-chain latest/history APIs and stored snapshots remain unchanged
  - trading desk layout and refresh timers continue to persist per user

## API And Contract Impact

- Option-chain latest response rows now include:
  - `callInstrumentKey`
  - `putInstrumentKey`
- Trading desk continues to use:
  - `GET /api/v1/admin/candles`
  - `GET /api/v1/admin/option-chain/expiries`
  - `GET /api/v1/admin/option-chain/latest`
  - `GET /api/v1/admin/intra-trade/upstox/positions`
  - `GET /api/v1/admin/intra-trade/upstox/orders`
  - `GET /api/v1/admin/news/preview`
  - `POST /api/v1/admin/intra-trade/orders/place`

## Database Impact

- None. Option-chain instrument keys are already persisted in `option_chain_snapshots`.

## Validation And Test Coverage

- Manual desk validation with Upstox access token for the tenant.
- UI validation checklist in `docs/features/trading-desk/test-cases.md`.

## Risks And Follow-Ups

- Real-time accuracy depends on the freshness of Upstox data and scheduler cadence.
- If Upstox tokens expire, desk panels will show stale or empty data until re-authenticated.

## Agent Handoff Note

- Start with `desktop/src/renderer/src/components/AdvancedTradingDesk.tsx` for desk behavior and UI state.
- Review `OptionChainService.fetchLatestSnapshot` and `AdminController.latestOptionChain` for option-chain row contract changes.
- Do not break tenant scoping or the requirement that order placement uses valid Upstox instrument keys.
