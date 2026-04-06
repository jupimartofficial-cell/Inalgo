CREATE TABLE IF NOT EXISTS trading_script (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    username VARCHAR(64) NOT NULL,
    script_name VARCHAR(120) NOT NULL,
    instrument_key VARCHAR(128) NOT NULL,
    timeframe_unit VARCHAR(16) NOT NULL,
    timeframe_interval INTEGER NOT NULL,
    strategy_type VARCHAR(16) NOT NULL,
    market_session VARCHAR(64),
    status VARCHAR(24) NOT NULL,
    publish_state VARCHAR(24) NOT NULL,
    compile_status VARCHAR(24) NOT NULL,
    current_version INTEGER NOT NULL,
    current_version_id BIGINT,
    paper_eligible BOOLEAN NOT NULL DEFAULT FALSE,
    live_eligible BOOLEAN NOT NULL DEFAULT FALSE,
    creator VARCHAR(64) NOT NULL,
    archived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_trading_script_tenant_user_name UNIQUE (tenant_id, username, script_name),
    CONSTRAINT ck_trading_script_status CHECK (status IN ('DRAFT', 'COMPILED', 'PAPER_READY', 'LIVE_READY', 'ARCHIVED')),
    CONSTRAINT ck_trading_script_publish_state CHECK (publish_state IN ('DRAFT', 'PUBLISHED')),
    CONSTRAINT ck_trading_script_compile_status CHECK (compile_status IN ('PENDING', 'SUCCESS', 'FAILED'))
);

CREATE TABLE IF NOT EXISTS trading_script_version (
    id BIGSERIAL PRIMARY KEY,
    script_id BIGINT NOT NULL REFERENCES trading_script(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL,
    username VARCHAR(64) NOT NULL,
    version INTEGER NOT NULL,
    source_js TEXT NOT NULL,
    declared_inputs_json TEXT,
    compile_diagnostics_json TEXT,
    compiled_artifact_json TEXT,
    compile_status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    paper_eligible BOOLEAN NOT NULL DEFAULT FALSE,
    live_eligible BOOLEAN NOT NULL DEFAULT FALSE,
    compiled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_trading_script_version UNIQUE (script_id, version),
    CONSTRAINT ck_trading_script_version_compile_status CHECK (compile_status IN ('PENDING', 'SUCCESS', 'FAILED'))
);

ALTER TABLE trading_script
    ADD CONSTRAINT fk_trading_script_current_version
    FOREIGN KEY (current_version_id) REFERENCES trading_script_version(id);

CREATE TABLE IF NOT EXISTS trading_script_perf_snapshot (
    script_id BIGINT PRIMARY KEY REFERENCES trading_script(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL,
    username VARCHAR(64) NOT NULL,
    latest_total_pnl NUMERIC(19, 2),
    latest_executed_trades INTEGER,
    latest_real_world_accuracy_pct NUMERIC(9, 2),
    latest_evaluated_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trading_script_library_lookup
    ON trading_script (tenant_id, username, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_trading_script_library_filters
    ON trading_script (tenant_id, username, status, compile_status, instrument_key, timeframe_unit, timeframe_interval);

CREATE INDEX IF NOT EXISTS idx_trading_script_version_lookup
    ON trading_script_version (tenant_id, username, script_id, version DESC);

CREATE INDEX IF NOT EXISTS idx_trading_script_perf_lookup
    ON trading_script_perf_snapshot (tenant_id, username, latest_total_pnl DESC NULLS LAST);
