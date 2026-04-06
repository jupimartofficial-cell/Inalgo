# Market Watch Test Cases

## Scope

- Tile configuration and persistence
- Tile movement and ordering
- Real-data rendering across all supported sources
- Refresh cadence and layout controls

## Backend Cases

1. Load an older saved layout without `primaryField`.
   Expected:
   - config is returned successfully
   - each tile receives a safe default `primaryField`

2. Save a tile with an unsupported primary field.
   Expected:
   - backend normalizes to the first supported field for the source

3. Fetch Market Watch data for a `TRADING_SIGNAL` tile.
   Expected:
   - response contains `primaryLabel`, `primaryValue`, status fields, and supporting fields
   - ids and update timestamps are not exposed as configurable business fields

4. Fetch Market Watch data for a `TRADING_PARAM` tile where gap values are null.
   Expected:
   - response remains successful
   - tone calculation falls back safely

5. Fetch Market Watch data for a `MARKET_SENTIMENT` tile.
   Expected:
   - latest tenant-scoped snapshot is returned
   - reason, source counts, and AI fields are included as supporting fields when available

6. Fetch Market Watch data for a `CANDLE` tile.
   Expected:
   - latest tenant-scoped candle row is returned
   - bullish/bearish tone is derived from close vs open

## Frontend Cases

1. Open `Market Signals -> Market Watch`.
   Expected:
   - watchboard header is visible
   - saved tiles render

2. Edit a tile and change the primary column.
   Expected:
   - updated tile shows the chosen column as the main value
   - save-layout action persists the change

3. Move a tile earlier or later.
   Expected:
   - tile order changes immediately
   - save-layout action persists the new order

4. Drag a tile onto another tile.
   Expected:
   - tile order changes
   - unsaved-layout hint is shown

5. Add a tile for each supported source.
   Expected:
   - `Trading Signal`, `Trading Param`, `Market Sentiment`, and `Candle` all save and render
   - only relevant selectors appear for the chosen source

6. Change refresh interval and grid columns.
   Expected:
   - countdown and layout update immediately
   - settings persist after save

7. Run `Accuracy` tab report when API payload is missing expected keys.
   Expected:
   - panel does not blank or crash
   - a readable error message is shown
   - if legacy keys (`india` / `global`) are present, report still renders

8. Run `Accuracy` with `5 min candle`.
   Expected:
   - request includes `candleIntervalMinutes=5`
   - each scope renders `Market Open`, `Market Middle`, and `Market Close` cards
   - each card shows its reference period (`09:15-09:30`, `11:30-14:30`, `14:30-15:30` IST)

9. Run `Accuracy` with `15 min candle`.
   Expected:
   - request includes `candleIntervalMinutes=15`
   - per-window metrics update based on the selected candle timeframe
   - daily breakdown rows show `Start`, `End`, and `Change %` for the selected window

## Live Data Checks

1. `Trading Signal` tile with real DB data.
   Expected:
   - latest row for the selected instrument and timeframe is shown

2. `Trading Param` tile with real DB data.
   Expected:
   - null ORB/gap values render safely when the latest row is incomplete
   - changing the primary column surfaces the chosen metric

3. `Market Sentiment` tile with real DB data.
   Expected:
   - latest sentiment rows for `GLOBAL_NEWS`, `INDIA_NEWS`, `GIFT_NIFTY`, and `SP500` render without API errors

4. `Candle` tile with real DB data.
   Expected:
   - latest candle row shows open, high, low, close, volume, and candle time

5. `Accuracy` per-window validation with real snapshots and benchmark candles.
   Expected:
   - `OPEN` uses `09:15-09:30` snapshots and benchmark candle movement in the same period
   - `MIDDLE` uses `11:30-14:30` snapshots and benchmark candle movement in the same period
   - `CLOSE` uses `14:30-15:30` snapshots and benchmark candle movement in the same period

## Suggested Execution

```bash
cd backend
mvn -Dtest=MarketWatchServiceTest test

cd ../desktop
npm run lint
npm run build
npm run test:e2e -- market-watch.spec.ts
```
