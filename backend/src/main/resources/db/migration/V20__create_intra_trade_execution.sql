-- Intra Trade: persists live, paper, and historical execution snapshots per tenant/user
CREATE TABLE intra_trade_execution (
    id                      BIGSERIAL       PRIMARY KEY,
    tenant_id               VARCHAR(64)     NOT NULL,
    username                VARCHAR(64)     NOT NULL,
    strategy_id             BIGINT,
    mode                    VARCHAR(16)     NOT NULL,
    status                  VARCHAR(32)     NOT NULL,
    strategy_name           VARCHAR(120)    NOT NULL,
    scan_instrument_key     VARCHAR(128)    NOT NULL,
    scan_timeframe_unit     VARCHAR(16)     NOT NULL,
    scan_timeframe_interval INTEGER         NOT NULL,
    strategy_json           TEXT            NOT NULL,
    result_json             TEXT            NOT NULL,
    total_pnl               NUMERIC(19, 2)  NOT NULL DEFAULT 0,
    executed_trades         INTEGER         NOT NULL DEFAULT 0,
    status_message          VARCHAR(255),
    evaluated_at            TIMESTAMPTZ     NOT NULL,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_intra_trade_execution_lookup
    ON intra_trade_execution (tenant_id, username, updated_at DESC);
