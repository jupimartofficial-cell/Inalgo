package com.inalgo.trade.admin;

import com.inalgo.trade.entity.IntraTradeExecutionEntity;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Component
public class IntraPnlCalculator {

    private static final ZoneId MARKET_ZONE = ZoneId.of("Asia/Kolkata");

    public List<IntraTradeExecutionEntity> filterExecutions(
            List<IntraTradeExecutionEntity> source,
            String mode,
            LocalDate from,
            LocalDate to,
            String strategy,
            String instrument,
            String status,
            String account,
            String tenantId,
            String username
    ) {
        return source.stream()
                .filter(e -> isLivePaper(e.getMode()))
                .filter(e -> !StringUtils.hasText(mode) || mode.equalsIgnoreCase(e.getMode()))
                .filter(e -> {
                    LocalDate date = resolveTradeInstant(e).atZone(MARKET_ZONE).toLocalDate();
                    return !date.isBefore(from) && !date.isAfter(to);
                })
                .filter(e -> !StringUtils.hasText(strategy) || e.getStrategyName().toLowerCase(Locale.ROOT).contains(strategy.toLowerCase(Locale.ROOT)))
                .filter(e -> !StringUtils.hasText(instrument) || e.getScanInstrumentKey().equalsIgnoreCase(instrument))
                .filter(e -> !StringUtils.hasText(status) || mapOpenClosed(e.getStatus()).equalsIgnoreCase(status))
                .filter(e -> {
                    String ref = StringUtils.hasText(e.getAccountRef()) ? e.getAccountRef() : tenantId + ":" + username;
                    return !StringUtils.hasText(account) || account.equalsIgnoreCase(ref);
                })
                .sorted(Comparator.comparing(this::resolveTradeInstant).reversed())
                .toList();
    }

