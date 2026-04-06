package com.inalgo.trade.admin;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class AdminDtos {
    private AdminDtos() {}

    /** Active instrument descriptor returned by GET /api/v1/admin/instruments. */
    public record InstrumentDto(
            String key,
            String label,
            String exchange,
            String contractName,
            String expiryDate,
            boolean futures
    ) {}

    public record AdminLoginRequest(
            @NotBlank String username,
            @NotBlank String password
    ) {}

    public record AdminLoginResponse(String token) {}

    public record MigrationStatusResponse(
            String instrumentKey,
            String timeframeUnit,
            Integer timeframeInterval,
            LocalDate nextFromDate,
            boolean completed,
            String lastRunStatus,
            String lastError,
            Instant lastRunAt,
            Instant updatedAt
    ) {}

    public record TriggerMigrationResponse(String status) {}

    public record TriggerActionResponse(String status) {}

    public record TriggerDeleteResponse(String status, Long id) {}

    public record MigrationStreamRequest(
            @NotBlank String instrumentKey,
            @NotBlank String timeframeUnit,
            @NotNull @Min(1) @Max(1440) Integer timeframeInterval,
            @NotNull LocalDate bootstrapFromDate
    ) {}

    public record MigrationJobResponse(
            String instrumentKey,
            String timeframeUnit,
            Integer timeframeInterval,
            String jobType,
            LocalDate bootstrapFromDate,
            String status,
            int progressPercent,
            String lastError,
            LocalDate nextFromDate,
            Instant updatedAt
    ) {}

    public record CreateTriggerRequest(
            String jobKey,
            @NotBlank @Size(max = 128) String instrumentKey,
            @Size(max = 16) String timeframeUnit,
            @Min(1) @Max(1440) Integer timeframeInterval,
            @NotBlank @Size(max = 32) String eventSource,
            @NotBlank @Size(max = 32) String triggerType,
            @Min(1) @Max(1440) Integer intervalValue,
            Instant scheduledAt
    ) {}

    public record UpdateTriggerRequest(
            String jobKey,
            @NotBlank @Size(max = 128) String instrumentKey,
            @Size(max = 16) String timeframeUnit,
            @Min(1) @Max(1440) Integer timeframeInterval,
            @NotBlank @Size(max = 32) String eventSource,
            @NotBlank @Size(max = 32) String triggerType,
            @Min(1) @Max(1440) Integer intervalValue,
            Instant scheduledAt
    ) {}

    public record TriggerResponse(
            Long id,
            String jobKey,
            String instrumentKey,
            String timeframeUnit,
            Integer timeframeInterval,
            String eventSource,
            String triggerType,
            Integer intervalValue,
            Instant scheduledAt,
            LocalDate bootstrapFromDate,
            String status,
            String lastRunStatus,
            String lastError,
            Instant lastRunAt,
            Instant nextRunAt,
            Instant createdAt,
            Instant updatedAt,
            String tabGroup,
            String jobNatureKey,
            String jobNatureLabel,
            boolean oneTime
    ) {}

    public record TriggerFacetOption(
            String value,
            String label,
            long count
    ) {}

    public record TriggerTimeframeFacetOption(
            String value,
            String label,
            String timeframeUnit,
            Integer timeframeInterval,
            long count
    ) {}

    public record TriggerBrowserSummary(
            long totalInTab,
            long filteredTotal,
            long runningCount,
            long pausedCount,
            long failedCount,
            long oneTimeCount,
            long attentionCount
    ) {}

    public record TriggerBrowserResponse(
            List<TriggerResponse> items,
            long totalElements,
            int page,
            int size,
            List<TriggerFacetOption> tabs,
            List<TriggerFacetOption> instruments,
            List<TriggerTimeframeFacetOption> timeframes,
            List<TriggerFacetOption> jobNatures,
            TriggerBrowserSummary summary
    ) {}

    public record UpstoxTokenStatusResponse(
            boolean configured,
            Instant updatedAt
    ) {}

    public record UpstoxTokenUpdateRequest(
            @NotBlank String token
    ) {}

    public record OpenAiTokenStatusResponse(
            boolean configured,
            Instant updatedAt,
            String model,
            boolean enabled
    ) {}

    public record OpenAiTokenUpdateRequest(
            @NotBlank String token
    ) {}

    public record TradingPreferencesSaveRequest(
            @NotBlank String username,
            @NotNull @Valid TradingPreferencesPayload preferences
    ) {}

    public record TradingPreferencesResponse(
            String username,
            TradingPreferencesPayload preferences,
            Instant updatedAt
    ) {}

    public record TradingDayParamRefreshRequest(
            @NotBlank @Size(max = 128) String instrumentKey,
            @NotNull LocalDate fromDate,
            @NotNull LocalDate toDate
    ) {}

    public record TradingDayParamRefreshResponse(
            String instrumentKey,
            LocalDate fromDate,
            LocalDate toDate,
            int processedTradingDays,
            List<LocalDate> refreshedTradeDates
    ) {}

    public record TradingSignalResponse(
            Long id,
            String instrumentKey,
            String timeframeUnit,
            Integer timeframeInterval,
            LocalDate signalDate,
            java.math.BigDecimal previousClose,
            java.math.BigDecimal currentClose,
            java.math.BigDecimal dma9,
            java.math.BigDecimal dma26,
            java.math.BigDecimal dma110,
            String signal,
            String firstCandleColor,
            Instant createdAt,
            Instant updatedAt
    ) {}

    public record TradingDayParamResponse(
            Long id,
            LocalDate tradeDate,
            String instrumentKey,
            java.math.BigDecimal orbHigh,
            java.math.BigDecimal orbLow,
            String orbBreakout,
            String orbBreakdown,
            java.math.BigDecimal todayOpen,
            java.math.BigDecimal todayClose,
            java.math.BigDecimal prevHigh,
            java.math.BigDecimal prevLow,
            java.math.BigDecimal prevClose,
            java.math.BigDecimal gapPct,
            String gapType,
            java.math.BigDecimal gapUpPct,
            java.math.BigDecimal gapDownPct,
            Instant createdAt,
            Instant updatedAt
    ) {}

    public record MarketSentimentResponse(
            Long id,
            String marketScope,
            String marketName,
            String evaluationType,
            String trendStatus,
            String reason,
            java.math.BigDecimal currentValue,
            java.math.BigDecimal ema9,
            java.math.BigDecimal ema21,
            java.math.BigDecimal ema110,
            Integer sourceCount,
            Integer evidenceCount,
            String sourceNames,
            Instant dataAsOf,
            String aiAnalysis,
            String aiReason,
            Integer aiConfidence,
            String aiModel,
            Instant aiUpdatedAt,
            Instant snapshotAt,
            Instant createdAt,
            Instant updatedAt
    ) {}

    public record TradingPreferencesPayload(
            @NotNull @Min(0) Integer activeTabIndex,
            @NotEmpty @Size(max = 5) List<@Valid TradingTabPreference> tabs
    ) {}

    public record TradingTabPreference(
            @NotBlank @Size(max = 40) String name,
            @NotNull @Size(min = 2, max = 10) List<@Valid TradingChartPreference> charts
    ) {}

    public record TradingChartPreference(
            @NotBlank @Size(max = 64) String id,
            @NotBlank @Size(max = 128) String instrumentKey,
            @NotBlank @Size(max = 16) String timeframeUnit,
            @NotNull @Min(1) @Max(1440) Integer timeframeInterval,
            @NotNull @Min(1) @Max(3650) Integer lookbackDays,
            @NotNull @Min(200) @Max(1000) Integer height,
            @NotBlank String layout
    ) {}

    public record BacktestStrategySaveRequest(
            @NotBlank String username,
            @NotNull @Valid BacktestStrategyPayload strategy
    ) {}

    public record BacktestRunRequest(
            @NotBlank String username,
            @NotNull @Valid BacktestStrategyPayload strategy
    ) {}

    public record BacktestStrategyPayload(
            @NotBlank @Size(max = 120) String strategyName,
            @NotBlank @Size(max = 128) String underlyingKey,
            @NotBlank @Size(max = 16) String underlyingSource,
            @NotBlank @Size(max = 16) String strategyType,
            @NotNull java.time.LocalTime entryTime,
            @NotNull java.time.LocalTime exitTime,
            @NotNull java.time.LocalDate startDate,
            @NotNull java.time.LocalDate endDate,
            @NotNull @Size(min = 1, max = 10) List<@Valid BacktestLegPayload> legs,
            @NotNull @Valid BacktestLegwiseSettingsPayload legwiseSettings,
            @NotNull @Valid BacktestOverallSettingsPayload overallSettings,
            @Valid BacktestAdvancedConditionsPayload advancedConditions
    ) {}

    public record BacktestLegPayload(
            @NotBlank @Size(max = 64) String id,
            @NotBlank @Size(max = 16) String segment,
            @NotNull @Min(1) @Max(100) Integer lots,
            @NotBlank @Size(max = 16) String position,
            @Size(max = 16) String optionType,
            @NotBlank @Size(max = 16) String expiryType,
            @NotBlank @Size(max = 16) String strikeType,
            @NotNull @Min(0) @Max(20) Integer strikeSteps,
            @Valid BacktestAdvancedConditionsPayload legConditions
    ) {}

    public record BacktestLegwiseSettingsPayload(
            @NotBlank @Size(max = 16) String squareOffMode,
            @NotNull Boolean trailSlToBreakEven,
            @NotBlank @Size(max = 16) String trailScope,
            @NotNull Boolean noReEntryAfterEnabled,
            java.time.LocalTime noReEntryAfterTime,
            @NotNull Boolean overallMomentumEnabled,
            @Size(max = 32) String overallMomentumMode,
            java.math.BigDecimal overallMomentumValue
    ) {}

    public record BacktestOverallSettingsPayload(
            @NotNull Boolean stopLossEnabled,
            @Size(max = 32) String stopLossMode,
            java.math.BigDecimal stopLossValue,
            @NotNull Boolean targetEnabled,
            @Size(max = 32) String targetMode,
            java.math.BigDecimal targetValue,
            @NotNull Boolean trailingEnabled,
            @Size(max = 32) String trailingMode,
            java.math.BigDecimal trailingTrigger,
            java.math.BigDecimal trailingLockProfit
    ) {}

    public record BacktestAdvancedConditionsPayload(
            @NotNull Boolean enabled,
            @Valid BacktestConditionGroupPayload entry,
            @Valid BacktestConditionGroupPayload exit
    ) {}

    public record BacktestConditionGroupPayload(
            @NotBlank @Size(max = 3) String operator,
            @NotNull @Size(min = 1, max = 20) List<@Valid BacktestConditionNodePayload> items
    ) {}

    public record BacktestConditionNodePayload(
            @Valid BacktestConditionRulePayload rule,
            @Valid BacktestConditionGroupPayload group
    ) {}

    public record BacktestConditionRulePayload(
            @NotBlank @Size(max = 16) String timeframeUnit,
            @NotNull @Min(1) @Max(1440) Integer timeframeInterval,
            @NotNull @Valid BacktestConditionOperandPayload left,
            @NotBlank @Size(max = 32) String comparator,
            @NotNull @Valid BacktestConditionOperandPayload right
    ) {}

    public record BacktestConditionOperandPayload(
            @NotBlank @Size(max = 16) String kind,
            @Size(max = 32) String source,
            @Size(max = 64) String field,
            @Size(max = 64) String value,
            @Size(max = 16) String valueType
    ) {}

    public record BacktestStrategyResponse(
            Long id,
            String username,
            String strategyName,
            String underlyingKey,
            String underlyingSource,
            String strategyType,
            java.time.LocalDate startDate,
            java.time.LocalDate endDate,
            java.time.LocalTime entryTime,
            java.time.LocalTime exitTime,
            Integer legsCount,
            BacktestStrategyPayload strategy,
            Instant createdAt,
            Instant updatedAt
    ) {}

    public record BacktestStrategyDeleteResponse(
            String status,
            Long id
    ) {}

    public record BacktestRunResponse(
            BacktestStrategyPayload strategy,
            List<BacktestResultRow> rows,
            java.math.BigDecimal totalPnl,
            java.math.BigDecimal averagePnl,
            Integer executedTrades,
            Integer winTrades,
            Integer lossTrades,
            Integer syncedInstruments,
            Integer syncedCandles,
            java.math.BigDecimal realWorldAccuracyPct,
            Integer marketPricedTrades,
            Integer fallbackPricedTrades,
            List<String> notes
    ) {}

    public record BacktestResultRow(
            java.time.LocalDate tradeDate,
            java.time.LocalDate exitDate,
            String expiryLabel,
            Instant entryTs,
            Instant exitTs,
            java.math.BigDecimal entryUnderlyingPrice,
            java.math.BigDecimal exitUnderlyingPrice,
            java.math.BigDecimal pnlAmount,
            String legsSummary,
            List<BacktestLegResult> legs
    ) {}

    public record BacktestLegResult(
            String legId,
            String legLabel,
            String instrumentKey,
            java.time.LocalDate expiryDate,
            java.math.BigDecimal strikePrice,
            Integer lotSize,
            Integer lots,
            java.math.BigDecimal entryPrice,
            java.math.BigDecimal exitPrice,
            java.math.BigDecimal pnlAmount
    ) {}

    public record OptionChainRefreshRequest(
            String underlyingKey,
            Boolean includeAllExpiries
    ) {}

    public record OptionChainRefreshResponse(
            List<OptionChainRefreshResult> results
    ) {}

    public record OptionChainRefreshResult(
            String underlyingKey,
            int processedExpiries,
            int persistedRows,
            int failedExpiries,
            List<String> errors
    ) {}

    public record OptionChainExpiriesResponse(
            String underlyingKey,
            List<LocalDate> expiries
    ) {}

    public record OptionChainSnapshotResponse(
            String underlyingKey,
            LocalDate expiryDate,
            Instant snapshotTs,
            java.math.BigDecimal underlyingSpotPrice,
            java.math.BigDecimal pcr,
            java.math.BigDecimal syntheticFuturePrice,
            List<OptionChainRowResponse> rows
    ) {}

    public record OptionChainRowResponse(
            java.math.BigDecimal strikePrice,
            String callInstrumentKey,
            java.math.BigDecimal callLtp,
            Long callOi,
            Long callPrevOi,
            Long callVolume,
            java.math.BigDecimal callIv,
            java.math.BigDecimal callOiChangePercent,
            String putInstrumentKey,
            java.math.BigDecimal putLtp,
            Long putOi,
            Long putPrevOi,
            Long putVolume,
            java.math.BigDecimal putIv,
            java.math.BigDecimal putOiChangePercent
    ) {}

    public record OptionChainHistoryResponse(
            String underlyingKey,
            LocalDate expiryDate,
            Instant snapshotTs,
            java.math.BigDecimal strikePrice,
            java.math.BigDecimal callLtp,
            Long callOi,
            Long callPrevOi,
            java.math.BigDecimal callIv,
            java.math.BigDecimal putLtp,
            Long putOi,
            Long putPrevOi,
            java.math.BigDecimal putIv,
            java.math.BigDecimal underlyingSpotPrice,
            java.math.BigDecimal pcr
    ) {}

    // ─── Market Watch ────────────────────────────────────────────────────────────

    public record MarketWatchTileConfig(
            String id,
            String title,
            String source,
            String instrumentKey,
            String timeframeUnit,
            Integer timeframeInterval,
            String marketScope
    ) {}

    public record MarketWatchLayoutConfig(
            Integer refreshIntervalSeconds,
            Integer gridColumns,
            java.util.List<MarketWatchTileConfig> tiles
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

    public record MarketWatchCandleResponse(
            String instrumentKey,
            String timeframeUnit,
            Integer timeframeInterval,
            Instant candleTs,
            java.math.BigDecimal openPrice,
            java.math.BigDecimal highPrice,
            java.math.BigDecimal lowPrice,
            java.math.BigDecimal closePrice,
            Long volume
    ) {}

    public record MarketWatchTileResult(
            String tileId,
            String source,
            Object data
    ) {}

    public record MarketWatchDataResponse(
            java.util.List<MarketWatchTileResult> tiles,
            Instant fetchedAt
    ) {}

}
