# Option Chain

## Change Summary

- **Status:** Implemented
- **Feature area:** Option-chain migration, storage, and desktop UI
- **Primary users:** Admin users monitoring option-chain snapshots

## Problem And Goal

- The platform needs live option-chain visibility for NIFTY, BANKNIFTY, and SENSEX, even though Upstox does not expose true historical option-chain history.
- The goal is to bootstrap currently available expiries, persist ongoing snapshots, and expose a UI and API that serve both latest and historical views.

## Implementation Summary

### Backend

- Fetches option contracts and option-chain rows from Upstox V2 APIs.
- Persists snapshot rows idempotently into `option_chain_snapshots`.
- Tracks bootstrap and runtime status in `option_chain_migration_state`.
- Serves latest and paginated historical views through tenant-scoped admin APIs.
- Runs scheduled refreshes through `UpstoxOptionChainScheduler`.

### Frontend

- Adds the `Option Chain` section to the admin UI.
- Supports underlying and expiry selection.
- Renders CE/PE rows with strike-centered layout, OI bars, and summary chips.
- Supports 30-second auto-refresh and manual bootstrap via `Migrate Historical`.

### UI Details

- Entry point: `Admin -> Option Chain` in the left navigation.
- Controls: underlying selector, expiry selector, and auto-refresh toggle with manual refresh action.
- Table layout: strike-centered CE/PE rows with OI bars and summary chips for quick scan.
- Actions: `Migrate Historical` triggers bootstrap snapshot capture for available expiries.

## Files And Modules Touched

- `backend/src/main/java/com/inalgo/trade/upstox/OptionChainService.java`
- `backend/src/main/java/com/inalgo/trade/upstox/UpstoxOptionChainScheduler.java`
- `backend/src/main/resources/db/migration/V6__create_option_chain_tables.sql`
- `desktop/src/renderer/src/components/OptionChainPanel.tsx`
- `desktop/src/renderer/src/api/admin.ts`

## Feature Impact

- New behavior:
  - latest option-chain snapshots can be viewed by underlying and expiry
  - bootstrap captures currently available expiries to seed persistence
  - scheduled refreshes accumulate a true local history from go-live onward
- Preserved behavior:
  - candle and trading-window APIs remain unchanged at contract level

## API And Contract Impact

- Admin APIs:
  - `POST /api/v1/admin/option-chain/migrate-historical`
  - `GET /api/v1/admin/option-chain/expiries?underlyingKey=...`
  - `GET /api/v1/admin/option-chain/latest?underlyingKey=...&expiryDate=...`
  - `GET /api/v1/admin/option-chain/history?underlyingKey=...&expiryDate=...`
- Latest snapshot rows now include:
  - `callInstrumentKey`
  - `putInstrumentKey`
- Provider check APIs:
  - `GET /api/v1/upstox/option-chain`
  - `GET /api/v1/upstox/option-contracts`

## Database Impact

- `option_chain_snapshots`
  - stores normalized metrics plus raw payload JSON
  - uniqueness key:
    - `(tenant_id, underlying_key, expiry_date, strike_price, snapshot_ts)`
- `option_chain_migration_state`
  - tracks last run status, last snapshot timestamp, and last error
- Migration:
  - `backend/src/main/resources/db/migration/V6__create_option_chain_tables.sql`

## Validation And Test Coverage

- Backend focus:
  - Upstox client parsing
  - snapshot persistence
  - PCR and synthetic future calculations
- Frontend focus:
  - panel rendering
  - expiry changes
  - bootstrap action
  - auto-refresh behavior

## Risks And Follow-Ups

- Upstox does not provide true historical option-chain snapshots, so history only exists from this application's go-live and scheduled refresh cadence.
- Keep scheduler settings conservative to avoid unnecessary provider pressure.

## Agent Handoff Note

- Open `backend/src/main/java/com/inalgo/trade/upstox/OptionChainService.java` first for persistence and calculation behavior.
- Open the option-chain panel next for UI rendering and refresh behavior.
- Do not break tenant scoping or the latest/history endpoint split.
