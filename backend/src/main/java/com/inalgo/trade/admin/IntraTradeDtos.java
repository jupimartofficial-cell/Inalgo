package com.inalgo.trade.admin;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public final class IntraTradeDtos {

    private IntraTradeDtos() {
    }

    // ─── Order placement ─────────────────────────────────────────────────────

    public record IntraOrderPlaceRequest(
            @NotBlank String instrumentToken,
            @NotBlank String transactionType,
            @NotNull @Min(1) Integer quantity,
            String orderType,
            BigDecimal limitPrice,
            String tag,
            String executionId
    ) {}

    public record IntraOrderResult(
            String orderId,
            String instrumentToken,
            String transactionType,
            Integer quantity,
            String orderType,
            BigDecimal limitPrice,
            String tag,
            String status,
            String message
    ) {}

    public record IntraOrdersResponse(
            String tenantId,
            List<IntraOrderResult> orders,
            int count
    ) {}

    public record IntraPositionSummary(
            String instrumentToken,
            String tradingSymbol,
            Integer netQuantity,
            BigDecimal avgBuyPrice,
            BigDecimal avgSellPrice,
            BigDecimal ltp,
            BigDecimal pnl
    ) {}

    public record IntraPositionsResponse(
            String tenantId,
            List<IntraPositionSummary> positions,
            int count
    ) {}

    public record IntraTradeRunRequest(
            @NotBlank String username,
            Long strategyId,
            @NotBlank String mode,
            @NotBlank String scanInstrumentKey,
            @NotBlank String scanTimeframeUnit,
            @NotNull @Min(1) @Max(1440) Integer scanTimeframeInterval,
            @NotNull AdminDtos.BacktestStrategyPayload strategy
    ) {
    }

    public record IntraTradeTrendCheckResponse(
            boolean hasConflict,
            String strategyBias,
            String currentTrend,
            String message
    ) {
    }

    public record IntraTradeDeleteResponse(
            String status,
            Long id
    ) {
    }

    public record IntraTradeExecutionSummary(
            Long id,
            String username,
            Long strategyId,
            String mode,
            String status,
            String strategyName,
            String scanInstrumentKey,
            String scanTimeframeUnit,
            Integer scanTimeframeInterval,
            java.math.BigDecimal totalPnl,
            Integer executedTrades,
            Instant evaluatedAt,
            String statusMessage,
            Instant createdAt,
            Instant updatedAt
    ) {
    }

    public record IntraTradeExecutionResponse(
            Long id,
            String username,
            Long strategyId,
            String mode,
            String status,
            String strategyName,
            String scanInstrumentKey,
            String scanTimeframeUnit,
            Integer scanTimeframeInterval,
            String statusMessage,
            Instant evaluatedAt,
            Instant createdAt,
            Instant updatedAt,
            AdminDtos.BacktestStrategyPayload strategy,
            AdminDtos.BacktestRunResponse result
    ) {
    }
}
