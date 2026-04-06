package com.inalgo.trade.admin;

import com.inalgo.trade.entity.IntraTradeExecutionEntity;
import com.inalgo.trade.repository.IntraPnlDailyRepository;
import com.inalgo.trade.repository.IntraTradeExecutionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class IntraPnlServiceTest {

    @Mock IntraTradeExecutionRepository executionRepository;
    @Mock IntraPnlDailyRepository       pnlDailyRepository;
    @Mock IntraPnlExportService         exportService;

    // Use real calculator for deterministic PnL maths
    private final IntraPnlCalculator calculator = new IntraPnlCalculator();

    private IntraPnlService service;

    private static final String TENANT = "local-desktop";
    private static final String USER   = "admin";

    @BeforeEach
    void setUp() {
        service = new IntraPnlService(executionRepository, pnlDailyRepository, calculator, exportService);
    }

    // ─── refreshDailyAggregates ───────────────────────────────────────────────

    @Test
    void refresh_ignoresBacktestExecutions() {
        var backtest = execution("BACKTEST", "COMPLETED", "2026-03-20T04:30:00Z", new BigDecimal("500"));
        when(executionRepository.findAllByTenantIdAndUsername(TENANT, USER)).thenReturn(List.of(backtest));

        service.refreshDailyAggregates(TENANT, USER);

        verify(pnlDailyRepository, never()).upsertDailyBucket(
                any(), any(), any(), any(), any(), any(), any(), anyInt(), anyInt(), anyInt(), any());
    }

    @Test
    void refresh_deletesOldBucketsAndRebuilds() {
        var e1 = execution("PAPER", "EXITED", "2026-03-20T04:30:00Z", new BigDecimal("300"));
        var e2 = execution("PAPER", "EXITED", "2026-03-21T04:30:00Z", new BigDecimal("200"));
        when(executionRepository.findAllByTenantIdAndUsername(TENANT, USER)).thenReturn(List.of(e1, e2));

        service.refreshDailyAggregates(TENANT, USER);

        verify(pnlDailyRepository).deleteAllByTenantIdAndUsername(TENANT, USER);
        verify(pnlDailyRepository, atLeastOnce()).upsertDailyBucket(
                any(), any(), any(), any(), any(), any(), any(), anyInt(), anyInt(), anyInt(), any());
    }

    @Test
    void refresh_createsSeparateBucketsPerMode() {
        var paper = execution("PAPER", "EXITED", "2026-03-20T04:30:00Z", new BigDecimal("100"));
        var live  = execution("LIVE",  "EXITED", "2026-03-20T04:30:00Z", new BigDecimal("200"));
        when(executionRepository.findAllByTenantIdAndUsername(TENANT, USER)).thenReturn(List.of(paper, live));

        service.refreshDailyAggregates(TENANT, USER);

        // One bucket per mode per date = 2 upserts
        ArgumentCaptor<String> modeCaptor = ArgumentCaptor.forClass(String.class);
        verify(pnlDailyRepository, atLeastOnce()).upsertDailyBucket(
                any(), any(), modeCaptor.capture(), any(), any(), any(), any(), anyInt(), anyInt(), anyInt(), any());
        assertThat(modeCaptor.getAllValues().stream().distinct()).hasSize(2);
    }

    @Test
    void refresh_correctlyClassifiesRealizedVsUnrealized() {
        var closed = execution("PAPER", "EXITED",  "2026-03-20T04:30:00Z", new BigDecimal("400"));
        var open   = execution("PAPER", "ENTERED", "2026-03-20T04:45:00Z", new BigDecimal("150"));
        when(executionRepository.findAllByTenantIdAndUsername(TENANT, USER)).thenReturn(List.of(closed, open));

        service.refreshDailyAggregates(TENANT, USER);

        ArgumentCaptor<BigDecimal> realizedCaptor    = ArgumentCaptor.forClass(BigDecimal.class);
        ArgumentCaptor<BigDecimal> unrealizedCaptor  = ArgumentCaptor.forClass(BigDecimal.class);
        ArgumentCaptor<BigDecimal> totalCaptor       = ArgumentCaptor.forClass(BigDecimal.class);
        verify(pnlDailyRepository).upsertDailyBucket(
                any(), any(), any(), any(),
                realizedCaptor.capture(), unrealizedCaptor.capture(), totalCaptor.capture(),
                anyInt(), anyInt(), anyInt(), any());

        assertThat(realizedCaptor.getValue()).isEqualByComparingTo("400.00");
        assertThat(unrealizedCaptor.getValue()).isEqualByComparingTo("150.00");
        assertThat(totalCaptor.getValue()).isEqualByComparingTo("550.00");
    }

    @Test
    void refresh_computesWinLossCounts() {
        var win1  = execution("PAPER", "EXITED", "2026-03-20T04:30:00Z", new BigDecimal("200"));
        var win2  = execution("PAPER", "EXITED", "2026-03-20T04:35:00Z", new BigDecimal("100"));
        var loss1 = execution("PAPER", "EXITED", "2026-03-20T04:40:00Z", new BigDecimal("-150"));
        when(executionRepository.findAllByTenantIdAndUsername(TENANT, USER)).thenReturn(List.of(win1, win2, loss1));

        service.refreshDailyAggregates(TENANT, USER);

        ArgumentCaptor<Integer> winCaptor  = ArgumentCaptor.forClass(Integer.class);
        ArgumentCaptor<Integer> lossCaptor = ArgumentCaptor.forClass(Integer.class);
        verify(pnlDailyRepository).upsertDailyBucket(
                any(), any(), any(), any(), any(), any(), any(),
                anyInt(), winCaptor.capture(), lossCaptor.capture(), any());

        assertThat(winCaptor.getValue()).isEqualTo(2);
        assertThat(lossCaptor.getValue()).isEqualTo(1);
    }

    // ─── dashboard ────────────────────────────────────────────────────────────

    @Test
    void dashboard_buildsAllFiveComponents() {
        var rows = List.of(
                execution("PAPER", "EXITED", "2026-03-20T04:30:00Z", new BigDecimal("300")),
                execution("LIVE",  "EXITED", "2026-03-21T04:30:00Z", new BigDecimal("500")));
        when(executionRepository.findAllByTenantIdAndUsername(TENANT, USER)).thenReturn(rows);

        var dashboard = service.dashboard(TENANT, USER, null, null, null, null, null, null, null);

        assertThat(dashboard.summary()).isNotNull();
        assertThat(dashboard.dailyTrend()).isNotNull();
        assertThat(dashboard.cumulative()).isNotNull();
        assertThat(dashboard.strategyPerformance()).isNotNull();
        assertThat(dashboard.tradeLedger()).isNotNull();
    }

    @Test
    void dashboard_defaultsToLast30Days_whenDatesNull() {
        var recent  = execution("PAPER", "EXITED", "2026-03-20T04:30:00Z", new BigDecimal("200"));
        var farPast = execution("PAPER", "EXITED", "2025-12-01T04:30:00Z", new BigDecimal("999"));
        when(executionRepository.findAllByTenantIdAndUsername(TENANT, USER)).thenReturn(List.of(recent, farPast));

        var dashboard = service.dashboard(TENANT, USER, null, null, null, null, null, null, null);

        assertThat(dashboard.tradeLedger()).hasSize(1);
        assertThat(dashboard.tradeLedger().get(0).pnl()).isEqualByComparingTo("200");
    }

    @Test
    void dashboard_filteredByMode_returnsOnlyMatchingMode() {
        var paper = execution("PAPER", "EXITED", "2026-03-20T04:30:00Z", new BigDecimal("100"));
        var live  = execution("LIVE",  "EXITED", "2026-03-20T04:30:00Z", new BigDecimal("200"));
        when(executionRepository.findAllByTenantIdAndUsername(TENANT, USER)).thenReturn(List.of(paper, live));

        var dashboard = service.dashboard(TENANT, USER, "PAPER",
                LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 31),
                null, null, null, null);

        assertThat(dashboard.tradeLedger()).hasSize(1);
        assertThat(dashboard.tradeLedger().get(0).tradeMode()).isEqualTo("PAPER");
    }

    @Test
    void dashboard_summaryReflectsFilteredData() {
        var win  = execution("PAPER", "EXITED", "2026-03-20T04:30:00Z", new BigDecimal("300"));
        var loss = execution("PAPER", "EXITED", "2026-03-20T04:35:00Z", new BigDecimal("-100"));
        when(executionRepository.findAllByTenantIdAndUsername(TENANT, USER)).thenReturn(List.of(win, loss));

        var dashboard = service.dashboard(TENANT, USER, "PAPER",
                LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 31),
                null, null, null, null);

        assertThat(dashboard.summary().totalPnl()).isEqualByComparingTo("200.00");
        assertThat(dashboard.summary().winRate()).isEqualByComparingTo("50.00");
    }

    // ─── helpers ──────────────────────────────────────────────────────────────

    private IntraTradeExecutionEntity execution(
            String mode, String status, String evaluatedAt, BigDecimal pnl) {
        return new IntraTradeExecutionEntity(
                TENANT, USER, 1L, mode, status, "Strategy",
                "NSE_INDEX|Nifty 50", "minutes", 5, "{}", "{}",
                pnl, 1, null, Instant.parse(evaluatedAt));
    }
}
