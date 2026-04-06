WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY tenant_id,
                            BTRIM(instrument_key),
                            LOWER(BTRIM(timeframe_unit)),
                            timeframe_interval,
                            signal_date
               ORDER BY updated_at DESC NULLS LAST,
                        created_at DESC NULLS LAST,
                        id DESC
           ) AS rn
    FROM trading_signal
)
DELETE FROM trading_signal ts
USING ranked r
WHERE ts.id = r.id
  AND r.rn > 1;

UPDATE trading_signal
SET instrument_key = BTRIM(instrument_key),
    timeframe_unit = LOWER(BTRIM(timeframe_unit))
WHERE instrument_key <> BTRIM(instrument_key)
   OR timeframe_unit <> LOWER(BTRIM(timeframe_unit));

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ck_trading_signal_instrument_key_trimmed'
    ) THEN
        ALTER TABLE trading_signal
            ADD CONSTRAINT ck_trading_signal_instrument_key_trimmed
                CHECK (instrument_key = BTRIM(instrument_key));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ck_trading_signal_timeframe_unit_canonical'
    ) THEN
        ALTER TABLE trading_signal
            ADD CONSTRAINT ck_trading_signal_timeframe_unit_canonical
                CHECK (timeframe_unit = LOWER(BTRIM(timeframe_unit)));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_class c
                 JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'i'
          AND c.relname = 'uk_trading_signal_tenant_instrument_tf_day'
          AND n.nspname = current_schema()
    ) THEN
        CREATE UNIQUE INDEX uk_trading_signal_tenant_instrument_tf_day
            ON trading_signal (tenant_id, instrument_key, timeframe_unit, timeframe_interval, signal_date);
    END IF;
END $$;
