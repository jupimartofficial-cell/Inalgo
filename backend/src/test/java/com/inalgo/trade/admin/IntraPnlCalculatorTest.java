package com.inalgo.trade.admin;

import com.inalgo.trade.entity.IntraTradeExecutionEntity;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class IntraPnlCalculatorTest {

    private final IntraPnlCalculator calc = new IntraPnlCalculator();

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    // ─── filterExecutions ─────────────────────────────────────────────────────

    @Test
    void filter_excludesBacktestModeExecutions() {
        var rows = List.of(
                execution("BACKTEST", "COMPLETED", "2026-03-20T04:30:00Z", "S1", "NSE_INDEX|Nifty 50", new BigDecimal("500")),
                execution("PAPER",    "EXITED",    "2026-03-20T04:30:00Z", "S1", "NSE_INDEX|Nifty 50", new BigDecimal("300")));

        var result = calc.filterExecutions(rows, null, LocalDate.of(2026, 3, 1),
                LocalDate.of(2026, 3, 31), null, null, null, null, "t1", "admin");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getMode()).isEqualTo("PAPER");
    }

    @Test
    void filter_byMode_returnsOnlyMatchingMode() {
        var rows = List.of(
                execution("PAPER", "EXITED", "2026-03-20T04:30:00Z", "S1", "NSE_INDEX|Nifty 50", new BigDecimal("100")),
                execution("LIVE",  "EXITED", "2026-03-20T04:30:00Z", "S1", "NSE_INDEX|Nifty 50", new BigDecimal("200")));

        var result = calc.filterExecutions(rows, "PAPER", LocalDate.of(2026, 3, 1),
                LocalDate.of(2026, 3, 31), null, null, null, null, "t1", "admin");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getMode()).isEqualTo("PAPER");
    }

    @Test
    void filter_byDateRange_excludesOutOfRange() {
        var rows = List.of(
                execution("PAPER", "EXITED", "2026-03-05T04:30:00Z", "S1", "NSE_INDEX|Nifty 50", new BigDecimal("100")),
                execution("PAPER", "EXITED", "2026-03-20T04:30:00Z", "S1", "NSE_INDEX|Nifty 50", new BigDecimal("200")),
                execution("PAPER", "EXITED", "2026-03-25T04:30:00Z", "S1", "NSE_INDEX|Nifty 50", new BigDecimal("300")));

        var result = calc.filterExecutions(rows, null, LocalDate.of(2026, 3, 10),
                LocalDate.of(2026, 3, 23), null, null, null, null, "t1", "admin");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getTotalPnl()).isEqualByComparingTo("200");
    }

    @Test
    void filter_byStrategyName_caseInsensitivePartialMatch() {
        var rows = List.of(
                execution("PAPER", "EXITED", "2026-03-20T04:30:00Z", "Nifty Scalp",  "NSE_INDEX|Nifty 50", new BigDecimal("100")),
                execution("PAPER", "EXITED", "2026-03-20T04:30:00Z", "Sensex Break", "NSE_INDEX|Nifty 50", new BigDecimal("200")));

        var result = calc.filterExecutions(rows, null, LocalDate.of(2026, 3, 1),
                LocalDate.of(2026, 3, 31), "NIFTY", null, null, null, "t1", "admin");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getStrategyName()).isEqualTo("Nifty Scalp");
    }

    @Test
    void filter_byInstrument_exactMatch() {
        var rows = List.of(
                execution("PAPER", "EXITED", "2026-03-20T04:30:00Z", "S1", "NSE_INDEX|Nifty 50",  new BigDecimal("100")),
                execution("PAPER", "EXITED", "2026-03-20T04:30:00Z", "S2", "NSE_INDEX|Nifty Bank", new BigDecimal("200")));

        var result = calc.filterExecutions(rows, null, LocalDate.of(2026, 3, 1),
                LocalDate.of(2026, 3, 31), null, "NSE_INDEX|Nifty 50", null, null, "t1", "admin");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getScanInstrumentKey()).isEqualTo("NSE_INDEX|Nifty 50");
    }

    @Test
    void filter_byStatus_open_includesOpenStatuses() {
        var rows = List.of(
                execution("PAPER", "ENTERED",     "2026-03-20T04:30:00Z", "S1", "I", new BigDecimal("100")),
                execution("PAPER", "WAITING_ENTRY","2026-03-20T04:30:00Z", "S2", "I", new BigDecimal("50")),
                execution("PAPER", "EXITED",       "2026-03-20T04:30:00Z", "S3", "I", new BigDecimal("200")));

        var result = calc.filterExecutions(rows, null, LocalDate.of(2026, 3, 1),
                LocalDate.of(2026, 3, 31), null, null, "OPEN", null, "t1", "admin");

        assertThat(result).hasSize(2);
        assertThat(result).allMatch(e -> "ENTERED".equals(e.getStatus()) || "WAITING_ENTRY".equals(e.getStatus()));
    }

    @Test
    void filter_byAccountRef_matchesTenantUserDefault_whenNoAccountRefSet() {
        var e = execution("PAPER", "EXITED", "2026-03-20T04:30:00Z", "S1", "I", new BigDecimal("100"));
        e.setAccountRef(null);

        var result = calc.filterExecutions(List.of(e), null, LocalDate.of(2026, 3, 1),
                LocalDate.of(2026, 3, 31), null, null, null, "local-desktop:admin", "local-desktop", "admin");

        assertThat(result).hasSize(1);
    }

    // ─── buildSummary ─────────────────────────────────────────────────────────

    @Test
    void buildSummary_emptyList_returnsAllZeros() {
        var summary = calc.buildSummary(List.of());
        assertThat(summary.totalPnl()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(summary.winRate()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(summary.maxDrawdown()).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void buildSummary_calculatesTotalPnl() {
        var rows = List.of(
                executionWithPnl("EXITED",  new BigDecimal("500")),
                executionWithPnl("EXITED",  new BigDecimal("-200")),
                executionWithPnl("ENTERED", new BigDecimal("100")));

        var summary = calc.buildSummary(rows);

        assertThat(summary.totalPnl()).isEqualByComparingTo("400.00");
    }

    @Test
    void buildSummary_calculatesWinRate_3wins1loss() {
        var rows = List.of(
                executionWithPnl("EXITED", new BigDecimal("200")),
                executionWithPnl("EXITED", new BigDecimal("100")),
                executionWithPnl("EXITED", new BigDecimal("50")),
                executionWithPnl("EXITED", new BigDecimal("-300")));

        var summary = calc.buildSummary(rows);

        assertThat(summary.winRate()).isEqualByComparingTo("75.00");
    }

    @Test
    void buildSummary_separatesRealizedAndUnrealized() {
        var rows = List.of(
                executionWithPnlAndStatus("EXITED",  new BigDecimal("400")),
                executionWithPnlAndStatus("ENTERED", new BigDecimal("150")));

        var summary = calc.buildSummary(rows);

        assertThat(summary.realizedPnl()).isEqualByComparingTo("400.00");
        assertThat(summary.unrealizedPnl()).isEqualByComparingTo("150.00");
    }

    @Test
    void buildSummary_calculatesMaxDrawdown() {
        // Sequence: +200, -300 → peak=200, drawdown=300
        var e1 = executionWithTimedPnl("EXITED", new BigDecimal("200"),  "2026-03-20T04:30:00Z");
        var e2 = executionWithTimedPnl("EXITED", new BigDecimal("-300"), "2026-03-21T04:30:00Z");
        var e3 = executionWithTimedPnl("EXITED", new BigDecimal("100"),  "2026-03-22T04:30:00Z");

        var summary = calc.buildSummary(List.of(e1, e2, e3));

        assertThat(summary.maxDrawdown()).isEqualByComparingTo("300.00");
    }

    @Test
    void buildSummary_calculatesAvgGainAndAvgLoss() {
        var rows = List.of(
                executionWithPnl("EXITED", new BigDecimal("200")),
                executionWithPnl("EXITED", new BigDecimal("100")),
                executionWithPnl("EXITED", new BigDecimal("-150")),
                executionWithPnl("EXITED", new BigDecimal("-50")));

        var summary = calc.buildSummary(rows);

        assertThat(summary.avgGain()).isEqualByComparingTo("150.00");
        assertThat(summary.avgLoss()).isEqualByComparingTo("-100.00");
    }

    // ─── buildDailyTrend ──────────────────────────────────────────────────────

    @Test
    void buildDailyTrend_groupsByDateAndMode() {
        var rows = List.of(
                executionWithModeTimedPnl("PAPER", new BigDecimal("100"), "2026-03-20T04:30:00Z"),
                executionWithModeTimedPnl("PAPER", new BigDecimal("200"), "2026-03-20T04:45:00Z"),
                executionWithModeTimedPnl("LIVE",  new BigDecimal("300"), "2026-03-20T05:00:00Z"));

        var daily = calc.buildDailyTrend(rows);

        assertThat(daily).hasSize(2); // PAPER 2026-03-20 and LIVE 2026-03-20
        var paper = daily.stream().filter(p -> "PAPER".equals(p.mode())).findFirst().orElseThrow();
        assertThat(paper.value()).isEqualByComparingTo("300.00"); // 100+200
    }

    @Test
    void buildDailyTrend_sortedByDateAscending() {
        var rows = List.of(
                executionWithModeTimedPnl("PAPER", new BigDecimal("50"),  "2026-03-22T04:30:00Z"),
                executionWithModeTimedPnl("PAPER", new BigDecimal("100"), "2026-03-20T04:30:00Z"),
                executionWithModeTimedPnl("PAPER", new BigDecimal("75"),  "2026-03-21T04:30:00Z"));

        var daily = calc.buildDailyTrend(rows);

        assertThat(daily.get(0).date()).isEqualTo(LocalDate.of(2026, 3, 20));
        assertThat(daily.get(1).date()).isEqualTo(LocalDate.of(2026, 3, 21));
        assertThat(daily.get(2).date()).isEqualTo(LocalDate.of(2026, 3, 22));
    }

    // ─── buildCumulative ──────────────────────────────────────────────────────

    @Test
    void buildCumulative_runningSumPerMode() {
        var daily = List.of(
                new IntraPnlDtos.PnlChartPoint(LocalDate.of(2026, 3, 20), new BigDecimal("100"), "PAPER"),
                new IntraPnlDtos.PnlChartPoint(LocalDate.of(2026, 3, 21), new BigDecimal("150"), "PAPER"),
                new IntraPnlDtos.PnlChartPoint(LocalDate.of(2026, 3, 20), new BigDecimal("200"), "LIVE"));

        var cumul = calc.buildCumulative(daily);

        var paperLast = cumul.stream().filter(p -> "PAPER".equals(p.mode()))
                .reduce((a, b) -> b).orElseThrow();
        assertThat(paperLast.value()).isEqualByComparingTo("250.00"); // 100+150

        var liveLast = cumul.stream().filter(p -> "LIVE".equals(p.mode())).findFirst().orElseThrow();
        assertThat(liveLast.value()).isEqualByComparingTo("200.00");
    }

    // ─── buildStrategyPerformance ─────────────────────────────────────────────

    @Test
    void buildStrategyPerformance_groupsStrategiesAndSortsByTotalPnlDesc() {
        var rows = List.of(
                namedExecution("Scalp",  "PAPER", new BigDecimal("1000")),
                namedExecution("Swing",  "PAPER", new BigDecimal("2000")),
                namedExecution("Swing",  "PAPER", new BigDecimal("-500")),
                namedExecution("Scalp",  "PAPER", new BigDecimal("200")));

        var perf = calc.buildStrategyPerformance(rows);

        assertThat(perf).hasSize(2);
        assertThat(perf.get(0).strategyName()).isEqualTo("Swing"); // 1500 > 1200
        assertThat(perf.get(0).totalPnl()).isEqualByComparingTo("1500.00");
        assertThat(perf.get(1).strategyName()).isEqualTo("Scalp");
        assertThat(perf.get(1).totalPnl()).isEqualByComparingTo("1200.00");
    }

    @Test
    void buildStrategyPerformance_computesPaperLiveSplit() {
        var rows = List.of(
                namedExecutionWithMode("Scalp", "PAPER", new BigDecimal("100")),
                namedExecutionWithMode("Scalp", "PAPER", new BigDecimal("200")),
                namedExecutionWithMode("Scalp", "LIVE",  new BigDecimal("300")));

        var perf = calc.buildStrategyPerformance(rows);

        assertThat(perf.get(0).paperTrades()).isEqualTo(2);
        assertThat(perf.get(0).liveTrades()).isEqualTo(1);
    }

    // ─── buildTradeLedger ─────────────────────────────────────────────────────

    @Test
    void buildTradeLedger_inferExitReason_fromStatusMessage_manual() {
        var e = execution("PAPER", "EXITED", "2026-03-20T04:30:00Z", "S1", "I", new BigDecimal("100"));
        e.setStatusMessage("Position exited manually from Intra Monitor");
        e.setExitReason(null);

        var ledger = calc.buildTradeLedger(List.of(e), "t1", "admin");

        assertThat(ledger.get(0).exitReason()).isEqualTo("manual exit");
    }

    @Test
    void buildTradeLedger_inferExitReason_target_fromStatusMessage() {
        var e = execution("PAPER", "EXITED", "2026-03-20T04:30:00Z", "S1", "I", new BigDecimal("100"));
        e.setStatusMessage("target hit successfully");
        e.setExitReason(null);

        var ledger = calc.buildTradeLedger(List.of(e), "t1", "admin");

        assertThat(ledger.get(0).exitReason()).isEqualTo("target");
    }

    @Test
    void buildTradeLedger_inferExitReason_stopLoss_fromStatusMessage() {
        var e = execution("PAPER", "EXITED", "2026-03-20T04:30:00Z", "S1", "I", new BigDecimal("-200"));
        e.setStatusMessage("stop loss triggered");
        e.setExitReason(null);

        var ledger = calc.buildTradeLedger(List.of(e), "t1", "admin");

        assertThat(ledger.get(0).exitReason()).isEqualTo("stop loss");
    }

    @Test
    void buildTradeLedger_usesExplicitExitReason_whenPresent() {
        var e = execution("PAPER", "EXITED", "2026-03-20T04:30:00Z", "S1", "I", new BigDecimal("100"));
        e.setExitReason("trailing SL");

        var ledger = calc.buildTradeLedger(List.of(e), "t1", "admin");

        assertThat(ledger.get(0).exitReason()).isEqualTo("trailing SL");
    }

    @Test
    void buildTradeLedger_mapsStatusToOpenClosed() {
        var open   = execution("PAPER", "ENTERED", "2026-03-20T04:30:00Z", "S1", "I", new BigDecimal("100"));
        var closed = execution("PAPER", "EXITED",  "2026-03-20T04:30:00Z", "S2", "I", new BigDecimal("200"));

        var ledger = calc.buildTradeLedger(List.of(open, closed), "t1", "admin");

        assertThat(ledger.stream().filter(r -> "OPEN".equals(r.status()))).hasSize(1);
        assertThat(ledger.stream().filter(r -> "CLOSED".equals(r.status()))).hasSize(1);
    }

    // ─── isOpenStatus ─────────────────────────────────────────────────────────

    @Test
    void isOpenStatus_trueForOpenStates() {
        assertThat(calc.isOpenStatus("WAITING_ENTRY")).isTrue();
        assertThat(calc.isOpenStatus("ENTERED")).isTrue();
        assertThat(calc.isOpenStatus("PAUSED")).isTrue();
        assertThat(calc.isOpenStatus("PARTIAL_EXIT")).isTrue();
    }

    @Test
    void isOpenStatus_falseForClosedStates() {
        assertThat(calc.isOpenStatus("EXITED")).isFalse();
        assertThat(calc.isOpenStatus("COMPLETED")).isFalse();
        assertThat(calc.isOpenStatus("FAILED")).isFalse();
        assertThat(calc.isOpenStatus("ERROR")).isFalse();
    }

    // ─── isLivePaper ─────────────────────────────────────────────────────────

    @Test
    void isLivePaper_trueForLiveAndPaper() {
        assertThat(calc.isLivePaper("LIVE")).isTrue();
        assertThat(calc.isLivePaper("PAPER")).isTrue();
        assertThat(calc.isLivePaper("live")).isTrue();
        assertThat(calc.isLivePaper("paper")).isTrue();
    }

    @Test
    void isLivePaper_falseForBacktest() {
        assertThat(calc.isLivePaper("BACKTEST")).isFalse();
        assertThat(calc.isLivePaper(null)).isFalse();
    }

    // ─── safe ─────────────────────────────────────────────────────────────────

    @Test
    void safe_returnsZero_forNull() {
        assertThat(calc.safe(null)).isEqualByComparingTo("0.00");
    }

    @Test
    void safe_scalesTo2DecimalPlaces() {
        assertThat(calc.safe(new BigDecimal("123.456789"))).isEqualByComparingTo("123.46");
    }

    // ─── helpers ──────────────────────────────────────────────────────────────

    private IntraTradeExecutionEntity execution(
            String mode, String status, String evaluatedAt,
            String strategy, String instrument, BigDecimal pnl) {
        var e = new IntraTradeExecutionEntity("t1", "admin", 1L, mode, status, strategy,
                instrument, "minutes", 5, "{}", "{}", pnl, 1, null,
                Instant.parse(evaluatedAt));
        return e;
    }

    private IntraTradeExecutionEntity executionWithPnl(String status, BigDecimal pnl) {
        return execution("PAPER", status, "2026-03-20T04:30:00Z", "Strategy", "I", pnl);
    }

    private IntraTradeExecutionEntity executionWithPnlAndStatus(String status, BigDecimal pnl) {
        return execution("PAPER", status, "2026-03-20T04:30:00Z", "Strategy", "I", pnl);
    }

    private IntraTradeExecutionEntity executionWithTimedPnl(String status, BigDecimal pnl, String ts) {
        return execution("PAPER", status, ts, "Strategy", "I", pnl);
    }

    private IntraTradeExecutionEntity executionWithModeTimedPnl(String mode, BigDecimal pnl, String ts) {
        return execution(mode, "EXITED", ts, "Strategy", "I", pnl);
    }

    private IntraTradeExecutionEntity namedExecution(String name, String mode, BigDecimal pnl) {
        return execution(mode, "EXITED", "2026-03-20T04:30:00Z", name, "I", pnl);
    }

    private IntraTradeExecutionEntity namedExecutionWithMode(String name, String mode, BigDecimal pnl) {
        return execution(mode, "EXITED", "2026-03-20T04:30:00Z", name, "I", pnl);
    }
}
