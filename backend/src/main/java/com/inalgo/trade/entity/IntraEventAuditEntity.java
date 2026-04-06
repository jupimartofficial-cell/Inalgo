package com.inalgo.trade.entity;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "intra_event_audit", indexes = {
        @Index(name = "idx_intra_event_lookup", columnList = "tenant_id, username, created_at DESC"),
        @Index(name = "idx_intra_event_runtime_lookup", columnList = "tenant_id, runtime_id, created_at DESC")
})
public class IntraEventAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "username", nullable = false, length = 64)
    private String username;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "runtime_id")
    private IntraRuntimeStrategyEntity runtime;

    @Column(name = "execution_id")
    private Long executionId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "position_id")
    private IntraPositionSnapshotEntity position;

    @Column(name = "event_type", nullable = false, length = 64)
    private String eventType;

    @Column(name = "severity", nullable = false, length = 16)
    private String severity;

    @Column(name = "mode", length = 16)
    private String mode;

    @Column(name = "message", nullable = false, length = 255)
    private String message;

    @Column(name = "reason", length = 255)
    private String reason;

    @Column(name = "before_state_json", columnDefinition = "TEXT")
    private String beforeStateJson;

    @Column(name = "after_state_json", columnDefinition = "TEXT")
    private String afterStateJson;

    @Column(name = "correlation_id", length = 64)
    private String correlationId;

    @Column(name = "actor", nullable = false, length = 64)
    private String actor;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        this.createdAt = Instant.now();
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
    public IntraPositionSnapshotEntity getPosition() { return position; }
    public void setPosition(IntraPositionSnapshotEntity position) { this.position = position; }
    public String getEventType() { return eventType; }
    public void setEventType(String eventType) { this.eventType = eventType; }
    public String getSeverity() { return severity; }
    public void setSeverity(String severity) { this.severity = severity; }
    public String getMode() { return mode; }
    public void setMode(String mode) { this.mode = mode; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public String getBeforeStateJson() { return beforeStateJson; }
    public void setBeforeStateJson(String beforeStateJson) { this.beforeStateJson = beforeStateJson; }
    public String getAfterStateJson() { return afterStateJson; }
    public void setAfterStateJson(String afterStateJson) { this.afterStateJson = afterStateJson; }
    public String getCorrelationId() { return correlationId; }
    public void setCorrelationId(String correlationId) { this.correlationId = correlationId; }
    public String getActor() { return actor; }
    public void setActor(String actor) { this.actor = actor; }
    public Instant getCreatedAt() { return createdAt; }
}
