package com.inalgo.trade.admin;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public final class IntraStrategyDtos {

    private IntraStrategyDtos() {
    }

    public record IntraStrategyBuilderPayload(
            @NotNull @Valid AdminDtos.BacktestStrategyPayload strategy,
            @NotBlank @Size(max = 16) String timeframeUnit,
            @NotNull @Min(1) @Max(1440) Integer timeframeInterval,
            Boolean advancedMode,
            @Size(max = 64) String marketSession
    ) {
    }

    public record IntraStrategyCreateDraftRequest(
            @NotBlank String username,
            @NotNull @Valid IntraStrategyBuilderPayload builder
    ) {
    }

    public record IntraStrategyUpdateDraftRequest(
            @NotBlank String username,
            @NotNull @Valid IntraStrategyBuilderPayload builder
    ) {
    }

    public record IntraStrategyValidateRequest(
            @NotBlank String username
    ) {
    }

    public record IntraStrategyPublishRequest(
            @NotBlank String username,
            @NotBlank String targetStatus
    ) {
    }

    public record IntraStrategyDuplicateRequest(
            @NotBlank String username
    ) {
    }

    public record IntraStrategyArchiveRequest(
            @NotBlank String username
    ) {
    }

    public record IntraStrategyImportFromBacktestRequest(
            @NotBlank String username,
            List<Long> strategyIds
    ) {
    }

    public record IntraStrategyAiGenerateRequest(
            @NotBlank String username,
            @NotBlank @Size(max = 128) String instrumentKey,
            @NotNull @Min(2) @Max(3) Integer candidateCount,
            @NotNull @Min(30) @Max(730) Integer lookbackDays,
            @NotBlank @Size(max = 16) String timeframeUnit,
            @NotNull @Min(1) @Max(1440) Integer timeframeInterval,
            Boolean saveAsDrafts
    ) {
    }

    public record IntraStrategyAiBacktestSummary(
            BigDecimal totalPnl,
            BigDecimal averagePnl,
            Integer executedTrades,
            Integer winTrades,
            Integer lossTrades,
            BigDecimal realWorldAccuracyPct,
            Integer marketPricedTrades,
            Integer fallbackPricedTrades,
            List<String> notes
    ) {
    }

    public record IntraStrategyAiCandidate(
            Integer rank,
            String strategyName,
            String templateKey,
            String direction,
            String rationale,
            AdminDtos.BacktestStrategyPayload strategy,
            IntraStrategyValidationResult validation,
            IntraStrategyAiBacktestSummary backtest,
            Boolean trendConflict,
            String trendBias,
            String currentTrend,
            String trendReason,
            BigDecimal selectionScore,
            Long savedStrategyId,
            List<String> notes
    ) {
    }

    public record IntraStrategyAiGenerateResponse(
            String instrumentKey,
            String timeframeUnit,
            Integer timeframeInterval,
            java.time.LocalDate lookbackFromDate,
            java.time.LocalDate lookbackToDate,
            String latestTrendSignal,
            String generationSource,
            String disclaimer,
            Integer recommendedRank,
            List<IntraStrategyAiCandidate> candidates
    ) {
    }

    public record IntraStrategyLibraryResponse(
            List<IntraStrategyLibraryItem> content,
            long totalElements,
            int totalPages,
            int number,
            int size
    ) {
    }

    public record IntraStrategyLibraryItem(
            Long id,
            String strategyName,
            String instrumentKey,
            String timeframeUnit,
            Integer timeframeInterval,
            String strategyType,
            String status,
            Instant lastModifiedAt,
            String creator,
            Integer version,
            Boolean paperEligible,
            Boolean liveEligible,
            BigDecimal latestPerformancePnl,
            Integer latestExecutedTrades
    ) {
    }

    public record IntraStrategyValidationIssue(
            Integer step,
            String field,
            String message
    ) {
    }

    public record IntraStrategyValidationResult(
            boolean valid,
            boolean paperEligible,
            boolean liveEligible,
            List<IntraStrategyValidationIssue> fieldErrors,
            List<String> summaryErrors,
            List<String> warnings
    ) {
    }

    public record IntraStrategyVersionResponse(
            Long id,
            Long strategyId,
            Integer version,
            boolean advancedMode,
            String timeframeUnit,
            Integer timeframeInterval,
            AdminDtos.BacktestStrategyPayload strategy,
            IntraStrategyValidationResult validation,
            Instant createdAt,
            Instant validatedAt
    ) {
    }

    public record IntraStrategyDetailsResponse(
            IntraStrategyLibraryItem strategy,
            IntraStrategyVersionResponse latestVersion
    ) {
    }

    public record IntraStrategyActionResponse(
            String status,
            Long strategyId
    ) {
    }

    public record IntraStrategyImportResult(
            Long backtestStrategyId,
            Long intraStrategyId,
            String status,
            String message
    ) {
    }

    public record IntraStrategyImportResponse(
            List<IntraStrategyImportResult> results
    ) {
    }
}
