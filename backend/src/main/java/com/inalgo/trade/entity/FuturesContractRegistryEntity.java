package com.inalgo.trade.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;
import java.time.LocalDate;

/**
 * Persists the currently-active monthly futures contract for each underlying index.
 * Updated automatically by FuturesContractRollService when a contract expires.
 */
@Entity
@Table(
        name = "futures_contract_registry",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_futures_contract_registry_underlying",
                columnNames = {"underlying_key"}
        )
)
public class FuturesContractRegistryEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "underlying_key", nullable = false, length = 200)
    private String underlyingKey;

    @Column(name = "label", nullable = false, length = 100)
    private String label;

    @Column(name = "exchange", nullable = false, length = 20)
    private String exchange;

    @Column(name = "instrument_key", nullable = false, length = 200)
    private String instrumentKey;

    @Column(name = "contract_name", length = 200)
    private String contractName;

    @Column(name = "expiry_date")
    private LocalDate expiryDate;

    @Column(name = "lot_size")
    private Integer lotSize;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected FuturesContractRegistryEntity() {}

    public Long getId() { return id; }
    public String getUnderlyingKey() { return underlyingKey; }
    public String getLabel() { return label; }
    public String getExchange() { return exchange; }
    public String getInstrumentKey() { return instrumentKey; }
    public String getContractName() { return contractName; }
    public LocalDate getExpiryDate() { return expiryDate; }
    public Integer getLotSize() { return lotSize; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }

    public void setInstrumentKey(String instrumentKey) { this.instrumentKey = instrumentKey; }
    public void setContractName(String contractName) { this.contractName = contractName; }
    public void setExpiryDate(LocalDate expiryDate) { this.expiryDate = expiryDate; }
    public void setLotSize(Integer lotSize) { this.lotSize = lotSize; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
