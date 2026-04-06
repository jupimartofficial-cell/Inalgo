# Manage Triggers Browser And Filters

## Onboarding Context

- **Project purpose:** InAlgo provides a multi-tenant admin console and Spring Boot backend for candle sync, analytics, option-chain workflows, backtesting, and trading operations for Indian traders.
- **Tech stack:** Backend uses Java 21, Spring Boot 3.3, Spring Data JPA, PostgreSQL 16, and Flyway; frontend uses React 18, TypeScript, Vite, and MUI.
- **Testing procedure:** Repo guidance uses `cd backend && mvn test` and `cd desktop && npm run build` as baseline checks, with targeted tests such as `mvn -Dtest=AdminTriggerServiceTest test` and `npm run test:e2e -- app-sections.spec.ts`.
- **Certification rules:** `docs/AI_AGENT_DEVELOPMENT.md` requires feature tracking, touched-area tests, static/manual verification, and explicit security and performance review for tenant isolation, input validation, pagination, and query behavior.

## Change Summary

- **Title:** Add a structured trigger browser with tabs, advanced filters, and supporting API/index changes
- **Date:** 2026-03-14
- **Status:** Follow-up needed

## Problem And Goal

- Operators need to work through larger trigger catalogs without mixing candle-sync jobs and analytics jobs in one flat grid.
- The goal is to expose a browser-oriented API and UI that support tabbed grouping, filtered browsing, and backend-driven pagination while preserving existing lifecycle actions.

## Implementation Summary

### Backend changes

- Added `GET /api/v1/admin/triggers/browser` in `AdminController`.
- Extended `AdminDtos.TriggerResponse` and introduced browser-specific DTOs for tabs, facets, and summary metadata.
- Added `browseTriggers(...)` in `AdminTriggerService` to classify trigger rows into tab groups and job natures, build facet metadata, and return paged items.
- Added a focused service test that covers browser grouping and facet output.

### Frontend changes

- Added `fetchTriggerBrowser(...)` and response typings in `desktop/src/renderer/src/api/admin.ts`.
- Updated `ManageTriggersPanel.tsx` to use:
  - top-level tabs
  - a collapsible advanced-filter panel
  - backend-driven pagination
  - filter and summary chips
- Updated Playwright coverage in `desktop/e2e/app-sections.spec.ts` to mock the new browser endpoint and exercise the new operator flows.

### Database changes

- Added `V13__add_admin_trigger_browser_index.sql` for `(tenant_id, job_key, instrument_key, timeframe_unit, timeframe_interval, updated_at DESC)`.
- Mirrored the browser index in `AdminTriggerEntity` JPA metadata.

## Files And Modules Touched

- `backend/src/main/java/com/inalgo/trade/admin/AdminController.java`
- `backend/src/main/java/com/inalgo/trade/admin/AdminDtos.java`
- `backend/src/main/java/com/inalgo/trade/admin/AdminTriggerService.java`
- `backend/src/main/java/com/inalgo/trade/entity/AdminTriggerEntity.java`
- `backend/src/main/resources/db/migration/V13__add_admin_trigger_browser_index.sql`
- `backend/src/test/java/com/inalgo/trade/admin/AdminTriggerServiceTest.java`
- `desktop/src/renderer/src/api/admin.ts`
- `desktop/src/renderer/src/components/ManageTriggersPanel.tsx`
- `desktop/e2e/app-sections.spec.ts`

## Feature Impact

- New behavior:
  - `Manage Triggers` now separates `Candle sync Jobs` from `Others`
  - advanced filters narrow the configured-trigger view by instrument, timeframe, and job nature
  - the browser exposes summary counts and filter-aware totals
- Unchanged behavior:
  - create, edit, delete, and lifecycle actions remain on the existing trigger feature
  - tenant authorization still runs through the admin token and `X-Tenant-Id`

## API And Contract Impact

- New endpoint:
  - `GET /api/v1/admin/triggers/browser`
- New query parameters:
  - `tabGroup`
  - `instrumentKey`
  - `timeframeKey`
  - `jobNatureKey`
  - `page`
  - `size`
- New response fields:
  - `items`
  - `tabs`
  - `instruments`
  - `timeframes`
  - `jobNatures`
  - `summary`
- Existing endpoint kept:
  - `GET /api/v1/admin/triggers`

## Database Impact

- Adds the `idx_admin_trigger_browser` index to support browser access patterns.
- No table or row format changes were introduced beyond index metadata.

## Validation Performed

- Reviewed the current workspace diff for backend, frontend, test, and migration changes.
- Checked the new migration file and the updated controller, service, and API client contracts.
- No automated backend or frontend tests were run as part of this documentation migration task.

## Risks And Follow-Ups

- `browseTriggers(...)` currently loads all tenant trigger rows and applies filtering and pagination in memory. Watch this path if tenants accumulate large trigger catalogs.
- Frontend selector behavior in Playwright uses positional combobox access in some cases; keep the test stable if the form structure changes.
- The new endpoint and index are documented, but end-to-end runtime validation is still needed before treating the workspace change as release-ready.

## Agent Handoff Note

- **Done:** The in-flight trigger-browser changes are now documented in a structured note and the long-lived feature docs were moved into `docs/features/`.
- **Where to continue:** Start with `backend/src/main/java/com/inalgo/trade/admin/AdminTriggerService.java`, then `desktop/src/renderer/src/components/ManageTriggersPanel.tsx`, then the added migration.
- **Be careful about:** Preserve tenant scoping, browser tab values (`CANDLE_SYNC`, `OTHERS`), and DTO shape parity between backend and frontend.
- **Recommended next step:** Run targeted backend and Playwright checks, then record the actual results back into this note before release.
