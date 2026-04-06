CREATE TABLE IF NOT EXISTS app_property (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    property_key VARCHAR(128) NOT NULL,
    property_value TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_app_property_tenant_key UNIQUE (tenant_id, property_key)
);

CREATE INDEX IF NOT EXISTS idx_app_property_tenant_key
    ON app_property (tenant_id, property_key);
