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
        name = "expired_instrument_expiry_cache",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_expired_instrument_expiry_cache",
                columnNames = {"tenant_id", "underlying_key", "expiry_date"}
        ),
        indexes = {
                @Index(name = "idx_expired_instrument_expiry_lookup", columnList = "tenant_id,underlying_key,expiry_date")
        }
)
public class ExpiredInstrumentExpiryEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "underlying_key", nullable = false, length = 128)
    private String underlyingKey;

    @Column(name = "expiry_date", nullable = false)
    private LocalDate expiryDate;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected ExpiredInstrumentExpiryEntity() {
    }

    public Long getId() {
        return id;
    }

    public String getTenantId() {
        return tenantId;
    }

    public String getUnderlyingKey() {
        return underlyingKey;
    }

    public LocalDate getExpiryDate() {
        return expiryDate;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
