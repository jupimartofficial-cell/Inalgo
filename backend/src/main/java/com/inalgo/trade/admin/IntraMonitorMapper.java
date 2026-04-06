package com.inalgo.trade.admin;

import com.inalgo.trade.entity.IntraPositionSnapshotEntity;
import com.inalgo.trade.repository.CandleRepository;
import com.inalgo.trade.repository.TradingSignalRepository;
import com.inalgo.trade.service.IndiaMarketHoursProperties;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Locale;

@Component
public class IntraMonitorMapper {

    private final TradingSignalRepository tradingSignalRepository;
    private final CandleRepository candleRepository;
    private final IndiaMarketHoursProperties marketHoursProperties;

    public IntraMonitorMapper(
            TradingSignalRepository tradingSignalRepository,
            CandleRepository candleRepository,
            IndiaMarketHoursProperties marketHoursProperties
    ) {
        this.tradingSignalRepository = tradingSignalRepository;
        this.candleRepository = candleRepository;
        this.marketHoursProperties = marketHoursProperties;
    }

    public String mapRuntimeStatus(String executionStatus) {
        String normalized = StringUtils.hasText(executionStatus) ? executionStatus.trim().toUpperCase(Locale.ROOT) : "WAITING";
        return switch (normalized) {
            case "WAITING_ENTRY" -> "WAITING";
            case "ENTERED" -> "ENTERED";
            case "PARTIAL_EXIT" -> "PARTIAL_EXIT";
            case "PAUSED" -> "PAUSED";
            case "FAILED" -> "ERROR";
            case "EXITED", "COMPLETED" -> "EXITED";
            default -> "WAITING";
        };
    }

    public String resolveTrend(String tenantId, List<String> instrumentKeys) {
        int buy = 0;
        int sell = 0;
        for (String instrument : instrumentKeys) {
            String signal = tradingSignalRepository
                    .findTopByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeIntervalAndSignalDateLessThanEqualOrderBySignalDateDescUpdatedAtDesc(
                            tenantId,
                            instrument,
                            "minutes",
                            5,
                            LocalDate.now(marketHoursProperties.zone())
                    )
                    .map(s -> s.getSignal() == null ? "" : s.getSignal().trim().toUpperCase(Locale.ROOT))
                    .orElse("");
            if ("BUY".equals(signal)) {
                buy++;
            } else if ("SELL".equals(signal)) {
                sell++;
            }
        }
        if (buy > sell) {
            return "UPTREND";
        }
        if (sell > buy) {
            return "DOWNTREND";
        }
        return "SIDEWAYS";
    }

    public String resolveSessionStatus(LocalDateTime now) {
        DayOfWeek day = now.getDayOfWeek();
        if (day == DayOfWeek.SATURDAY || day == DayOfWeek.SUNDAY) {
            return "Closed";
        }
        LocalTime open = marketHoursProperties.openTime();
        LocalTime close = marketHoursProperties.closeTime();
        if (now.toLocalTime().isBefore(open)) {
            return "Pre-open";
        }
        if (!now.toLocalTime().isBefore(close)) {
            return "Closed";
        }
        return "Open";
    }

    public Instant resolveEntryInstant(IntraTradeDtos.IntraTradeExecutionResponse execution) {
        if (execution.result() == null || execution.result().rows() == null || execution.result().rows().isEmpty()) {
            return execution.evaluatedAt();
        }
        AdminDtos.BacktestResultRow row = execution.result().rows().get(execution.result().rows().size() - 1);
        return parseInstant(row.entryTs());
    }

    public String resolveSignal(String tenantId, IntraTradeDtos.IntraTradeExecutionResponse execution) {
        LocalDate signalDate = parseInstant(execution.evaluatedAt()).atZone(marketHoursProperties.zone()).toLocalDate();
        String signal = tradingSignalRepository
                .findTopByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeIntervalAndSignalDateLessThanEqualOrderBySignalDateDescUpdatedAtDesc(
                        tenantId,
                        execution.scanInstrumentKey(),
                        execution.scanTimeframeUnit(),
                        execution.scanTimeframeInterval(),
                        signalDate
                )
                .map(s -> s.getSignal() == null ? null : s.getSignal().trim().toUpperCase(Locale.ROOT))
                .orElse(null);
        if (StringUtils.hasText(signal)) {
            return signal;
        }

        if (execution.result() == null || execution.result().notes() == null) {
            return "UNKNOWN";
        }
        String joined = execution.result().notes().stream().reduce("", (a, b) -> a + " " + b).toUpperCase(Locale.ROOT);
        if (joined.contains("BUY")) {
            return "BUY";
        }
        if (joined.contains("SELL")) {
            return "SELL";
        }
        if (joined.contains("HOLD")) {
            return "HOLD";
        }
        return "UNKNOWN";
    }

