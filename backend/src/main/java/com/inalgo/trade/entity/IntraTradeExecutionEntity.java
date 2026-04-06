package com.inalgo.trade.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(
        name = "intra_trade_execution",
        indexes = {
                @Index(name = "idx_intra_trade_execution_lookup", columnList = "tenant_id, username, updated_at DESC")
        }
)
public class IntraTradeExecutionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "username", nullable = false, length = 64)
    private String username;

    @Column(name = "strategy_id")
    private Long strategyId;

    @Column(name = "mode", nullable = false, length = 16)
    private String mode;

    @Column(name = "status", nullable = false, length = 32)
    private String status;

    @Column(name = "strategy_name", nullable = false, length = 120)
    private String strategyName;

    @Column(name = "scan_instrument_key", nullable = false, length = 128)
    private String scanInstrumentKey;

    @Column(name = "scan_timeframe_unit", nullable = false, length = 16)
    private String scanTimeframeUnit;

    @Column(name = "scan_timeframe_interval", nullable = false)
    private Integer scanTimeframeInterval;

    @Column(name = "strategy_json", nullable = false, columnDefinition = "TEXT")
    private String strategyJson;

    @Column(name = "result_json", nullable = false, columnDefinition = "TEXT")
    private String resultJson;

    @Column(name = "total_pnl", nullable = false, precision = 19, scale = 2)
    private BigDecimal totalPnl;

    @Column(name = "executed_trades", nullable = false)
    private Integer executedTrades;

    @Column(name = "status_message", length = 255)
    private String statusMessage;

    @Column(name = "exit_reason", length = 40)
    private String exitReason;

    @Column(name = "account_ref", length = 128)
    private String accountRef;

    @Column(name = "evaluated_at", nullable = false)
    private Instant evaluatedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected IntraTradeExecutionEntity() {
    }

    public IntraTradeExecutionEntity(
            String tenantId,
            String username,
            Long strategyId,
            String mode,
            String status,
            String strategyName,
            String scanInstrumentKey,
            String scanTimeframeUnit,
            Integer scanTimeframeInterval,
            String strategyJson,
            String resultJson,
            BigDecimal totalPnl,
            Integer executedTrades,
            String statusMessage,
            Instant evaluatedAt
    ) {
        this.tenantId = tenantId;
        this.username = username;
        this.strategyId = strategyId;
        this.mode = mode;
        this.status = status;
        this.strategyName = strategyName;
        this.scanInstrumentKey = scanInstrumentKey;
        this.scanTimeframeUnit = scanTimeframeUnit;
        this.scanTimeframeInterval = scanTimeframeInterval;
        this.strategyJson = strategyJson;
        this.resultJson = resultJson;
        this.totalPnl = totalPnl;
        this.executedTrades = executedTrades;
        this.statusMessage = statusMessage;
        this.evaluatedAt = evaluatedAt;
    }

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

    public Long getId() {
        return id;
    }

    public String getTenantId() {
        return tenantId;
    }

    public String getUsername() {
        return username;
    }

    public Long getStrategyId() {
        return strategyId;
    }

    public void setStrategyId(Long strategyId) {
        this.strategyId = strategyId;
    }

    public String getMode() {
        return mode;
    }

    public void setMode(String mode) {
        this.mode = mode;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getStrategyName() {
        return strategyName;
    }

    public void setStrategyName(String strategyName) {
        this.strategyName = strategyName;
    }

    public String getScanInstrumentKey() {
        return scanInstrumentKey;
    }

    public void setScanInstrumentKey(String scanInstrumentKey) {
        this.scanInstrumentKey = scanInstrumentKey;
    }

    public String getScanTimeframeUnit() {
        return scanTimeframeUnit;
    }

    public void setScanTimeframeUnit(String scanTimeframeUnit) {
        this.scanTimeframeUnit = scanTimeframeUnit;
    }

    public Integer getScanTimeframeInterval() {
        return scanTimeframeInterval;
    }

    public void setScanTimeframeInterval(Integer scanTimeframeInterval) {
        this.scanTimeframeInterval = scanTimeframeInterval;
    }

    public String getStrategyJson() {
        return strategyJson;
    }

    public void setStrategyJson(String strategyJson) {
        this.strategyJson = strategyJson;
    }

    public String getResultJson() {
        return resultJson;
    }

    public void setResultJson(String resultJson) {
        this.resultJson = resultJson;
    }

    public BigDecimal getTotalPnl() {
        return totalPnl;
    }

    public void setTotalPnl(BigDecimal totalPnl) {
        this.totalPnl = totalPnl;
    }

    public Integer getExecutedTrades() {
        return executedTrades;
    }

    public void setExecutedTrades(Integer executedTrades) {
        this.executedTrades = executedTrades;
    }

    public String getStatusMessage() {
        return statusMessage;
    }

    public void setStatusMessage(String statusMessage) {
        this.statusMessage = statusMessage;
    }

    public Instant getEvaluatedAt() {
        return evaluatedAt;
    }

    public void setEvaluatedAt(Instant evaluatedAt) {
        this.evaluatedAt = evaluatedAt;
    }

    public String getExitReason() {
        return exitReason;
    }

    public void setExitReason(String exitReason) {
        this.exitReason = exitReason;
    }

    public String getAccountRef() {
        return accountRef;
    }

    public void setAccountRef(String accountRef) {
        this.accountRef = accountRef;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
