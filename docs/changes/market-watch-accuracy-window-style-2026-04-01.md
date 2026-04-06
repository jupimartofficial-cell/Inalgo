# Market Watch Accuracy Window-Style Update (2026-04-01)

## Change Summary
- Status: complete for validated scope
- Scope: Accuracy tab logic + API contract + UI controls + validation
- Goal: compute accuracy by market session windows using 5-minute or 15-minute benchmark candles and show reference periods in UI

## Problem And Goal
- Problem:
  - Previous accuracy logic used day-level direction comparison and did not evaluate open/middle/close windows.
  - UI did not expose reference periods or candle timeframe selection for accuracy computation.
- Goal:
  - Implement window-based accuracy for:
    - `OPEN`: `09:15-09:30` IST
    - `MIDDLE`: `11:30-14:30` IST
    - `CLOSE`: `14:30-15:30` IST
  - Allow benchmark candle selection of `5m` or `15m`.
  - Show reference period labels in UI.

## Implementation Summary
- Backend:
  - Added window-scoped snapshot-day counting and window-scoped accuracy query in `MarketSentimentSnapshotRepository`.
  - Added `candleIntervalMinutes` support (`5` or `15`) in `/api/v1/admin/market-watch/accuracy`.
  - Updated `MarketTrendAccuracyService` to compute per-window metrics and return `windows[]` for each scope.
- Frontend:
  - Accuracy API call now sends `candleIntervalMinutes`.
  - Accuracy panel now includes candle selector (`5 min candle`, `15 min candle`).
  - Replaced day-only summary cards with window cards showing:
    - reference period
    - trend/AI accuracy
    - precision metrics
    - per-window daily breakdown (`Start`, `End`, `Change %`).

## Files And Modules Touched
- `backend/src/main/java/com/inalgo/trade/admin/MarketWatchController.java`
- `backend/src/main/java/com/inalgo/trade/admin/MarketTrendAccuracyService.java`
- `backend/src/main/java/com/inalgo/trade/admin/MarketWatchDtos.java`
- `backend/src/main/java/com/inalgo/trade/repository/MarketSentimentSnapshotRepository.java`
- `backend/src/test/java/com/inalgo/trade/repository/MarketSentimentSnapshotRepositoryIntegrationTest.java`
- `desktop/src/renderer/src/api/admin.ts`
- `desktop/src/renderer/src/api/admin.types.ts`
- `desktop/src/renderer/src/components/market-watch/MarketWatchAccuracyPanel.tsx`
- `docs/features/market-watch/feature.md`
- `docs/features/market-watch/test-cases.md`

## API And Contract Impact
- Endpoint updated:
  - `GET /api/v1/admin/market-watch/accuracy?lookbackDays=<n>&candleIntervalMinutes=<5|15>`
- Response additions:
  - top-level `candleIntervalMinutes`
  - per-scope `windows[]` with `windowKey`, `windowLabel`, `referencePeriod`, and per-window metrics/rows
- Daily row field semantics in Accuracy response:
  - `startPrice` / `endPrice` replace day close/prev-close in window mode

## Validation Performed
- Backend:
  - `cd backend && mvn -Dtest=MarketSentimentSnapshotRepositoryIntegrationTest,MarketWatchServiceTest test`
- Frontend:
  - `cd desktop && npm run build`
- Live API check against currently running backend process:
  - Existing process still serves legacy accuracy payload until restart/redeploy.
  - Verified by calling `/api/v1/admin/market-watch/accuracy` and observing missing new `windows` fields before restart.

## Risks And Follow-Ups
- Running backend instance must be restarted to serve the new window-based payload in UI.
- Window accuracy remains sensitive to snapshot coverage inside each window; sparse windows are expected when no snapshots were captured in that period.
- Repository token-budget gate remains globally failing due unrelated legacy oversized files.

## Handoff
- Scope completed: backend and frontend window-style accuracy logic with selectable 5m/15m benchmark candles.
- Decision: accuracy windows are strictly IST time bounded and use matching window benchmark movement.
- Validation: targeted backend tests and frontend production build passed.
- Next step: restart backend process, open `Market Signals -> Market Watch -> Accuracy`, pick `5 min` or `15 min`, run and verify window cards.