    public String resolveSlState(IntraTradeDtos.IntraTradeExecutionResponse execution) {
        if (execution.strategy() == null || execution.strategy().overallSettings() == null) {
            return "NA";
        }
        return execution.strategy().overallSettings().stopLossEnabled() ? "Armed" : "Disabled";
    }

    public String resolveTargetState(IntraTradeDtos.IntraTradeExecutionResponse execution) {
        if (execution.strategy() == null || execution.strategy().overallSettings() == null) {
            return "NA";
        }
        return execution.strategy().overallSettings().targetEnabled() ? "Armed" : "Disabled";
    }

    public BigDecimal resolveSlValue(IntraTradeDtos.IntraTradeExecutionResponse execution) {
        if (execution.strategy() == null || execution.strategy().overallSettings() == null || !execution.strategy().overallSettings().stopLossEnabled()) {
            return null;
        }
        return safe(execution.strategy().overallSettings().stopLossValue());
    }

    public BigDecimal resolveTargetValue(IntraTradeDtos.IntraTradeExecutionResponse execution) {
        if (execution.strategy() == null || execution.strategy().overallSettings() == null || !execution.strategy().overallSettings().targetEnabled()) {
            return null;
        }
        return safe(execution.strategy().overallSettings().targetValue());
    }

    public BigDecimal resolveLots(IntraTradeDtos.IntraTradeExecutionResponse execution) {
        if (execution.strategy() == null || execution.strategy().legs() == null || execution.strategy().legs().isEmpty()) {
            return BigDecimal.ONE.setScale(4, RoundingMode.HALF_UP);
        }
        int total = execution.strategy().legs().stream().mapToInt(l -> l.lots() == null ? 0 : l.lots()).sum();
        if (total <= 0) {
            total = 1;
        }
        return BigDecimal.valueOf(total).setScale(4, RoundingMode.HALF_UP);
    }

    public String resolveNextAction(String status) {
        return switch (status) {
            case "WAITING" -> "Await signal";
            case "ENTERED" -> "Monitor SL/target";
            case "PARTIAL_EXIT" -> "Manage residual";
            case "PAUSED" -> "Resume strategy";
            case "EXITED" -> "Review in P&L";
            case "ERROR" -> "Inspect event log";
            default -> "Await signal";
        };
    }

    public Instant parseInstant(String value) {
        if (!StringUtils.hasText(value)) {
            return Instant.now();
        }
        try {
            return Instant.parse(value);
        } catch (Exception ignored) {
            return Instant.now();
        }
    }

    public Instant parseInstant(Instant value) {
        return value == null ? Instant.now() : value;
    }

    public long resolveTimeInTradeSeconds(Instant entryTime) {
        if (entryTime == null) {
            return 0L;
        }
        return Math.max(0L, Duration.between(entryTime, Instant.now()).getSeconds());
    }

    public IntraMonitorDtos.PositionSummary toPositionSummary(IntraPositionSnapshotEntity row) {
        return new IntraMonitorDtos.PositionSummary(
                row.getId(),
                row.getRuntime() == null ? null : row.getRuntime().getId(),
                row.getExecutionId(),
                row.getInstrumentKey(),
                safeQty(row.getQuantityLots()),
                row.getEntryPrice(),
                row.getCurrentPrice(),
                safe(row.getUnrealizedPnl()),
                safe(row.getRealizedPnl()),
                row.getSlPrice(),
                row.getTargetPrice(),
                row.getStrategyName(),
                row.getTimeInTradeSeconds(),
                row.getStatus(),
                row.isManualWatch(),
                row.getMode(),
                row.getUpdatedAt()
        );
    }

    public BigDecimal toBigDecimal(BigDecimal value) {
        return value == null ? null : value.setScale(4, RoundingMode.HALF_UP);
    }

    public BigDecimal safe(BigDecimal value) {
        return value == null ? BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP) : value.setScale(2, RoundingMode.HALF_UP);
    }

    public BigDecimal safeQty(BigDecimal value) {
        return value == null ? BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP) : value.setScale(4, RoundingMode.HALF_UP);
    }

    public boolean isLivePaper(String mode) {
        return "LIVE".equalsIgnoreCase(mode) || "PAPER".equalsIgnoreCase(mode);
    }

    public String safeReason(String reason, String fallback) {
        return StringUtils.hasText(reason) ? reason.trim() : fallback;
    }

    public List<IntraMonitorDtos.IndexValue> resolveIndexValues(String tenantId, List<String> instrumentKeys) {
        return instrumentKeys.stream()
                .map(key -> candleRepository
                        .findTopByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeIntervalOrderByCandleTsDesc(tenantId, key, "days", 1)
                        .map(c -> new IntraMonitorDtos.IndexValue(key, key.replace("NSE_INDEX|", "").replace("BSE_INDEX|", ""), c.getClosePrice(), c.getCandleTs()))
                        .orElse(new IntraMonitorDtos.IndexValue(key, key, null, null)))
                .toList();
    }
}
