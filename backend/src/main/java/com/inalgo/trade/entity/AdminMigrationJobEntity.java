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
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(
        name = "admin_migration_job",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_admin_migration_job_stream",
                        columnNames = {"tenant_id", "instrument_key", "timeframe_unit", "timeframe_interval", "job_type"}
                )
        },
        indexes = {
                @Index(name = "idx_admin_migration_job_tenant_type_status", columnList = "tenant_id, job_type, status, updated_at")
        }
)
public class AdminMigrationJobEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "instrument_key", nullable = false, length = 128)
    private String instrumentKey;

    @Column(name = "timeframe_unit", nullable = false, length = 16)
    private String timeframeUnit;

    @Column(name = "timeframe_interval", nullable = false)
    private Integer timeframeInterval;

    @Column(name = "job_type", nullable = false, length = 64)
    private String jobType;

    @Column(name = "bootstrap_from_date", nullable = false)
    private LocalDate bootstrapFromDate;

    @Column(name = "status", nullable = false, length = 16)
    private String status;

    @Column(name = "progress_percent", nullable = false)
    private Integer progressPercent;

    @Column(name = "last_error")
    private String lastError;

    @Column(name = "next_from_date")
    private LocalDate nextFromDate;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected AdminMigrationJobEntity() {
    }

    public AdminMigrationJobEntity(
            String tenantId,
            String instrumentKey,
            String timeframeUnit,
            Integer timeframeInterval,
            String jobType,
            LocalDate bootstrapFromDate
    ) {
        this.tenantId = tenantId;
        this.instrumentKey = instrumentKey;
        this.timeframeUnit = timeframeUnit;
        this.timeframeInterval = timeframeInterval;
        this.jobType = jobType;
        this.bootstrapFromDate = bootstrapFromDate;
        this.status = "PENDING";
        this.progressPercent = 0;
    }

    @PrePersist
    void onCreate() {
        this.updatedAt = Instant.now();
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

    public String getInstrumentKey() {
        return instrumentKey;
    }

    public String getTimeframeUnit() {
        return timeframeUnit;
    }

    public Integer getTimeframeInterval() {
        return timeframeInterval;
    }

    public String getJobType() {
        return jobType;
    }

    public LocalDate getBootstrapFromDate() {
        return bootstrapFromDate;
    }

    public String getStatus() {
        return status;
    }

    public Integer getProgressPercent() {
        return progressPercent;
    }

    public String getLastError() {
        return lastError;
    }

    public LocalDate getNextFromDate() {
        return nextFromDate;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void updateSnapshot(
            String jobType,
            LocalDate bootstrapFromDate,
            String status,
            int progressPercent,
            String lastError,
            LocalDate nextFromDate
    ) {
        this.jobType = jobType;
        this.bootstrapFromDate = bootstrapFromDate;
        this.status = status;
        this.progressPercent = Math.max(0, Math.min(100, progressPercent));
        this.lastError = lastError;
        this.nextFromDate = nextFromDate;
    }
}
