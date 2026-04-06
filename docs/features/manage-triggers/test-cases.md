# Manage Triggers Test Cases

## Scope

- Trigger creation and lifecycle management
- Due-trigger execution behavior
- Tabbed browser, advanced filters, and pagination
- Non-regression across adjacent admin sections

## Backend Cases

1. Create a recurring trigger.
   Expected:
   - row is inserted into `admin_trigger`
   - status is `STOPPED`
   - last run status is `PENDING`
   - job key is persisted correctly

2. Start, pause, resume, and stop a trigger.
   Expected:
   - lifecycle API returns the new status
   - `next_run_at` is populated on start and resume
   - `next_run_at` is cleared on pause and stop

3. Execute a due recurring trigger.
   Expected:
   - migration service is called for the configured tenant, instrument, and timeframe
   - last run status becomes `SUCCESS`
   - status stays `RUNNING`
   - `next_run_at` advances to the next cadence

4. Execute a due one-time trigger.
   Expected:
   - migration service runs once
   - status becomes `STOPPED`
   - `next_run_at` is cleared

5. Re-sync an already completed migration stream.
   Expected:
   - completed migration state is realigned to the last stored candle timestamp for that stream
   - trigger run proceeds without manual migration-job restart

6. Execute a trading-signal refresh trigger.
   Expected:
   - `trading_signal` receives one row per instrument, timeframe, and day
   - EMA 9, EMA 26, EMA 110, and signal values update in place on later runs

7. Execute a trading-day-param refresh trigger.
   Expected:
   - `trading_day_param` receives one row per instrument and day
   - ORB values come from the 9:15 AM to 9:30 AM IST 15-minute candle
   - breakout and breakdown flags update from the latest intraday minute close
   - opening values come from the 9:15 AM IST 5-minute candle
   - previous-session values skip weekends and holidays with no candles
   - gap metrics follow the previous-session range rules

8. Browse triggers by tab and facet filters.
   Expected:
   - `CANDLE_SYNC` and `OTHERS` tab counts are correct
   - instrument, timeframe, and job-nature options are returned for the active tab
   - filtered totals and summary counts match the returned rows

9. Update an existing trigger.
   Expected:
   - stopped or paused trigger configuration is updated in place
   - running triggers are rejected for edit until paused or stopped

10. Delete an existing trigger.
    Expected:
    - stopped or paused trigger row is removed
    - running triggers are rejected for delete until paused or stopped

11. Defer a due trigger outside India business hours.
    Expected:
    - the trigger does not execute immediately
    - `next_run_at` moves to the next India business-window opening
    - status stays `RUNNING`

## Frontend Cases

1. Open `Manage Triggers` from the left navigation.
   Expected:
   - heading is visible
   - creation form and configured-trigger browser both render

2. Create a trigger with `Hour timer` and `Every hour`.
   Expected:
   - UI posts `eventSource=TIME_DRIVEN`
   - UI posts `triggerType=HOUR_TIMER`
   - UI posts `intervalValue=1`
   - success toast is shown

3. Create a trigger with `Minutes timer` and one of the expanded minute cadences.
   Expected:
   - UI exposes `Every 2 minutes`, `Every 3 minutes`, `Every 4 minutes`, `Every 6 minutes`, and `Every 7 minutes`
   - UI posts `triggerType=MINUTES_TIMER`
   - selected `intervalValue` is submitted unchanged

4. Start a trigger from the browser row.
   Expected:
   - `Start` changes to `Pause` and `Stop`
   - status chip moves to `RUNNING`

5. Pause and resume a trigger.
   Expected:
   - pause changes lifecycle state to `PAUSED`
   - resume restores `RUNNING`

6. Stop a trigger.
   Expected:
   - lifecycle state returns to `STOPPED`
   - `Start` becomes available again

7. Validate schedule preview changes.
   Expected:
   - changing trigger type or interval updates the right-side preview immediately

8. Create a `Trading day params` trigger.
   Expected:
   - UI posts `jobKey=TRADING_DAY_PARAM_REFRESH`
   - timeframe is omitted from the payload
   - success toast is shown

9. Paginate configured triggers.
   Expected:
   - first page shows the configured page size
   - next and previous page controls navigate trigger rows correctly

10. Browse configured triggers by tab and collapsible filters.
    Expected:
    - `Candle sync Jobs` and `Others` tabs show tab-specific counts
    - collapsing and expanding the advanced-filter section preserves the current filter state
    - instrument, timeframe, and job-nature filters narrow the grid correctly inside the active tab

11. Edit a configured trigger.
    Expected:
    - row action loads values into the form
    - update request is sent
    - refreshed row reflects the new job configuration

12. Delete a configured trigger.
    Expected:
    - confirmation dialog appears
    - delete request is sent
    - row is removed and counts refresh

13. Keep running triggers alive after admin session expiry.
    Expected:
    - previously started triggers still execute for the tenant
    - execution does not depend on an active browser login session

## Regression Checks

1. `Migration Jobs` still loads and its actions still work.
2. `Historical Data` filters, sorting, and pagination still work.
3. Login, Option Chain, and Trading Window sections still open without console errors.

## Suggested Execution

```bash
cd backend
mvn -Dtest=AdminTriggerServiceTest test

cd ../desktop
npm run test:e2e -- app-sections.spec.ts
```
