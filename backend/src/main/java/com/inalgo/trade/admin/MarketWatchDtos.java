package com.inalgo.trade.admin;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public final class MarketWatchDtos {

    private MarketWatchDtos() {
    }

    public record MarketWatchGroupConfig(
            String id,
            String name
    ) {}

    public record MarketWatchTileConfig(
            String id,
            String title,
            String source,
            String instrumentKey,
            String timeframeUnit,
            Integer timeframeInterval,
            String marketScope,
            String primaryField,
            String groupId
    ) {}

    public record MarketWatchLayoutConfig(
            Integer refreshIntervalSeconds,
            Integer gridColumns,
            List<MarketWatchTileConfig> tiles,
            List<MarketWatchGroupConfig> groups
    ) {}

    public record MarketWatchConfigSaveRequest(
            @NotBlank String username,
            @NotNull MarketWatchLayoutConfig config
    ) {}

    public record MarketWatchConfigResponse(
            String username,
            MarketWatchLayoutConfig config,
            Instant updatedAt
    ) {}

    public record MarketWatchTileField(
            String key,
            String label,
            String value,
            String tone
    ) {}

    public record MarketWatchTileResult(
            String tileId,
            String source,
            String primaryField,
            String primaryLabel,
            String primaryValue,
            String statusLabel,
            String statusTone,
            String updatedAt,
            List<MarketWatchTileField> fields
    ) {}

    public record MarketWatchDataResponse(
            List<MarketWatchTileResult> tiles,
            Instant fetchedAt
    ) {}

    public record MarketSentimentRefreshResponse(
            int scopesUpdated,
            String refreshedAt
    ) {}

    // ── Trend accuracy ────────────────────────────────────────────────────────

    /** One trading day's prediction vs actual outcome. */
    public record DailyAccuracyRow(
            String tradeDate,
            String predictedTrend,
            String aiPrediction,
            int avgConfidence,
            int snapCount,
            BigDecimal startPrice,
            BigDecimal endPrice,
            BigDecimal changePct,
            String actualDirection,
            boolean trendCorrect,
            boolean aiCorrect
    ) {}

    public record WindowAccuracy(
            String windowKey,
            String windowLabel,
            String referencePeriod,
            int snapshotDays,
            int totalDays,
            int trendCorrect,
            double trendAccuracyPct,
            int aiCorrect,
            double aiAccuracyPct,
            Double trendBullPrecision,
            Double trendBearPrecision,
            Double aiBullPrecision,
            Double aiBearPrecision,
            List<DailyAccuracyRow> dailyRows
    ) {}

    /** Accuracy summary for one market scope (INDIA_NEWS or GLOBAL_NEWS). */
    public record ScopeAccuracy(
            String scope,
            String benchmark,
            /** Total distinct IST days that have at least one snapshot in the lookback window. */
            int snapshotDays,
            /** Days where a snapshot AND a matching Nifty daily candle (with prev-close) both exist. */
            int totalDays,
            int trendCorrect,
            double trendAccuracyPct,
            int aiCorrect,
            double aiAccuracyPct,
            Double trendBullPrecision,
            Double trendBearPrecision,
            Double aiBullPrecision,
            Double aiBearPrecision,
            List<DailyAccuracyRow> dailyRows,
            List<WindowAccuracy> windows
    ) {}

    /** Full accuracy report across both news scopes. */
    public record TrendAccuracyReport(
            Instant computedAt,
            int lookbackDays,
            int candleIntervalMinutes,
            ScopeAccuracy indiaNews,
            ScopeAccuracy globalNews
    ) {}
}
