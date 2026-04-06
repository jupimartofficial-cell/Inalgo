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

@Entity
@Table(
        name = "admin_trigger",
        indexes = {
                @Index(name = "idx_admin_trigger_tenant_status_next_run", columnList = "tenant_id, status, next_run_at"),
                @Index(name = "idx_admin_trigger_tenant_updated", columnList = "tenant_id, updated_at"),
                @Index(name = "idx_admin_trigger_browser", columnList = "tenant_id, job_key, instrument_key, timeframe_unit, timeframe_interval, updated_at")
        }
)
public class AdminTriggerEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "job_key", nullable = false, length = 64)
    private String jobKey;

    @Column(name = "instrument_key", nullable = false, length = 128)
    private String instrumentKey;

    @Column(name = "timeframe_unit", length = 16)
    private String timeframeUnit;

    @Column(name = "timeframe_interval")
    private Integer timeframeInterval;

    @Column(name = "event_source", nullable = false, length = 32)
    private String eventSource;

    @Column(name = "trigger_type", nullable = false, length = 32)
    private String triggerType;

    @Column(name = "interval_value")
    private Integer intervalValue;

    @Column(name = "scheduled_at")
    private Instant scheduledAt;

    @Column(name = "bootstrap_from_date")
    private LocalDate bootstrapFromDate;

    @Column(name = "status", nullable = false, length = 16)
    private String status;

    @Column(name = "last_run_status", nullable = false, length = 16)
    private String lastRunStatus;

    @Column(name = "last_error")
    private String lastError;

    @Column(name = "last_run_at")
    private Instant lastRunAt;

    @Column(name = "next_run_at")
    private Instant nextRunAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected AdminTriggerEntity() {
    }

    public AdminTriggerEntity(
            String tenantId,
            String jobKey,
            String instrumentKey,
            String timeframeUnit,
            Integer timeframeInterval,
            String eventSource,
            String triggerType,
            Integer intervalValue,
            Instant scheduledAt,
            LocalDate bootstrapFromDate
    ) {
        this.tenantId = tenantId;
        this.jobKey = jobKey;
        this.instrumentKey = instrumentKey;
        this.timeframeUnit = timeframeUnit;
        this.timeframeInterval = timeframeInterval;
        this.eventSource = eventSource;
        this.triggerType = triggerType;
        this.intervalValue = intervalValue;
        this.scheduledAt = scheduledAt;
        this.bootstrapFromDate = bootstrapFromDate;
        this.status = "STOPPED";
        this.lastRunStatus = "PENDING";
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

    public String getJobKey() {
        return jobKey;
    }

    public String getInstrumentKey() {
        return instrumentKey;
    }

    public String getTimeframeUnit() {
        return timeframeUnit;
    }

    public Integer getTimeframeInterval() {
        return timeframeInterval;
    }

    public String getEventSource() {
        return eventSource;
    }

    public String getTriggerType() {
        return triggerType;
    }

    public Integer getIntervalValue() {
        return intervalValue;
    }

    public Instant getScheduledAt() {
        return scheduledAt;
    }

    public LocalDate getBootstrapFromDate() {
        return bootstrapFromDate;
    }

    public String getStatus() {
        return status;
    }

    public String getLastRunStatus() {
        return lastRunStatus;
    }

    public String getLastError() {
        return lastError;
    }

    public Instant getLastRunAt() {
        return lastRunAt;
    }

    public Instant getNextRunAt() {
        return nextRunAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void start(Instant nextRunAt) {
        this.status = "RUNNING";
        this.nextRunAt = nextRunAt;
        this.lastError = null;
    }

    public void pause() {
        this.status = "PAUSED";
        this.nextRunAt = null;
    }

    public void resume(Instant nextRunAt) {
        this.status = "RUNNING";
        this.nextRunAt = nextRunAt;
        this.lastError = null;
    }

    public void stop() {
        this.status = "STOPPED";
        this.nextRunAt = null;
    }

    public void markExecutionStarted() {
        this.lastRunStatus = "RUNNING";
        this.lastError = null;
    }

    public void markExecutionSuccess(Instant lastRunAt, Instant nextRunAt, String nextLifecycleStatus) {
        this.lastRunAt = lastRunAt;
        this.lastRunStatus = "SUCCESS";
        this.lastError = null;
        this.nextRunAt = nextRunAt;
        this.status = nextLifecycleStatus;
    }

    public void markExecutionFailed(Instant lastRunAt, String errorMessage, Instant nextRunAt, String nextLifecycleStatus) {
        this.lastRunAt = lastRunAt;
        this.lastRunStatus = "FAILED";
        this.lastError = errorMessage;
        this.nextRunAt = nextRunAt;
        this.status = nextLifecycleStatus;
    }

    public void deferTo(Instant nextRunAt) {
        this.nextRunAt = nextRunAt;
    }

    public void reconfigure(
            String jobKey,
            String instrumentKey,
            String timeframeUnit,
            Integer timeframeInterval,
            String eventSource,
            String triggerType,
            Integer intervalValue,
            Instant scheduledAt,
            LocalDate bootstrapFromDate
    ) {
        this.jobKey = jobKey;
        this.instrumentKey = instrumentKey;
        this.timeframeUnit = timeframeUnit;
        this.timeframeInterval = timeframeInterval;
        this.eventSource = eventSource;
        this.triggerType = triggerType;
        this.intervalValue = intervalValue;
        this.scheduledAt = scheduledAt;
        this.bootstrapFromDate = bootstrapFromDate;
        if (!"RUNNING".equals(this.status)) {
            this.nextRunAt = null;
        }
        this.lastError = null;
    }
}
