# Option Chain Test Cases

## Scope

- Upstox parsing
- Snapshot persistence
- Latest and history admin APIs
- UI reload, bootstrap, and refresh behavior

## Backend Cases

1. Upstox client parses option-chain payload into structured rows.
2. Upstox client parses option-contract payload and expiry dates.
3. Option-chain refresh writes rows via idempotent upsert.
4. Latest-chain view computes synthetic future price correctly.
5. OI change percentages are computed correctly for CE and PE rows.

## API Cases

1. `GET /api/v1/admin/option-chain/expiries` returns sorted expiry values.
2. `GET /api/v1/admin/option-chain/latest` returns latest snapshot rows for the selected expiry.
3. `GET /api/v1/admin/option-chain/latest` includes call and put instrument keys for each row.
4. `POST /api/v1/admin/option-chain/migrate-historical` triggers refresh and returns summary counts.
5. `GET /api/v1/admin/option-chain/history` returns paginated historical rows.

## Frontend Cases

1. Option Chain menu opens the new section successfully.
2. Underlying change reloads the expiry list.
3. Expiry change reloads table rows.
4. Auto-refresh toggle performs periodic refresh.
5. Migration button triggers the API and shows notification.
6. Calls and puts table renders strike, LTP, OI bars, and OI change colors.

## Regression Checks

1. Migration Jobs section still loads and controls work.
2. Historical Data section filters, sorts, and paginates unchanged.
3. Trading Window tab and chart persistence remain unaffected.
