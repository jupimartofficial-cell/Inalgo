package com.inalgo.trade.entity;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(
        name = "candles",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_candle_tenant_symbol_tf_ts",
                columnNames = {"tenant_id", "instrument_key", "timeframe_unit", "timeframe_interval", "candle_ts"}
        ),
        indexes = {
                @Index(name = "idx_candle_lookup", columnList = "tenant_id,instrument_key,timeframe_unit,timeframe_interval,candle_ts")
        }
)
public class CandleEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "instrument_key", nullable = false, length = 64)
    private String instrumentKey;

    @Column(name = "timeframe_unit", nullable = false, length = 16)
    private String timeframeUnit;

    @Column(name = "timeframe_interval", nullable = false)
    private Integer timeframeInterval;

    @Column(name = "candle_ts", nullable = false)
    private Instant candleTs;

    @Column(name = "open_price", nullable = false, precision = 18, scale = 6)
    private BigDecimal openPrice;

    @Column(name = "high_price", nullable = false, precision = 18, scale = 6)
    private BigDecimal highPrice;

    @Column(name = "low_price", nullable = false, precision = 18, scale = 6)
    private BigDecimal lowPrice;

    @Column(name = "close_price", nullable = false, precision = 18, scale = 6)
    private BigDecimal closePrice;

    @Column(name = "volume")
    private Long volume;

    protected CandleEntity() {
    }

    public CandleEntity(String tenantId, String instrumentKey, String timeframeUnit, Integer timeframeInterval,
                        Instant candleTs, BigDecimal openPrice, BigDecimal highPrice, BigDecimal lowPrice,
                        BigDecimal closePrice, Long volume) {
        this.tenantId = tenantId;
        this.instrumentKey = instrumentKey;
        this.timeframeUnit = timeframeUnit;
        this.timeframeInterval = timeframeInterval;
        this.candleTs = candleTs;
        this.openPrice = openPrice;
        this.highPrice = highPrice;
        this.lowPrice = lowPrice;
        this.closePrice = closePrice;
        this.volume = volume;
    }

    public Long getId() { return id; }
    public String getTenantId() { return tenantId; }
    public String getInstrumentKey() { return instrumentKey; }
    public String getTimeframeUnit() { return timeframeUnit; }
    public Integer getTimeframeInterval() { return timeframeInterval; }
    public Instant getCandleTs() { return candleTs; }
    public BigDecimal getOpenPrice() { return openPrice; }
    public BigDecimal getHighPrice() { return highPrice; }
    public BigDecimal getLowPrice() { return lowPrice; }
    public BigDecimal getClosePrice() { return closePrice; }
    public Long getVolume() { return volume; }

    public void updatePrices(BigDecimal openPrice, BigDecimal highPrice, BigDecimal lowPrice, BigDecimal closePrice, Long volume) {
        this.openPrice = openPrice;
        this.highPrice = highPrice;
        this.lowPrice = lowPrice;
        this.closePrice = closePrice;
        this.volume = volume;
    }
}
