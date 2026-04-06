CREATE TABLE IF NOT EXISTS backtest_strategy (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    username VARCHAR(64) NOT NULL,
    strategy_name VARCHAR(120) NOT NULL,
    underlying_key VARCHAR(128) NOT NULL,
    underlying_source VARCHAR(16) NOT NULL,
    strategy_type VARCHAR(16) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    entry_time TIME NOT NULL,
    exit_time TIME NOT NULL,
    legs_count INTEGER NOT NULL,
    strategy_json TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_backtest_strategy_tenant_user_name UNIQUE (tenant_id, username, strategy_name)
);

CREATE INDEX IF NOT EXISTS idx_backtest_strategy_lookup
    ON backtest_strategy (tenant_id, username, updated_at DESC);
