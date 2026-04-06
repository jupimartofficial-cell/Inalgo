package com.inalgo.trade.entity;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "intra_position_snapshot", indexes = {
        @Index(name = "idx_intra_position_lookup", columnList = "tenant_id, username, mode, status, updated_at DESC")
})
public class IntraPositionSnapshotEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "username", nullable = false, length = 64)
    private String username;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "runtime_id", nullable = false)
    private IntraRuntimeStrategyEntity runtime;

    @Column(name = "execution_id", nullable = false)
    private Long executionId;

    @Column(name = "mode", nullable = false, length = 16)
    private String mode;

    @Column(name = "instrument_key", nullable = false, length = 128)
    private String instrumentKey;

    @Column(name = "leg_id", length = 64)
    private String legId;

    @Column(name = "leg_label", length = 120)
    private String legLabel;

    @Column(name = "trade_instrument_key", length = 128)
    private String tradeInstrumentKey;

    @Column(name = "entry_side", length = 8)
    private String entrySide;

    @Column(name = "exit_side", length = 8)
    private String exitSide;

    @Column(name = "lot_size")
    private Integer lotSize;

    @Column(name = "lots")
    private Integer lots;

    @Column(name = "quantity_units")
    private Integer quantityUnits;

    @Column(name = "quantity_lots", nullable = false, precision = 19, scale = 4)
    private BigDecimal quantityLots = BigDecimal.ZERO;

    @Column(name = "entry_price", precision = 19, scale = 4)
    private BigDecimal entryPrice;

    @Column(name = "current_price", precision = 19, scale = 4)
    private BigDecimal currentPrice;

    @Column(name = "unrealized_pnl", nullable = false, precision = 19, scale = 2)
    private BigDecimal unrealizedPnl = BigDecimal.ZERO;

    @Column(name = "realized_pnl", nullable = false, precision = 19, scale = 2)
    private BigDecimal realizedPnl = BigDecimal.ZERO;

    @Column(name = "sl_price", precision = 19, scale = 4)
    private BigDecimal slPrice;

    @Column(name = "target_price", precision = 19, scale = 4)
    private BigDecimal targetPrice;

    @Column(name = "strategy_name", nullable = false, length = 120)
    private String strategyName;

    @Column(name = "entry_time")
    private Instant entryTime;

    @Column(name = "time_in_trade_seconds", nullable = false)
    private Long timeInTradeSeconds = 0L;

    @Column(name = "status", nullable = false, length = 24)
    private String status = "OPEN";

    @Column(name = "manual_watch", nullable = false)
    private boolean manualWatch;

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
    public IntraRuntimeStrategyEntity getRuntime() { return runtime; }
    public void setRuntime(IntraRuntimeStrategyEntity runtime) { this.runtime = runtime; }
    public Long getExecutionId() { return executionId; }
    public void setExecutionId(Long executionId) { this.executionId = executionId; }
    public String getMode() { return mode; }
    public void setMode(String mode) { this.mode = mode; }
    public String getInstrumentKey() { return instrumentKey; }
    public void setInstrumentKey(String instrumentKey) { this.instrumentKey = instrumentKey; }
    public String getLegId() { return legId; }
    public void setLegId(String legId) { this.legId = legId; }
    public String getLegLabel() { return legLabel; }
    public void setLegLabel(String legLabel) { this.legLabel = legLabel; }
    public String getTradeInstrumentKey() { return tradeInstrumentKey; }
    public void setTradeInstrumentKey(String tradeInstrumentKey) { this.tradeInstrumentKey = tradeInstrumentKey; }
    public String getEntrySide() { return entrySide; }
    public void setEntrySide(String entrySide) { this.entrySide = entrySide; }
    public String getExitSide() { return exitSide; }
    public void setExitSide(String exitSide) { this.exitSide = exitSide; }
    public Integer getLotSize() { return lotSize; }
    public void setLotSize(Integer lotSize) { this.lotSize = lotSize; }
    public Integer getLots() { return lots; }
    public void setLots(Integer lots) { this.lots = lots; }
    public Integer getQuantityUnits() { return quantityUnits; }
    public void setQuantityUnits(Integer quantityUnits) { this.quantityUnits = quantityUnits; }
    public BigDecimal getQuantityLots() { return quantityLots; }
    public void setQuantityLots(BigDecimal quantityLots) { this.quantityLots = quantityLots; }
    public BigDecimal getEntryPrice() { return entryPrice; }
    public void setEntryPrice(BigDecimal entryPrice) { this.entryPrice = entryPrice; }
    public BigDecimal getCurrentPrice() { return currentPrice; }
    public void setCurrentPrice(BigDecimal currentPrice) { this.currentPrice = currentPrice; }
    public BigDecimal getUnrealizedPnl() { return unrealizedPnl; }
    public void setUnrealizedPnl(BigDecimal unrealizedPnl) { this.unrealizedPnl = unrealizedPnl; }
    public BigDecimal getRealizedPnl() { return realizedPnl; }
    public void setRealizedPnl(BigDecimal realizedPnl) { this.realizedPnl = realizedPnl; }
    public BigDecimal getSlPrice() { return slPrice; }
    public void setSlPrice(BigDecimal slPrice) { this.slPrice = slPrice; }
    public BigDecimal getTargetPrice() { return targetPrice; }
    public void setTargetPrice(BigDecimal targetPrice) { this.targetPrice = targetPrice; }
    public String getStrategyName() { return strategyName; }
    public void setStrategyName(String strategyName) { this.strategyName = strategyName; }
    public Instant getEntryTime() { return entryTime; }
    public void setEntryTime(Instant entryTime) { this.entryTime = entryTime; }
    public Long getTimeInTradeSeconds() { return timeInTradeSeconds; }
    public void setTimeInTradeSeconds(Long timeInTradeSeconds) { this.timeInTradeSeconds = timeInTradeSeconds; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public boolean isManualWatch() { return manualWatch; }
    public void setManualWatch(boolean manualWatch) { this.manualWatch = manualWatch; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
