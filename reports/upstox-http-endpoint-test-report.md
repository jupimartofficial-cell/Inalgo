# Upstox HTTP Endpoint Test Report

- Timestamp (UTC): `2026-03-04T14:18:12.260477+00:00`
- Total checks: **42**
- HTTP 200 checks: **42**
- Non-200 checks: **0**

## Scope
- Instruments: `NSE_INDEX|Nifty 50`, `NSE_INDEX|Nifty Bank`, `BSE_INDEX|SENSEX`.
- Timeframes covered: `1minute`, `5minute`, `15minute`, `30minute`, `60minute`, `1day`, `1week`, `1month`.
- Endpoint coverage strategy: intraday is validated for minute/day intervals; weekly/monthly are validated via historical endpoint.

## Results

| Endpoint | Instrument | Timeframe | Status | Result |
|---|---|---:|---:|---|
| intraday | NSE_INDEX|Nifty 50 | 1minute | 200 | PASS |
| intraday | NSE_INDEX|Nifty 50 | 5minute | 200 | PASS |
| intraday | NSE_INDEX|Nifty 50 | 15minute | 200 | PASS |
| intraday | NSE_INDEX|Nifty 50 | 30minute | 200 | PASS |
| intraday | NSE_INDEX|Nifty 50 | 60minute | 200 | PASS |
| intraday | NSE_INDEX|Nifty 50 | 1day | 200 | PASS |
| historical | NSE_INDEX|Nifty 50 | 1minute | 200 | PASS |
| historical | NSE_INDEX|Nifty 50 | 5minute | 200 | PASS |
| historical | NSE_INDEX|Nifty 50 | 15minute | 200 | PASS |
| historical | NSE_INDEX|Nifty 50 | 30minute | 200 | PASS |
| historical | NSE_INDEX|Nifty 50 | 60minute | 200 | PASS |
| historical | NSE_INDEX|Nifty 50 | 1day | 200 | PASS |
| historical | NSE_INDEX|Nifty 50 | 1week | 200 | PASS |
| historical | NSE_INDEX|Nifty 50 | 1month | 200 | PASS |
| intraday | NSE_INDEX|Nifty Bank | 1minute | 200 | PASS |
| intraday | NSE_INDEX|Nifty Bank | 5minute | 200 | PASS |
| intraday | NSE_INDEX|Nifty Bank | 15minute | 200 | PASS |
| intraday | NSE_INDEX|Nifty Bank | 30minute | 200 | PASS |
| intraday | NSE_INDEX|Nifty Bank | 60minute | 200 | PASS |
| intraday | NSE_INDEX|Nifty Bank | 1day | 200 | PASS |
| historical | NSE_INDEX|Nifty Bank | 1minute | 200 | PASS |
| historical | NSE_INDEX|Nifty Bank | 5minute | 200 | PASS |
| historical | NSE_INDEX|Nifty Bank | 15minute | 200 | PASS |
| historical | NSE_INDEX|Nifty Bank | 30minute | 200 | PASS |
| historical | NSE_INDEX|Nifty Bank | 60minute | 200 | PASS |
| historical | NSE_INDEX|Nifty Bank | 1day | 200 | PASS |
| historical | NSE_INDEX|Nifty Bank | 1week | 200 | PASS |
| historical | NSE_INDEX|Nifty Bank | 1month | 200 | PASS |
| intraday | BSE_INDEX|SENSEX | 1minute | 200 | PASS |
| intraday | BSE_INDEX|SENSEX | 5minute | 200 | PASS |
| intraday | BSE_INDEX|SENSEX | 15minute | 200 | PASS |
| intraday | BSE_INDEX|SENSEX | 30minute | 200 | PASS |
| intraday | BSE_INDEX|SENSEX | 60minute | 200 | PASS |
| intraday | BSE_INDEX|SENSEX | 1day | 200 | PASS |
| historical | BSE_INDEX|SENSEX | 1minute | 200 | PASS |
| historical | BSE_INDEX|SENSEX | 5minute | 200 | PASS |
| historical | BSE_INDEX|SENSEX | 15minute | 200 | PASS |
| historical | BSE_INDEX|SENSEX | 30minute | 200 | PASS |
| historical | BSE_INDEX|SENSEX | 60minute | 200 | PASS |
| historical | BSE_INDEX|SENSEX | 1day | 200 | PASS |
| historical | BSE_INDEX|SENSEX | 1week | 200 | PASS |
| historical | BSE_INDEX|SENSEX | 1month | 200 | PASS |

## Error Remediation Applied
- No HTTP errors were observed in this run; no endpoint-side remediation was required.
