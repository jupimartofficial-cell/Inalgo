package com.inalgo.trade.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(
        name = "trading_signal",
        indexes = {
                @Index(name = "idx_trading_signal_lookup", columnList = "tenant_id, signal_date, instrument_key, timeframe_unit, timeframe_interval")
        }
)
public class TradingSignalEntity {
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

    @Column(name = "signal_date", nullable = false)
    private LocalDate signalDate;

    @Column(name = "previous_close", precision = 18, scale = 6)
    private BigDecimal previousClose;

    @Column(name = "current_close", precision = 18, scale = 6)
    private BigDecimal currentClose;

    @Column(name = "dma_9", precision = 18, scale = 6)
    private BigDecimal dma9;

    @Column(name = "dma_26", precision = 18, scale = 6)
    private BigDecimal dma26;

    @Column(name = "dma_110", precision = 18, scale = 6)
    private BigDecimal dma110;

    @Column(name = "signal", nullable = false, length = 8)
    private String signal;

    @Column(name = "first_candle_color", length = 5)
    private String firstCandleColor;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected TradingSignalEntity() {
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

    public LocalDate getSignalDate() {
        return signalDate;
    }

    public BigDecimal getPreviousClose() {
        return previousClose;
    }

    public BigDecimal getCurrentClose() {
        return currentClose;
    }

    public BigDecimal getDma9() {
        return dma9;
    }

    public BigDecimal getDma26() {
        return dma26;
    }

    public BigDecimal getDma110() {
        return dma110;
    }

    public String getSignal() {
        return signal;
    }

    public String getFirstCandleColor() {
        return firstCandleColor;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
