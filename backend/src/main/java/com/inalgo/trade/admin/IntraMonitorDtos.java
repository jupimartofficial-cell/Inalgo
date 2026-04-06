package com.inalgo.trade.admin;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

public final class IntraMonitorDtos {

    private IntraMonitorDtos() {
    }

    public record MarketSummaryResponse(
            String marketTrend,
            String sessionStatus,
            Instant refreshedAt,
            boolean stale,
            Integer freshnessSeconds,
            List<IndexValue> indexValues
    ) {
    }

    public record IndexValue(
            String instrumentKey,
            String label,
            BigDecimal value,
            Instant valueTs
    ) {
    }

    public record RuntimeSummary(
            Long runtimeId,
            Long executionId,
            Long strategyId,
            String strategyName,
            String instrument,
            String mode,
            String status,
            Instant entryTime,
            String currentSignal,
            BigDecimal currentMtm,
            String slState,
            String targetState,
            String nextExpectedAction,
            Instant refreshedAt,
            Integer freshnessSeconds
    ) {
    }

    public record PositionSummary(
            Long positionId,
            Long runtimeId,
            Long executionId,
            String instrument,
            BigDecimal quantityLots,
            BigDecimal entryPrice,
            BigDecimal currentPrice,
            BigDecimal unrealizedPnl,
            BigDecimal realizedPnl,
            BigDecimal sl,
            BigDecimal target,
            String strategyName,
            Long timeInTradeSeconds,
            String status,
            boolean manualWatch,
            String mode,
            Instant updatedAt
    ) {
    }

    public record EventLogItem(
            Long id,
            Instant eventTime,
            String eventType,
            String severity,
            String mode,
            String message,
            String reason,
            String actor,
            Long runtimeId,
            Long positionId,
            String correlationId
    ) {
    }

    public record LiveActionRequest(
            @NotNull Boolean confirmLiveAction,
            @NotBlank String liveAcknowledgement,
            @NotBlank String reason
    ) {
    }

    public record RuntimeActionResponse(
            String status,
            String message,
            Long runtimeId,
            Instant updatedAt
    ) {
    }

    public record PositionActionResponse(
            String status,
            String message,
            Long positionId,
            Instant updatedAt
    ) {
    }

    public record EmergencyActionRequest(
            @NotBlank String action,
            Long selectedRuntimeId,
            Boolean confirmLiveAction,
            String liveAcknowledgement,
            String reason
    ) {
    }

    public record EmergencyActionResponse(
            String status,
            String action,
            Integer affectedRuntimes,
            Integer affectedPositions,
            Instant executedAt
    ) {
    }

    public record RuntimeStateTransition(
            String fromStatus,
            String toStatus,
            String reason,
            Map<String, Object> before,
            Map<String, Object> after
    ) {
    }
}
