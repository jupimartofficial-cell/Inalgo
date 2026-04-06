CREATE TABLE market_sentiment_snapshot (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    market_scope VARCHAR(32) NOT NULL,
    market_name VARCHAR(64) NOT NULL,
    evaluation_type VARCHAR(16) NOT NULL,
    trend_status VARCHAR(16) NOT NULL,
    reason TEXT NOT NULL,
    current_value NUMERIC(18, 6),
    ema_9 NUMERIC(18, 6),
    ema_21 NUMERIC(18, 6),
    ema_110 NUMERIC(18, 6),
    source_count INTEGER NOT NULL DEFAULT 0,
    evidence_count INTEGER NOT NULL DEFAULT 0,
    source_names TEXT,
    data_as_of TIMESTAMPTZ,
    snapshot_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_market_sentiment_snapshot UNIQUE (tenant_id, market_scope, snapshot_at)
);

CREATE INDEX idx_market_sentiment_snapshot_lookup
    ON market_sentiment_snapshot (tenant_id, snapshot_at DESC, market_scope, trend_status);
