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
@Table(name = "intra_strategy_perf_snapshot")
public class IntraStrategyPerfSnapshotEntity {

    @Id
    @Column(name = "strategy_id", nullable = false)
    private Long strategyId;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "username", nullable = false, length = 64)
    private String username;

    @Column(name = "latest_total_pnl", precision = 19, scale = 2)
    private BigDecimal latestTotalPnl;

    @Column(name = "latest_executed_trades")
    private Integer latestExecutedTrades;

    @Column(name = "latest_evaluated_at")
    private Instant latestEvaluatedAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected IntraStrategyPerfSnapshotEntity() {
    }

    public IntraStrategyPerfSnapshotEntity(
            Long strategyId,
            String tenantId,
            String username,
            BigDecimal latestTotalPnl,
            Integer latestExecutedTrades,
            Instant latestEvaluatedAt
    ) {
        this.strategyId = strategyId;
        this.tenantId = tenantId;
        this.username = username;
        this.latestTotalPnl = latestTotalPnl;
        this.latestExecutedTrades = latestExecutedTrades;
        this.latestEvaluatedAt = latestEvaluatedAt;
    }

    @PrePersist
    void onCreate() {
        this.updatedAt = Instant.now();
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }

    public Long getStrategyId() {
        return strategyId;
    }

    public String getTenantId() {
        return tenantId;
    }

    public String getUsername() {
        return username;
    }

    public BigDecimal getLatestTotalPnl() {
        return latestTotalPnl;
    }

    public void setLatestTotalPnl(BigDecimal latestTotalPnl) {
        this.latestTotalPnl = latestTotalPnl;
    }

    public Integer getLatestExecutedTrades() {
        return latestExecutedTrades;
    }

    public void setLatestExecutedTrades(Integer latestExecutedTrades) {
        this.latestExecutedTrades = latestExecutedTrades;
    }

    public Instant getLatestEvaluatedAt() {
        return latestEvaluatedAt;
    }

    public void setLatestEvaluatedAt(Instant latestEvaluatedAt) {
        this.latestEvaluatedAt = latestEvaluatedAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
