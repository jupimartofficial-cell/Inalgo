# Pro Chart TradingView-Style Upgrade

## Onboarding Context

- **Project purpose:** Multi-tenant admin console and backend for candle sync, historical browsing, option-chain visibility, backtesting, and chart-heavy trading workflows for Indian index/F&O traders.
- **Tech stack:** Spring Boot 3.3 + Java 21 backend, React 18 + TypeScript + Vite frontend, PostgreSQL 16 with Flyway, Electron wrapper retained for desktop packaging.
- **Testing procedure used:** `cd desktop && npm run lint`, `cd desktop && npm run build`, `cd desktop && npm run test:e2e -- -g "Trading window supports chart/tab constraints and preference persistence"`, `scripts/check-source-token-budget.sh`.
- **Certification rules:** Preserve tenant/session boundaries, keep chart changes frontend-only, keep touched files within the repo source budget, record UI-visible changes in canonical docs, and note operational risk/rollback if validation cannot cover the full suite.

## Change Summary

- **Date:** 2026-03-27
- **Status:** Complete for the shared frontend chart shell
- **Scope:** Frontend charting upgrade applied to all `ProChartCanvas` consumers

## Problem And Goal

- The existing chart experience covered candlesticks and a small indicator set, but it lacked the richer interaction model traders expect from the TradingView advanced chart demo.
- Goal: analyze the TradingView demo surface, then upgrade the repo’s shared chart shell so similar capabilities are available anywhere the application renders the shared candle chart.

## TradingView Feature Analysis

- Reviewed the TradingView Advanced Charts demo at `https://charting-library.tradingview-widget.com/`.
- Observed core top-toolbar capabilities:
  - symbol/search and compare/add-symbol controls
  - interval selector
  - chart-type selector
  - indicators and indicator templates entry points
  - layout/save/settings/fullscreen/snapshot controls
- Observed core left-toolbar capabilities:
  - cursor/crosshair
  - drawing families such as trend lines, Fibonacci/pattern tools, annotation tools, measure, magnets, lock/hide/remove, and object tree
- Practical repo constraint:
  - direct TradingView Charting Library embed is not the safe default for this private tenant-authenticated app, so the implementation extends the existing `lightweight-charts` stack instead of swapping to the hosted TradingView library.

## Implementation Summary

### Frontend

- Refactored the shared chart implementation into smaller chart modules so the touched files meet the repo token-budget gate.
- Upgraded the shared `ProChartCanvas` used by `Trading window` and `Historical Data` with:
  - chart styles: candles, bars, area, line, baseline
  - compare overlays loaded from the existing historical-data API
  - snapshots and fullscreen mode
  - price-scale presets: auto, log, percent, indexed
  - theme toggle
  - drawing toolbar with trend line, horizontal line, vertical line, zone, text note, and measure tools
  - drawings/object list dialog
  - settings dialog for watermark/grid/crosshair/magnet/drawing-toolbar behavior
- Kept the existing indicator stack and expanded the shared shell around it rather than creating a parallel chart implementation.

### Backend / Database

- No backend or database contract changes.

## Files And Modules Touched

- `desktop/src/renderer/src/components/ProChartCanvas.tsx`
- `desktop/src/renderer/src/components/ProChartCanvasShared.ts`
- `desktop/src/renderer/src/components/useProChartSetup.ts`
- `desktop/src/renderer/src/components/ProChartToolbar.tsx`
- `desktop/src/renderer/src/components/ProChartDrawingLayer.tsx`
- `desktop/src/renderer/src/components/useProChartCompare.ts`
- `desktop/src/renderer/src/components/useProChartShell.ts`
- `desktop/src/renderer/src/components/ProChartCompareDialog.tsx`
- `desktop/src/renderer/src/components/ProChartSettingsDialog.tsx`
- `desktop/src/renderer/src/components/ProChartDrawingsDialog.tsx`
- `desktop/src/renderer/src/components/ProChartDialogs.tsx`
- `desktop/src/renderer/src/components/ProChartSurfaceMeta.tsx`
- `desktop/e2e/trading-window.spec.ts`
- `README.md`
- `docs/features/trading-window/feature.md`

## Feature Impact

- **New behavior:**
  - all current `ProChartCanvas` surfaces now share the upgraded chart shell
  - traders can add compare overlays, switch style/scale presets, open fullscreen, take snapshots, and place drawings
  - chart-local UI state is persisted in browser storage by `chartId`
- **Preserved behavior:**
  - Trading Window layout persistence still uses the backend trading-preferences APIs
  - tenant-scoped candle loading still flows through the existing historical-data API
  - existing indicator panes and timeframe switching continue working

## API And Contract Impact

- No new backend endpoints.
- Compare overlays reuse:
  - `GET /api/v1/admin/historical-data`

## Validation Performed

- `cd desktop && npm run lint` -> pass
- `cd desktop && npm run build` -> pass
- `cd desktop && npm run test:e2e -- -g "Trading window supports chart/tab constraints and preference persistence"` -> pass
- `scripts/check-source-token-budget.sh` -> touched shared-chart files pass the budget gate; repo still contains unrelated pre-existing over-budget files outside this task scope

## Risks And Follow-Ups

- Drawings and compare overlays persist in browser-local storage, not backend trading preferences.
- The shared chart is feature-richer and therefore heavier; monitor render cost if more concurrent charts or overlays are added later.
- The full `desktop/e2e/trading-window.spec.ts` suite still contains unrelated failures in migration-job flows from the current worktree state and should be investigated separately if that area is being touched next.

## Agent Handoff Note

- **Done:** Shared chart shell upgraded and wired across existing chart consumers.
- **Where to continue:** Start with `desktop/src/renderer/src/components/ProChartCanvas.tsx`, then `desktop/src/renderer/src/components/useProChartSetup.ts`, then the new dialog/drawing modules.
- **Do not break:** the 5-tab / 2-to-10-chart Trading Window constraints, tenant-scoped historical-data loading, or the source-budget split across the new chart modules.
