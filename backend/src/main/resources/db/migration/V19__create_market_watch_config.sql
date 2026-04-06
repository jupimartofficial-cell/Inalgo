-- Market Watch: persists per-user tile layout and refresh settings
CREATE TABLE market_watch_config (
    id          BIGSERIAL    PRIMARY KEY,
    tenant_id   VARCHAR(64)  NOT NULL,
    username    VARCHAR(64)  NOT NULL,
    config_json TEXT         NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_market_watch_config_tenant_user
    ON market_watch_config (tenant_id, username);
