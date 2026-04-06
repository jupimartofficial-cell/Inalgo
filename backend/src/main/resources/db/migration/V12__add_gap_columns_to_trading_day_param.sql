ALTER TABLE trading_day_param
    ADD COLUMN IF NOT EXISTS today_open NUMERIC(18, 6),
    ADD COLUMN IF NOT EXISTS today_close NUMERIC(18, 6),
    ADD COLUMN IF NOT EXISTS prev_high NUMERIC(18, 6),
    ADD COLUMN IF NOT EXISTS prev_low NUMERIC(18, 6),
    ADD COLUMN IF NOT EXISTS prev_close NUMERIC(18, 6),
    ADD COLUMN IF NOT EXISTS gap_pct NUMERIC(18, 6),
    ADD COLUMN IF NOT EXISTS gap_type VARCHAR(16),
    ADD COLUMN IF NOT EXISTS gap_up_pct NUMERIC(18, 6),
    ADD COLUMN IF NOT EXISTS gap_down_pct NUMERIC(18, 6);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ck_trading_day_param_gap_type'
    ) THEN
        ALTER TABLE trading_day_param
            ADD CONSTRAINT ck_trading_day_param_gap_type
                CHECK (gap_type IS NULL OR gap_type IN ('Gap Up', 'Gap Down', 'Normal'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ck_trading_day_param_prev_range'
    ) THEN
        ALTER TABLE trading_day_param
            ADD CONSTRAINT ck_trading_day_param_prev_range
                CHECK (prev_high IS NULL OR prev_low IS NULL OR prev_low <= prev_high);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ck_trading_day_param_gap_positive'
    ) THEN
        ALTER TABLE trading_day_param
            ADD CONSTRAINT ck_trading_day_param_gap_positive
                CHECK (
                    (gap_up_pct IS NULL OR gap_up_pct >= 0)
                    AND (gap_down_pct IS NULL OR gap_down_pct >= 0)
                );
    END IF;
END $$;
