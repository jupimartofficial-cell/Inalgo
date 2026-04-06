ALTER TABLE intra_position_snapshot
    ADD COLUMN leg_id VARCHAR(64),
    ADD COLUMN leg_label VARCHAR(120),
    ADD COLUMN trade_instrument_key VARCHAR(128),
    ADD COLUMN entry_side VARCHAR(8),
    ADD COLUMN exit_side VARCHAR(8),
    ADD COLUMN lot_size INTEGER,
    ADD COLUMN lots INTEGER,
    ADD COLUMN quantity_units INTEGER;

CREATE TABLE intra_trade_order (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    username VARCHAR(64) NOT NULL,
    execution_id BIGINT NOT NULL,
    runtime_id BIGINT,
    position_id BIGINT,
    leg_id VARCHAR(64),
    leg_label VARCHAR(120),
    phase VARCHAR(24) NOT NULL,
    instrument_key VARCHAR(128) NOT NULL,
    transaction_type VARCHAR(8) NOT NULL,
    quantity INTEGER NOT NULL,
    order_type VARCHAR(16) NOT NULL,
    limit_price NUMERIC(19,4) NOT NULL DEFAULT 0,
    order_id VARCHAR(64),
    status VARCHAR(32),
    tag VARCHAR(64),
    message VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_intra_trade_order_lookup
    ON intra_trade_order (tenant_id, execution_id, phase, created_at DESC);

CREATE UNIQUE INDEX uq_intra_trade_order_phase
    ON intra_trade_order (tenant_id, execution_id, leg_id, phase);
