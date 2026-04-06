CREATE TABLE IF NOT EXISTS intra_strategy (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    username VARCHAR(64) NOT NULL,
    strategy_name VARCHAR(120) NOT NULL,
    underlying_key VARCHAR(128) NOT NULL,
    timeframe_unit VARCHAR(16) NOT NULL,
    timeframe_interval INTEGER NOT NULL,
    strategy_type VARCHAR(16) NOT NULL,
    market_session VARCHAR(64),
    status VARCHAR(24) NOT NULL,
    publish_state VARCHAR(24) NOT NULL,
    current_version INTEGER NOT NULL,
    current_version_id BIGINT,
    paper_eligible BOOLEAN NOT NULL DEFAULT FALSE,
    live_eligible BOOLEAN NOT NULL DEFAULT FALSE,
    creator VARCHAR(64) NOT NULL,
    source_backtest_strategy_id BIGINT,
    archived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_intra_strategy_tenant_user_name UNIQUE (tenant_id, username, strategy_name),
    CONSTRAINT uk_intra_strategy_import_source UNIQUE (tenant_id, username, source_backtest_strategy_id),
    CONSTRAINT ck_intra_strategy_status CHECK (status IN ('DRAFT', 'PAPER_READY', 'LIVE_READY', 'ARCHIVED')),
    CONSTRAINT ck_intra_strategy_publish_state CHECK (publish_state IN ('DRAFT', 'PUBLISHED'))
);

CREATE TABLE IF NOT EXISTS intra_strategy_version (
    id BIGSERIAL PRIMARY KEY,
    strategy_id BIGINT NOT NULL REFERENCES intra_strategy(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL,
    username VARCHAR(64) NOT NULL,
    version INTEGER NOT NULL,
    advanced_mode BOOLEAN NOT NULL DEFAULT FALSE,
    timeframe_unit VARCHAR(16) NOT NULL,
    timeframe_interval INTEGER NOT NULL,
    strategy_json TEXT NOT NULL,
    validation_errors_json TEXT,
    validation_summary_json TEXT,
    validation_warnings_json TEXT,
    paper_eligible BOOLEAN NOT NULL DEFAULT FALSE,
    live_eligible BOOLEAN NOT NULL DEFAULT FALSE,
    validated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_intra_strategy_version UNIQUE (strategy_id, version)
);

ALTER TABLE intra_strategy
    ADD CONSTRAINT fk_intra_strategy_current_version
    FOREIGN KEY (current_version_id) REFERENCES intra_strategy_version(id);

CREATE TABLE IF NOT EXISTS intra_strategy_perf_snapshot (
    strategy_id BIGINT PRIMARY KEY REFERENCES intra_strategy(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL,
    username VARCHAR(64) NOT NULL,
    latest_total_pnl NUMERIC(19, 2),
    latest_executed_trades INTEGER,
    latest_evaluated_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intra_strategy_library_lookup
    ON intra_strategy (tenant_id, username, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_intra_strategy_library_filters
    ON intra_strategy (tenant_id, username, status, underlying_key, timeframe_unit, timeframe_interval);

CREATE INDEX IF NOT EXISTS idx_intra_strategy_version_lookup
    ON intra_strategy_version (tenant_id, username, strategy_id, version DESC);

CREATE INDEX IF NOT EXISTS idx_intra_strategy_perf_lookup
    ON intra_strategy_perf_snapshot (tenant_id, username, latest_total_pnl DESC NULLS LAST);
