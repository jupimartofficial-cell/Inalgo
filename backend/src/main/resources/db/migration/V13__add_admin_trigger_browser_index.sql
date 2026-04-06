CREATE INDEX IF NOT EXISTS idx_admin_trigger_browser
    ON admin_trigger (tenant_id, job_key, instrument_key, timeframe_unit, timeframe_interval, updated_at DESC);
