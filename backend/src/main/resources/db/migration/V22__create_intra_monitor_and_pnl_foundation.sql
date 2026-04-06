-- Intra Monitor + Intra P&L foundation tables
-- Phase 1: runtime state, position snapshots, immutable event/audit log, daily P&L aggregates

ALTER TABLE intra_trade_execution
    ADD COLUMN IF NOT EXISTS exit_reason VARCHAR(40),
    ADD COLUMN IF NOT EXISTS account_ref VARCHAR(128);

UPDATE intra_trade_execution
SET exit_reason = COALESCE(exit_reason,
    CASE
        WHEN status = 'EXITED' THEN 'strategy exit'
        WHEN status = 'FAILED' THEN 'error'
        ELSE 'unknown'
    END),
    account_ref = COALESCE(account_ref, tenant_id || ':' || username)
WHERE exit_reason IS NULL OR account_ref IS NULL;

CREATE TABLE IF NOT EXISTS intra_runtime_strategy (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    username VARCHAR(64) NOT NULL,
    execution_id BIGINT NOT NULL,
    strategy_id BIGINT,
    strategy_name VARCHAR(120) NOT NULL,
    instrument_key VARCHAR(128) NOT NULL,
    mode VARCHAR(16) NOT NULL,
    status VARCHAR(24) NOT NULL,
    entry_time TIMESTAMPTZ,
    current_signal VARCHAR(32),
    current_mtm NUMERIC(19, 2) NOT NULL DEFAULT 0,
    sl_state VARCHAR(32),
    target_state VARCHAR(32),
    next_expected_action VARCHAR(64),
    data_refreshed_at TIMESTAMPTZ NOT NULL,
    freshness_seconds INTEGER NOT NULL DEFAULT 0,
    last_event_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_intra_runtime_execution UNIQUE (tenant_id, execution_id),
    CONSTRAINT ck_intra_runtime_status CHECK (status IN ('WAITING', 'ENTERED', 'PARTIAL_EXIT', 'EXITED', 'PAUSED', 'ERROR')),
    CONSTRAINT ck_intra_runtime_mode CHECK (mode IN ('LIVE', 'PAPER'))
);

CREATE INDEX IF NOT EXISTS idx_intra_runtime_lookup
    ON intra_runtime_strategy (tenant_id, username, mode, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS intra_position_snapshot (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    username VARCHAR(64) NOT NULL,
    runtime_id BIGINT NOT NULL REFERENCES intra_runtime_strategy(id) ON DELETE CASCADE,
    execution_id BIGINT NOT NULL,
    mode VARCHAR(16) NOT NULL,
    instrument_key VARCHAR(128) NOT NULL,
    quantity_lots NUMERIC(19, 4) NOT NULL DEFAULT 0,
    entry_price NUMERIC(19, 4),
    current_price NUMERIC(19, 4),
    unrealized_pnl NUMERIC(19, 2) NOT NULL DEFAULT 0,
    realized_pnl NUMERIC(19, 2) NOT NULL DEFAULT 0,
    sl_price NUMERIC(19, 4),
    target_price NUMERIC(19, 4),
    strategy_name VARCHAR(120) NOT NULL,
    entry_time TIMESTAMPTZ,
    time_in_trade_seconds BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(24) NOT NULL DEFAULT 'OPEN',
    manual_watch BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_intra_position_mode CHECK (mode IN ('LIVE', 'PAPER')),
    CONSTRAINT ck_intra_position_status CHECK (status IN ('OPEN', 'PARTIAL_EXIT', 'CLOSED', 'PAUSED', 'MANUAL_WATCH'))
);

CREATE INDEX IF NOT EXISTS idx_intra_position_lookup
    ON intra_position_snapshot (tenant_id, username, mode, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS intra_event_audit (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    username VARCHAR(64) NOT NULL,
    runtime_id BIGINT,
    execution_id BIGINT,
    position_id BIGINT,
    event_type VARCHAR(64) NOT NULL,
    severity VARCHAR(16) NOT NULL,
    mode VARCHAR(16),
    message VARCHAR(255) NOT NULL,
    reason VARCHAR(255),
    before_state_json TEXT,
    after_state_json TEXT,
    correlation_id VARCHAR(64),
    actor VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_intra_event_runtime FOREIGN KEY (runtime_id) REFERENCES intra_runtime_strategy(id) ON DELETE SET NULL,
    CONSTRAINT fk_intra_event_position FOREIGN KEY (position_id) REFERENCES intra_position_snapshot(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_intra_event_lookup
    ON intra_event_audit (tenant_id, username, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_intra_event_runtime_lookup
    ON intra_event_audit (tenant_id, runtime_id, created_at DESC);

CREATE TABLE IF NOT EXISTS intra_pnl_daily (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    username VARCHAR(64) NOT NULL,
    mode VARCHAR(16) NOT NULL,
    trade_date DATE NOT NULL,
    realized_pnl NUMERIC(19, 2) NOT NULL DEFAULT 0,
    unrealized_pnl NUMERIC(19, 2) NOT NULL DEFAULT 0,
    total_pnl NUMERIC(19, 2) NOT NULL DEFAULT 0,
    trades_count INTEGER NOT NULL DEFAULT 0,
    win_count INTEGER NOT NULL DEFAULT 0,
    loss_count INTEGER NOT NULL DEFAULT 0,
    max_drawdown NUMERIC(19, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_intra_pnl_daily UNIQUE (tenant_id, username, mode, trade_date),
    CONSTRAINT ck_intra_pnl_mode CHECK (mode IN ('LIVE', 'PAPER'))
);

CREATE INDEX IF NOT EXISTS idx_intra_pnl_daily_lookup
    ON intra_pnl_daily (tenant_id, username, mode, trade_date DESC);
