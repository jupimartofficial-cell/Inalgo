package com.inalgo.trade.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "trading_script_perf_snapshot")
public class TradingScriptPerfSnapshotEntity {

    @Id
    @Column(name = "script_id")
    private Long scriptId;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "username", nullable = false, length = 64)
    private String username;

    @Column(name = "latest_total_pnl", precision = 19, scale = 2)
    private BigDecimal latestTotalPnl;

    @Column(name = "latest_executed_trades")
    private Integer latestExecutedTrades;

    @Column(name = "latest_real_world_accuracy_pct", precision = 9, scale = 2)
    private BigDecimal latestRealWorldAccuracyPct;

    @Column(name = "latest_evaluated_at")
    private Instant latestEvaluatedAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected TradingScriptPerfSnapshotEntity() {
    }

    public TradingScriptPerfSnapshotEntity(
            Long scriptId,
            String tenantId,
            String username,
            BigDecimal latestTotalPnl,
            Integer latestExecutedTrades,
            BigDecimal latestRealWorldAccuracyPct,
            Instant latestEvaluatedAt
    ) {
        this.scriptId = scriptId;
        this.tenantId = tenantId;
        this.username = username;
        this.latestTotalPnl = latestTotalPnl;
        this.latestExecutedTrades = latestExecutedTrades;
        this.latestRealWorldAccuracyPct = latestRealWorldAccuracyPct;
        this.latestEvaluatedAt = latestEvaluatedAt;
    }

    @PrePersist
    @PreUpdate
    void touch() {
        this.updatedAt = Instant.now();
    }

    public Long getScriptId() { return scriptId; }
    public String getTenantId() { return tenantId; }
    public String getUsername() { return username; }
    public BigDecimal getLatestTotalPnl() { return latestTotalPnl; }
    public Integer getLatestExecutedTrades() { return latestExecutedTrades; }
    public BigDecimal getLatestRealWorldAccuracyPct() { return latestRealWorldAccuracyPct; }
    public Instant getLatestEvaluatedAt() { return latestEvaluatedAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
