# AI Token Budget Guardrails (2026-03-21)

## Change Summary

- **Status:** Partial (policy + phase 1 + phase 2 refactors completed)
- **Feature area:** Engineering standards and source modularization
- **Goal:** Keep source files manageable for low-token AI models and human review

## Problem And Goal

- Several backend/frontend source files are too large for reliable low-token model context windows.
- The target is to formalize repo limits and start reducing oversized files without changing behavior.

## Implementation Summary

### Standards and workflow updates

- Added a source-file token budget rule to:
  - `AGENTS.md`
  - `docs/AI_AGENT_DEVELOPMENT.md`
  - `docs/ENTERPRISE_DELIVERY_STANDARD.md`
  - `docs/ENTERPRISE_CODING_STANDARD.md`
  - `CLAUDE.md`
  - `README.md` (validation command section)
- Added scanner script:
  - `scripts/check-source-token-budget.sh`
  - default limits: `500` lines and `20,000` bytes

### Code refactor (single-file line-count reduction)

- Refactored `desktop/src/renderer/src/api/admin.ts` by extracting API type definitions into:
  - `desktop/src/renderer/src/api/admin.types.ts`
- Preserved existing API function exports and call behavior in `admin.ts`.
- `admin.ts` line count reduced from `724` to `377`.

### Phase 2 refactor (top oversized-file split pass)

- Split `desktop/src/renderer/src/App.tsx` shared constants/helpers/UI atoms into:
  - `desktop/src/renderer/src/components/AppShellShared.tsx`
  - `desktop/src/renderer/src/components/AppSidebar.tsx`
  - App line count reduced from `2618` to `1820`
  - `AppShellShared.tsx` reduced further from `877` to `487` after sidebar extraction
- Split `desktop/src/renderer/src/components/BacktestPanel.tsx` shared helpers and row/card components into:
  - `desktop/src/renderer/src/components/BacktestPanelShared.tsx`
  - BacktestPanel line count reduced from `1861` to `1466`
- Split `backend/src/main/java/com/inalgo/trade/admin/BacktestRunService.java` candle sync/persistence utilities into:
  - `backend/src/main/java/com/inalgo/trade/admin/BacktestCandleSyncService.java`
  - BacktestRunService line count reduced from `1142` to `984`

### Phase 3 refactor (next-largest split pass)

- Split `desktop/src/renderer/src/components/ProChartCanvas.tsx` shared chart math/config/types into:
  - `desktop/src/renderer/src/components/ProChartCanvasShared.ts`
  - ProChartCanvas line count reduced from `1484` to `1152`
- Split `desktop/src/renderer/src/components/ManageTriggersPanel.tsx` shared trigger constants/types/helpers into:
  - `desktop/src/renderer/src/components/ManageTriggersShared.tsx`
  - ManageTriggersPanel line count reduced from `1289` to `1099`
- Split `backend/src/main/java/com/inalgo/trade/admin/AdminMigrationService.java` job-key parsing/normalization into:
  - `backend/src/main/java/com/inalgo/trade/admin/AdminMigrationJobKeySupport.java`
  - AdminMigrationService line count reduced from `994` to `918`

### Phase 4 refactor (controller and footprint reductions)

- Split backtest endpoints out of the main admin controller into:
  - `backend/src/main/java/com/inalgo/trade/admin/BacktestAdminController.java`
  - `backend/src/main/java/com/inalgo/trade/admin/AdminController.java` reduced to `396` lines and `16,867` bytes
- Additional footprint reductions:
  - `backend/src/main/java/com/inalgo/trade/upstox/OptionChainService.java` reduced below byte cap
  - `backend/src/test/java/com/inalgo/trade/admin/AdminTriggerServiceTest.java` reduced below byte cap
  - `desktop/src/renderer/src/components/OptionChainPanel.tsx` reduced below byte cap
  - `backend/src/main/java/com/inalgo/trade/upstox/UpstoxHistoricalMigrationService.java` reduced from `615` to `564` lines
  - `backend/src/main/java/com/inalgo/trade/admin/BacktestConditionService.java` reduced from `590` to `532` lines
  - `desktop/src/renderer/src/components/BacktestAdvancedConditionsEditor.tsx` reduced from `678` to `637` lines

### Skill updates

- Added token-budget expectations to default skill files:
  - `$enterprise-delivery-defaults`
  - `$enterprise-coding-standards`
  - `$structured-change-documentation`
  - `$spring-boot-react-postgresql-production-gate`

## Files And Modules Touched

- `desktop/src/renderer/src/api/admin.ts`
- `desktop/src/renderer/src/api/admin.types.ts`
- `desktop/src/renderer/src/components/AppShellShared.tsx`
- `desktop/src/renderer/src/components/AppSidebar.tsx`
- `desktop/src/renderer/src/components/BacktestPanelShared.tsx`
- `backend/src/main/java/com/inalgo/trade/admin/BacktestCandleSyncService.java`
- `desktop/src/renderer/src/components/ProChartCanvasShared.ts`
- `desktop/src/renderer/src/components/ManageTriggersShared.tsx`
- `backend/src/main/java/com/inalgo/trade/admin/AdminMigrationJobKeySupport.java`
- `backend/src/main/java/com/inalgo/trade/admin/BacktestAdminController.java`
- `scripts/check-source-token-budget.sh`
- `AGENTS.md`
- `README.md`
- `CLAUDE.md`
- `docs/AI_AGENT_DEVELOPMENT.md`
- `docs/ENTERPRISE_DELIVERY_STANDARD.md`
- `docs/ENTERPRISE_CODING_STANDARD.md`
- `docs/changes/ai-token-budget-guardrails-2026-03-21.md`

## Feature Impact

- New behavior:
  - token-budget scan command now exists and can fail if limits are exceeded
  - project standards now require token-budget checks for meaningful code changes
- Preserved behavior:
  - frontend API calls and payload handling in `admin.ts` remain unchanged

## Validation Performed

```bash
scripts/check-source-token-budget.sh
cd desktop && npm run build
cd backend && mvn -Dtest=BacktestRunServiceTest test
cd backend && mvn -Dtest=AdminMigrationServiceTest,BacktestRunServiceTest test
cd backend && mvn -Dtest=AdminMigrationServiceTest,BacktestRunServiceTest,AdminTriggerServiceTest test
```

## Risks And Follow-Ups

- The repository still contains multiple oversized legacy files above the new limits.
- After phase 2, the next highest-impact split targets are:
  - `desktop/src/renderer/src/App.tsx`
  - `desktop/src/renderer/src/components/BacktestPanel.tsx`
  - `desktop/src/renderer/src/components/ProChartCanvas.tsx`
  - `desktop/src/renderer/src/components/ManageTriggersPanel.tsx`
  - `backend/src/test/java/com/inalgo/trade/admin/BacktestRunServiceTest.java`

## Agent Handoff Note

- Continue by splitting one large file per PR while keeping behavior stable.
- Use `scripts/check-source-token-budget.sh` before finalizing each refactor PR.
- Do not break current backend/frontend contracts during module extraction.
