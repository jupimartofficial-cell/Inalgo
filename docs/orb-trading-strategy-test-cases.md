# Opening Range Breakout And Breakdown Test Cases

## Automated coverage

- Backend integration: `backend/src/test/java/com/inalgo/trade/service/TradingAnalyticsServicePostgresIntegrationTest.java`
  - validates ORB high/low persistence from the 9:15 AM IST 15-minute candle
  - validates `orb_breakout = Yes` when latest intraday minute close is above ORB high
  - validates `orb_breakdown = Yes` when latest intraday minute close is below ORB low
  - validates same-day upsert behavior so one instrument keeps one row per day

## Scenario matrix

1. Breakout after opening range is established.
   Expected:
   - `orb_high` equals the opening-range candle high
   - `orb_low` equals the opening-range candle low
   - `orb_breakout = Yes`
   - `orb_breakdown = No`

2. Breakdown after opening range is established.
   Expected:
   - `orb_high` equals the opening-range candle high
   - `orb_low` equals the opening-range candle low
   - `orb_breakout = No`
   - `orb_breakdown = Yes`

3. Price returns inside the range later in the session.
   Expected:
   - same-day row is updated, not duplicated
   - `orb_breakout = No`
   - `orb_breakdown = No`

4. Opening-range candle is not yet available.
   Expected:
   - row may exist with `orb_high` and `orb_low` unset
   - `orb_breakout = No`
   - `orb_breakdown = No`

5. Latest intraday candle is missing.
   Expected:
   - ORB values persist if available
   - breakout and breakdown remain `No`
