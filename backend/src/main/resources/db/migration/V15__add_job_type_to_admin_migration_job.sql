ALTER TABLE admin_migration_job
    ADD COLUMN IF NOT EXISTS job_type VARCHAR(64);

UPDATE admin_migration_job
SET job_type = 'CANDLE_SYNC'
WHERE job_type IS NULL;

ALTER TABLE admin_migration_job
    ALTER COLUMN job_type SET NOT NULL;

ALTER TABLE admin_migration_job
    ALTER COLUMN job_type SET DEFAULT 'CANDLE_SYNC';

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uk_admin_migration_job_stream'
          AND conrelid = 'admin_migration_job'::regclass
    ) THEN
        ALTER TABLE admin_migration_job
            DROP CONSTRAINT uk_admin_migration_job_stream;
    END IF;
END $$;

ALTER TABLE admin_migration_job
    ADD CONSTRAINT uk_admin_migration_job_stream
        UNIQUE (tenant_id, instrument_key, timeframe_unit, timeframe_interval, job_type);

DROP INDEX IF EXISTS idx_admin_migration_job_tenant_status;

CREATE INDEX IF NOT EXISTS idx_admin_migration_job_tenant_type_status
    ON admin_migration_job (tenant_id, job_type, status, updated_at DESC);
