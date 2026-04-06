package com.inalgo.trade.entity;

import jakarta.persistence.*;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(
        name = "upstox_migration_state",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_upstox_migration_state_stream",
                columnNames = {"tenant_id", "instrument_key", "timeframe_unit", "timeframe_interval"}
        )
)
public class UpstoxMigrationStateEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "instrument_key", nullable = false, length = 64)
    private String instrumentKey;

    @Column(name = "timeframe_unit", nullable = false, length = 16)
    private String timeframeUnit;

    @Column(name = "timeframe_interval", nullable = false)
    private Integer timeframeInterval;

    @Column(name = "next_from_date", nullable = false)
    private LocalDate nextFromDate;

    @Column(name = "completed", nullable = false)
    private boolean completed;

    @Column(name = "last_run_status", nullable = false, length = 16)
    private String lastRunStatus;

    @Column(name = "last_error")
    private String lastError;

    @Column(name = "last_run_at")
    private Instant lastRunAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected UpstoxMigrationStateEntity() {
    }

    public UpstoxMigrationStateEntity(
            String tenantId,
            String instrumentKey,
            String timeframeUnit,
            Integer timeframeInterval,
            LocalDate nextFromDate
    ) {
        this.tenantId = tenantId;
        this.instrumentKey = instrumentKey;
        this.timeframeUnit = timeframeUnit;
        this.timeframeInterval = timeframeInterval;
        this.nextFromDate = nextFromDate;
        this.completed = false;
        this.lastRunStatus = "PENDING";
        this.updatedAt = Instant.now();
    }

    public String getTenantId() { return tenantId; }
    public String getInstrumentKey() { return instrumentKey; }
    public String getTimeframeUnit() { return timeframeUnit; }
    public Integer getTimeframeInterval() { return timeframeInterval; }
    public LocalDate getNextFromDate() { return nextFromDate; }
    public boolean isCompleted() { return completed; }
    public String getLastRunStatus() { return lastRunStatus; }
    public String getLastError() { return lastError; }
    public Instant getLastRunAt() { return lastRunAt; }
    public Instant getUpdatedAt() { return updatedAt; }

    public void markRunning() {
        this.lastRunStatus = "RUNNING";
        this.lastError = null;
        this.lastRunAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    public void markFailed(String error) {
        this.lastRunStatus = "FAILED";
        this.lastError = error;
        this.lastRunAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    public void advanceTo(LocalDate nextFromDate) {
        this.nextFromDate = nextFromDate;
        this.lastRunStatus = "SUCCESS";
        this.lastError = null;
        this.lastRunAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    public void markCompleted() {
        this.completed = true;
        this.lastRunStatus = "SUCCESS";
        this.lastError = null;
        this.lastRunAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    public void resumeFromCheckpoint() {
        this.completed = false;
        this.lastRunStatus = "PENDING";
        this.lastError = null;
        this.lastRunAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    public void restartFrom(LocalDate bootstrapFromDate) {
        this.nextFromDate = bootstrapFromDate;
        resumeFromCheckpoint();
    }
}
