-- Registry of currently-active monthly futures contracts for each underlying index.
-- Automatically maintained by FuturesContractRollService; replaces hardcoded keys in MigrationCatalogSeeder.
CREATE TABLE futures_contract_registry (
    id              BIGSERIAL    PRIMARY KEY,
    underlying_key  VARCHAR(200) NOT NULL UNIQUE,   -- e.g. NSE_INDEX|Nifty 50
    label           VARCHAR(100) NOT NULL,           -- display label  e.g. Nifty 50
    exchange        VARCHAR(20)  NOT NULL,            -- NSE or BSE
    instrument_key  VARCHAR(200) NOT NULL,            -- active futures key e.g. NSE_FO|51714
    contract_name   VARCHAR(200),                     -- e.g. NIFTY FUT 30 MAR 26
    expiry_date     DATE,                             -- expiry of the active contract
    lot_size        INTEGER,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Seed default entries for the three tracked underlyings.
-- instrument_key / contract_name / expiry_date will be updated at runtime when contracts roll.
INSERT INTO futures_contract_registry
    (underlying_key, label, exchange, instrument_key, contract_name, expiry_date, lot_size)
VALUES
    ('NSE_INDEX|Nifty 50',   'Nifty 50',   'NSE', 'NSE_FO|51714', 'NIFTY FUT 30 MAR 26',    '2026-03-27', 75),
    ('NSE_INDEX|Nifty Bank', 'Nifty Bank', 'NSE', 'NSE_FO|51701', 'BANKNIFTY FUT 30 MAR 26', '2026-03-26', 30),
    ('BSE_INDEX|SENSEX',     'SENSEX',     'BSE', 'BSE_FO|825565','SENSEX FUT 25 MAR 26',    '2026-03-25', 10);