    public IntraPnlDtos.PnlSummary buildSummary(List<IntraTradeExecutionEntity> rows) {
        BigDecimal total = rows.stream().map(e -> safe(e.getTotalPnl())).reduce(BigDecimal.ZERO, BigDecimal::add);
        LocalDate today = LocalDate.now(MARKET_ZONE);
        BigDecimal todayPnl = rows.stream()
                .filter(e -> resolveTradeInstant(e).atZone(MARKET_ZONE).toLocalDate().equals(today))
                .map(e -> safe(e.getTotalPnl()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal realized = rows.stream()
                .filter(e -> !isOpenStatus(e.getStatus()))
                .map(e -> safe(e.getTotalPnl()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal unrealized = rows.stream()
                .filter(e -> isOpenStatus(e.getStatus()))
                .map(e -> safe(e.getTotalPnl()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<BigDecimal> gains = rows.stream().map(e -> safe(e.getTotalPnl())).filter(v -> v.signum() > 0).toList();
        List<BigDecimal> losses = rows.stream().map(e -> safe(e.getTotalPnl())).filter(v -> v.signum() < 0).toList();
        int wins = gains.size();
        int totalTrades = rows.size();
        BigDecimal winRate = totalTrades == 0
                ? BigDecimal.ZERO
                : BigDecimal.valueOf((wins * 100.0) / totalTrades).setScale(2, RoundingMode.HALF_UP);

        BigDecimal avgGain = gains.isEmpty() ? BigDecimal.ZERO : gains.stream().reduce(BigDecimal.ZERO, BigDecimal::add)
                .divide(BigDecimal.valueOf(gains.size()), 2, RoundingMode.HALF_UP);
        BigDecimal avgLoss = losses.isEmpty() ? BigDecimal.ZERO : losses.stream().reduce(BigDecimal.ZERO, BigDecimal::add)
                .divide(BigDecimal.valueOf(losses.size()), 2, RoundingMode.HALF_UP);

        BigDecimal cumulative = BigDecimal.ZERO;
        BigDecimal peak = BigDecimal.ZERO;
        BigDecimal maxDrawdown = BigDecimal.ZERO;
        List<IntraTradeExecutionEntity> chron = new ArrayList<>(rows);
        chron.sort(Comparator.comparing(this::resolveTradeInstant));
        for (IntraTradeExecutionEntity row : chron) {
            cumulative = cumulative.add(safe(row.getTotalPnl()));
            peak = peak.max(cumulative);
            maxDrawdown = maxDrawdown.max(peak.subtract(cumulative));
        }

        return new IntraPnlDtos.PnlSummary(
                total.setScale(2, RoundingMode.HALF_UP),
                todayPnl.setScale(2, RoundingMode.HALF_UP),
                realized.setScale(2, RoundingMode.HALF_UP),
                unrealized.setScale(2, RoundingMode.HALF_UP),
                winRate,
                avgGain,
                avgLoss,
                maxDrawdown.setScale(2, RoundingMode.HALF_UP)
        );
    }

    public List<IntraPnlDtos.PnlChartPoint> buildDailyTrend(List<IntraTradeExecutionEntity> rows) {
        Map<String, BigDecimal> map = new LinkedHashMap<>();
        for (IntraTradeExecutionEntity row : rows) {
            LocalDate date = resolveTradeInstant(row).atZone(MARKET_ZONE).toLocalDate();
            String key = date + "|" + row.getMode();
            map.put(key, map.getOrDefault(key, BigDecimal.ZERO).add(safe(row.getTotalPnl())));
        }
        return map.entrySet().stream()
                .map(e -> {
                    String[] split = e.getKey().split("\\|");
                    return new IntraPnlDtos.PnlChartPoint(LocalDate.parse(split[0]), e.getValue().setScale(2, RoundingMode.HALF_UP), split[1]);
                })
                .sorted(Comparator.comparing(IntraPnlDtos.PnlChartPoint::date))
                .toList();
    }

    public List<IntraPnlDtos.PnlChartPoint> buildCumulative(List<IntraPnlDtos.PnlChartPoint> daily) {
        Map<String, BigDecimal> running = new HashMap<>();
        List<IntraPnlDtos.PnlChartPoint> result = new ArrayList<>();
        for (IntraPnlDtos.PnlChartPoint point : daily) {
            BigDecimal next = running.getOrDefault(point.mode(), BigDecimal.ZERO).add(point.value());
            running.put(point.mode(), next);
            result.add(new IntraPnlDtos.PnlChartPoint(point.date(), next.setScale(2, RoundingMode.HALF_UP), point.mode()));
        }
        return result;
    }

    public List<IntraPnlDtos.StrategyPerformanceRow> buildStrategyPerformance(List<IntraTradeExecutionEntity> rows) {
        Map<String, List<IntraTradeExecutionEntity>> grouped = rows.stream().collect(Collectors.groupingBy(IntraTradeExecutionEntity::getStrategyName));
        List<IntraPnlDtos.StrategyPerformanceRow> output = new ArrayList<>();
        for (Map.Entry<String, List<IntraTradeExecutionEntity>> entry : grouped.entrySet()) {
            List<IntraTradeExecutionEntity> strategyRows = entry.getValue();
            BigDecimal total = strategyRows.stream().map(e -> safe(e.getTotalPnl())).reduce(BigDecimal.ZERO, BigDecimal::add);
            int trades = strategyRows.size();
            int wins = (int) strategyRows.stream().filter(e -> safe(e.getTotalPnl()).signum() > 0).count();
            BigDecimal winRate = trades == 0 ? BigDecimal.ZERO : BigDecimal.valueOf((wins * 100.0) / trades).setScale(2, RoundingMode.HALF_UP);
            BigDecimal avg = trades == 0 ? BigDecimal.ZERO : total.divide(BigDecimal.valueOf(trades), 2, RoundingMode.HALF_UP);
            BigDecimal maxWin = strategyRows.stream().map(e -> safe(e.getTotalPnl())).max(Comparator.naturalOrder()).orElse(BigDecimal.ZERO);
            BigDecimal maxLoss = strategyRows.stream().map(e -> safe(e.getTotalPnl())).min(Comparator.naturalOrder()).orElse(BigDecimal.ZERO);
            BigDecimal dd = computeDrawdown(strategyRows);
            int paperTrades = (int) strategyRows.stream().filter(e -> "PAPER".equalsIgnoreCase(e.getMode())).count();
            int liveTrades = (int) strategyRows.stream().filter(e -> "LIVE".equalsIgnoreCase(e.getMode())).count();

            output.add(new IntraPnlDtos.StrategyPerformanceRow(
                    entry.getKey(),
                    trades,
                    winRate,
                    total.setScale(2, RoundingMode.HALF_UP),
                    avg,
                    maxWin.setScale(2, RoundingMode.HALF_UP),
                    maxLoss.setScale(2, RoundingMode.HALF_UP),
                    dd,
                    paperTrades,
                    liveTrades
            ));
        }

        output.sort(Comparator.comparing(IntraPnlDtos.StrategyPerformanceRow::totalPnl).reversed());
        return output;
    }

    public List<IntraPnlDtos.TradeLedgerRow> buildTradeLedger(List<IntraTradeExecutionEntity> rows, String tenantId, String username) {
        DateTimeFormatter timeFmt = DateTimeFormatter.ofPattern("HH:mm");
        return rows.stream().map(row -> {
            Instant tradeInstant = resolveTradeInstant(row);
            LocalDate date = tradeInstant.atZone(MARKET_ZONE).toLocalDate();
            String time = tradeInstant.atZone(MARKET_ZONE).toLocalTime().format(timeFmt);
            BigDecimal qty = BigDecimal.valueOf(Math.max(1, Optional.ofNullable(row.getExecutedTrades()).orElse(0)));
            String reason = StringUtils.hasText(row.getExitReason()) ? row.getExitReason() : inferExitReason(row);
            String status = mapOpenClosed(row.getStatus());
            String duration = row.getStatus().equals("WAITING_ENTRY") ? "00:00" : "--";
            String account = StringUtils.hasText(row.getAccountRef()) ? row.getAccountRef() : tenantId + ":" + username;
            return new IntraPnlDtos.TradeLedgerRow(
                    row.getId(),
                    date,
                    time,
                    row.getScanInstrumentKey(),
                    row.getStrategyName(),
                    row.getMode(),
                    null,
                    null,
                    qty,
                    safe(row.getTotalPnl()),
                    reason,
                    duration,
                    status,
                    account
            );
        }).toList();
    }

    public Instant resolveTradeInstant(IntraTradeExecutionEntity execution) {
        return execution.getEvaluatedAt() == null ? Optional.ofNullable(execution.getUpdatedAt()).orElse(Instant.now()) : execution.getEvaluatedAt();
    }

    public boolean isOpenStatus(String status) {
        return "WAITING_ENTRY".equals(status) || "ENTERED".equals(status) || "PAUSED".equals(status) || "PARTIAL_EXIT".equals(status);
    }

    public boolean isLivePaper(String mode) {
        return "LIVE".equalsIgnoreCase(mode) || "PAPER".equalsIgnoreCase(mode);
    }

    public BigDecimal safe(BigDecimal value) {
        return value == null ? BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP) : value.setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal computeDrawdown(List<IntraTradeExecutionEntity> rows) {
        List<IntraTradeExecutionEntity> chron = new ArrayList<>(rows);
        chron.sort(Comparator.comparing(this::resolveTradeInstant));
        BigDecimal cumulative = BigDecimal.ZERO;
        BigDecimal peak = BigDecimal.ZERO;
        BigDecimal max = BigDecimal.ZERO;
        for (IntraTradeExecutionEntity row : chron) {
            cumulative = cumulative.add(safe(row.getTotalPnl()));
            peak = peak.max(cumulative);
            max = max.max(peak.subtract(cumulative));
        }
        return max.setScale(2, RoundingMode.HALF_UP);
    }

    private String inferExitReason(IntraTradeExecutionEntity row) {
        if (!StringUtils.hasText(row.getStatusMessage())) {
            return "strategy exit";
        }
        String normalized = row.getStatusMessage().toLowerCase(Locale.ROOT);
        if (normalized.contains("manual")) {
            return "manual exit";
        }
        if (normalized.contains("target")) {
            return "target";
        }
        if (normalized.contains("stop")) {
            return "stop loss";
        }
        if (normalized.contains("trail")) {
            return "trailing SL";
        }
        return "strategy exit";
    }

    private String mapOpenClosed(String status) {
        String normalized = StringUtils.hasText(status) ? status.trim().toUpperCase(Locale.ROOT) : "";
        return switch (normalized) {
            case "WAITING_ENTRY", "ENTERED", "PAUSED", "PARTIAL_EXIT" -> "OPEN";
            default -> "CLOSED";
        };
    }
}
