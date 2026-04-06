# Upstox V2 Earliest Historical Date Findings

Date of check: 2026-03-07 (IST)

## Scope
- API: `GET /v2/historical-candle/{instrument}/{timeframe}/{to_date}/{from_date}`
- Instruments: `NSE_INDEX|Nifty 50`, `NSE_INDEX|Nifty Bank`, `BSE_INDEX|SENSEX`
- Timeframes tested (v2-supported): `1minute`, `30minute`, `day`, `week`, `month`
- Probe floor date: `2020-01-01`

## Earliest candle available per instrument/timeframe

| Instrument | 1minute | 30minute | day | week | month |
|---|---|---|---|---|---|
| NSE_INDEX\|Nifty 50 | 2025-03-13 09:15 | 2022-01-03 09:15 | 2020-01-01 00:00 | 2019-12-30 00:00 | 2020-01-01 00:00 |
| NSE_INDEX\|Nifty Bank | 2025-03-13 09:15 | 2022-01-03 09:15 | 2020-01-01 00:00 | 2019-12-30 00:00 | 2020-01-01 00:00 |
| BSE_INDEX\|SENSEX | 2025-03-13 09:15 | 2022-01-03 09:15 | 2020-01-01 00:00 | 2019-12-30 00:00 | 2020-01-01 00:00 |

(All timestamps are `+05:30` from Upstox.)

## Notes
- v2 endpoint accepts only: `1minute`, `30minute`, `day`, `week`, `month` (others return `UDAPI1020`).
- For `1minute`, the probe hits `UDAPI1148 (Invalid date range)` when stepping further back, so the earliest values above are the oldest candles returned before the API rejects older ranges.

## Repro

```bash
python3 scripts/upstox_v2_earliest_date_probe.py > reports/upstox-v2-earliest-date-result.json
```

Raw output is saved at:
- `reports/upstox-v2-earliest-date-result.json`
