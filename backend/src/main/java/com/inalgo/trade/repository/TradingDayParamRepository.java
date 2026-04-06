package com.inalgo.trade.repository;

import com.inalgo.trade.entity.TradingDayParamEntity;
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

public interface TradingDayParamRepository extends JpaRepository<TradingDayParamEntity, Long> {
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            INSERT INTO trading_day_param (
                tenant_id,
                trade_date,
                instrument_key,
                orb_high,
                orb_low,
                orb_breakout,
                orb_breakdown,
                today_open,
                today_close,
                prev_high,
                prev_low,
                prev_close,
                gap_pct,
                gap_type,
                gap_up_pct,
                gap_down_pct,
                updated_at
            ) VALUES (
                :tenantId,
                :tradeDate,
                :instrumentKey,
                :orbHigh,
                :orbLow,
                :orbBreakout,
                :orbBreakdown,
                :todayOpen,
                :todayClose,
                :prevHigh,
                :prevLow,
                :prevClose,
                :gapPct,
                :gapType,
                :gapUpPct,
                :gapDownPct,
                NOW()
            )
            ON CONFLICT (tenant_id, instrument_key, trade_date)
            DO UPDATE SET
                orb_high = EXCLUDED.orb_high,
                orb_low = EXCLUDED.orb_low,
                orb_breakout = EXCLUDED.orb_breakout,
                orb_breakdown = EXCLUDED.orb_breakdown,
                today_open = EXCLUDED.today_open,
                today_close = EXCLUDED.today_close,
                prev_high = EXCLUDED.prev_high,
                prev_low = EXCLUDED.prev_low,
                prev_close = EXCLUDED.prev_close,
                gap_pct = EXCLUDED.gap_pct,
                gap_type = EXCLUDED.gap_type,
                gap_up_pct = EXCLUDED.gap_up_pct,
                gap_down_pct = EXCLUDED.gap_down_pct,
                updated_at = NOW()
            """, nativeQuery = true)
    int upsert(
            @Param("tenantId") String tenantId,
            @Param("tradeDate") LocalDate tradeDate,
            @Param("instrumentKey") String instrumentKey,
            @Param("orbHigh") BigDecimal orbHigh,
            @Param("orbLow") BigDecimal orbLow,
            @Param("orbBreakout") String orbBreakout,
            @Param("orbBreakdown") String orbBreakdown,
            @Param("todayOpen") BigDecimal todayOpen,
            @Param("todayClose") BigDecimal todayClose,
            @Param("prevHigh") BigDecimal prevHigh,
            @Param("prevLow") BigDecimal prevLow,
            @Param("prevClose") BigDecimal prevClose,
            @Param("gapPct") BigDecimal gapPct,
            @Param("gapType") String gapType,
            @Param("gapUpPct") BigDecimal gapUpPct,
            @Param("gapDownPct") BigDecimal gapDownPct
    );

    Optional<TradingDayParamEntity> findByTenantIdAndInstrumentKeyAndTradeDate(
            String tenantId,
            String instrumentKey,
            LocalDate tradeDate
    );

    @Query("""
            SELECT tdp
            FROM TradingDayParamEntity tdp
            WHERE tdp.tenantId = :tenantId
              AND tdp.instrumentKey = :instrumentKey
              AND tdp.tradeDate >= :fromDate
              AND tdp.tradeDate <= :toDate
            ORDER BY tdp.tradeDate ASC
            """)
    List<TradingDayParamEntity> findForBacktestRange(
            @Param("tenantId") String tenantId,
            @Param("instrumentKey") String instrumentKey,
            @Param("fromDate") LocalDate fromDate,
            @Param("toDate") LocalDate toDate
    );

    @Query("""
            SELECT tdp
            FROM TradingDayParamEntity tdp
            WHERE tdp.tenantId = :tenantId
              AND tdp.instrumentKey = COALESCE(:instrumentKey, tdp.instrumentKey)
              AND tdp.tradeDate >= COALESCE(:fromDate, tdp.tradeDate)
              AND tdp.tradeDate <= COALESCE(:toDate, tdp.tradeDate)
            """)
    Page<TradingDayParamEntity> search(
            @Param("tenantId") String tenantId,
            @Param("instrumentKey") String instrumentKey,
            @Param("fromDate") LocalDate fromDate,
            @Param("toDate") LocalDate toDate,
            Pageable pageable
    );
}
