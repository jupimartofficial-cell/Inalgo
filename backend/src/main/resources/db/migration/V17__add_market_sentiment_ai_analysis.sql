ALTER TABLE market_sentiment_snapshot
    ADD COLUMN ai_analysis VARCHAR(16),
    ADD COLUMN ai_reason TEXT,
    ADD COLUMN ai_confidence INTEGER,
    ADD COLUMN ai_model VARCHAR(64),
    ADD COLUMN ai_updated_at TIMESTAMPTZ;
