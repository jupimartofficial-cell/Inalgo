package com.inalgo.trade.admin;

import com.inalgo.trade.entity.CandleEntity;
import com.inalgo.trade.repository.CandleRepository;
import com.inalgo.trade.upstox.ExpiredInstrumentCatalogService;
import com.inalgo.trade.upstox.UpstoxCandleResponse;
import com.inalgo.trade.upstox.UpstoxClient;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.SimpleTransactionStatus;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.same;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BacktestRunServiceTest {

    @Mock
    private CandleRepository candleRepository;

    @Mock
    private UpstoxClient upstoxClient;

    @Mock
    private ExpiredInstrumentCatalogService expiredInstrumentCatalogService;

    @Mock
    private BacktestConditionService backtestConditionService;

    @Mock
    private BacktestStrategyService backtestStrategyService;

    @Test
    void runBacktest_persistsSyncedCandlesInsideTransaction() {
        BacktestRunService service = new BacktestRunService(
                candleRepository,
                upstoxClient,
                expiredInstrumentCatalogService,
                backtestConditionService,
                backtestStrategyService,
                new TestTransactionManager()
        );

        InMemoryCandleStore store = new InMemoryCandleStore();
        AtomicBoolean sawTransaction = new AtomicBoolean(false);
        stubCandleRepository(store, sawTransaction);

        LocalDate tradeDate = LocalDate.of(2026, 1, 7);
        AdminDtos.BacktestStrategyPayload strategy = strategyFor(
                tradeDate,
                tradeDate,
                new AdminDtos.BacktestLegPayload("leg-1", "FUTURES", 1, "BUY", null, "WEEKLY", "ATM", 0, null)
        );

        stubStrategyNormalization(strategy);

        when(upstoxClient.fetchHistoricalCandles(anyString(), eq("minutes"), eq(5), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(candleResponse(List.of(
                        candleRow(tradeDate, "09:35", "100"),
                        candleRow(tradeDate, "15:15", "110")
                )));
        when(expiredInstrumentCatalogService.getExpiries("tenant-a", "NSE_INDEX|Nifty 50", tradeDate)).thenReturn(List.of());

        AdminDtos.BacktestRunResponse response = service.runBacktest(
                "tenant-a",
                new AdminDtos.BacktestRunRequest("admin", strategy)
        );

        assertEquals(1, response.executedTrades());
        assertTrue(sawTransaction.get(), "Expected candle upserts to run inside an active transaction");
        assertFalse(response.notes().stream().anyMatch(note -> note.contains("Sync failed for NSE_INDEX|Nifty 50")));
    }

    @Test
    void runBacktest_usesIntradayCandlesForCurrentTradingDay() {
        BacktestRunService service = new BacktestRunService(
                candleRepository,
                upstoxClient,
                expiredInstrumentCatalogService,
                backtestConditionService,
                backtestStrategyService,
                new TestTransactionManager()
        );

        InMemoryCandleStore store = new InMemoryCandleStore();
        stubCandleRepository(store, new AtomicBoolean(false));

        LocalDate tradeDate = LocalDate.now(ZoneId.of("Asia/Kolkata"));
        assumeTrue(
                tradeDate.getDayOfWeek() != java.time.DayOfWeek.SATURDAY
                        && tradeDate.getDayOfWeek() != java.time.DayOfWeek.SUNDAY,
                "Current-day intraday path requires a trading day"
        );
        AdminDtos.BacktestStrategyPayload strategy = strategyFor(
                tradeDate,
                tradeDate,
                new AdminDtos.BacktestLegPayload("leg-1", "FUTURES", 1, "BUY", null, "WEEKLY", "ATM", 0, null)
        );

        stubStrategyNormalization(strategy);

        when(upstoxClient.fetchHistoricalCandles(
                "NSE_INDEX|Nifty 50",
                "minutes",
                5,
                tradeDate.minusDays(1),
                tradeDate.minusDays(2)
        )).thenReturn(candleResponse(List.of(
                candleRow(tradeDate.minusDays(1), "09:35", "95")
        )));
        when(upstoxClient.fetchIntradayCandles("NSE_INDEX|Nifty 50", "minutes", 5))
                .thenReturn(candleResponse(List.of(
                        candleRow(tradeDate, "09:35", "100"),
                        candleRow(tradeDate, "15:15", "110")
                )));
        when(expiredInstrumentCatalogService.getExpiries("tenant-a", "NSE_INDEX|Nifty 50", tradeDate)).thenReturn(List.of());

        AdminDtos.BacktestRunResponse response = service.runBacktest(
                "tenant-a",
                new AdminDtos.BacktestRunRequest("admin", strategy)
        );

        assertEquals(1, response.executedTrades());
        assertEquals(new BigDecimal("10.00"), response.totalPnl());
        verify(upstoxClient).fetchHistoricalCandles(
                "NSE_INDEX|Nifty 50",
                "minutes",
                5,
                tradeDate.minusDays(1),
                tradeDate.minusDays(2)
        );
        verify(upstoxClient).fetchIntradayCandles("NSE_INDEX|Nifty 50", "minutes", 5);
        verify(upstoxClient, never()).fetchHistoricalCandles(
                "NSE_INDEX|Nifty 50",
                "minutes",
                5,
                tradeDate,
                tradeDate
        );
    }

    @Test
    void runBacktest_usesPartialOptionFallbackInsteadOfZeroingBothLegPrices() {
        BacktestRunService service = new BacktestRunService(
                candleRepository,
                upstoxClient,
                expiredInstrumentCatalogService,
                backtestConditionService,
                backtestStrategyService,
                new TestTransactionManager()
        );

        InMemoryCandleStore store = new InMemoryCandleStore();
        stubCandleRepository(store, new AtomicBoolean(false));

        LocalDate tradeDate = LocalDate.of(2026, 1, 7);
        LocalDate expiryDate = LocalDate.of(2026, 1, 8);
        String optionInstrument = "NSE_FO|40477";
        AdminDtos.BacktestStrategyPayload strategy = strategyFor(
                tradeDate,
                tradeDate,
                new AdminDtos.BacktestLegPayload("leg-1", "OPTIONS", 1, "BUY", "CALL", "WEEKLY", "ATM", 0, null)
        );

        stubStrategyNormalization(strategy);

        when(upstoxClient.fetchHistoricalCandles(anyString(), eq("minutes"), eq(5), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(candleResponse(List.of(
                        candleRow(tradeDate, "09:35", "100"),
                        candleRow(tradeDate, "15:15", "95")
                )));
        when(expiredInstrumentCatalogService.getOptionExpiries("tenant-a", "NSE_INDEX|Nifty 50", tradeDate)).thenReturn(List.of(expiryDate));
        when(expiredInstrumentCatalogService.getOptionContracts("tenant-a", "NSE_INDEX|Nifty 50", expiryDate))
                .thenReturn(List.of(new UpstoxClient.ExpiredDerivativeContractView(
                        "NIFTY CALL",
                        "NSE_FO",
                        "NSE",
                        expiryDate,
                        optionInstrument,
                        "40477",
                        "NIFTY26JAN100CE",
                        50,
                        "OPTIDX",
                        "NSE_INDEX|Nifty 50",
                        new BigDecimal("100"),
                        true,
                        "CE"
                )));
        when(upstoxClient.fetchExpiredHistoricalCandles(eq(optionInstrument), eq("5minute"), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(candleResponse(List.of(
                        candleRow(tradeDate, "09:35", "12")
                )));

        AdminDtos.BacktestRunResponse response = service.runBacktest(
                "tenant-a",
                new AdminDtos.BacktestRunRequest("admin", strategy)
        );

        AdminDtos.BacktestResultRow row = response.rows().getFirst();
        AdminDtos.BacktestLegResult leg = row.legs().getFirst();

        assertEquals(new BigDecimal("12.00"), leg.entryPrice());
        assertEquals(new BigDecimal("10.00"), leg.exitPrice());
        assertEquals(new BigDecimal("-100.00"), leg.pnlAmount());
        assertEquals(new BigDecimal("75.00"), response.realWorldAccuracyPct());
        assertEquals(0, response.marketPricedTrades());
        assertEquals(1, response.fallbackPricedTrades());
        assertNotEquals(0, row.pnlAmount().compareTo(BigDecimal.ZERO));
        assertTrue(response.notes().stream().anyMatch(note -> note.contains("partial synthetic option pricing fallback")));
        assertFalse(response.notes().stream().anyMatch(note -> note.contains("Sync failed for")));
    }

    @Test
    void runBacktest_triggersStopLossBeforePlannedExit() {
        BacktestRunService service = new BacktestRunService(
                candleRepository,
                upstoxClient,
                expiredInstrumentCatalogService,
                backtestConditionService,
                backtestStrategyService,
                new TestTransactionManager()
        );

        InMemoryCandleStore store = new InMemoryCandleStore();
        stubCandleRepository(store, new AtomicBoolean(false));

        LocalDate tradeDate = LocalDate.of(2026, 1, 7);
        AdminDtos.BacktestStrategyPayload strategy = strategyFor(
                tradeDate,
                tradeDate,
                new AdminDtos.BacktestLegPayload("leg-1", "FUTURES", 1, "BUY", null, "WEEKLY", "ATM", 0, null),
                new AdminDtos.BacktestOverallSettingsPayload(
                        true,
                        "MAX_LOSS",
                        new BigDecimal("4"),
                        false,
                        null,
                        null,
                        false,
                        null,
                        null,
                        null
                )
        );
        stubStrategyNormalization(strategy);

        when(upstoxClient.fetchHistoricalCandles(anyString(), eq("minutes"), eq(5), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(candleResponse(List.of(
                        candleRow(tradeDate, "09:35", "100"),
                        candleRow(tradeDate, "09:40", "98"),
                        candleRow(tradeDate, "09:45", "95"),
                        candleRow(tradeDate, "15:15", "120")
                )));
        when(expiredInstrumentCatalogService.getExpiries("tenant-a", "NSE_INDEX|Nifty 50", tradeDate)).thenReturn(List.of());

        AdminDtos.BacktestRunResponse response = service.runBacktest(
                "tenant-a",
                new AdminDtos.BacktestRunRequest("admin", strategy)
        );

        AdminDtos.BacktestResultRow row = response.rows().getFirst();
        AdminDtos.BacktestLegResult leg = row.legs().getFirst();
        assertEquals(Instant.parse("2026-01-07T04:15:00Z"), row.exitTs());
        assertEquals(new BigDecimal("95.00"), leg.exitPrice());
        assertEquals(new BigDecimal("-5.00"), row.pnlAmount());
        assertTrue(response.notes().stream().anyMatch(note -> note.contains("Stop loss hit on 2026-01-07 at 09:45")));
    }

    @Test
    void runBacktest_triggersTargetBeforePlannedExit() {
        BacktestRunService service = new BacktestRunService(
                candleRepository,
                upstoxClient,
                expiredInstrumentCatalogService,
                backtestConditionService,
                backtestStrategyService,
                new TestTransactionManager()
        );

        InMemoryCandleStore store = new InMemoryCandleStore();
        stubCandleRepository(store, new AtomicBoolean(false));

        LocalDate tradeDate = LocalDate.of(2026, 1, 7);
        AdminDtos.BacktestStrategyPayload strategy = strategyFor(
                tradeDate,
                tradeDate,
                new AdminDtos.BacktestLegPayload("leg-1", "FUTURES", 1, "BUY", null, "WEEKLY", "ATM", 0, null),
                new AdminDtos.BacktestOverallSettingsPayload(
                        false,
                        null,
                        null,
                        true,
                        "MAX_PROFIT",
                        new BigDecimal("3"),
                        false,
                        null,
                        null,
                        null
                ),
                new AdminDtos.BacktestAdvancedConditionsPayload(false, null, null)
        );
        stubStrategyNormalization(strategy);

        when(upstoxClient.fetchHistoricalCandles(anyString(), eq("minutes"), eq(5), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(candleResponse(List.of(
                        candleRow(tradeDate, "09:35", "100"),
                        candleRow(tradeDate, "09:40", "103"),
                        candleRow(tradeDate, "09:45", "106"),
                        candleRow(tradeDate, "15:15", "95")
                )));
        when(expiredInstrumentCatalogService.getExpiries("tenant-a", "NSE_INDEX|Nifty 50", tradeDate)).thenReturn(List.of());

        AdminDtos.BacktestRunResponse response = service.runBacktest(
                "tenant-a",
                new AdminDtos.BacktestRunRequest("admin", strategy)
        );

        AdminDtos.BacktestResultRow row = response.rows().getFirst();
        assertEquals(Instant.parse("2026-01-07T04:10:00Z"), row.exitTs());
        assertEquals(new BigDecimal("3.00"), row.pnlAmount());
        assertTrue(response.notes().stream().anyMatch(note -> note.contains("Target hit on 2026-01-07 at 09:40")));
    }

    @Test
    void runBacktest_triggersTrailingStopLossAfterProfitPeak() {
        BacktestRunService service = new BacktestRunService(
                candleRepository,
                upstoxClient,
                expiredInstrumentCatalogService,
                backtestConditionService,
                backtestStrategyService,
                new TestTransactionManager()
        );

        InMemoryCandleStore store = new InMemoryCandleStore();
        stubCandleRepository(store, new AtomicBoolean(false));

        LocalDate tradeDate = LocalDate.of(2026, 1, 7);
        AdminDtos.BacktestStrategyPayload strategy = strategyFor(
                tradeDate,
                tradeDate,
                new AdminDtos.BacktestLegPayload("leg-1", "FUTURES", 1, "BUY", null, "WEEKLY", "ATM", 0, null),
                new AdminDtos.BacktestOverallSettingsPayload(
                        false,
                        null,
                        null,
                        false,
                        null,
                        null,
                        true,
                        "TRAILING_SL",
                        new BigDecimal("2"),
                        null
                )
        );
        stubStrategyNormalization(strategy);

        when(upstoxClient.fetchHistoricalCandles(anyString(), eq("minutes"), eq(5), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(candleResponse(List.of(
                        candleRow(tradeDate, "09:35", "100"),
                        candleRow(tradeDate, "09:40", "106"),
                        candleRow(tradeDate, "09:45", "103"),
                        candleRow(tradeDate, "15:15", "120")
                )));
        when(expiredInstrumentCatalogService.getExpiries("tenant-a", "NSE_INDEX|Nifty 50", tradeDate)).thenReturn(List.of());

        AdminDtos.BacktestRunResponse response = service.runBacktest(
                "tenant-a",
                new AdminDtos.BacktestRunRequest("admin", strategy)
        );

        AdminDtos.BacktestResultRow row = response.rows().getFirst();
        assertEquals(Instant.parse("2026-01-07T04:15:00Z"), row.exitTs());
        assertEquals(new BigDecimal("3.00"), row.pnlAmount());
        assertTrue(response.notes().stream().anyMatch(note -> note.contains("Trailing stop loss hit on 2026-01-07 at 09:45")));
    }

    @Test
    void runBacktest_totalPnlUsesNetOfProfitsAndLosses() {
        BacktestRunService service = new BacktestRunService(
                candleRepository,
                upstoxClient,
                expiredInstrumentCatalogService,
                backtestConditionService,
                backtestStrategyService,
                new TestTransactionManager()
        );

        InMemoryCandleStore store = new InMemoryCandleStore();
        stubCandleRepository(store, new AtomicBoolean(false));

        LocalDate dayOne = LocalDate.of(2026, 1, 5);
        LocalDate dayTwo = LocalDate.of(2026, 1, 6);
        AdminDtos.BacktestStrategyPayload strategy = strategyFor(
                dayOne,
                dayTwo,
                new AdminDtos.BacktestLegPayload("leg-1", "FUTURES", 1, "BUY", null, "WEEKLY", "ATM", 0, null)
        );
        stubStrategyNormalization(strategy);

        when(upstoxClient.fetchHistoricalCandles(anyString(), eq("minutes"), eq(5), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(candleResponse(List.of(
                        candleRow(dayOne, "09:35", "100"),
                        candleRow(dayOne, "15:15", "110"),
                        candleRow(dayTwo, "09:35", "100"),
                        candleRow(dayTwo, "15:15", "85")
                )));
        when(expiredInstrumentCatalogService.getExpiries(eq("tenant-a"), eq("NSE_INDEX|Nifty 50"), any(LocalDate.class)))
                .thenReturn(List.of());

        AdminDtos.BacktestRunResponse response = service.runBacktest(
                "tenant-a",
                new AdminDtos.BacktestRunRequest("admin", strategy)
        );

        assertEquals(2, response.executedTrades());
        assertEquals(1, response.winTrades());
        assertEquals(1, response.lossTrades());
        assertEquals(new BigDecimal("-5.00"), response.totalPnl());
        assertEquals(new BigDecimal("-2.50"), response.averagePnl());
    }

    @Test
    void runBacktest_resolvesMonthlyExpiryAndStrikeStepsForOptions() {
        BacktestRunService service = new BacktestRunService(
                candleRepository,
                upstoxClient,
                expiredInstrumentCatalogService,
                backtestConditionService,
                backtestStrategyService,
                new TestTransactionManager()
        );

        InMemoryCandleStore store = new InMemoryCandleStore();
        stubCandleRepository(store, new AtomicBoolean(false));

        LocalDate tradeDate = LocalDate.of(2026, 1, 7);
        LocalDate monthlyExpiry = LocalDate.of(2026, 1, 29);
        String selectedInstrument = "NSE_FO|110CE";

        AdminDtos.BacktestStrategyPayload strategy = strategyFor(
                tradeDate,
                tradeDate,
                new AdminDtos.BacktestLegPayload("leg-1", "OPTIONS", 1, "BUY", "CALL", "MONTHLY", "OTM", 1, null)
        );
        stubStrategyNormalization(strategy);

        when(upstoxClient.fetchHistoricalCandles(anyString(), eq("minutes"), eq(5), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(candleResponse(List.of(
                        candleRow(tradeDate, "09:35", "100"),
                        candleRow(tradeDate, "15:15", "101")
                )));

        when(expiredInstrumentCatalogService.getOptionExpiries("tenant-a", "NSE_INDEX|Nifty 50", tradeDate)).thenReturn(List.of(
                LocalDate.of(2026, 1, 8),
                LocalDate.of(2026, 1, 15),
                monthlyExpiry,
                LocalDate.of(2026, 2, 5)
        ));

        when(expiredInstrumentCatalogService.getOptionContracts("tenant-a", "NSE_INDEX|Nifty 50", monthlyExpiry))
                .thenReturn(List.of(
                        optionContract(monthlyExpiry, "NSE_FO|90CE", "NIFTY26JAN90CE", "90"),
                        optionContract(monthlyExpiry, "NSE_FO|100CE", "NIFTY26JAN100CE", "100"),
                        optionContract(monthlyExpiry, selectedInstrument, "NIFTY26JAN110CE", "110")
                ));

        when(upstoxClient.fetchExpiredHistoricalCandles(eq(selectedInstrument), eq("5minute"), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(candleResponse(List.of(
                        candleRow(tradeDate, "09:35", "10"),
                        candleRow(tradeDate, "15:15", "15")
                )));

        AdminDtos.BacktestRunResponse response = service.runBacktest(
                "tenant-a",
                new AdminDtos.BacktestRunRequest("admin", strategy)
        );

        AdminDtos.BacktestLegResult leg = response.rows().getFirst().legs().getFirst();
        assertEquals(monthlyExpiry, leg.expiryDate());
        assertEquals(0, leg.strikePrice().compareTo(new BigDecimal("110")));
        assertEquals(selectedInstrument, leg.instrumentKey());
        assertEquals(new BigDecimal("250.00"), leg.pnlAmount());
    }

    @Test
    void runBacktest_refreshesOptionExpiriesWhenRangeMovesBeyondCachedLastExpiry() {
        BacktestRunService service = new BacktestRunService(
                candleRepository,
                upstoxClient,
                expiredInstrumentCatalogService,
                backtestConditionService,
                backtestStrategyService,
                new TestTransactionManager()
        );

        InMemoryCandleStore store = new InMemoryCandleStore();
        stubCandleRepository(store, new AtomicBoolean(false));

        LocalDate dayOne = LocalDate.of(2026, 1, 1);
        LocalDate dayTwo = LocalDate.of(2026, 1, 2);
        LocalDate firstExpiry = dayOne;
        LocalDate refreshedExpiry = LocalDate.of(2026, 1, 13);

        AdminDtos.BacktestStrategyPayload strategy = strategyFor(
                dayOne,
                dayTwo,
                new AdminDtos.BacktestLegPayload("leg-1", "OPTIONS", 1, "BUY", "CALL", "WEEKLY", "ATM", 0, null)
        );
        stubStrategyNormalization(strategy);

        when(upstoxClient.fetchHistoricalCandles(anyString(), eq("minutes"), eq(5), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(candleResponse(List.of(
                        candleRow(dayOne, "09:35", "100"),
                        candleRow(dayOne, "15:15", "101"),
                        candleRow(dayTwo, "09:35", "102"),
                        candleRow(dayTwo, "15:15", "103")
                )));

        when(expiredInstrumentCatalogService.getOptionExpiries("tenant-a", "NSE_INDEX|Nifty 50", dayOne))
                .thenReturn(List.of(firstExpiry));
        when(expiredInstrumentCatalogService.getOptionExpiries("tenant-a", "NSE_INDEX|Nifty 50", dayTwo))
                .thenReturn(List.of(firstExpiry, refreshedExpiry));

        when(expiredInstrumentCatalogService.getOptionContracts("tenant-a", "NSE_INDEX|Nifty 50", firstExpiry))
                .thenReturn(List.of(optionContract(firstExpiry, "NSE_FO|100CE", "NIFTY06JAN100CE", "100")));
        when(expiredInstrumentCatalogService.getOptionContracts("tenant-a", "NSE_INDEX|Nifty 50", refreshedExpiry))
                .thenReturn(List.of(optionContract(refreshedExpiry, "NSE_FO|110CE", "NIFTY13JAN100CE", "100")));

        when(upstoxClient.fetchExpiredHistoricalCandles(anyString(), eq("5minute"), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(candleResponse(List.of(
                        candleRow(dayOne, "09:35", "10"),
                        candleRow(dayOne, "15:15", "12"),
                        candleRow(dayTwo, "09:35", "11"),
                        candleRow(dayTwo, "15:15", "13")
                )));

        AdminDtos.BacktestRunResponse response = service.runBacktest(
                "tenant-a",
                new AdminDtos.BacktestRunRequest("admin", strategy)
        );

        assertEquals(2, response.executedTrades());
        assertEquals(firstExpiry, response.rows().get(0).legs().getFirst().expiryDate());
        assertEquals(refreshedExpiry, response.rows().get(1).legs().getFirst().expiryDate());
        verify(expiredInstrumentCatalogService).getOptionExpiries("tenant-a", "NSE_INDEX|Nifty 50", dayOne);
        verify(expiredInstrumentCatalogService).getOptionExpiries("tenant-a", "NSE_INDEX|Nifty 50", dayTwo);
    }

    @Test
    void runBacktest_usesMonthlyFutureWhenWeeklyFutureContractUnavailable() {
        BacktestRunService service = new BacktestRunService(
                candleRepository,
                upstoxClient,
                expiredInstrumentCatalogService,
                backtestConditionService,
                backtestStrategyService,
                new TestTransactionManager()
        );

        InMemoryCandleStore store = new InMemoryCandleStore();
        stubCandleRepository(store, new AtomicBoolean(false));

        LocalDate tradeDate = LocalDate.of(2026, 1, 7);
        LocalDate weeklyExpiry = LocalDate.of(2026, 1, 8);
        LocalDate monthlyExpiry = LocalDate.of(2026, 1, 29);
        String futureInstrument = "NSE_FO|51714";

        AdminDtos.BacktestStrategyPayload strategy = strategyFor(
                tradeDate,
                tradeDate,
                new AdminDtos.BacktestLegPayload("leg-1", "FUTURES", 1, "BUY", null, "WEEKLY", "ATM", 0, null)
        );
        stubStrategyNormalization(strategy);

        when(upstoxClient.fetchHistoricalCandles(anyString(), eq("minutes"), eq(5), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(candleResponse(List.of(
                        candleRow(tradeDate, "09:35", "100"),
                        candleRow(tradeDate, "15:15", "110")
                )));
        when(expiredInstrumentCatalogService.getExpiries("tenant-a", "NSE_INDEX|Nifty 50", tradeDate))
                .thenReturn(List.of(weeklyExpiry, monthlyExpiry));
        when(expiredInstrumentCatalogService.getFutureContracts("tenant-a", "NSE_INDEX|Nifty 50", weeklyExpiry))
                .thenReturn(List.of());
        when(expiredInstrumentCatalogService.getFutureContracts("tenant-a", "NSE_INDEX|Nifty 50", monthlyExpiry))
                .thenReturn(List.of(futureContract(monthlyExpiry, futureInstrument)));
        when(upstoxClient.fetchExpiredHistoricalCandles(eq(futureInstrument), eq("5minute"), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(candleResponse(List.of(
                        candleRow(tradeDate, "09:35", "200"),
                        candleRow(tradeDate, "15:15", "210")
                )));

        AdminDtos.BacktestRunResponse response = service.runBacktest(
                "tenant-a",
                new AdminDtos.BacktestRunRequest("admin", strategy)
        );

        AdminDtos.BacktestLegResult leg = response.rows().getFirst().legs().getFirst();
        assertEquals(monthlyExpiry, leg.expiryDate());
        assertEquals(futureInstrument, leg.instrumentKey());
        assertEquals(new BigDecimal("500.00"), leg.pnlAmount());
        assertTrue(response.notes().stream().anyMatch(note -> note.contains("Weekly futures contract unavailable")));
    }

    @Test
    void runBacktest_positionalExitSkipsWeekendToNextTradingDay() {
        BacktestRunService service = new BacktestRunService(
                candleRepository,
                upstoxClient,
                expiredInstrumentCatalogService,
                backtestConditionService,
                backtestStrategyService,
                new TestTransactionManager()
        );

        InMemoryCandleStore store = new InMemoryCandleStore();
        stubCandleRepository(store, new AtomicBoolean(false));

        LocalDate friday = LocalDate.of(2026, 1, 9);
        LocalDate saturday = LocalDate.of(2026, 1, 10);
        LocalDate monday = LocalDate.of(2026, 1, 12);

        AdminDtos.BacktestStrategyPayload strategy = new AdminDtos.BacktestStrategyPayload(
                "Weekend Positional",
                "NSE_INDEX|Nifty 50",
                "CASH",
                "POSITIONAL",
                LocalTime.of(9, 35),
                LocalTime.of(15, 15),
                friday,
                saturday,
                List.of(new AdminDtos.BacktestLegPayload("leg-1", "FUTURES", 1, "BUY", null, "WEEKLY", "ATM", 0, null)),
                new AdminDtos.BacktestLegwiseSettingsPayload(
                        "PARTIAL",
                        false,
                        "ALL_LEGS",
                        false,
                        null,
                        false,
                        null,
                        null
                ),
                new AdminDtos.BacktestOverallSettingsPayload(
                        false,
                        null,
                        null,
                        false,
                        null,
                        null,
                        false,
                        null,
                        null,
                        null
                ),
                new AdminDtos.BacktestAdvancedConditionsPayload(false, null, null)
        );
        stubStrategyNormalization(strategy);

        when(upstoxClient.fetchHistoricalCandles(anyString(), eq("minutes"), eq(5), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(candleResponse(List.of(
                        candleRow(friday, "09:35", "100"),
                        candleRow(friday, "15:15", "90"),
                        candleRow(monday, "15:15", "110")
                )));
        when(expiredInstrumentCatalogService.getExpiries("tenant-a", "NSE_INDEX|Nifty 50", friday)).thenReturn(List.of());

        AdminDtos.BacktestRunResponse response = service.runBacktest(
                "tenant-a",
                new AdminDtos.BacktestRunRequest("admin", strategy)
        );

        AdminDtos.BacktestResultRow row = response.rows().getFirst();
        assertEquals(monday, row.exitDate());
        assertEquals(new BigDecimal("10.00"), row.pnlAmount());
    }

    @Test
    void runBacktest_skipsLegsWhoseLegEntryConditionsFail() {
        BacktestRunService service = new BacktestRunService(
                candleRepository,
                upstoxClient,
                expiredInstrumentCatalogService,
                backtestConditionService,
                backtestStrategyService,
                new TestTransactionManager()
        );

        InMemoryCandleStore store = new InMemoryCandleStore();
        stubCandleRepository(store, new AtomicBoolean(false));

        LocalDate tradeDate = LocalDate.of(2026, 1, 7);
        AdminDtos.BacktestConditionRulePayload dummyRule = new AdminDtos.BacktestConditionRulePayload(
                "minutes",
                5,
                new AdminDtos.BacktestConditionOperandPayload("VALUE", null, null, "1", "NUMBER"),
                "EQUAL_TO",
                new AdminDtos.BacktestConditionOperandPayload("VALUE", null, null, "1", "NUMBER")
        );
        AdminDtos.BacktestAdvancedConditionsPayload filteredLegConditions =
                new AdminDtos.BacktestAdvancedConditionsPayload(
                        true,
                        new AdminDtos.BacktestConditionGroupPayload(
                                "AND",
                                List.of(new AdminDtos.BacktestConditionNodePayload(dummyRule, null))
                        ),
                        null
                );
        AdminDtos.BacktestLegPayload includedLeg =
                new AdminDtos.BacktestLegPayload("leg-1", "FUTURES", 1, "BUY", null, "WEEKLY", "ATM", 0, null);
        AdminDtos.BacktestLegPayload filteredLeg =
                new AdminDtos.BacktestLegPayload("leg-2", "FUTURES", 1, "BUY", null, "WEEKLY", "ATM", 0, filteredLegConditions);
        AdminDtos.BacktestStrategyPayload strategy = new AdminDtos.BacktestStrategyPayload(
                "Leg entry filters",
                "NSE_INDEX|Nifty 50",
                "CASH",
                "INTRADAY",
                LocalTime.of(9, 35),
                LocalTime.of(15, 15),
                tradeDate,
                tradeDate,
                List.of(includedLeg, filteredLeg),
                new AdminDtos.BacktestLegwiseSettingsPayload("PARTIAL", false, "ALL_LEGS", false, null, false, null, null),
                new AdminDtos.BacktestOverallSettingsPayload(false, null, null, false, null, null, false, null, null, null),
                new AdminDtos.BacktestAdvancedConditionsPayload(false, null, null)
        );
        stubStrategyNormalization(strategy);

        BacktestConditionService.EvaluationContext strategyContext = BacktestConditionService.EvaluationContext.disabled();
        BacktestConditionService.EvaluationContext filteredContext = new BacktestConditionService.EvaluationContext(
                filteredLegConditions,
                tradeDate.minusDays(1),
                Map.of(),
                Map.of()
        );
        when(backtestConditionService.prepareEvaluationContext("tenant-a", strategy)).thenReturn(strategyContext);
        when(backtestConditionService.prepareEvaluationContext(
                eq("tenant-a"),
                eq("NSE_INDEX|Nifty 50"),
                eq(tradeDate),
                eq(tradeDate),
                same(filteredLeg.legConditions())
        )).thenReturn(filteredContext);
        when(backtestConditionService.evaluateIntradayEntry(eq(filteredContext), eq(tradeDate), any(), any())).thenReturn(false);

        when(upstoxClient.fetchHistoricalCandles(anyString(), eq("minutes"), eq(5), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(candleResponse(List.of(
                        candleRow(tradeDate, "09:35", "100"),
                        candleRow(tradeDate, "15:15", "110")
                )));
        when(expiredInstrumentCatalogService.getExpiries("tenant-a", "NSE_INDEX|Nifty 50", tradeDate)).thenReturn(List.of());

        AdminDtos.BacktestRunResponse response = service.runBacktest(
                "tenant-a",
                new AdminDtos.BacktestRunRequest("admin", strategy)
        );

        AdminDtos.BacktestResultRow row = response.rows().getFirst();
        assertEquals(1, row.legs().size());
        assertEquals("leg-1", row.legs().getFirst().legId());
        assertEquals(new BigDecimal("10.00"), row.pnlAmount());
        assertTrue(response.notes().stream().anyMatch(note -> note.contains("Skipped leg-2 on 2026-01-07 because leg entry conditions were not met")));
    }

    @Test
    void runBacktest_usesEarliestCheckpointForLegExitCondition() {
        BacktestRunService service = new BacktestRunService(
                candleRepository,
                upstoxClient,
                expiredInstrumentCatalogService,
                backtestConditionService,
                backtestStrategyService,
                new TestTransactionManager()
        );

        InMemoryCandleStore store = new InMemoryCandleStore();
        stubCandleRepository(store, new AtomicBoolean(false));

        LocalDate tradeDate = LocalDate.of(2026, 1, 7);
        AdminDtos.BacktestAdvancedConditionsPayload enabledLegConditions =
                new AdminDtos.BacktestAdvancedConditionsPayload(true, null, null);
        AdminDtos.BacktestLegPayload leg =
                new AdminDtos.BacktestLegPayload("leg-1", "FUTURES", 1, "BUY", null, "WEEKLY", "ATM", 0, enabledLegConditions);
        AdminDtos.BacktestStrategyPayload strategy = strategyFor(tradeDate, tradeDate, leg);
        stubStrategyNormalization(strategy);

        BacktestConditionService.EvaluationContext strategyContext = BacktestConditionService.EvaluationContext.disabled();
        BacktestConditionService.EvaluationContext legContext = new BacktestConditionService.EvaluationContext(
                enabledLegConditions,
                tradeDate.minusDays(1),
                Map.of(),
                Map.of()
        );
        when(backtestConditionService.prepareEvaluationContext("tenant-a", strategy)).thenReturn(strategyContext);
        when(backtestConditionService.prepareEvaluationContext(
                eq("tenant-a"),
                eq("NSE_INDEX|Nifty 50"),
                eq(tradeDate),
                eq(tradeDate),
                same(leg.legConditions())
        )).thenReturn(legContext);
        when(backtestConditionService.evaluateIntradayExit(eq(legContext), eq(tradeDate), any(), any())).thenReturn(true);

        when(upstoxClient.fetchHistoricalCandles(anyString(), eq("minutes"), eq(5), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(candleResponse(List.of(
                        candleRow(tradeDate, "09:35", "100"),
                        candleRow(tradeDate, "09:40", "105"),
                        candleRow(tradeDate, "15:15", "110")
                )));
        when(expiredInstrumentCatalogService.getExpiries("tenant-a", "NSE_INDEX|Nifty 50", tradeDate)).thenReturn(List.of());

        AdminDtos.BacktestRunResponse response = service.runBacktest(
                "tenant-a",
                new AdminDtos.BacktestRunRequest("admin", strategy)
        );

        AdminDtos.BacktestResultRow row = response.rows().getFirst();
        assertEquals(Instant.parse("2026-01-07T04:10:00Z"), row.exitTs());
        assertEquals(new BigDecimal("5.00"), row.pnlAmount());
        assertTrue(response.notes().stream().anyMatch(note -> note.contains("leg exit condition hit on 2026-01-07 at 09:40")));
        assertTrue(response.notes().stream().anyMatch(note -> note.contains("Advance exit condition hit on 2026-01-07 at 09:40")));
    }

    @Test
    void runBacktest_appliesExitConditionEvenWhenRiskThresholdsDisabled() {
        BacktestRunService service = new BacktestRunService(
                candleRepository,
                upstoxClient,
                expiredInstrumentCatalogService,
                backtestConditionService,
                backtestStrategyService,
                new TestTransactionManager()
        );

        InMemoryCandleStore store = new InMemoryCandleStore();
        stubCandleRepository(store, new AtomicBoolean(false));

        LocalDate tradeDate = LocalDate.of(2026, 1, 7);
        AdminDtos.BacktestConditionRulePayload dummyRule = new AdminDtos.BacktestConditionRulePayload(
                "minutes",
                5,
                new AdminDtos.BacktestConditionOperandPayload("VALUE", null, null, "1", "NUMBER"),
                "EQUAL_TO",
                new AdminDtos.BacktestConditionOperandPayload("VALUE", null, null, "1", "NUMBER")
        );
        AdminDtos.BacktestAdvancedConditionsPayload strategyConditions = new AdminDtos.BacktestAdvancedConditionsPayload(
                true,
                null,
                new AdminDtos.BacktestConditionGroupPayload(
                        "AND",
                        List.of(new AdminDtos.BacktestConditionNodePayload(dummyRule, null))
                )
        );
        AdminDtos.BacktestStrategyPayload strategy = new AdminDtos.BacktestStrategyPayload(
                "Strategy exit intraday",
                "NSE_INDEX|Nifty 50",
                "CASH",
                "INTRADAY",
                LocalTime.of(9, 35),
                LocalTime.of(15, 15),
                tradeDate,
                tradeDate,
                List.of(new AdminDtos.BacktestLegPayload("leg-1", "FUTURES", 1, "BUY", null, "WEEKLY", "ATM", 0, null)),
                new AdminDtos.BacktestLegwiseSettingsPayload("PARTIAL", false, "ALL_LEGS", false, null, false, null, null),
                new AdminDtos.BacktestOverallSettingsPayload(false, null, null, false, null, null, false, null, null, null),
                strategyConditions
        );
        stubStrategyNormalization(strategy);

        BacktestConditionService.EvaluationContext strategyContext = new BacktestConditionService.EvaluationContext(
                strategyConditions,
                tradeDate.minusDays(1),
                Map.of(),
                Map.of()
        );
        when(backtestConditionService.prepareEvaluationContext("tenant-a", strategy)).thenReturn(strategyContext);
        when(backtestConditionService.evaluateIntradayExit(eq(strategyContext), eq(tradeDate), any(), any())).thenReturn(true);

        when(upstoxClient.fetchHistoricalCandles(anyString(), eq("minutes"), eq(5), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(candleResponse(List.of(
                        candleRow(tradeDate, "09:35", "100"),
                        candleRow(tradeDate, "09:40", "102"),
                        candleRow(tradeDate, "15:15", "110")
                )));
        when(expiredInstrumentCatalogService.getExpiries("tenant-a", "NSE_INDEX|Nifty 50", tradeDate)).thenReturn(List.of());

        AdminDtos.BacktestRunResponse response = service.runBacktest(
                "tenant-a",
                new AdminDtos.BacktestRunRequest("admin", strategy)
        );

        AdminDtos.BacktestResultRow row = response.rows().getFirst();
        assertEquals(Instant.parse("2026-01-07T04:10:00Z"), row.exitTs());
        assertEquals(new BigDecimal("2.00"), row.pnlAmount());
        assertTrue(response.notes().stream().anyMatch(note -> note.contains("Advance exit condition hit on 2026-01-07 at 09:40")));
    }

    private void stubStrategyNormalization(AdminDtos.BacktestStrategyPayload strategy) {
        when(backtestStrategyService.normalizeStrategyPayload(any(AdminDtos.BacktestStrategyPayload.class))).thenReturn(strategy);
        doNothing().when(backtestStrategyService).validateStrategyPayload(strategy);
        lenient().when(backtestConditionService.prepareEvaluationContext(anyString(), any(AdminDtos.BacktestStrategyPayload.class)))
                .thenReturn(BacktestConditionService.EvaluationContext.disabled());
        lenient().when(backtestConditionService.prepareEvaluationContext(anyString(), anyString(), any(LocalDate.class), any(LocalDate.class), any()))
                .thenReturn(BacktestConditionService.EvaluationContext.disabled());
        lenient().when(backtestConditionService.evaluateIntradayEntry(any(), any(), any(), any()))
                .thenReturn(true);
        lenient().when(backtestConditionService.evaluateIntradayExit(any(), any(), any(), any()))
                .thenReturn(false);
    }

    private UpstoxCandleResponse candleResponse(List<List<Object>> candles) {
        return new UpstoxCandleResponse("success", candles.size(), candles);
    }

    private List<Object> candleRow(LocalDate date, String hhmm, String closePrice) {
        return List.of(
                OffsetDateTime.of(date, LocalTime.parse(hhmm), ZoneOffset.ofHoursMinutes(5, 30)).toString(),
                closePrice,
                closePrice,
                closePrice,
                closePrice,
                "100"
        );
    }

    private AdminDtos.BacktestStrategyPayload strategyFor(
            LocalDate startDate,
            LocalDate endDate,
            AdminDtos.BacktestLegPayload leg
    ) {
        return strategyFor(
                startDate,
                endDate,
                leg,
                new AdminDtos.BacktestOverallSettingsPayload(
                        false,
                        null,
                        null,
                        false,
                        null,
                        null,
                        false,
                        null,
                        null,
                        null
                )
        );
    }

    private AdminDtos.BacktestStrategyPayload strategyFor(
            LocalDate startDate,
            LocalDate endDate,
            AdminDtos.BacktestLegPayload leg,
            AdminDtos.BacktestOverallSettingsPayload overallSettings
    ) {
        return strategyFor(
                startDate,
                endDate,
                leg,
                overallSettings,
                new AdminDtos.BacktestAdvancedConditionsPayload(false, null, null)
        );
    }

    private AdminDtos.BacktestStrategyPayload strategyFor(
            LocalDate startDate,
            LocalDate endDate,
            AdminDtos.BacktestLegPayload leg,
            AdminDtos.BacktestOverallSettingsPayload overallSettings,
            AdminDtos.BacktestAdvancedConditionsPayload advancedConditions
    ) {
        return new AdminDtos.BacktestStrategyPayload(
                "Test Strategy",
                "NSE_INDEX|Nifty 50",
                "CASH",
                "INTRADAY",
                LocalTime.of(9, 35),
                LocalTime.of(15, 15),
                startDate,
                endDate,
                List.of(leg),
                new AdminDtos.BacktestLegwiseSettingsPayload(
                        "PARTIAL",
                        false,
                        "ALL_LEGS",
                        false,
                        null,
                        false,
                        null,
                        null
                ),
                overallSettings,
                advancedConditions
        );
    }

    private UpstoxClient.ExpiredDerivativeContractView optionContract(
            LocalDate expiryDate,
            String instrumentKey,
            String symbol,
            String strike
    ) {
        return new UpstoxClient.ExpiredDerivativeContractView(
                "NIFTY CALL",
                "NSE_FO",
                "NSE",
                expiryDate,
                instrumentKey,
                instrumentKey.replace("NSE_FO|", ""),
                symbol,
                50,
                "OPTIDX",
                "NSE_INDEX|Nifty 50",
                new BigDecimal(strike),
                true,
                "CE"
        );
    }

    private UpstoxClient.ExpiredDerivativeContractView futureContract(
            LocalDate expiryDate,
            String instrumentKey
    ) {
        return new UpstoxClient.ExpiredDerivativeContractView(
                "NIFTY FUT",
                "NSE_FO",
                "NSE",
                expiryDate,
                instrumentKey,
                instrumentKey.replace("NSE_FO|", ""),
                "NIFTY26JANFUT",
                50,
                "FUTIDX",
                "NSE_INDEX|Nifty 50",
                null,
                false,
                null
        );
    }

    private void stubCandleRepository(InMemoryCandleStore store, AtomicBoolean sawTransaction) {
        when(candleRepository.upsert(anyString(), anyString(), anyString(), anyInt(), any(Instant.class), any(BigDecimal.class), any(BigDecimal.class), any(BigDecimal.class), any(BigDecimal.class), any()))
                .thenAnswer(invocation -> {
                    sawTransaction.set(TransactionSynchronizationManager.isActualTransactionActive());
                    store.upsert(
                            invocation.getArgument(0),
                            invocation.getArgument(1),
                            invocation.getArgument(2),
                            invocation.getArgument(3),
                            invocation.getArgument(4),
                            invocation.getArgument(5),
                            invocation.getArgument(6),
                            invocation.getArgument(7),
                            invocation.getArgument(8),
                            invocation.getArgument(9)
                    );
                    return 1;
                });

        when(candleRepository.findByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeIntervalAndCandleTsGreaterThanEqualAndCandleTsLessThanOrderByCandleTsAsc(
                anyString(), anyString(), anyString(), anyInt(), any(Instant.class), any(Instant.class)
        )).thenAnswer(invocation -> store.find(
                invocation.getArgument(0),
                invocation.getArgument(1),
                invocation.getArgument(2),
                invocation.getArgument(3),
                invocation.getArgument(4),
                invocation.getArgument(5)
        ));

        lenient().when(candleRepository.findFirstByTenantIdAndInstrumentKeyAndTimeframeUnitAndCandleTsGreaterThanEqualAndCandleTsLessThanOrderByCandleTsDescTimeframeIntervalAsc(
                anyString(), anyString(), anyString(), any(Instant.class), any(Instant.class)
        )).thenReturn(java.util.Optional.empty());
    }

    private static final class InMemoryCandleStore {
        private final Map<String, List<CandleEntity>> byStream = new HashMap<>();

        private void upsert(
                String tenantId,
                String instrumentKey,
                String timeframeUnit,
                Integer timeframeInterval,
                Instant candleTs,
                BigDecimal openPrice,
                BigDecimal highPrice,
                BigDecimal lowPrice,
                BigDecimal closePrice,
                Long volume
        ) {
            String key = key(tenantId, instrumentKey, timeframeUnit, timeframeInterval);
            List<CandleEntity> candles = byStream.computeIfAbsent(key, ignored -> new ArrayList<>());
            int existingIndex = -1;
            for (int i = 0; i < candles.size(); i += 1) {
                if (candles.get(i).getCandleTs().equals(candleTs)) {
                    existingIndex = i;
                    break;
                }
            }
            CandleEntity entity = new CandleEntity(
                    tenantId,
                    instrumentKey,
                    timeframeUnit,
                    timeframeInterval,
                    candleTs,
                    openPrice,
                    highPrice,
                    lowPrice,
                    closePrice,
                    volume
            );
            if (existingIndex >= 0) {
                candles.set(existingIndex, entity);
            } else {
                candles.add(entity);
            }
            candles.sort(Comparator.comparing(CandleEntity::getCandleTs));
        }

        private List<CandleEntity> find(
                String tenantId,
                String instrumentKey,
                String timeframeUnit,
                Integer timeframeInterval,
                Instant from,
                Instant to
        ) {
            String key = key(tenantId, instrumentKey, timeframeUnit, timeframeInterval);
            return byStream.getOrDefault(key, List.of())
                    .stream()
                    .filter(candle -> !candle.getCandleTs().isBefore(from) && candle.getCandleTs().isBefore(to))
                    .sorted(Comparator.comparing(CandleEntity::getCandleTs))
                    .toList();
        }

        private String key(String tenantId, String instrumentKey, String timeframeUnit, Integer timeframeInterval) {
            return tenantId + "|" + instrumentKey + "|" + timeframeUnit + "|" + timeframeInterval;
        }
    }

    private static final class TestTransactionManager implements PlatformTransactionManager {
        @Override
        public TransactionStatus getTransaction(TransactionDefinition definition) {
            if (!TransactionSynchronizationManager.isSynchronizationActive()) {
                TransactionSynchronizationManager.initSynchronization();
            }
            TransactionSynchronizationManager.setActualTransactionActive(true);
            return new SimpleTransactionStatus();
        }

        @Override
        public void commit(TransactionStatus status) {
            clearContext();
        }

        @Override
        public void rollback(TransactionStatus status) {
            clearContext();
        }

        private void clearContext() {
            TransactionSynchronizationManager.setActualTransactionActive(false);
            if (TransactionSynchronizationManager.isSynchronizationActive()) {
                TransactionSynchronizationManager.clearSynchronization();
            }
        }
    }
}
