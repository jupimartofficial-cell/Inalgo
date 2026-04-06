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
        name = "trading_day_param",
        indexes = {
                @Index(name = "idx_trading_day_param_lookup", columnList = "tenant_id, trade_date, instrument_key")
        }
)
public class TradingDayParamEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "trade_date", nullable = false)
    private LocalDate tradeDate;

    @Column(name = "instrument_key", nullable = false, length = 128)
    private String instrumentKey;

    @Column(name = "orb_high", precision = 18, scale = 6)
    private BigDecimal orbHigh;

    @Column(name = "orb_low", precision = 18, scale = 6)
    private BigDecimal orbLow;

    @Column(name = "orb_breakout", nullable = false, length = 3)
    private String orbBreakout;

    @Column(name = "orb_breakdown", nullable = false, length = 3)
    private String orbBreakdown;

    @Column(name = "today_open", precision = 18, scale = 6)
    private BigDecimal todayOpen;

    @Column(name = "today_close", precision = 18, scale = 6)
    private BigDecimal todayClose;

    @Column(name = "prev_high", precision = 18, scale = 6)
    private BigDecimal prevHigh;

    @Column(name = "prev_low", precision = 18, scale = 6)
    private BigDecimal prevLow;

    @Column(name = "prev_close", precision = 18, scale = 6)
    private BigDecimal prevClose;

    @Column(name = "gap_pct", precision = 18, scale = 6)
    private BigDecimal gapPct;

    @Column(name = "gap_type", length = 16)
    private String gapType;

    @Column(name = "gap_up_pct", precision = 18, scale = 6)
    private BigDecimal gapUpPct;

    @Column(name = "gap_down_pct", precision = 18, scale = 6)
    private BigDecimal gapDownPct;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected TradingDayParamEntity() {
    }

    public Long getId() {
        return id;
    }

    public String getTenantId() {
        return tenantId;
    }

    public LocalDate getTradeDate() {
        return tradeDate;
    }

    public String getInstrumentKey() {
        return instrumentKey;
    }

    public BigDecimal getOrbHigh() {
        return orbHigh;
    }

    public BigDecimal getOrbLow() {
        return orbLow;
    }

    public String getOrbBreakout() {
        return orbBreakout;
    }

    public String getOrbBreakdown() {
        return orbBreakdown;
    }

    public BigDecimal getTodayOpen() {
        return todayOpen;
    }

    public BigDecimal getTodayClose() {
        return todayClose;
    }

    public BigDecimal getPrevHigh() {
        return prevHigh;
    }

    public BigDecimal getPrevLow() {
        return prevLow;
    }

    public BigDecimal getPrevClose() {
        return prevClose;
    }

    public BigDecimal getGapPct() {
        return gapPct;
    }

    public String getGapType() {
        return gapType;
    }

    public BigDecimal getGapUpPct() {
        return gapUpPct;
    }

    public BigDecimal getGapDownPct() {
        return gapDownPct;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
