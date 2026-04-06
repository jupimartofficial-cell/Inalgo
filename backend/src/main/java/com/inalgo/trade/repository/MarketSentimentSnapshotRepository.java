package com.inalgo.trade.repository;

import com.inalgo.trade.entity.MarketSentimentSnapshotEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface MarketSentimentSnapshotRepository extends JpaRepository<MarketSentimentSnapshotEntity, Long> {
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            INSERT INTO market_sentiment_snapshot (
                tenant_id,
                market_scope,
                market_name,
                evaluation_type,
                trend_status,
                reason,
                current_value,
                ema_9,
                ema_21,
                ema_110,
                source_count,
                evidence_count,
                source_names,
                data_as_of,
                ai_analysis,
                ai_reason,
                ai_confidence,
                ai_model,
                ai_updated_at,
                snapshot_at,
                updated_at
            ) VALUES (
                :tenantId,
                :marketScope,
                :marketName,
                :evaluationType,
                :trendStatus,
                :reason,
                :currentValue,
                :ema9,
                :ema21,
                :ema110,
                :sourceCount,
                :evidenceCount,
                :sourceNames,
                :dataAsOf,
                :aiAnalysis,
                :aiReason,
                :aiConfidence,
                :aiModel,
                :aiUpdatedAt,
                :snapshotAt,
                NOW()
            )
            ON CONFLICT (tenant_id, market_scope, snapshot_at)
            DO UPDATE SET
                market_name = EXCLUDED.market_name,
                evaluation_type = EXCLUDED.evaluation_type,
                trend_status = EXCLUDED.trend_status,
                reason = EXCLUDED.reason,
                current_value = EXCLUDED.current_value,
                ema_9 = EXCLUDED.ema_9,
                ema_21 = EXCLUDED.ema_21,
                ema_110 = EXCLUDED.ema_110,
                source_count = EXCLUDED.source_count,
                evidence_count = EXCLUDED.evidence_count,
                source_names = EXCLUDED.source_names,
                data_as_of = EXCLUDED.data_as_of,
                ai_analysis = EXCLUDED.ai_analysis,
                ai_reason = EXCLUDED.ai_reason,
                ai_confidence = EXCLUDED.ai_confidence,
                ai_model = EXCLUDED.ai_model,
                ai_updated_at = EXCLUDED.ai_updated_at,
                updated_at = NOW()
            """, nativeQuery = true)
    int upsert(
            @Param("tenantId") String tenantId,
            @Param("marketScope") String marketScope,
            @Param("marketName") String marketName,
            @Param("evaluationType") String evaluationType,
            @Param("trendStatus") String trendStatus,
            @Param("reason") String reason,
            @Param("currentValue") BigDecimal currentValue,
            @Param("ema9") BigDecimal ema9,
            @Param("ema21") BigDecimal ema21,
            @Param("ema110") BigDecimal ema110,
            @Param("sourceCount") Integer sourceCount,
            @Param("evidenceCount") Integer evidenceCount,
            @Param("sourceNames") String sourceNames,
            @Param("dataAsOf") Instant dataAsOf,
            @Param("aiAnalysis") String aiAnalysis,
            @Param("aiReason") String aiReason,
            @Param("aiConfidence") Integer aiConfidence,
            @Param("aiModel") String aiModel,
            @Param("aiUpdatedAt") Instant aiUpdatedAt,
            @Param("snapshotAt") Instant snapshotAt
    );

    Optional<MarketSentimentSnapshotEntity> findByTenantIdAndMarketScopeAndSnapshotAt(String tenantId, String marketScope, Instant snapshotAt);

    /** Count of distinct IST calendar days that have at least one snapshot for the given scope. */
    @Query(value = """
            SELECT COUNT(DISTINCT DATE(snapshot_at AT TIME ZONE 'Asia/Kolkata'))
            FROM market_sentiment_snapshot
            WHERE tenant_id   = :tenantId
              AND market_scope = :scope
              AND snapshot_at >= :fromDate
            """, nativeQuery = true)
    int countDistinctSnapshotDays(
            @Param("tenantId") String tenantId,
            @Param("scope") String scope,
            @Param("fromDate") Instant fromDate
    );

    @Query(value = """
            SELECT COUNT(DISTINCT DATE(snapshot_at AT TIME ZONE 'Asia/Kolkata'))
            FROM market_sentiment_snapshot
            WHERE tenant_id    = :tenantId
              AND market_scope = :scope
              AND snapshot_at >= :fromDate
              AND ((snapshot_at AT TIME ZONE 'Asia/Kolkata')::time) BETWEEN CAST(:windowStart AS time) AND CAST(:windowEnd AS time)
            """, nativeQuery = true)
    int countDistinctSnapshotDaysInWindow(
            @Param("tenantId") String tenantId,
            @Param("scope") String scope,
            @Param("fromDate") Instant fromDate,
            @Param("windowStart") String windowStart,
            @Param("windowEnd") String windowEnd
    );

    /**
     * Returns one row per trading day (IST) for the given scope.
     * The dominant (most-frequent) trend_status / ai_analysis combination is selected per day.
     * Each row is joined against the daily NIFTY candle so the actual market direction
     * (BULL / BEAR / NEUTRAL) can be compared against the prediction.
     *
     * Columns: trade_date(text), trend_status, ai_analysis, avg_confidence(int),
     *          snap_count(int), close_price, prev_close, change_pct, actual_direction
     */
    @Query(value = """
            WITH snapshot_counts AS (
                SELECT
                    DATE(snapshot_at AT TIME ZONE 'Asia/Kolkata') AS trade_date,
                    trend_status,
                    ai_analysis,
                    ROUND(AVG(COALESCE(ai_confidence, 50))::numeric)::integer AS avg_confidence,
                    COUNT(*)::integer AS snap_count
                FROM market_sentiment_snapshot
                WHERE tenant_id    = :tenantId
                  AND market_scope = :scope
                  AND snapshot_at >= :fromDate
                GROUP BY DATE(snapshot_at AT TIME ZONE 'Asia/Kolkata'), trend_status, ai_analysis
            ),
            daily_top AS (
                SELECT DISTINCT ON (trade_date)
                    trade_date, trend_status, ai_analysis, avg_confidence, snap_count
                FROM snapshot_counts
                ORDER BY trade_date, snap_count DESC
            ),
            daily_close_candidates AS (
                SELECT
                    DATE(candle_ts AT TIME ZONE 'Asia/Kolkata') AS trade_date,
                    close_price,
                    1 AS source_priority
                FROM candles
                WHERE tenant_id       = :tenantId
                  AND instrument_key  = :instrumentKey
                  AND timeframe_unit  = 'days'
                  AND timeframe_interval = 1
                  AND candle_ts      >= :candleFromDate
                UNION ALL
                SELECT
                    minute_close.trade_date,
                    minute_close.close_price,
                    2 AS source_priority
                FROM (
                    SELECT DISTINCT ON (DATE(candle_ts AT TIME ZONE 'Asia/Kolkata'))
                        DATE(candle_ts AT TIME ZONE 'Asia/Kolkata') AS trade_date,
                        close_price
                    FROM candles
                    WHERE tenant_id       = :tenantId
                      AND instrument_key  = :instrumentKey
                      AND timeframe_unit  = 'minutes'
                      AND timeframe_interval = 1
                      AND candle_ts      >= :candleFromDate
                    ORDER BY DATE(candle_ts AT TIME ZONE 'Asia/Kolkata'), candle_ts DESC
                ) minute_close
            ),
            daily_close AS (
                SELECT DISTINCT ON (trade_date)
                    trade_date,
                    close_price
                FROM daily_close_candidates
                ORDER BY trade_date, source_priority
            ),
            nifty_prices AS (
                SELECT
                    trade_date,
                    close_price,
                    LAG(close_price) OVER (ORDER BY trade_date) AS prev_close
                FROM daily_close
            )
            SELECT
                p.trade_date::text,
                p.trend_status,
                p.ai_analysis,
                p.avg_confidence,
                p.snap_count,
                n.close_price,
                n.prev_close,
                ROUND(100.0 * (n.close_price - n.prev_close) / NULLIF(n.prev_close, 0), 2) AS change_pct,
                CASE
                    WHEN n.close_price > n.prev_close THEN 'BULL'
                    WHEN n.close_price < n.prev_close THEN 'BEAR'
                    ELSE 'NEUTRAL'
                END AS actual_direction
            FROM daily_top p
            JOIN nifty_prices n ON p.trade_date = n.trade_date
            WHERE n.prev_close IS NOT NULL
            ORDER BY p.trade_date DESC
            """, nativeQuery = true)
    List<Object[]> computeDailyAccuracy(
            @Param("tenantId") String tenantId,
            @Param("scope") String scope,
            @Param("fromDate") Instant fromDate,
            @Param("candleFromDate") Instant candleFromDate,
            @Param("instrumentKey") String instrumentKey
    );

    @Query(value = """
            WITH snapshot_counts AS (
                SELECT
                    DATE(snapshot_at AT TIME ZONE 'Asia/Kolkata') AS trade_date,
                    trend_status,
                    ai_analysis,
                    ROUND(AVG(COALESCE(ai_confidence, 50))::numeric)::integer AS avg_confidence,
                    COUNT(*)::integer AS snap_count
                FROM market_sentiment_snapshot
                WHERE tenant_id    = :tenantId
                  AND market_scope = :scope
                  AND snapshot_at >= :fromDate
                  AND ((snapshot_at AT TIME ZONE 'Asia/Kolkata')::time) BETWEEN CAST(:windowStart AS time) AND CAST(:windowEnd AS time)
                GROUP BY DATE(snapshot_at AT TIME ZONE 'Asia/Kolkata'), trend_status, ai_analysis
            ),
            daily_top AS (
                SELECT DISTINCT ON (trade_date)
                    trade_date, trend_status, ai_analysis, avg_confidence, snap_count
                FROM snapshot_counts
                ORDER BY trade_date, snap_count DESC
            ),
            candle_window AS (
                SELECT
                    DATE(candle_ts AT TIME ZONE 'Asia/Kolkata') AS trade_date,
                    MIN(candle_ts) FILTER (WHERE ((candle_ts AT TIME ZONE 'Asia/Kolkata')::time) >= CAST(:windowStart AS time)) AS first_ts,
                    MAX(candle_ts) FILTER (WHERE ((candle_ts AT TIME ZONE 'Asia/Kolkata')::time) <= CAST(:windowEnd AS time)) AS last_ts
                FROM candles
                WHERE tenant_id          = :tenantId
                  AND instrument_key     = :instrumentKey
                  AND timeframe_unit     = 'minutes'
                  AND timeframe_interval = :candleIntervalMinutes
                  AND candle_ts          >= :candleFromDate
                  AND ((candle_ts AT TIME ZONE 'Asia/Kolkata')::time) BETWEEN CAST(:windowStart AS time) AND CAST(:windowEnd AS time)
                GROUP BY DATE(candle_ts AT TIME ZONE 'Asia/Kolkata')
            ),
            window_prices AS (
                SELECT
                    cw.trade_date,
                    c_start.close_price AS start_close,
                    c_end.close_price   AS end_close
                FROM candle_window cw
                JOIN candles c_start
                  ON c_start.tenant_id = :tenantId
                 AND c_start.instrument_key = :instrumentKey
                 AND c_start.timeframe_unit = 'minutes'
                 AND c_start.timeframe_interval = :candleIntervalMinutes
                 AND c_start.candle_ts = cw.first_ts
                JOIN candles c_end
                  ON c_end.tenant_id = :tenantId
                 AND c_end.instrument_key = :instrumentKey
                 AND c_end.timeframe_unit = 'minutes'
                 AND c_end.timeframe_interval = :candleIntervalMinutes
                 AND c_end.candle_ts = cw.last_ts
                WHERE cw.first_ts IS NOT NULL
                  AND cw.last_ts IS NOT NULL
            )
            SELECT
                p.trade_date::text,
                p.trend_status,
                p.ai_analysis,
                p.avg_confidence,
                p.snap_count,
                w.start_close,
                w.end_close,
                ROUND(100.0 * (w.end_close - w.start_close) / NULLIF(w.start_close, 0), 2) AS change_pct,
                CASE
                    WHEN w.end_close > w.start_close THEN 'BULL'
                    WHEN w.end_close < w.start_close THEN 'BEAR'
                    ELSE 'NEUTRAL'
                END AS actual_direction
            FROM daily_top p
            JOIN window_prices w ON p.trade_date = w.trade_date
            ORDER BY p.trade_date DESC
            """, nativeQuery = true)
    List<Object[]> computeWindowAccuracy(
            @Param("tenantId") String tenantId,
            @Param("scope") String scope,
            @Param("fromDate") Instant fromDate,
            @Param("candleFromDate") Instant candleFromDate,
            @Param("instrumentKey") String instrumentKey,
            @Param("candleIntervalMinutes") int candleIntervalMinutes,
            @Param("windowStart") String windowStart,
            @Param("windowEnd") String windowEnd
    );

    @Query("""
            SELECT ms
            FROM MarketSentimentSnapshotEntity ms
            WHERE ms.tenantId = :tenantId
              AND ms.marketScope = COALESCE(:marketScope, ms.marketScope)
              AND ms.trendStatus = COALESCE(:trendStatus, ms.trendStatus)
              AND ms.snapshotAt >= COALESCE(:fromSnapshotAt, ms.snapshotAt)
              AND ms.snapshotAt <= COALESCE(:toSnapshotAt, ms.snapshotAt)
            """)
    Page<MarketSentimentSnapshotEntity> search(
            @Param("tenantId") String tenantId,
            @Param("marketScope") String marketScope,
            @Param("trendStatus") String trendStatus,
            @Param("fromSnapshotAt") Instant fromSnapshotAt,
            @Param("toSnapshotAt") Instant toSnapshotAt,
            Pageable pageable
    );
}
