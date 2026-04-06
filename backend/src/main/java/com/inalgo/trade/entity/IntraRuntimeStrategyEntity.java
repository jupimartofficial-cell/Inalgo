package com.inalgo.trade.entity;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(
        name = "intra_runtime_strategy",
        indexes = {
                @Index(name = "idx_intra_runtime_lookup", columnList = "tenant_id, username, mode, status, updated_at DESC")
        },
        uniqueConstraints = {
                @UniqueConstraint(name = "uq_intra_runtime_execution", columnNames = {"tenant_id", "execution_id"})
        }
)
public class IntraRuntimeStrategyEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "username", nullable = false, length = 64)
    private String username;

    @Column(name = "execution_id", nullable = false)
    private Long executionId;

    @Column(name = "strategy_id")
    private Long strategyId;

    @Column(name = "strategy_name", nullable = false, length = 120)
    private String strategyName;

    @Column(name = "instrument_key", nullable = false, length = 128)
    private String instrumentKey;

    @Column(name = "mode", nullable = false, length = 16)
    private String mode;

    @Column(name = "status", nullable = false, length = 24)
    private String status;

    @Column(name = "entry_time")
    private Instant entryTime;

    @Column(name = "current_signal", length = 32)
    private String currentSignal;

    @Column(name = "current_mtm", nullable = false, precision = 19, scale = 2)
    private BigDecimal currentMtm = BigDecimal.ZERO;

    @Column(name = "sl_state", length = 32)
    private String slState;

    @Column(name = "target_state", length = 32)
    private String targetState;

    @Column(name = "next_expected_action", length = 64)
    private String nextExpectedAction;

    @Column(name = "data_refreshed_at", nullable = false)
    private Instant dataRefreshedAt;

    @Column(name = "freshness_seconds", nullable = false)
    private Integer freshnessSeconds = 0;

    @Column(name = "last_event_at")
    private Instant lastEventAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
        if (dataRefreshedAt == null) {
            dataRefreshedAt = now;
        }
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
    public Long getExecutionId() { return executionId; }
    public void setExecutionId(Long executionId) { this.executionId = executionId; }
    public Long getStrategyId() { return strategyId; }
    public void setStrategyId(Long strategyId) { this.strategyId = strategyId; }
    public String getStrategyName() { return strategyName; }
    public void setStrategyName(String strategyName) { this.strategyName = strategyName; }
    public String getInstrumentKey() { return instrumentKey; }
    public void setInstrumentKey(String instrumentKey) { this.instrumentKey = instrumentKey; }
    public String getMode() { return mode; }
    public void setMode(String mode) { this.mode = mode; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Instant getEntryTime() { return entryTime; }
    public void setEntryTime(Instant entryTime) { this.entryTime = entryTime; }
    public String getCurrentSignal() { return currentSignal; }
    public void setCurrentSignal(String currentSignal) { this.currentSignal = currentSignal; }
    public BigDecimal getCurrentMtm() { return currentMtm; }
    public void setCurrentMtm(BigDecimal currentMtm) { this.currentMtm = currentMtm; }
    public String getSlState() { return slState; }
    public void setSlState(String slState) { this.slState = slState; }
    public String getTargetState() { return targetState; }
    public void setTargetState(String targetState) { this.targetState = targetState; }
    public String getNextExpectedAction() { return nextExpectedAction; }
    public void setNextExpectedAction(String nextExpectedAction) { this.nextExpectedAction = nextExpectedAction; }
    public Instant getDataRefreshedAt() { return dataRefreshedAt; }
    public void setDataRefreshedAt(Instant dataRefreshedAt) { this.dataRefreshedAt = dataRefreshedAt; }
    public Integer getFreshnessSeconds() { return freshnessSeconds; }
    public void setFreshnessSeconds(Integer freshnessSeconds) { this.freshnessSeconds = freshnessSeconds; }
    public Instant getLastEventAt() { return lastEventAt; }
    public void setLastEventAt(Instant lastEventAt) { this.lastEventAt = lastEventAt; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
