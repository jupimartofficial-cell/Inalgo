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
        name = "intra_trade_order",
        indexes = {
                @Index(name = "idx_intra_trade_order_lookup", columnList = "tenant_id, execution_id, phase, created_at DESC")
        }
)
public class IntraTradeOrderEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "username", nullable = false, length = 64)
    private String username;

    @Column(name = "execution_id", nullable = false)
    private Long executionId;

    @Column(name = "runtime_id")
    private Long runtimeId;

    @Column(name = "position_id")
    private Long positionId;

    @Column(name = "leg_id", length = 64)
    private String legId;

    @Column(name = "leg_label", length = 120)
    private String legLabel;

    @Column(name = "phase", nullable = false, length = 24)
    private String phase;

    @Column(name = "instrument_key", nullable = false, length = 128)
    private String instrumentKey;

    @Column(name = "transaction_type", nullable = false, length = 8)
    private String transactionType;

    @Column(name = "quantity", nullable = false)
    private Integer quantity;

    @Column(name = "order_type", nullable = false, length = 16)
    private String orderType;

    @Column(name = "limit_price", nullable = false, precision = 19, scale = 4)
    private BigDecimal limitPrice = BigDecimal.ZERO;

    @Column(name = "order_id", length = 64)
    private String orderId;

    @Column(name = "status", length = 32)
    private String status;

    @Column(name = "tag", length = 64)
    private String tag;

    @Column(name = "message", length = 255)
    private String message;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

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

    public Long getId() { return id; }
    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public Long getExecutionId() { return executionId; }
    public void setExecutionId(Long executionId) { this.executionId = executionId; }
    public Long getRuntimeId() { return runtimeId; }
    public void setRuntimeId(Long runtimeId) { this.runtimeId = runtimeId; }
    public Long getPositionId() { return positionId; }
    public void setPositionId(Long positionId) { this.positionId = positionId; }
    public String getLegId() { return legId; }
    public void setLegId(String legId) { this.legId = legId; }
    public String getLegLabel() { return legLabel; }
    public void setLegLabel(String legLabel) { this.legLabel = legLabel; }
    public String getPhase() { return phase; }
    public void setPhase(String phase) { this.phase = phase; }
    public String getInstrumentKey() { return instrumentKey; }
    public void setInstrumentKey(String instrumentKey) { this.instrumentKey = instrumentKey; }
    public String getTransactionType() { return transactionType; }
    public void setTransactionType(String transactionType) { this.transactionType = transactionType; }
    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }
    public String getOrderType() { return orderType; }
    public void setOrderType(String orderType) { this.orderType = orderType; }
    public BigDecimal getLimitPrice() { return limitPrice; }
    public void setLimitPrice(BigDecimal limitPrice) { this.limitPrice = limitPrice; }
    public String getOrderId() { return orderId; }
    public void setOrderId(String orderId) { this.orderId = orderId; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getTag() { return tag; }
    public void setTag(String tag) { this.tag = tag; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
