-- Add first_candle_color column to trading_signal table.
-- Stores the color of the first candle of the trading day for the signal's instrument and timeframe.
-- Values: 'GREEN' (close >= open) or 'RED' (close < open). NULL when data is unavailable.
ALTER TABLE trading_signal
    ADD COLUMN IF NOT EXISTS first_candle_color VARCHAR(5)
        CHECK (first_candle_color IN ('GREEN', 'RED'));
