package com.inalgo.trade.repository;

import com.inalgo.trade.entity.TradingSignalEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface TradingSignalRepository extends JpaRepository<TradingSignalEntity, Long> {
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            INSERT INTO trading_signal (
                tenant_id,
                instrument_key,
                timeframe_unit,
                timeframe_interval,
                signal_date,
                previous_close,
                current_close,
                dma_9,
                dma_26,
                dma_110,
                signal,
                first_candle_color,
                updated_at
            ) VALUES (
                :tenantId,
                :instrumentKey,
                :timeframeUnit,
                :timeframeInterval,
                :signalDate,
                :previousClose,
                :currentClose,
                :dma9,
                :dma26,
                :dma110,
                :signal,
                :firstCandleColor,
                NOW()
            )
            ON CONFLICT (tenant_id, instrument_key, timeframe_unit, timeframe_interval, signal_date)
            DO UPDATE SET
                previous_close = EXCLUDED.previous_close,
                current_close = EXCLUDED.current_close,
                dma_9 = EXCLUDED.dma_9,
                dma_26 = EXCLUDED.dma_26,
                dma_110 = EXCLUDED.dma_110,
                signal = EXCLUDED.signal,
                first_candle_color = EXCLUDED.first_candle_color,
                updated_at = NOW()
            """, nativeQuery = true)
    int upsert(
            @Param("tenantId") String tenantId,
            @Param("instrumentKey") String instrumentKey,
            @Param("timeframeUnit") String timeframeUnit,
            @Param("timeframeInterval") Integer timeframeInterval,
            @Param("signalDate") LocalDate signalDate,
            @Param("previousClose") BigDecimal previousClose,
            @Param("currentClose") BigDecimal currentClose,
            @Param("dma9") BigDecimal dma9,
            @Param("dma26") BigDecimal dma26,
            @Param("dma110") BigDecimal dma110,
            @Param("signal") String signal,
            @Param("firstCandleColor") String firstCandleColor
    );

    Optional<TradingSignalEntity> findByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeIntervalAndSignalDate(
            String tenantId,
            String instrumentKey,
            String timeframeUnit,
            Integer timeframeInterval,
            LocalDate signalDate
    );

    Optional<TradingSignalEntity> findTopByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeIntervalAndSignalDateLessThanEqualOrderBySignalDateDescUpdatedAtDesc(
            String tenantId,
            String instrumentKey,
            String timeframeUnit,
            Integer timeframeInterval,
            LocalDate signalDate
    );

    @Query("""
            SELECT ts
            FROM TradingSignalEntity ts
            WHERE ts.tenantId = :tenantId
              AND ts.instrumentKey = :instrumentKey
              AND ts.signalDate >= :fromDate
              AND ts.signalDate <= :toDate
            ORDER BY ts.signalDate ASC, ts.timeframeUnit ASC, ts.timeframeInterval ASC
            """)
    List<TradingSignalEntity> findForBacktestRange(
            @Param("tenantId") String tenantId,
            @Param("instrumentKey") String instrumentKey,
            @Param("fromDate") LocalDate fromDate,
            @Param("toDate") LocalDate toDate
    );

    @Query("""
            SELECT ts
            FROM TradingSignalEntity ts
            WHERE ts.tenantId = :tenantId
              AND ts.instrumentKey = COALESCE(:instrumentKey, ts.instrumentKey)
              AND ts.timeframeUnit = COALESCE(:timeframeUnit, ts.timeframeUnit)
              AND ts.timeframeInterval = COALESCE(:timeframeInterval, ts.timeframeInterval)
              AND ts.signal = COALESCE(:signal, ts.signal)
              AND ts.signalDate >= COALESCE(:fromDate, ts.signalDate)
              AND ts.signalDate <= COALESCE(:toDate, ts.signalDate)
            """)
    Page<TradingSignalEntity> search(
            @Param("tenantId") String tenantId,
            @Param("instrumentKey") String instrumentKey,
            @Param("timeframeUnit") String timeframeUnit,
            @Param("timeframeInterval") Integer timeframeInterval,
            @Param("signal") String signal,
            @Param("fromDate") LocalDate fromDate,
            @Param("toDate") LocalDate toDate,
            Pageable pageable
    );
}
