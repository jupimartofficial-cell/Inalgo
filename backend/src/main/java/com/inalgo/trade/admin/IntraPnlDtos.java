package com.inalgo.trade.admin;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public final class IntraPnlDtos {

    private IntraPnlDtos() {
    }

    public record PnlSummary(
            BigDecimal totalPnl,
            BigDecimal todayPnl,
            BigDecimal realizedPnl,
            BigDecimal unrealizedPnl,
            BigDecimal winRate,
            BigDecimal avgGain,
            BigDecimal avgLoss,
            BigDecimal maxDrawdown
    ) {
    }

    public record PnlChartPoint(
            LocalDate date,
            BigDecimal value,
            String mode
    ) {
    }

    public record StrategyPerformanceRow(
            String strategyName,
            Integer numberOfTrades,
            BigDecimal winRate,
            BigDecimal totalPnl,
            BigDecimal avgTrade,
            BigDecimal maxWin,
            BigDecimal maxLoss,
            BigDecimal drawdown,
            Integer paperTrades,
            Integer liveTrades
    ) {
    }

    public record TradeLedgerRow(
            Long executionId,
            LocalDate date,
            String time,
            String instrument,
            String strategy,
            String tradeMode,
            BigDecimal entry,
            BigDecimal exit,
            BigDecimal quantity,
            BigDecimal pnl,
            String exitReason,
            String duration,
            String status,
            String account
    ) {
    }

    public record PnlDashboardResponse(
            PnlSummary summary,
            List<PnlChartPoint> dailyTrend,
            List<PnlChartPoint> cumulative,
            List<StrategyPerformanceRow> strategyPerformance,
            List<TradeLedgerRow> tradeLedger
    ) {
    }
}
