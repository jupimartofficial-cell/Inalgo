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

@Entity
@Table(
        name = "admin_session",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_admin_session_token_hash", columnNames = {"token_hash"})
        },
        indexes = {
                @Index(name = "idx_admin_session_tenant_expires", columnList = "tenant_id, expires_at"),
                @Index(name = "idx_admin_session_expires", columnList = "expires_at")
        }
)
public class AdminSessionEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "token_hash", nullable = false, length = 64)
    private String tokenHash;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "last_used_at", nullable = false)
    private Instant lastUsedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected AdminSessionEntity() {
    }

    public AdminSessionEntity(String tenantId, String tokenHash, Instant expiresAt) {
        this.tenantId = tenantId;
        this.tokenHash = tokenHash;
        this.expiresAt = expiresAt;
        this.lastUsedAt = Instant.now();
    }

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
        if (this.lastUsedAt == null) {
            this.lastUsedAt = now;
        }
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }

    public boolean isExpired(Instant now) {
        return expiresAt.isBefore(now);
    }

    public void touch(Instant now) {
        this.lastUsedAt = now;
    }
}
