# Migration Futures Update Verification (2026-03-07)

## Change summary
- Added three index futures to default migration job catalog:
  - `NSE_FO|51714` (`NIFTY FUT 30 MAR 26`)
  - `NSE_FO|51701` (`BANKNIFTY FUT 30 MAR 26`)
  - `BSE_FO|825565` (`SENSEX FUT 25 MAR 26`)
- Added same three instruments to configured scheduler streams in `application.yml` with interval `1day` and bootstrap `2024-01-01`.

## Automated tests
- Command: `cd backend && mvn test`
- Result: `BUILD SUCCESS`
- Tests: 37 run, 0 failures, 0 errors.

## Runtime verification (fresh app instance)
- Started updated backend on `http://localhost:8082`.
- Admin API check:
  - `GET /api/v1/admin/migrations/jobs` returned **48** jobs.
  - Verified presence of all existing spot indices and all three futures for `1minute` and `1day`.
- Upstox proxy check:
  - `GET /api/v1/upstox/historical` for `NSE_INDEX|Nifty 50` (`1day`) returned candles.
  - `GET /api/v1/upstox/historical` for `NSE_FO|51714` (`1day`) returned candles.

## Notes
- Futures instrument keys are contract-specific; update them on expiry.
