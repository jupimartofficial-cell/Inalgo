package com.inalgo.trade.admin;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.inalgo.trade.entity.IntraTradeExecutionEntity;
import com.inalgo.trade.repository.IntraRuntimeStrategyRepository;
import com.inalgo.trade.repository.IntraTradeExecutionRepository;
import com.inalgo.trade.service.IndiaMarketHoursProperties;
import jakarta.validation.ValidationException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class IntraTradeServiceTest {

    @Mock
    private IntraTradeExecutionRepository intraTradeExecutionRepository;

    @Mock
    private IntraRuntimeStrategyRepository intraRuntimeStrategyRepository;

    @Mock
    private BacktestStrategyService backtestStrategyService;

    @Mock
    private BacktestRunService backtestRunService;

    @Mock
    private IntraTradeTrendAdvisor trendAdvisor;

    @Test
    void runExecution_backtestPersistsCompletedSnapshot() {
        IntraTradeService service = serviceAt("2026-03-22T10:20:00Z");
        AdminDtos.BacktestStrategyPayload strategy = strategy("Swing to scalp", "INTRADAY");
        AdminDtos.BacktestRunResponse result = result(strategy, 2, new BigDecimal("1420.50"), List.of("Historical run"));
        when(backtestStrategyService.normalizeStrategyPayload(strategy)).thenReturn(strategy);
        when(backtestRunService.runBacktest(eq("tenant-a"), any(AdminDtos.BacktestRunRequest.class))).thenReturn(result);
        when(intraTradeExecutionRepository.save(any(IntraTradeExecutionEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        IntraTradeDtos.IntraTradeExecutionResponse response = service.runExecution(
                "tenant-a",
                new IntraTradeDtos.IntraTradeRunRequest(
                        "admin",
                        7L,
                        "BACKTEST",
                        "NSE_INDEX|Nifty 50",
                        "days",
                        1,
                        strategy
                )
        );

        assertEquals("COMPLETED", response.status());
        assertEquals(2, response.result().executedTrades());
        assertEquals(new BigDecimal("1420.50"), response.result().totalPnl());

        ArgumentCaptor<IntraTradeExecutionEntity> captor = ArgumentCaptor.forClass(IntraTradeExecutionEntity.class);
        verify(intraTradeExecutionRepository).save(captor.capture());
        assertEquals("BACKTEST", captor.getValue().getMode());
        assertEquals("COMPLETED", captor.getValue().getStatus());
        assertEquals("NSE_INDEX|Nifty 50", captor.getValue().getScanInstrumentKey());
    }

    @Test
    void runExecution_liveBeforeEntryReturnsWaitingEntrySnapshot() {
        IntraTradeService service = serviceAt("2026-03-23T03:20:00Z");
        AdminDtos.BacktestStrategyPayload strategy = strategy("Morning breakout", "INTRADAY");
        when(backtestStrategyService.normalizeStrategyPayload(strategy)).thenReturn(strategy);
        when(intraTradeExecutionRepository.save(any(IntraTradeExecutionEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        IntraTradeDtos.IntraTradeExecutionResponse response = service.runExecution(
                "tenant-a",
                new IntraTradeDtos.IntraTradeRunRequest(
                        "admin",
                        null,
                        "LIVE",
                        "NSE_INDEX|Nifty 50",
                        "minutes",
                        5,
                        strategy
                )
        );

        assertEquals("WAITING_ENTRY", response.status());
        assertEquals(0, response.result().executedTrades());
        assertEquals("Waiting for the configured entry window", response.statusMessage());
    }

    @Test
    void runExecution_liveRejectsDuplicateActiveRuntime() {
        IntraTradeService service = serviceAt("2026-03-23T03:20:00Z");
        AdminDtos.BacktestStrategyPayload strategy = strategy("Duplicate live", "INTRADAY");
        when(intraRuntimeStrategyRepository.existsByTenantIdAndUsernameAndStrategyIdAndModeAndStatusIn(
                eq("tenant-a"),
                eq("admin"),
                eq(7L),
                eq("LIVE"),
                any()
        )).thenReturn(true);

        ValidationException error = assertThrows(
                ValidationException.class,
                () -> service.runExecution(
                        "tenant-a",
                        new IntraTradeDtos.IntraTradeRunRequest(
                                "admin",
                                7L,
                                "LIVE",
                                "NSE_INDEX|Nifty 50",
                                "minutes",
                                5,
                                strategy
                        )
                )
        );

        assertEquals("Live strategy is already running. Resume or exit the active runtime first.", error.getMessage());
    }

    @Test
    void runExecution_liveRejectsNonOptionStrategies() {
        IntraTradeService service = serviceAt("2026-03-23T05:50:00Z");
        AdminDtos.BacktestStrategyPayload strategy = new AdminDtos.BacktestStrategyPayload(
                "Futures strategy",
                "NSE_INDEX|Nifty 50",
                "FUTURES",
                "INTRADAY",
                LocalTime.of(9, 35),
                LocalTime.of(15, 15),
                LocalDate.of(2026, 3, 23),
                LocalDate.of(2026, 3, 23),
                List.of(new AdminDtos.BacktestLegPayload("leg-1", "FUTURES", 1, "BUY", null, "WEEKLY", "ATM", 0, null)),
                strategy("x", "INTRADAY").legwiseSettings(),
                strategy("x", "INTRADAY").overallSettings(),
                new AdminDtos.BacktestAdvancedConditionsPayload(false, null, null)
        );
        when(backtestStrategyService.normalizeStrategyPayload(strategy)).thenReturn(strategy);

        ValidationException error = assertThrows(
                ValidationException.class,
                () -> service.runExecution(
                        "tenant-a",
                        new IntraTradeDtos.IntraTradeRunRequest(
                                "admin",
                                null,
                                "LIVE",
                                "NSE_INDEX|Nifty 50",
                                "minutes",
                                5,
                                strategy
                        )
                )
        );

        assertEquals("Intra Trade currently supports option legs only", error.getMessage());
    }

    @Test
    void runExecution_liveWaitsForCompletedScanCandle() {
        IntraTradeService service = serviceAt("2026-03-23T04:10:00Z");
        AdminDtos.BacktestStrategyPayload strategy = strategy("Scan aligned strategy", "INTRADAY");
        when(backtestStrategyService.normalizeStrategyPayload(strategy)).thenReturn(strategy);
        when(intraTradeExecutionRepository.save(any(IntraTradeExecutionEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        IntraTradeDtos.IntraTradeExecutionResponse response = service.runExecution(
                "tenant-a",
                new IntraTradeDtos.IntraTradeRunRequest(
                        "admin",
                        null,
                        "PAPER",
                        "NSE_INDEX|Nifty 50",
                        "minutes",
                        15,
                        strategy
                )
        );

        assertEquals("WAITING_ENTRY", response.status());
        assertEquals("Waiting for the first eligible scan candle", response.statusMessage());
        assertEquals(
                "A completed 15 minutes candle is required after the entry window before evaluation.",
                response.result().notes().getFirst()
        );
    }

    @Test
    void runExecution_liveAlignsBacktestWindowToSavedScanCadence() {
        IntraTradeService service = serviceAt("2026-03-23T04:37:00Z");
        AdminDtos.BacktestStrategyPayload strategy = strategy("Aligned strategy", "INTRADAY");
        AdminDtos.BacktestRunResponse result = result(strategy, 1, new BigDecimal("250.00"), List.of("Marked to market"));
        when(backtestStrategyService.normalizeStrategyPayload(strategy)).thenReturn(strategy);
        when(backtestRunService.runBacktest(eq("tenant-a"), any(AdminDtos.BacktestRunRequest.class), anyInt())).thenReturn(result);
        when(intraTradeExecutionRepository.save(any(IntraTradeExecutionEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        IntraTradeDtos.IntraTradeExecutionResponse response = service.runExecution(
                "tenant-a",
                new IntraTradeDtos.IntraTradeRunRequest(
                        "admin",
                        9L,
                        "PAPER",
                        "NSE_INDEX|Nifty 50",
                        "minutes",
                        15,
                        strategy
                )
        );

        assertEquals("ENTERED", response.status());
        verify(backtestRunService).runBacktest(eq("tenant-a"), argThat((AdminDtos.BacktestRunRequest request) ->
                request.strategy().entryTime().equals(LocalTime.of(9, 45))
                        && request.strategy().exitTime().equals(LocalTime.of(10, 0))
                        && request.strategy().startDate().equals(LocalDate.of(2026, 3, 23))
                        && request.strategy().endDate().equals(LocalDate.of(2026, 3, 23))
        ), eq(15));
    }

    @Test
    void runExecution_liveUsesConfiguredMarketOpenForScanAlignment() {
        IndiaMarketHoursProperties marketHoursProperties = new IndiaMarketHoursProperties(
                "Asia/Kolkata",
                LocalTime.of(9, 30),
                LocalTime.of(15, 30),
                List.of()
        );
        IntraTradeService service = serviceAt("2026-03-23T04:32:00Z", marketHoursProperties);
        AdminDtos.BacktestStrategyPayload strategy = strategy("Custom market open", "INTRADAY");
        AdminDtos.BacktestRunResponse result = result(strategy, 1, new BigDecimal("120.00"), List.of("Marked to market"));
        when(backtestStrategyService.normalizeStrategyPayload(strategy)).thenReturn(strategy);
        when(backtestRunService.runBacktest(eq("tenant-a"), any(AdminDtos.BacktestRunRequest.class), anyInt())).thenReturn(result);
        when(intraTradeExecutionRepository.save(any(IntraTradeExecutionEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        IntraTradeDtos.IntraTradeExecutionResponse response = service.runExecution(
                "tenant-a",
                new IntraTradeDtos.IntraTradeRunRequest(
                        "admin",
                        12L,
                        "PAPER",
                        "NSE_INDEX|Nifty 50",
                        "minutes",
                        15,
                        strategy
                )
        );

        assertEquals("ENTERED", response.status());
        verify(backtestRunService).runBacktest(eq("tenant-a"), argThat((AdminDtos.BacktestRunRequest request) ->
                request.strategy().entryTime().equals(LocalTime.of(9, 45))
                        && request.strategy().exitTime().equals(LocalTime.of(10, 0))
        ), eq(15));
    }

    @Test
    void listExecutions_returnsLatestSavedRuns() {
        IntraTradeService service = serviceAt("2026-03-23T05:50:00Z");
        IntraTradeExecutionEntity entity = new IntraTradeExecutionEntity(
                "tenant-a",
                "admin",
                3L,
                "PAPER",
                "ENTERED",
                "Momentum entry",
                "NSE_INDEX|Nifty 50",
                "minutes",
                15,
                "{}",
                "{}",
                new BigDecimal("420.25"),
                1,
                "Position is open and marked to market",
                Instant.parse("2026-03-23T05:50:00Z")
        );
        when(intraTradeExecutionRepository.findAllByTenantIdAndUsernameOrderByUpdatedAtDesc(eq("tenant-a"), eq("admin"), any()))
                .thenReturn(new PageImpl<>(List.of(entity)));

        var page = service.listExecutions("tenant-a", "admin", 0, 10);

        assertEquals(1, page.getTotalElements());
        assertEquals("PAPER", page.getContent().get(0).mode());
        assertEquals("ENTERED", page.getContent().get(0).status());
    }

    @Test
    void checkTrend_returnsAdvisorResponse() {
        IntraTradeService service = serviceAt("2026-03-23T05:50:00Z");
        AdminDtos.BacktestStrategyPayload strategy = strategy("Trend checked", "INTRADAY");
        when(backtestStrategyService.normalizeStrategyPayload(strategy)).thenReturn(strategy);
        when(trendAdvisor.checkTrend("tenant-a", "NSE_INDEX|Nifty 50", "minutes", 5, strategy))
                .thenReturn(new IntraTradeDtos.IntraTradeTrendCheckResponse(true, "BULL", "SELL", "Conflict"));

        IntraTradeDtos.IntraTradeTrendCheckResponse response = service.checkTrend(
                "tenant-a",
                new IntraTradeDtos.IntraTradeRunRequest(
                        "admin",
                        null,
                        "PAPER",
                        "NSE_INDEX|Nifty 50",
                        "minutes",
                        5,
                        strategy
                )
        );

        assertEquals(true, response.hasConflict());
        assertEquals("SELL", response.currentTrend());
    }

    @Test
    void updateExecution_rejectsEnteredExecution() {
        IntraTradeService service = serviceAt("2026-03-23T05:50:00Z");
        AdminDtos.BacktestStrategyPayload strategy = strategy("Edit blocked", "INTRADAY");
        when(intraTradeExecutionRepository.findByIdAndTenantId(5L, "tenant-a"))
                .thenReturn(Optional.of(entity("ENTERED", strategy)));

        ValidationException error = assertThrows(
                ValidationException.class,
                () -> service.updateExecution(
                        "tenant-a",
                        5L,
                        new IntraTradeDtos.IntraTradeRunRequest(
                                "admin",
                                null,
                                "PAPER",
                                "NSE_INDEX|Nifty 50",
                                "minutes",
                                5,
                                strategy
                        )
                )
        );

        assertEquals("Entered executions must be exited before editing", error.getMessage());
    }

    @Test
    void exitExecution_updatesSnapshotToExited() {
        IntraTradeService service = serviceAt("2026-03-23T04:46:00Z");
        AdminDtos.BacktestStrategyPayload strategy = strategy("Exit now", "INTRADAY");
        when(intraTradeExecutionRepository.findByIdAndTenantId(8L, "tenant-a"))
                .thenReturn(Optional.of(entity("ENTERED", strategy)));
        when(backtestRunService.runBacktest(eq("tenant-a"), any(AdminDtos.BacktestRunRequest.class), anyInt()))
                .thenReturn(result(strategy, 1, new BigDecimal("320.00"), List.of("Marked to market")));
        when(intraTradeExecutionRepository.save(any(IntraTradeExecutionEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        IntraTradeDtos.IntraTradeExecutionResponse response = service.exitExecution("tenant-a", 8L, "admin");

        assertEquals("EXITED", response.status());
        assertEquals("Position exited immediately and result saved", response.statusMessage());
        assertEquals(1, response.result().executedTrades());
    }

    @Test
    void deleteExecution_rejectsEnteredExecution() {
        IntraTradeService service = serviceAt("2026-03-23T05:50:00Z");
        AdminDtos.BacktestStrategyPayload strategy = strategy("Delete blocked", "INTRADAY");
        when(intraTradeExecutionRepository.findByIdAndTenantId(6L, "tenant-a"))
                .thenReturn(Optional.of(entity("ENTERED", strategy)));

        ValidationException error = assertThrows(
                ValidationException.class,
                () -> service.deleteExecution("tenant-a", 6L, "admin")
        );

        assertEquals("Entered executions must be exited before delete", error.getMessage());
    }

    private IntraTradeService serviceAt(String instant) {
        return serviceAt(instant, defaultMarketHours());
    }

    private IntraTradeService serviceAt(String instant, IndiaMarketHoursProperties marketHoursProperties) {
        return new IntraTradeService(
                intraTradeExecutionRepository,
                intraRuntimeStrategyRepository,
                backtestStrategyService,
                backtestRunService,
                trendAdvisor,
                new ObjectMapper().findAndRegisterModules(),
                Clock.fixed(Instant.parse(instant), ZoneOffset.UTC),
                new IntraTradeScanWindowResolver(marketHoursProperties),
                marketHoursProperties
        );
    }

    private IndiaMarketHoursProperties defaultMarketHours() {
        return new IndiaMarketHoursProperties(
                "Asia/Kolkata",
                LocalTime.of(9, 15),
                LocalTime.of(15, 30),
                List.of()
        );
    }

    private IntraTradeExecutionEntity entity(String status, AdminDtos.BacktestStrategyPayload strategy) {
        return new IntraTradeExecutionEntity(
                "tenant-a",
                "admin",
                3L,
                "PAPER",
                status,
                strategy.strategyName(),
                "NSE_INDEX|Nifty 50",
                "minutes",
                5,
                new ObjectMapper().findAndRegisterModules().valueToTree(strategy).toString(),
                new ObjectMapper().findAndRegisterModules().valueToTree(result(strategy, 1, new BigDecimal("100.00"), List.of("Saved"))).toString(),
                new BigDecimal("100.00"),
                1,
                "Position is open and marked to market",
                Instant.parse("2026-03-23T04:40:00Z")
        );
    }

    private AdminDtos.BacktestStrategyPayload strategy(String name, String strategyType) {
        return new AdminDtos.BacktestStrategyPayload(
                name,
                "NSE_INDEX|Nifty 50",
                "FUTURES",
                strategyType,
                LocalTime.of(9, 35),
                LocalTime.of(15, 15),
                LocalDate.of(2026, 3, 1),
                LocalDate.of(2026, 3, 23),
                List.of(new AdminDtos.BacktestLegPayload("leg-1", "OPTIONS", 1, "BUY", "CALL", "WEEKLY", "ATM", 0, null)),
                new AdminDtos.BacktestLegwiseSettingsPayload("PARTIAL", false, "ALL_LEGS", false, null, false, null, BigDecimal.ZERO),
                new AdminDtos.BacktestOverallSettingsPayload(false, null, BigDecimal.ZERO, false, null, BigDecimal.ZERO, false, null, BigDecimal.ZERO, BigDecimal.ZERO),
                new AdminDtos.BacktestAdvancedConditionsPayload(false, null, null)
        );
    }

    private AdminDtos.BacktestRunResponse result(
            AdminDtos.BacktestStrategyPayload strategy,
            int executedTrades,
            BigDecimal totalPnl,
            List<String> notes
    ) {
        return new AdminDtos.BacktestRunResponse(
                strategy,
                List.of(),
                totalPnl,
                totalPnl,
                executedTrades,
                executedTrades,
                0,
                0,
                0,
                new BigDecimal("100.00"),
                executedTrades,
                0,
                notes
        );
    }
}
