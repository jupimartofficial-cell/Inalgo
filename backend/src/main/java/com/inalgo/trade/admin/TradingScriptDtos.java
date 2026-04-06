package com.inalgo.trade.admin;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

public final class TradingScriptDtos {

    private TradingScriptDtos() {
    }

    public record TradingScriptBuilderPayload(
            @NotBlank @Size(max = 50000) String sourceJs
    ) {
    }

    public record TradingScriptCreateDraftRequest(
            @NotBlank String username,
            @NotNull @Valid TradingScriptBuilderPayload builder
    ) {
    }

    public record TradingScriptUpdateDraftRequest(
            @NotBlank String username,
            @NotNull @Valid TradingScriptBuilderPayload builder
    ) {
    }

    public record TradingScriptCompileRequest(
            @NotBlank String username
    ) {
    }

    public record TradingScriptValidateRequest(
            @NotBlank String username
    ) {
    }

    public record TradingScriptPublishRequest(
            @NotBlank String username,
            @NotBlank String targetStatus
    ) {
    }

    public record TradingScriptDuplicateRequest(
            @NotBlank String username
    ) {
    }

    public record TradingScriptArchiveRequest(
            @NotBlank String username
    ) {
    }

    public record TradingScriptDiagnostic(
            String severity,
            String code,
            String message,
            Integer line,
            Integer column,
            Integer endLine,
            Integer endColumn
    ) {
    }

    public record TradingScriptInputDescriptor(
            String key,
            String label,
            String type,
            Object defaultValue,
            Boolean required,
            String description
    ) {
    }

    public record TradingScriptMeta(
            String name,
            String instrumentKey,
            String timeframeUnit,
            Integer timeframeInterval,
            String strategyType,
            String marketSession
    ) {
    }

    public record TradingScriptCompiledArtifact(
            TradingScriptMeta meta,
            List<TradingScriptInputDescriptor> inputs,
            AdminDtos.BacktestStrategyPayload compiledStrategy,
            List<String> imports,
            List<String> notes,
            Map<String, Object> runtimeHints,
            String sourceHash
    ) {
    }

    public record TradingScriptCompileResponse(
            String compileStatus,
            boolean valid,
            boolean paperEligible,
            boolean liveEligible,
            List<TradingScriptDiagnostic> diagnostics,
            TradingScriptCompiledArtifact artifact,
            List<String> warnings
    ) {
    }

    public record TradingScriptBacktestSummary(
            BigDecimal totalPnl,
            BigDecimal averagePnl,
            Integer executedTrades,
            Integer winTrades,
            Integer lossTrades,
            BigDecimal realWorldAccuracyPct,
            Integer marketPricedTrades,
            Integer fallbackPricedTrades,
            Instant evaluatedAt,
            List<String> notes
    ) {
    }

    public record TradingScriptLibraryItem(
            Long id,
            String scriptName,
            String instrumentKey,
            String timeframeUnit,
            Integer timeframeInterval,
            String strategyType,
            String status,
            String compileStatus,
            Instant lastModifiedAt,
            String creator,
            Integer version,
            Boolean paperEligible,
            Boolean liveEligible,
            BigDecimal latestPerformancePnl,
            Integer latestExecutedTrades,
            BigDecimal latestRealWorldAccuracyPct
    ) {
    }

    public record TradingScriptVersionResponse(
            Long id,
            Long scriptId,
            Integer version,
            String sourceJs,
            TradingScriptCompileResponse compile,
            Instant createdAt,
            Instant compiledAt
    ) {
    }

    public record TradingScriptDetailsResponse(
            TradingScriptLibraryItem script,
            TradingScriptVersionResponse latestVersion,
            TradingScriptBacktestSummary latestBacktest
    ) {
    }

    public record TradingScriptLibraryResponse(
            List<TradingScriptLibraryItem> content,
            long totalElements,
            int totalPages,
            int number,
            int size
    ) {
    }

    public record TradingScriptActionResponse(
            String status,
            Long scriptId
    ) {
    }

    public record TradingScriptBacktestResponse(
            TradingScriptBacktestSummary summary,
            AdminDtos.BacktestRunResponse result
    ) {
    }
}
