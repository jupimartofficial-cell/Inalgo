# Upstox Expired Instrument Earliest Date Findings

Date of check: 2026-03-07 (IST)

## Scope
- API: `GET /v2/expired-instruments/historical-candle/{instrument}/{timeframe}/{to_date}/{from_date}`
- Instrument under test: `NSE_FO|73507|24-04-2025`
- Timeframes: `1minute`, `5minute`, `15minute`, `30minute`, `60minute`, `1day`, `1week`, `1month`
- Probe floor date: `2020-01-01`

## Result summary

The following timeframes returned data (HTTP 200). Earliest candles:
- `1minute`: `2025-01-31T13:41:00+05:30`
- `5minute`: `2025-01-31T03:30:00+05:30`
- `15minute`: `2025-01-31T03:30:00+05:30`
- `30minute`: `2025-01-31T03:30:00+05:30`

The following timeframes returned error `UDAPI1147 (Invalid interval)`:
- `60minute`, `1day`, `1week`, `1month`

## Detailed matrix

| Instrument | Timeframe | HTTP | Earliest Candle | Error Code |
|---|---|---:|---|---|
| NSE_FO\|73507\|24-04-2025 | 1minute | 200 | 2025-01-31T13:41:00+05:30 | - |
| NSE_FO\|73507\|24-04-2025 | 5minute | 200 | 2025-01-31T03:30:00+05:30 | - |
| NSE_FO\|73507\|24-04-2025 | 15minute | 200 | 2025-01-31T03:30:00+05:30 | - |
| NSE_FO\|73507\|24-04-2025 | 30minute | 200 | 2025-01-31T03:30:00+05:30 | - |
| NSE_FO\|73507\|24-04-2025 | 60minute | 400 | N/A | UDAPI1147 |
| NSE_FO\|73507\|24-04-2025 | 1day | 400 | N/A | UDAPI1147 |
| NSE_FO\|73507\|24-04-2025 | 1week | 400 | N/A | UDAPI1147 |
| NSE_FO\|73507\|24-04-2025 | 1month | 400 | N/A | UDAPI1147 |

## Repro

```bash
python3 scripts/upstox_expired_earliest_probe.py > reports/upstox-expired-earliest-result.json
```

Raw output is saved at:
- `reports/upstox-expired-earliest-result.json`
