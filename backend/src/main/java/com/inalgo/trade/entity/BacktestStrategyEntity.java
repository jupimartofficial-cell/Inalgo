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

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;

@Entity
@Table(
        name = "backtest_strategy",
        indexes = {
                @Index(name = "idx_backtest_strategy_lookup", columnList = "tenant_id, username, updated_at DESC")
        }
)
public class BacktestStrategyEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "username", nullable = false, length = 64)
    private String username;

    @Column(name = "strategy_name", nullable = false, length = 120)
    private String strategyName;

    @Column(name = "underlying_key", nullable = false, length = 128)
    private String underlyingKey;

    @Column(name = "underlying_source", nullable = false, length = 16)
    private String underlyingSource;

    @Column(name = "strategy_type", nullable = false, length = 16)
    private String strategyType;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Column(name = "entry_time", nullable = false)
    private LocalTime entryTime;

    @Column(name = "exit_time", nullable = false)
    private LocalTime exitTime;

    @Column(name = "legs_count", nullable = false)
    private Integer legsCount;

    @Column(name = "strategy_json", nullable = false, columnDefinition = "TEXT")
    private String strategyJson;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected BacktestStrategyEntity() {
    }

    public BacktestStrategyEntity(
            String tenantId,
            String username,
            String strategyName,
            String underlyingKey,
            String underlyingSource,
            String strategyType,
            LocalDate startDate,
            LocalDate endDate,
            LocalTime entryTime,
            LocalTime exitTime,
            Integer legsCount,
            String strategyJson
    ) {
        this.tenantId = tenantId;
        this.username = username;
        this.strategyName = strategyName;
        this.underlyingKey = underlyingKey;
        this.underlyingSource = underlyingSource;
        this.strategyType = strategyType;
        this.startDate = startDate;
        this.endDate = endDate;
        this.entryTime = entryTime;
        this.exitTime = exitTime;
        this.legsCount = legsCount;
        this.strategyJson = strategyJson;
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

    public String getStrategyName() {
        return strategyName;
    }

    public void setStrategyName(String strategyName) {
        this.strategyName = strategyName;
    }

    public String getUnderlyingKey() {
        return underlyingKey;
    }

    public void setUnderlyingKey(String underlyingKey) {
        this.underlyingKey = underlyingKey;
    }

    public String getUnderlyingSource() {
        return underlyingSource;
    }

    public void setUnderlyingSource(String underlyingSource) {
        this.underlyingSource = underlyingSource;
    }

    public String getStrategyType() {
        return strategyType;
    }

    public void setStrategyType(String strategyType) {
        this.strategyType = strategyType;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public void setStartDate(LocalDate startDate) {
        this.startDate = startDate;
    }

    public LocalDate getEndDate() {
        return endDate;
    }

    public void setEndDate(LocalDate endDate) {
        this.endDate = endDate;
    }

    public LocalTime getEntryTime() {
        return entryTime;
    }

    public void setEntryTime(LocalTime entryTime) {
        this.entryTime = entryTime;
    }

    public LocalTime getExitTime() {
        return exitTime;
    }

    public void setExitTime(LocalTime exitTime) {
        this.exitTime = exitTime;
    }

    public Integer getLegsCount() {
        return legsCount;
    }

    public void setLegsCount(Integer legsCount) {
        this.legsCount = legsCount;
    }

    public String getStrategyJson() {
        return strategyJson;
    }

    public void setStrategyJson(String strategyJson) {
        this.strategyJson = strategyJson;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
