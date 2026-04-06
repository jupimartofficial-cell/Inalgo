# Manage Triggers

## Change Summary

- **Status:** Implemented and actively extended
- **Feature area:** Admin trigger scheduling and operations
- **Primary users:** Tenant-scoped admin operators

## Problem And Goal

- Admins need to schedule candle sync and analytics jobs without manually restarting them throughout the trading day.
- Operators also need a workable browser for larger trigger catalogs so they can separate candle-sync jobs from analytics jobs and filter by instrument, timeframe, and job nature.

## Implementation Summary

### Backend

- Persists trigger definitions in `admin_trigger`.
- Executes scheduled jobs through `AdminTriggerScheduler` and `AdminTriggerService`.
- Supports candle-sync, trading-signal refresh, and trading-day-parameter refresh jobs.
- Exposes a browser-oriented trigger API with tab grouping, facet metadata, and server-side page inputs:
  - `GET /api/v1/admin/triggers/browser`
- Keeps trigger lifecycle controls on the existing create/update/start/pause/resume/stop/delete endpoints.

### Frontend

- Renders `Manage Triggers` from the admin navigation.
- Keeps the trigger-creation editor collapsed by default so operators can review the configured-trigger browser before opening the form.
- Provides a creation and edit form for event source, schedule type, interval, instrument, and timeframe.
- Renders a configured-trigger browser with:
  - `Candle sync Jobs` and `Others` tabs
  - collapsible advanced filters
  - backend-driven pagination
  - filter-aware counts and summary chips
- Tightens card, filter, and table-cell alignment so summary metrics, trigger metadata, and row actions stay visually aligned across desktop layouts.

### UI Details

- Entry point: `Admin -> Manage Triggers` in the left navigation.
- Page layout: configured-trigger browser with tabs, counts, and row actions alongside the trigger create/edit form with schedule preview.
- Default behavior: the create/edit form starts collapsed and advanced filters remain collapsed until expanded.
- Browser controls: tab switch between `Candle sync Jobs` and `Others`, filters for instrument/timeframe/job nature, and pagination controls.
- Row actions: `Start`, `Pause`, `Resume`, `Stop`, edit, and delete with confirmation plus status chips for `RUNNING`, `PAUSED`, and `STOPPED`.

### Scheduled jobs

- `Candle sync`
  - requires instrument and timeframe
  - reuses the Upstox historical migration engine
- `Trading signal`
  - requires instrument and timeframe
  - refreshes previous close, current close, EMA 9, EMA 26, EMA 110, and BUY/SELL/HOLD
- `Trading day params`
  - requires instrument only
  - refreshes ORB high/low, breakout/breakdown flags, opening 5-minute values, previous-session values, and gap classification
- Execution window
  - admin triggers run only during India business days and the configured market-hours window
  - default window is `Asia/Kolkata`, Monday-Friday, `9:15 AM` to `3:30 PM`
  - due triggers are deferred to the next market opening when they become due outside that window

## Files And Modules Touched

- `backend/src/main/java/com/inalgo/trade/admin/AdminController.java`
- `backend/src/main/java/com/inalgo/trade/admin/AdminDtos.java`
- `backend/src/main/java/com/inalgo/trade/admin/AdminTriggerService.java`
- `backend/src/main/java/com/inalgo/trade/admin/AdminTriggerScheduler.java`
- `backend/src/main/java/com/inalgo/trade/entity/AdminTriggerEntity.java`
- `backend/src/main/java/com/inalgo/trade/repository/AdminTriggerRepository.java`
- `desktop/src/renderer/src/api/admin.ts`
- `desktop/src/renderer/src/components/ManageTriggersPanel.tsx`
- `backend/src/test/java/com/inalgo/trade/admin/AdminTriggerServiceTest.java`
- `desktop/e2e/app-sections.spec.ts`

## Feature Impact

- New behavior:
  - triggers can be created, edited, deleted, and lifecycle-managed from the admin UI
  - configured triggers can be browsed by tab, instrument, timeframe, and job nature
  - the create-trigger editor starts collapsed until the operator explicitly opens it or edits an existing trigger
  - one-time and recurring jobs are surfaced with richer browser metadata
- Preserved behavior:
  - new triggers still start in `STOPPED`
  - `Start`, `Pause`, `Resume`, and `Stop` continue to drive the runtime state machine
  - candle-sync runs continue to restart from the last stored candle checkpoint
  - started triggers continue running without depending on a currently active admin session

## API And Contract Impact

- Tenant-scoped admin APIs:
  - `GET /api/v1/admin/triggers`
  - `GET /api/v1/admin/triggers/browser`
  - `POST /api/v1/admin/triggers`
  - `PUT /api/v1/admin/triggers/{triggerId}`
  - `DELETE /api/v1/admin/triggers/{triggerId}`
  - `POST /api/v1/admin/triggers/{triggerId}/start`
  - `POST /api/v1/admin/triggers/{triggerId}/pause`
  - `POST /api/v1/admin/triggers/{triggerId}/resume`
  - `POST /api/v1/admin/triggers/{triggerId}/stop`
- Browser endpoint query parameters:
  - `tabGroup`
  - `instrumentKey`
  - `timeframeKey`
  - `jobNatureKey`
  - `page`
  - `size`
- Browser response adds:
  - `items`
  - `tabs`
  - `instruments`
  - `timeframes`
  - `jobNatures`
  - `summary`

## Database Impact

- Trigger definitions live in `admin_trigger`.
- Base table creation migration:
  - `backend/src/main/resources/db/migration/V7__create_admin_trigger.sql`
- Browser support adds a composite lookup index:
  - `backend/src/main/resources/db/migration/V13__add_admin_trigger_browser_index.sql`
- Entity-level JPA index metadata mirrors the browser index for code visibility.

## Validation And Test Coverage

- Backend coverage:
  - `backend/src/test/java/com/inalgo/trade/admin/AdminTriggerServiceTest.java`
- Frontend coverage:
  - `desktop/e2e/app-sections.spec.ts`
- Manual validation focus:
  - create and edit flows
  - default collapsed-state behavior for the creation form
  - lifecycle actions
  - tab switching
  - advanced-filter persistence
  - paginated browsing

## Risks And Follow-Ups

- `browseTriggers` currently loads the tenant trigger set into memory before applying filters and pagination. Revisit repository-side filtering if tenant trigger volume grows significantly.
- Keep browser response fields in sync between backend DTOs and `desktop/src/renderer/src/api/admin.ts`.
- Re-run the UI regression suite after any future browser layout changes because the panel now carries more operator state.
- If exchange holidays must be enforced, populate the market-hours holiday list in runtime config; otherwise the business-day guard uses Monday-Friday.

## Agent Handoff Note

- Open `backend/src/main/java/com/inalgo/trade/admin/AdminTriggerService.java` first for trigger classification, facet generation, and runtime behavior.
- Open `desktop/src/renderer/src/components/ManageTriggersPanel.tsx` next for tab, filter, and pagination state.
- Do not break tenant-header validation, the `STOPPED`-by-default creation rule, or the separation between candle-sync and analytics jobs.
