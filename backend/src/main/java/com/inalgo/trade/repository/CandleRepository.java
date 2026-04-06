package com.inalgo.trade.repository;

import com.inalgo.trade.entity.CandleEntity;
import java.sql.Date;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface CandleRepository extends JpaRepository<CandleEntity, Long>, JpaSpecificationExecutor<CandleEntity> {
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            INSERT INTO candles (
                tenant_id,
                instrument_key,
                timeframe_unit,
                timeframe_interval,
                candle_ts,
                open_price,
                high_price,
                low_price,
                close_price,
                volume,
                updated_at
            ) VALUES (
                :tenantId,
                :instrumentKey,
                :timeframeUnit,
                :timeframeInterval,
                :candleTs,
                :openPrice,
                :highPrice,
                :lowPrice,
                :closePrice,
                :volume,
                NOW()
            )
            ON CONFLICT (tenant_id, instrument_key, timeframe_unit, timeframe_interval, candle_ts)
            DO UPDATE SET
                open_price = EXCLUDED.open_price,
                high_price = EXCLUDED.high_price,
                low_price = EXCLUDED.low_price,
                close_price = EXCLUDED.close_price,
                volume = EXCLUDED.volume,
                updated_at = NOW()
            """, nativeQuery = true)
    int upsert(
            @Param("tenantId") String tenantId,
            @Param("instrumentKey") String instrumentKey,
            @Param("timeframeUnit") String timeframeUnit,
            @Param("timeframeInterval") Integer timeframeInterval,
            @Param("candleTs") Instant candleTs,
            @Param("openPrice") BigDecimal openPrice,
            @Param("highPrice") BigDecimal highPrice,
            @Param("lowPrice") BigDecimal lowPrice,
            @Param("closePrice") BigDecimal closePrice,
            @Param("volume") Long volume
    );

    Optional<CandleEntity> findByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeIntervalAndCandleTs(
            String tenantId,
            String instrumentKey,
            String timeframeUnit,
            Integer timeframeInterval,
            Instant candleTs
    );

    Page<CandleEntity> findByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeIntervalAndCandleTsBetween(
            String tenantId,
            String instrumentKey,
            String timeframeUnit,
            Integer timeframeInterval,
            Instant from,
            Instant to,
            Pageable pageable
    );

    Page<CandleEntity> findByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeIntervalOrderByCandleTsDesc(
            String tenantId,
            String instrumentKey,
            String timeframeUnit,
            Integer timeframeInterval,
            Pageable pageable
    );

    Page<CandleEntity> findByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeIntervalOrderByCandleTsAsc(
            String tenantId,
            String instrumentKey,
            String timeframeUnit,
            Integer timeframeInterval,
            Pageable pageable
    );

    List<CandleEntity> findByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeIntervalAndCandleTsGreaterThanEqualAndCandleTsLessThanOrderByCandleTsAsc(
            String tenantId,
            String instrumentKey,
            String timeframeUnit,
            Integer timeframeInterval,
            Instant from,
            Instant to
    );

    Optional<CandleEntity> findFirstByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeIntervalAndCandleTsGreaterThanEqualAndCandleTsLessThanOrderByCandleTsAsc(
            String tenantId,
            String instrumentKey,
            String timeframeUnit,
            Integer timeframeInterval,
            Instant from,
            Instant to
    );

    Optional<CandleEntity> findFirstByTenantIdAndInstrumentKeyAndTimeframeUnitAndCandleTsGreaterThanEqualAndCandleTsLessThanOrderByCandleTsDescTimeframeIntervalAsc(
            String tenantId,
            String instrumentKey,
            String timeframeUnit,
            Instant from,
            Instant to
    );

    Optional<CandleEntity> findFirstByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeIntervalAndCandleTsLessThanOrderByCandleTsDesc(
            String tenantId,
            String instrumentKey,
            String timeframeUnit,
            Integer timeframeInterval,
            Instant before
    );

    boolean existsByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeInterval(
            String tenantId,
            String instrumentKey,
            String timeframeUnit,
            Integer timeframeInterval
    );

    Optional<CandleEntity> findTopByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeIntervalOrderByCandleTsDesc(
            String tenantId,
            String instrumentKey,
            String timeframeUnit,
            Integer timeframeInterval
    );

    @Query(value = """
            SELECT DISTINCT ((candle_ts AT TIME ZONE 'Asia/Kolkata')::date)
            FROM candles
            WHERE tenant_id = :tenantId
              AND instrument_key = :instrumentKey
              AND timeframe_unit = :timeframeUnit
              AND ((candle_ts AT TIME ZONE 'Asia/Kolkata')::date) BETWEEN :fromDate AND :toDate
            ORDER BY 1
            """, nativeQuery = true)
    List<Date> findDistinctTradeDatesInMarketZone(
            @Param("tenantId") String tenantId,
            @Param("instrumentKey") String instrumentKey,
            @Param("timeframeUnit") String timeframeUnit,
            @Param("fromDate") LocalDate fromDate,
            @Param("toDate") LocalDate toDate
    );

    @Query(value = """
            SELECT DISTINCT ((candle_ts AT TIME ZONE 'Asia/Kolkata')::date)
            FROM candles
            WHERE tenant_id = :tenantId
              AND instrument_key = :instrumentKey
              AND timeframe_unit = :timeframeUnit
              AND timeframe_interval = :timeframeInterval
              AND ((candle_ts AT TIME ZONE 'Asia/Kolkata')::date) BETWEEN :fromDate AND :toDate
            ORDER BY 1
            """, nativeQuery = true)
    List<Date> findDistinctTradeDatesInMarketZoneByTimeframe(
            @Param("tenantId") String tenantId,
            @Param("instrumentKey") String instrumentKey,
            @Param("timeframeUnit") String timeframeUnit,
            @Param("timeframeInterval") Integer timeframeInterval,
            @Param("fromDate") LocalDate fromDate,
            @Param("toDate") LocalDate toDate
    );

}
