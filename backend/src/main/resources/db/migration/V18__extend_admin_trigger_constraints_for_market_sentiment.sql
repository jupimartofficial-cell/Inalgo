ALTER TABLE admin_trigger
    DROP CONSTRAINT IF EXISTS ck_admin_trigger_job_key;

ALTER TABLE admin_trigger
    ADD CONSTRAINT ck_admin_trigger_job_key
        CHECK (
            job_key IN (
                'CANDLE_SYNC',
                'TRADING_SIGNAL_REFRESH',
                'TRADING_DAY_PARAM_REFRESH',
                'MARKET_SENTIMENT_REFRESH'
            )
        );

ALTER TABLE admin_trigger
    DROP CONSTRAINT IF EXISTS ck_admin_trigger_timeframe_requirements;

ALTER TABLE admin_trigger
    ADD CONSTRAINT ck_admin_trigger_timeframe_requirements
        CHECK (
            (job_key IN ('CANDLE_SYNC', 'TRADING_SIGNAL_REFRESH')
                AND timeframe_unit IS NOT NULL
                AND timeframe_interval IS NOT NULL)
            OR (job_key IN ('TRADING_DAY_PARAM_REFRESH', 'MARKET_SENTIMENT_REFRESH')
                AND timeframe_unit IS NULL
                AND timeframe_interval IS NULL)
        );

ALTER TABLE admin_trigger
    DROP CONSTRAINT IF EXISTS ck_admin_trigger_bootstrap_requirements;

ALTER TABLE admin_trigger
    ADD CONSTRAINT ck_admin_trigger_bootstrap_requirements
        CHECK (
            (job_key = 'CANDLE_SYNC' AND bootstrap_from_date IS NOT NULL)
            OR job_key IN ('TRADING_SIGNAL_REFRESH', 'TRADING_DAY_PARAM_REFRESH', 'MARKET_SENTIMENT_REFRESH')
        );
