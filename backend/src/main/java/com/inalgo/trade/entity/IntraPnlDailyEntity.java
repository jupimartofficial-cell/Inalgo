package com.inalgo.trade.entity;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "intra_pnl_daily", indexes = {
        @Index(name = "idx_intra_pnl_daily_lookup", columnList = "tenant_id, username, mode, trade_date DESC")
}, uniqueConstraints = {
        @UniqueConstraint(name = "uq_intra_pnl_daily", columnNames = {"tenant_id", "username", "mode", "trade_date"})
})
public class IntraPnlDailyEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "username", nullable = false, length = 64)
    private String username;

    @Column(name = "mode", nullable = false, length = 16)
    private String mode;

    @Column(name = "trade_date", nullable = false)
    private LocalDate tradeDate;

    @Column(name = "realized_pnl", nullable = false, precision = 19, scale = 2)
    private BigDecimal realizedPnl = BigDecimal.ZERO;

    @Column(name = "unrealized_pnl", nullable = false, precision = 19, scale = 2)
    private BigDecimal unrealizedPnl = BigDecimal.ZERO;

    @Column(name = "total_pnl", nullable = false, precision = 19, scale = 2)
    private BigDecimal totalPnl = BigDecimal.ZERO;

    @Column(name = "trades_count", nullable = false)
    private Integer tradesCount = 0;

    @Column(name = "win_count", nullable = false)
    private Integer winCount = 0;

    @Column(name = "loss_count", nullable = false)
    private Integer lossCount = 0;

    @Column(name = "max_drawdown", nullable = false, precision = 19, scale = 2)
    private BigDecimal maxDrawdown = BigDecimal.ZERO;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }

    public Long getId() { return id; }
    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getMode() { return mode; }
    public void setMode(String mode) { this.mode = mode; }
    public LocalDate getTradeDate() { return tradeDate; }
    public void setTradeDate(LocalDate tradeDate) { this.tradeDate = tradeDate; }
    public BigDecimal getRealizedPnl() { return realizedPnl; }
    public void setRealizedPnl(BigDecimal realizedPnl) { this.realizedPnl = realizedPnl; }
    public BigDecimal getUnrealizedPnl() { return unrealizedPnl; }
    public void setUnrealizedPnl(BigDecimal unrealizedPnl) { this.unrealizedPnl = unrealizedPnl; }
    public BigDecimal getTotalPnl() { return totalPnl; }
    public void setTotalPnl(BigDecimal totalPnl) { this.totalPnl = totalPnl; }
    public Integer getTradesCount() { return tradesCount; }
    public void setTradesCount(Integer tradesCount) { this.tradesCount = tradesCount; }
    public Integer getWinCount() { return winCount; }
    public void setWinCount(Integer winCount) { this.winCount = winCount; }
    public Integer getLossCount() { return lossCount; }
    public void setLossCount(Integer lossCount) { this.lossCount = lossCount; }
    public BigDecimal getMaxDrawdown() { return maxDrawdown; }
    public void setMaxDrawdown(BigDecimal maxDrawdown) { this.maxDrawdown = maxDrawdown; }
}
