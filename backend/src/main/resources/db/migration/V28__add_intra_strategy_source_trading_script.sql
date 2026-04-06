ALTER TABLE intra_strategy
    ADD COLUMN IF NOT EXISTS source_trading_script_id BIGINT;

CREATE UNIQUE INDEX IF NOT EXISTS uk_intra_strategy_import_trading_script
    ON intra_strategy (tenant_id, username, source_trading_script_id)
    WHERE source_trading_script_id IS NOT NULL;
