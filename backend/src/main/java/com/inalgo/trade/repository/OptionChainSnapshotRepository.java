package com.inalgo.trade.repository;

import com.inalgo.trade.entity.OptionChainSnapshotEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public interface OptionChainSnapshotRepository extends JpaRepository<OptionChainSnapshotEntity, Long> {

    @Modifying
    @Query(value = """
            INSERT INTO option_chain_snapshots (
                tenant_id,
                underlying_key,
                expiry_date,
                strike_price,
                snapshot_ts,
                underlying_spot_price,
                pcr,
                call_instrument_key,
                call_ltp,
                call_volume,
                call_oi,
                call_prev_oi,
                call_bid_price,
                call_bid_qty,
                call_ask_price,
                call_ask_qty,
                call_iv,
                call_delta,
                call_gamma,
                call_theta,
                call_vega,
                call_pop,
                put_instrument_key,
                put_ltp,
                put_volume,
                put_oi,
                put_prev_oi,
                put_bid_price,
                put_bid_qty,
                put_ask_price,
                put_ask_qty,
                put_iv,
                put_delta,
                put_gamma,
                put_theta,
                put_vega,
                put_pop,
                row_payload,
                call_payload,
                put_payload,
                updated_at
            ) VALUES (
                :tenantId,
                :underlyingKey,
                :expiryDate,
                :strikePrice,
                :snapshotTs,
                :underlyingSpotPrice,
                :pcr,
                :callInstrumentKey,
                :callLtp,
                :callVolume,
                :callOi,
                :callPrevOi,
                :callBidPrice,
                :callBidQty,
                :callAskPrice,
                :callAskQty,
                :callIv,
                :callDelta,
                :callGamma,
                :callTheta,
                :callVega,
                :callPop,
                :putInstrumentKey,
                :putLtp,
                :putVolume,
                :putOi,
                :putPrevOi,
                :putBidPrice,
                :putBidQty,
                :putAskPrice,
                :putAskQty,
                :putIv,
                :putDelta,
                :putGamma,
                :putTheta,
                :putVega,
                :putPop,
                CAST(:rowPayload AS jsonb),
                CAST(:callPayload AS jsonb),
                CAST(:putPayload AS jsonb),
                NOW()
            )
            ON CONFLICT (tenant_id, underlying_key, expiry_date, strike_price, snapshot_ts)
            DO UPDATE SET
                underlying_spot_price = EXCLUDED.underlying_spot_price,
                pcr = EXCLUDED.pcr,
                call_instrument_key = EXCLUDED.call_instrument_key,
                call_ltp = EXCLUDED.call_ltp,
                call_volume = EXCLUDED.call_volume,
                call_oi = EXCLUDED.call_oi,
                call_prev_oi = EXCLUDED.call_prev_oi,
                call_bid_price = EXCLUDED.call_bid_price,
                call_bid_qty = EXCLUDED.call_bid_qty,
                call_ask_price = EXCLUDED.call_ask_price,
                call_ask_qty = EXCLUDED.call_ask_qty,
                call_iv = EXCLUDED.call_iv,
                call_delta = EXCLUDED.call_delta,
                call_gamma = EXCLUDED.call_gamma,
                call_theta = EXCLUDED.call_theta,
                call_vega = EXCLUDED.call_vega,
                call_pop = EXCLUDED.call_pop,
                put_instrument_key = EXCLUDED.put_instrument_key,
                put_ltp = EXCLUDED.put_ltp,
                put_volume = EXCLUDED.put_volume,
                put_oi = EXCLUDED.put_oi,
                put_prev_oi = EXCLUDED.put_prev_oi,
                put_bid_price = EXCLUDED.put_bid_price,
                put_bid_qty = EXCLUDED.put_bid_qty,
                put_ask_price = EXCLUDED.put_ask_price,
                put_ask_qty = EXCLUDED.put_ask_qty,
                put_iv = EXCLUDED.put_iv,
                put_delta = EXCLUDED.put_delta,
                put_gamma = EXCLUDED.put_gamma,
                put_theta = EXCLUDED.put_theta,
                put_vega = EXCLUDED.put_vega,
                put_pop = EXCLUDED.put_pop,
                row_payload = EXCLUDED.row_payload,
                call_payload = EXCLUDED.call_payload,
                put_payload = EXCLUDED.put_payload,
                updated_at = NOW()
            """, nativeQuery = true)
    int upsert(
            @Param("tenantId") String tenantId,
            @Param("underlyingKey") String underlyingKey,
            @Param("expiryDate") LocalDate expiryDate,
            @Param("strikePrice") BigDecimal strikePrice,
            @Param("snapshotTs") Instant snapshotTs,
            @Param("underlyingSpotPrice") BigDecimal underlyingSpotPrice,
            @Param("pcr") BigDecimal pcr,
            @Param("callInstrumentKey") String callInstrumentKey,
            @Param("callLtp") BigDecimal callLtp,
            @Param("callVolume") Long callVolume,
            @Param("callOi") Long callOi,
            @Param("callPrevOi") Long callPrevOi,
            @Param("callBidPrice") BigDecimal callBidPrice,
            @Param("callBidQty") Long callBidQty,
            @Param("callAskPrice") BigDecimal callAskPrice,
            @Param("callAskQty") Long callAskQty,
            @Param("callIv") BigDecimal callIv,
            @Param("callDelta") BigDecimal callDelta,
            @Param("callGamma") BigDecimal callGamma,
            @Param("callTheta") BigDecimal callTheta,
            @Param("callVega") BigDecimal callVega,
            @Param("callPop") BigDecimal callPop,
            @Param("putInstrumentKey") String putInstrumentKey,
            @Param("putLtp") BigDecimal putLtp,
            @Param("putVolume") Long putVolume,
            @Param("putOi") Long putOi,
            @Param("putPrevOi") Long putPrevOi,
            @Param("putBidPrice") BigDecimal putBidPrice,
            @Param("putBidQty") Long putBidQty,
            @Param("putAskPrice") BigDecimal putAskPrice,
            @Param("putAskQty") Long putAskQty,
            @Param("putIv") BigDecimal putIv,
            @Param("putDelta") BigDecimal putDelta,
            @Param("putGamma") BigDecimal putGamma,
            @Param("putTheta") BigDecimal putTheta,
            @Param("putVega") BigDecimal putVega,
            @Param("putPop") BigDecimal putPop,
            @Param("rowPayload") String rowPayload,
            @Param("callPayload") String callPayload,
            @Param("putPayload") String putPayload
    );

    @Query("""
            SELECT o FROM OptionChainSnapshotEntity o
            WHERE o.tenantId = :tenantId
              AND o.underlyingKey = :underlyingKey
              AND o.expiryDate = :expiryDate
              AND o.snapshotTs = (
                  SELECT MAX(i.snapshotTs)
                  FROM OptionChainSnapshotEntity i
                  WHERE i.tenantId = :tenantId
                    AND i.underlyingKey = :underlyingKey
                    AND i.expiryDate = :expiryDate
              )
            ORDER BY o.strikePrice ASC
            """)
    List<OptionChainSnapshotEntity> findLatestSnapshotRows(
            @Param("tenantId") String tenantId,
            @Param("underlyingKey") String underlyingKey,
            @Param("expiryDate") LocalDate expiryDate
    );

    @Query("""
            SELECT DISTINCT o.expiryDate
            FROM OptionChainSnapshotEntity o
            WHERE o.tenantId = :tenantId
              AND o.underlyingKey = :underlyingKey
            ORDER BY o.expiryDate ASC
            """)
    List<LocalDate> findDistinctExpiriesByTenantAndUnderlying(
            @Param("tenantId") String tenantId,
            @Param("underlyingKey") String underlyingKey
    );

    Page<OptionChainSnapshotEntity> findByTenantIdAndUnderlyingKeyAndExpiryDateAndSnapshotTsBetween(
            String tenantId,
            String underlyingKey,
            LocalDate expiryDate,
            Instant from,
            Instant to,
            Pageable pageable
    );
}
