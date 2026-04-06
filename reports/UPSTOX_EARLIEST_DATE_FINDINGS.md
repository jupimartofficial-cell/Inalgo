# Upstox Earliest Historical Date Findings

Date of check: 2026-03-07 (IST)

## Scope
Checked historical candle availability for:
- Instruments: `NSE_INDEX|Nifty 50`, `NSE_INDEX|Nifty Bank`, `BSE_INDEX|SENSEX`
- Timeframes: `1m`, `5m`, `15m`, `30m`, `60m`, `1D`, `1W`, `1M`
- API: `GET /v3/historical-candle/{instrument_key}/{unit}/{interval}/{to_date}/{from_date}`

## Earliest candle available per instrument/timeframe

| Instrument | 1m | 5m | 15m | 30m | 60m | 1D | 1W | 1M |
|---|---|---|---|---|---|---|---|---|
| NSE_INDEX\|Nifty 50 | 2025-03-13 09:15 | 2025-03-13 09:15 | 2025-03-13 09:15 | 2022-01-03 09:15 | 2022-01-03 09:15 | 2020-01-01 00:00 | 2019-12-30 00:00 | 2020-01-01 00:00 |
| NSE_INDEX\|Nifty Bank | 2025-03-13 09:15 | 2025-03-13 09:15 | 2025-03-13 09:15 | 2022-01-03 09:15 | 2022-01-03 09:15 | 2020-01-01 00:00 | 2019-12-30 00:00 | 2020-01-01 00:00 |
| BSE_INDEX\|SENSEX | 2025-03-13 09:15 | 2025-03-13 09:15 | 2025-03-13 09:15 | 2022-01-03 09:15 | 2022-01-03 09:15 | 2020-01-01 00:00 | 2019-12-30 00:00 | 2020-01-01 00:00 |

(All timestamps are `+05:30` from Upstox.)

## Can we migrate from 2020-01-01?

- **Yes** for: `1D`, `1W`, `1M`.
- **No** for: `1m`, `5m`, `15m`, `30m`, `60m` (these start later than 2020).

## Date-range limit observations

Requests that exceed timeframe-specific limits return `400` with `UDAPI1148 (Invalid date range)`.

Observed practical request windows:
- `1m/5m/15m/30m`: max ~29 days per request
- `60m`: max ~90 days per request
- `1D/1W/1M`: large windows work for backfill from 2020 in this tenant/token

## Repro

Use `scripts/upstox_earliest_date_probe.py` to rerun checks with current token.

Raw output is saved at:
- `reports/upstox-earliest-date-result.json`
