# Upstox V3 Historical Candle APIs — Learning Notes & Data Sync Plan

## Current project instrument scope (as of 2026-03-07)
- Spot indices:
  - `NSE_INDEX|Nifty 50`
  - `NSE_INDEX|Nifty Bank`
  - `BSE_INDEX|SENSEX`
- Index futures in migration catalog:
  - `NSE_FO|51714` (`NIFTY FUT 30 MAR 26`)
  - `NSE_FO|51701` (`BANKNIFTY FUT 30 MAR 26`)
  - `BSE_FO|825565` (`SENSEX FUT 25 MAR 26`)

Note: futures keys are contract-specific and must be rolled on expiry.

## Source URLs reviewed
1. https://upstox.com/developer/api-documentation/announcements/enhanced-historical-candle-data-apis-v3/
2. https://upstox.com/developer/api-documentation/v3/get-intra-day-candle-data/
3. https://upstox.com/developer/api-documentation/v3/get-historical-candle-data/

---

## 1) What changed in V3 (learning summary)

From the announcement and V3 docs:
- Upstox introduced enhanced V3 candle APIs for both **intraday** and **historical** OHLC retrieval.
- V3 adds **custom interval support** across time units (instead of fixed/default-only buckets).
- Response shape remains broadly consistent (`status` + `data.candles`) to ease migration.
- There are explicit validation errors for bad unit/interval/date ranges (`UDAPI1146`, `UDAPI1147`, `UDAPI1148`, etc.).

---

## 2) Endpoint reference (practical)

## A) Intraday Candle Data V3

### Purpose
Get OHLC candles for the **current trading day** for an instrument.

### Endpoint pattern
`GET https://api.upstox.com/v3/historical-candle/intraday/{instrument_key}/{unit}/{interval}`

### Example
`GET https://api.upstox.com/v3/historical-candle/intraday/NSE_EQ%7CINE848E01016/minutes/1`

### Required headers
- `Accept: application/json`
- `Content-Type: application/json`
- `Authorization: Bearer <access_token>`

### Path params
- `instrument_key` (URL-encoded, e.g. `NSE_EQ|INE848E01016` -> `NSE_EQ%7CINE848E01016`)
- `unit` (doc examples show `minutes`, `days`; announcement mentions expanded units)
- `interval` (numeric, valid range depends on unit)

### Response model (important for ingestion)
- `status`
- `data.candles`
  - Candles are array entries representing OHLC(+volume,OI if available by segment)

---

## B) Historical Candle Data V3

### Purpose
Get OHLC candles over a date range with flexible unit/interval combinations.

### Endpoint pattern
`GET https://api.upstox.com/v3/historical-candle/{instrument_key}/{unit}/{interval}/{to_date}/{from_date}`

### Example
`GET https://api.upstox.com/v3/historical-candle/NSE_EQ%7CINE848E01016/minutes/1/2025-01-02/2025-01-01`

### Required headers
- `Accept: application/json`
- `Content-Type: application/json`
- `Authorization: Bearer <access_token>`

### Path params
- `instrument_key`
- `unit` (docs show `minutes`, `days`, `weeks`, `months`)
- `interval`
- `to_date` (`YYYY-MM-DD`)
- `from_date` (`YYYY-MM-DD`)

### Validation / error notes seen in docs
- `UDAPI1022`: `to_date` required
- `UDAPI1015`: `to_date` must be >= `from_date` and valid format
- `UDAPI1146`: invalid unit
- `UDAPI1147`: invalid interval for selected unit
- `UDAPI1148`: date span exceeds allowed limits for selected unit/interval

---

## 3) Data sync design (recommended)

## A) Core goals
- Reliable backfill + incremental sync.
- Idempotent writes (safe retries).
- Fast resync after outages.
- Minimal duplicate/downstream recalculation.

## B) Storage schema suggestion
Use a candle fact table keyed by:
- `instrument_key`
- `timeframe_unit`
- `timeframe_interval`
- `candle_ts` (normalized exchange timestamp)

Recommended unique constraint:
`UNIQUE (instrument_key, timeframe_unit, timeframe_interval, candle_ts)`

Columns:
- o, h, l, c
- volume (nullable)
- oi (nullable)
- source (`upstox_v3`)
- fetched_at
- payload_hash (optional for change-detection)

## C) Sync modes
1. **Bootstrap backfill**
   - For each instrument and timeframe, fetch historical in windows from oldest -> newest.
   - Keep window size conservative so requests don’t hit `UDAPI1148`.
2. **Daily refresh**
   - Re-fetch last N days (small overlap window) to absorb late adjustments.
3. **Intraday rolling sync**
   - Poll intraday endpoint for active symbols at fixed cadence.
   - Upsert by unique candle key.
4. **Recovery sync**
   - After downtime, run gap-filler using last successful candle timestamp.

## D) Windowing strategy
Because exact limits vary by unit/interval, implement adaptive chunking:
- Start with a configured date span per unit (e.g., minutes = short windows, days/weeks/months = larger).
- If `UDAPI1148` occurs, halve span and retry.
- Persist successful span size per `(unit, interval)` for smarter future calls.

## E) Idempotency & correctness
- Use DB `UPSERT` (`ON CONFLICT DO UPDATE`) on unique key.
- Treat API call + DB write as atomic batch transaction.
- Maintain `sync_state` table per stream:
  - `instrument_key`
  - `unit`
  - `interval`
  - `last_success_to_date`
  - `last_success_candle_ts`
  - `last_run_status`

## F) Retry and rate control
- Retry on 429/5xx with exponential backoff + jitter.
- Do **not** retry on validation errors (`UDAPI1146/1147/1015`) until params are corrected.
- Add bounded concurrency by instrument bucket.

## G) Data quality checks
After each batch:
- Verify timestamp monotonicity.
- Detect duplicates before upsert (for logging only).
- Sanity-check OHLC (`low <= open/close <= high`).
- Alert on large candle gaps in trading sessions.

---

## 4) Implementation playbook

1. Build URL-safe instrument encoder (`|` -> `%7C`).
2. Build typed request builders for both endpoints.
3. Build parser for `data.candles` with strict schema validation.
4. Implement generic `fetch_with_backoff` wrapper.
5. Implement `sync_historical_range` with adaptive chunking.
6. Implement `sync_intraday_current_day` polling job.
7. Add `sync_state` persistence and observability metrics.
8. Add replay job for failed windows.

---

## 5) Suggested default sync policy
- **1-minute candles**: intraday poll every 30–60s, plus daily overlap refresh (last 2 trading days).
- **3/5/15-minute candles**: derive from 1-minute internally if you already store 1-min; otherwise fetch directly.
- **Daily+ candles**: run end-of-day sync with 5–10 day overlap.

---

## 6) Security and operational notes
- Store bearer token in secret manager, never in code.
- Rotate/refresh token before expiry.
- Log request correlation IDs and status codes (avoid logging tokens).
- Keep per-tenant segregation if your platform is multi-tenant.

---

## 7) Open items to verify in sandbox before production
- Final allowed `unit` set for intraday vs historical (announcement vs endpoint docs can differ in wording).
- Exact max date-span constraints per `(unit, interval)`.
- Candle array field order across all segments (equity, index, derivatives).
- Upstox rate limits and recommended concurrency envelope for production volume.
