package com.inalgo.trade.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(
        name = "option_chain_migration_state",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_option_chain_migration_state_stream",
                columnNames = {"tenant_id", "underlying_key", "expiry_date"}
        ),
        indexes = {
                @Index(name = "idx_option_chain_migration_state_lookup", columnList = "tenant_id,underlying_key,expiry_date")
        }
)
public class OptionChainMigrationStateEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "underlying_key", nullable = false, length = 64)
    private String underlyingKey;

    @Column(name = "expiry_date", nullable = false)
    private LocalDate expiryDate;

    @Column(name = "bootstrap_completed", nullable = false)
    private boolean bootstrapCompleted;

    @Column(name = "last_snapshot_ts")
    private Instant lastSnapshotTs;

    @Column(name = "last_run_status", nullable = false, length = 16)
    private String lastRunStatus;

    @Column(name = "last_error")
    private String lastError;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected OptionChainMigrationStateEntity() {
    }

    public OptionChainMigrationStateEntity(String tenantId, String underlyingKey, LocalDate expiryDate) {
        this.tenantId = tenantId;
        this.underlyingKey = underlyingKey;
        this.expiryDate = expiryDate;
        this.bootstrapCompleted = false;
        this.lastRunStatus = "PENDING";
        this.updatedAt = Instant.now();
    }

    public String getTenantId() { return tenantId; }
    public String getUnderlyingKey() { return underlyingKey; }
    public LocalDate getExpiryDate() { return expiryDate; }
    public boolean isBootstrapCompleted() { return bootstrapCompleted; }
    public Instant getLastSnapshotTs() { return lastSnapshotTs; }
    public String getLastRunStatus() { return lastRunStatus; }
    public String getLastError() { return lastError; }
    public Instant getUpdatedAt() { return updatedAt; }

    public void markRunning() {
        this.lastRunStatus = "RUNNING";
        this.lastError = null;
        this.updatedAt = Instant.now();
    }

    public void markSuccess(Instant snapshotTs, boolean bootstrapCompleted) {
        this.lastRunStatus = "SUCCESS";
        this.lastSnapshotTs = snapshotTs;
        this.bootstrapCompleted = bootstrapCompleted;
        this.lastError = null;
        this.updatedAt = Instant.now();
    }

    public void markFailed(String error) {
        this.lastRunStatus = "FAILED";
        this.lastError = error;
        this.updatedAt = Instant.now();
    }
}
