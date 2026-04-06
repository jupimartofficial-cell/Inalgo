CREATE TABLE IF NOT EXISTS trading_preference (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    username VARCHAR(64) NOT NULL,
    preferences_json TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_trading_pref_tenant_user UNIQUE (tenant_id, username)
);

CREATE INDEX IF NOT EXISTS idx_trading_pref_tenant_user
    ON trading_preference (tenant_id, username);

