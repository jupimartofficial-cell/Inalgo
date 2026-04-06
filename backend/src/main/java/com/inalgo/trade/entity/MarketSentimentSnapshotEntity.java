package com.inalgo.trade.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(
        name = "market_sentiment_snapshot",
        indexes = {
                @Index(name = "idx_market_sentiment_snapshot_lookup", columnList = "tenant_id, snapshot_at, market_scope, trend_status")
        }
)
public class MarketSentimentSnapshotEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "market_scope", nullable = false, length = 32)
    private String marketScope;

    @Column(name = "market_name", nullable = false, length = 64)
    private String marketName;

    @Column(name = "evaluation_type", nullable = false, length = 16)
    private String evaluationType;

    @Column(name = "trend_status", nullable = false, length = 16)
    private String trendStatus;

    @Column(name = "reason", nullable = false, columnDefinition = "text")
    private String reason;

    @Column(name = "current_value", precision = 18, scale = 6)
    private BigDecimal currentValue;

    @Column(name = "ema_9", precision = 18, scale = 6)
    private BigDecimal ema9;

    @Column(name = "ema_21", precision = 18, scale = 6)
    private BigDecimal ema21;

    @Column(name = "ema_110", precision = 18, scale = 6)
    private BigDecimal ema110;

    @Column(name = "source_count", nullable = false)
    private Integer sourceCount;

    @Column(name = "evidence_count", nullable = false)
    private Integer evidenceCount;

    @Column(name = "source_names", columnDefinition = "text")
    private String sourceNames;

    @Column(name = "data_as_of")
    private Instant dataAsOf;

    @Column(name = "ai_analysis", length = 16)
    private String aiAnalysis;

    @Column(name = "ai_reason", columnDefinition = "text")
    private String aiReason;

    @Column(name = "ai_confidence")
    private Integer aiConfidence;

    @Column(name = "ai_model", length = 64)
    private String aiModel;

    @Column(name = "ai_updated_at")
    private Instant aiUpdatedAt;

    @Column(name = "snapshot_at", nullable = false)
    private Instant snapshotAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected MarketSentimentSnapshotEntity() {
    }

    public Long getId() { return id; }
    public String getTenantId() { return tenantId; }
    public String getMarketScope() { return marketScope; }
    public String getMarketName() { return marketName; }
    public String getEvaluationType() { return evaluationType; }
    public String getTrendStatus() { return trendStatus; }
    public String getReason() { return reason; }
    public BigDecimal getCurrentValue() { return currentValue; }
    public BigDecimal getEma9() { return ema9; }
    public BigDecimal getEma21() { return ema21; }
    public BigDecimal getEma110() { return ema110; }
    public Integer getSourceCount() { return sourceCount; }
    public Integer getEvidenceCount() { return evidenceCount; }
    public String getSourceNames() { return sourceNames; }
    public Instant getDataAsOf() { return dataAsOf; }
    public String getAiAnalysis() { return aiAnalysis; }
    public String getAiReason() { return aiReason; }
    public Integer getAiConfidence() { return aiConfidence; }
    public String getAiModel() { return aiModel; }
    public Instant getAiUpdatedAt() { return aiUpdatedAt; }
    public Instant getSnapshotAt() { return snapshotAt; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
