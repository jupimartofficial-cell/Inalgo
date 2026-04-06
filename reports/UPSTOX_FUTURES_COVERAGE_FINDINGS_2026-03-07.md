# Upstox Futures Coverage Findings (Nifty, Bank Nifty, Sensex)

Date of check: 2026-03-07 (IST)
Tenant used: `local-desktop`

## Scope
- Instruments:
  - `Nifty future`
  - `Bank Nifty future`
  - `Sensex future`
- Defined date range used for validation: `2020-01-01` to `2026-03-07`
- Candle timeframe used for continuity checks: `30minute` (rolling 29-day windows)
- Endpoints:
  - Active contracts: `GET /v3/historical-candle/{instrument_key}/minutes/30/{to_date}/{from_date}`
  - Expired contract discovery: `GET /v2/expired-instruments/expiries` and `GET /v2/expired-instruments/future/contract`
  - Expired candles: `GET /v2/expired-instruments/historical-candle/{instrument}/{timeframe}/{to_date}/{from_date}`
  - Active contract discovery: Upstox instrument master `complete.json.gz`

## Summary

| Instrument | Contracts Checked | Expired | Active (current+coming) | Observed Expiry Span | Missing Months In Observed Span | Missing Current/Coming Months | Contracts With No Candle Data |
|---|---:|---:|---:|---|---|---|---:|
| Nifty future | 20 | 17 | 3 | 2024-10-31 -> 2026-05-26 | None | None | 1 |
| Bank Nifty future | 20 | 17 | 3 | 2024-10-30 -> 2026-05-26 | None | None | 1 |
| Sensex future | 55 | 52 | 3 | 2024-10-04 -> 2026-05-27 | None | None | 0 |

## Current + Coming Months (Validated)
As of 2026-03-07, all 3 underlyings have current and next 2 monthly contracts, and all returned candle data.

- Nifty: Mar 2026, Apr 2026, May 2026
- Bank Nifty: Mar 2026, Apr 2026, May 2026
- Sensex: Mar 2026, Apr 2026, May 2026

## Historical Coverage Observations
- Within the **observed expiry span from Upstox expired contract APIs**, monthly continuity is complete for all three instruments.
- However, Upstox expired expiry listings for these underlyings start around **October 2024**, not 2020.
- Therefore, for the requested broad range `2020-01-01` onward, API-discoverable futures history is **not available before ~2024-10** in this check.

## Contracts Returning Zero Candles
Two expired contracts returned HTTP 200 with zero candles across `1/5/15/30minute` checks:
- `NIFTY FUT 26 DEC 24` (`NSE_FO|35005|26-12-2024`)
- `BANKNIFTY FUT 27 MAR 25` (`NSE_FO|58958|27-03-2025`)

## Artifacts
- Raw machine output: `reports/upstox-futures-coverage-check-2026-03-07.json`
