# Trading Desk Test Cases

## Scope

- Market Watch list and refresh behavior
- Chart tabs and instrument/timeframe changes
- Option-chain snapshot rendering and order entry
- Bottom panel data (Positions, Orders, News)
- Refresh settings persistence

## Frontend Cases

1. Open `Trading Desk` from the navigation.
   Expected:
   - full-screen desk renders without the admin sidebar
   - header shows clock and back button

2. Market Watch list renders default instruments.
   Expected:
   - each row shows label, exchange, timeframe
   - LTP and percentage change are populated after refresh

3. Edit a Market Watch instrument.
   Expected:
   - changes persist after reload
   - LTP refresh uses the instrument's configured timeframe

4. Add a new Market Watch instrument.
   Expected:
   - row appears in the list
   - refresh pulls data for the new instrument key

5. Change active chart tab instrument and timeframe.
   Expected:
   - chart reloads with new data
   - tab label updates to the selected watch label

6. Add and remove chart tabs.
   Expected:
   - up to 5 tabs allowed
   - closing a tab selects the next available tab

7. Option-chain expiry selection.
   Expected:
   - expiry list loads for the selected underlying
   - rows render with CE/PE values and ATM highlight

8. Option-chain order placement buttons.
   Expected:
   - BUY/SELL buttons are disabled when instrument keys are missing
   - when enabled, clicking opens the order dialog with correct instrument token

9. Order dialog validation.
   Expected:
   - invalid quantity or limit price blocks submission
   - successful placement shows confirmation toast

10. Bottom panel Positions and Orders.
    Expected:
    - tabs load data without console errors
    - empty state messaging renders when no data returned

11. News feed tabs.
    Expected:
    - global and India tabs load recent articles
    - sentiment chip reflects positive/negative score

12. Refresh settings.
    Expected:
    - refresh intervals update for Market Watch, Option Chain, and Bottom Panel
    - settings persist after reload

## Backend/API Cases

1. `GET /api/v1/admin/option-chain/latest` includes `callInstrumentKey` and `putInstrumentKey` in rows.
2. `POST /api/v1/admin/intra-trade/orders/place` accepts `instrumentToken` from option-chain rows and returns order status.
3. `GET /api/v1/admin/intra-trade/upstox/positions` and `/orders` return data when a valid Upstox token is configured.

## Regression Checks

1. Option Chain main admin panel still renders and refreshes.
2. Trading Window chart controls continue to load without console errors.
3. Intra Trade order placement remains functional outside the desk.
