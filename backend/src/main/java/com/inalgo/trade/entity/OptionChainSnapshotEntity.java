package com.inalgo.trade.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(
        name = "option_chain_snapshots",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_option_chain_snapshot_stream",
                columnNames = {"tenant_id", "underlying_key", "expiry_date", "strike_price", "snapshot_ts"}
        ),
        indexes = {
                @Index(name = "idx_option_chain_latest_lookup", columnList = "tenant_id,underlying_key,expiry_date,snapshot_ts,strike_price"),
                @Index(name = "idx_option_chain_history_lookup", columnList = "tenant_id,underlying_key,snapshot_ts")
        }
)
public class OptionChainSnapshotEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "underlying_key", nullable = false, length = 64)
    private String underlyingKey;

    @Column(name = "expiry_date", nullable = false)
    private LocalDate expiryDate;

    @Column(name = "strike_price", nullable = false, precision = 18, scale = 2)
    private BigDecimal strikePrice;

    @Column(name = "snapshot_ts", nullable = false)
    private Instant snapshotTs;

    @Column(name = "underlying_spot_price", precision = 18, scale = 4)
    private BigDecimal underlyingSpotPrice;

    @Column(name = "pcr", precision = 18, scale = 6)
    private BigDecimal pcr;

    @Column(name = "call_instrument_key", length = 64)
    private String callInstrumentKey;

    @Column(name = "call_ltp", precision = 18, scale = 6)
    private BigDecimal callLtp;

    @Column(name = "call_volume")
    private Long callVolume;

    @Column(name = "call_oi")
    private Long callOi;

    @Column(name = "call_prev_oi")
    private Long callPrevOi;

    @Column(name = "call_bid_price", precision = 18, scale = 6)
    private BigDecimal callBidPrice;

    @Column(name = "call_bid_qty")
    private Long callBidQty;

    @Column(name = "call_ask_price", precision = 18, scale = 6)
    private BigDecimal callAskPrice;

    @Column(name = "call_ask_qty")
    private Long callAskQty;

    @Column(name = "call_iv", precision = 18, scale = 6)
    private BigDecimal callIv;

    @Column(name = "call_delta", precision = 18, scale = 6)
    private BigDecimal callDelta;

    @Column(name = "call_gamma", precision = 18, scale = 6)
    private BigDecimal callGamma;

    @Column(name = "call_theta", precision = 18, scale = 6)
    private BigDecimal callTheta;

    @Column(name = "call_vega", precision = 18, scale = 6)
    private BigDecimal callVega;

    @Column(name = "call_pop", precision = 18, scale = 6)
    private BigDecimal callPop;

    @Column(name = "put_instrument_key", length = 64)
    private String putInstrumentKey;

    @Column(name = "put_ltp", precision = 18, scale = 6)
    private BigDecimal putLtp;

    @Column(name = "put_volume")
    private Long putVolume;

    @Column(name = "put_oi")
    private Long putOi;

    @Column(name = "put_prev_oi")
    private Long putPrevOi;

    @Column(name = "put_bid_price", precision = 18, scale = 6)
    private BigDecimal putBidPrice;

    @Column(name = "put_bid_qty")
    private Long putBidQty;

    @Column(name = "put_ask_price", precision = 18, scale = 6)
    private BigDecimal putAskPrice;

    @Column(name = "put_ask_qty")
    private Long putAskQty;

    @Column(name = "put_iv", precision = 18, scale = 6)
    private BigDecimal putIv;

    @Column(name = "put_delta", precision = 18, scale = 6)
    private BigDecimal putDelta;

    @Column(name = "put_gamma", precision = 18, scale = 6)
    private BigDecimal putGamma;

    @Column(name = "put_theta", precision = 18, scale = 6)
    private BigDecimal putTheta;

    @Column(name = "put_vega", precision = 18, scale = 6)
    private BigDecimal putVega;

    @Column(name = "put_pop", precision = 18, scale = 6)
    private BigDecimal putPop;

    @Column(name = "row_payload", nullable = false, columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private String rowPayload;

    @Column(name = "call_payload", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private String callPayload;

    @Column(name = "put_payload", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private String putPayload;

    protected OptionChainSnapshotEntity() {
    }

    public Long getId() { return id; }
    public String getTenantId() { return tenantId; }
    public String getUnderlyingKey() { return underlyingKey; }
    public LocalDate getExpiryDate() { return expiryDate; }
    public BigDecimal getStrikePrice() { return strikePrice; }
    public Instant getSnapshotTs() { return snapshotTs; }
    public BigDecimal getUnderlyingSpotPrice() { return underlyingSpotPrice; }
    public BigDecimal getPcr() { return pcr; }
    public String getCallInstrumentKey() { return callInstrumentKey; }
    public BigDecimal getCallLtp() { return callLtp; }
    public Long getCallVolume() { return callVolume; }
    public Long getCallOi() { return callOi; }
    public Long getCallPrevOi() { return callPrevOi; }
    public BigDecimal getCallBidPrice() { return callBidPrice; }
    public Long getCallBidQty() { return callBidQty; }
    public BigDecimal getCallAskPrice() { return callAskPrice; }
    public Long getCallAskQty() { return callAskQty; }
    public BigDecimal getCallIv() { return callIv; }
    public BigDecimal getCallDelta() { return callDelta; }
    public BigDecimal getCallGamma() { return callGamma; }
    public BigDecimal getCallTheta() { return callTheta; }
    public BigDecimal getCallVega() { return callVega; }
    public BigDecimal getCallPop() { return callPop; }
    public String getPutInstrumentKey() { return putInstrumentKey; }
    public BigDecimal getPutLtp() { return putLtp; }
    public Long getPutVolume() { return putVolume; }
    public Long getPutOi() { return putOi; }
    public Long getPutPrevOi() { return putPrevOi; }
    public BigDecimal getPutBidPrice() { return putBidPrice; }
    public Long getPutBidQty() { return putBidQty; }
    public BigDecimal getPutAskPrice() { return putAskPrice; }
    public Long getPutAskQty() { return putAskQty; }
    public BigDecimal getPutIv() { return putIv; }
    public BigDecimal getPutDelta() { return putDelta; }
    public BigDecimal getPutGamma() { return putGamma; }
    public BigDecimal getPutTheta() { return putTheta; }
    public BigDecimal getPutVega() { return putVega; }
    public BigDecimal getPutPop() { return putPop; }
    public String getRowPayload() { return rowPayload; }
    public String getCallPayload() { return callPayload; }
    public String getPutPayload() { return putPayload; }
}
