CREATE TABLE IF NOT EXISTS expired_instrument_expiry_cache (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    underlying_key VARCHAR(128) NOT NULL,
    expiry_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_expired_instrument_expiry_cache UNIQUE (tenant_id, underlying_key, expiry_date)
);

CREATE INDEX IF NOT EXISTS idx_expired_instrument_expiry_lookup
    ON expired_instrument_expiry_cache (tenant_id, underlying_key, expiry_date);

CREATE TABLE IF NOT EXISTS expired_derivative_contract_cache (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    contract_kind VARCHAR(16) NOT NULL,
    underlying_key VARCHAR(128) NOT NULL,
    expiry_date DATE NOT NULL,
    instrument_key VARCHAR(128) NOT NULL,
    name VARCHAR(256),
    segment VARCHAR(64),
    exchange VARCHAR(32),
    exchange_token VARCHAR(64),
    trading_symbol VARCHAR(128),
    lot_size INTEGER,
    instrument_type VARCHAR(64),
    strike_price NUMERIC(18, 4),
    weekly BOOLEAN,
    option_type VARCHAR(16),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_expired_derivative_contract_cache UNIQUE (
        tenant_id,
        contract_kind,
        underlying_key,
        expiry_date,
        instrument_key
    )
);

CREATE INDEX IF NOT EXISTS idx_expired_derivative_contract_lookup
    ON expired_derivative_contract_cache (tenant_id, contract_kind, underlying_key, expiry_date);
