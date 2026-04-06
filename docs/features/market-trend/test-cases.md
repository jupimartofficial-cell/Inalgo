# Market Trend Test Cases

## Scope

- Market sentiment news scoring
- OpenAI advisory market analysis
- Technical trend computation for Gift Nifty and S&P 500
- Persistence and list API
- Backtest UI section rendering, filtering, and pagination

## Backend Cases

1. Classify a war/conflict article.
   Expected:
   - article is scored bearish
   - reason tags include `war/conflict`

2. Ignore non-India articles for the India trend feed.
   Expected:
   - unrelated global-only article is skipped from Indian trend evidence

3. Compute Gift Nifty or S&P 500 technical trend.
   Expected:
   - when `price > ema9 > ema21 > ema110`, trend is `BULL`
   - when `price < ema9 < ema21 < ema110`, trend is `BEAR`
   - otherwise trend is `HOLD`

4. Persist a snapshot row for each market scope on refresh.
   Expected:
   - `GLOBAL_NEWS`, `INDIA_NEWS`, `GIFT_NIFTY`, and `SP500` rows are upserted for the refresh timestamp

5. Search market-trend rows with filters.
   Expected:
   - scope and status filters narrow the result
   - paging is applied and sorted by latest snapshot first

6. Scheduler swallows provider validation failures.
   Expected:
   - scheduled tick logs a warning and does not crash the app context

7. Store OpenAI advisory analysis when the API key is configured.
   Expected:
   - scheduler persists `aiAnalysis`, `aiReason`, `aiConfidence`, and `aiModel`
   - rule-based `trendStatus` remains populated independently

8. Manage Trigger can schedule market trend refresh.
   Expected:
   - `MARKET_SENTIMENT_REFRESH` can be created without timeframe
   - trigger executes `marketSentimentService.refreshTenant`
   - fixed cron scheduler backs off while a running or paused market-trend trigger exists

## Frontend Cases

1. Open `Backtest -> Market Trend`.
   Expected:
   - heading is visible
   - grid rows render

2. Filter by market scope.
   Expected:
   - UI sends `marketScope`
   - filtered rows refresh

3. Filter by trend status.
   Expected:
   - UI sends `trendStatus`
   - selected trend chip remains visible in the results

4. Filter by date range.
   Expected:
   - UI sends `fromSnapshotAt` and `toSnapshotAt`
   - grid refreshes from page `0`

5. Reset filters.
   Expected:
   - all draft filters return to defaults
   - unfiltered listing is requested again

6. Update the OpenAI API key in the migration/admin section.
   Expected:
   - UI calls `/admin/openai/token`
   - status chip and model metadata refresh

7. Render the `AI Analyse` column.
   Expected:
   - chip shows `BULL`, `BEAR`, or `NEUTRAL` when available
   - confidence and model metadata are visible below the chip

## Suggested Execution

```bash
cd backend
mvn -Dtest=MarketSentimentServiceTest,BacktestAnalyticsServiceTest,UpstoxSchedulersTest test

cd ../desktop
npm run build
npm run test:e2e -- backtest.spec.ts
```
