package com.inalgo.trade.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(
        name = "expired_derivative_contract_cache",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_expired_derivative_contract_cache",
                columnNames = {"tenant_id", "contract_kind", "underlying_key", "expiry_date", "instrument_key"}
        ),
        indexes = {
                @Index(name = "idx_expired_derivative_contract_lookup", columnList = "tenant_id,contract_kind,underlying_key,expiry_date")
        }
)
public class ExpiredDerivativeContractEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "contract_kind", nullable = false, length = 16)
    private String contractKind;

    @Column(name = "underlying_key", nullable = false, length = 128)
    private String underlyingKey;

    @Column(name = "expiry_date", nullable = false)
    private LocalDate expiryDate;

    @Column(name = "instrument_key", nullable = false, length = 128)
    private String instrumentKey;

    @Column(name = "name", length = 256)
    private String name;

    @Column(name = "segment", length = 64)
    private String segment;

    @Column(name = "exchange", length = 32)
    private String exchange;

    @Column(name = "exchange_token", length = 64)
    private String exchangeToken;

    @Column(name = "trading_symbol", length = 128)
    private String tradingSymbol;

    @Column(name = "lot_size")
    private Integer lotSize;

    @Column(name = "instrument_type", length = 64)
    private String instrumentType;

    @Column(name = "strike_price", precision = 18, scale = 4)
    private BigDecimal strikePrice;

    @Column(name = "weekly")
    private Boolean weekly;

    @Column(name = "option_type", length = 16)
    private String optionType;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected ExpiredDerivativeContractEntity() {
    }

    public Long getId() {
        return id;
    }

    public String getTenantId() {
        return tenantId;
    }

    public String getContractKind() {
        return contractKind;
    }

    public String getUnderlyingKey() {
        return underlyingKey;
    }

    public LocalDate getExpiryDate() {
        return expiryDate;
    }

    public String getInstrumentKey() {
        return instrumentKey;
    }

    public String getName() {
        return name;
    }

    public String getSegment() {
        return segment;
    }

    public String getExchange() {
        return exchange;
    }

    public String getExchangeToken() {
        return exchangeToken;
    }

    public String getTradingSymbol() {
        return tradingSymbol;
    }

    public Integer getLotSize() {
        return lotSize;
    }

    public String getInstrumentType() {
        return instrumentType;
    }

    public BigDecimal getStrikePrice() {
        return strikePrice;
    }

    public Boolean getWeekly() {
        return weekly;
    }

    public String getOptionType() {
        return optionType;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
