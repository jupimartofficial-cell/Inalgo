package com.inalgo.trade.upstox;

import com.inalgo.trade.entity.UpstoxMigrationStateEntity;
import com.inalgo.trade.repository.CandleRepository;
import com.inalgo.trade.repository.UpstoxMigrationStateRepository;
import jakarta.validation.ValidationException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionStatus;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeast;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;

@ExtendWith(MockitoExtension.class)
class UpstoxHistoricalMigrationServiceTest {

    @Mock
    private UpstoxClient upstoxClient;

    @Mock
    private CandleRepository candleRepository;

    @Mock
    private UpstoxMigrationStateRepository stateRepository;

    @Mock
    private PlatformTransactionManager transactionManager;

    private UpstoxMigrationProperties properties;
    private UpstoxHistoricalMigrationService service;

    @BeforeEach
    void setUp() {
        properties = new UpstoxMigrationProperties(
                true,
                "0 */5 * * * *",
                5,
                2,
                30,
                List.of(new UpstoxMigrationProperties.StreamConfig(
                        "tenant-a",
                        "NSE_EQ|INE848E01016",
                        "1minute",
                        LocalDate.now().minusDays(3)
                ))
        );
        lenient().when(transactionManager.getTransaction(any(TransactionDefinition.class))).thenReturn(new SimpleTransactionStatus());
        service = new UpstoxHistoricalMigrationService(upstoxClient, candleRepository, stateRepository, properties, transactionManager);
    }

    private static class SimpleTransactionStatus implements TransactionStatus {
        @Override public boolean hasSavepoint() { return false; }
        @Override public void flush() { }
        @Override public boolean isNewTransaction() { return true; }
        @Override public boolean isRollbackOnly() { return false; }
        @Override public void setRollbackOnly() { }
        @Override public boolean isCompleted() { return false; }
        @Override public Object createSavepoint() { return null; }
        @Override public void rollbackToSavepoint(Object savepoint) { }
        @Override public void releaseSavepoint(Object savepoint) { }
    }

    @Test
    void migrateTick_resumesFromSavedDateAndAdvancesState() {
        UpstoxMigrationStateEntity savedState = new UpstoxMigrationStateEntity(
                "tenant-a",
                "NSE_EQ|INE848E01016",
                "minutes",
                1,
                LocalDate.now().minusDays(2)
        );

        when(stateRepository.findByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeInterval(
                "tenant-a", "NSE_EQ|INE848E01016", "minutes", 1)).thenReturn(Optional.of(savedState));
        when(stateRepository.save(any(UpstoxMigrationStateEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(upstoxClient.fetchHistoricalCandles(eq("NSE_EQ|INE848E01016"), eq("minutes"), eq(1), eq(LocalDate.now().minusDays(1)), eq(LocalDate.now().minusDays(2)))).thenReturn(
                new UpstoxCandleResponse("success", 1,
                        List.of(List.of("2025-01-01T09:15:00+05:30", 100, 101, 99, 100.5, 1234)))
        );
        when(upstoxClient.fetchIntradayCandles("NSE_EQ|INE848E01016", "minutes", 1)).thenReturn(
                new UpstoxCandleResponse("success", 1,
                        List.of(List.of("2025-01-02T09:15:00+05:30", 101, 102, 100, 101.5, 4321)))
        );

        service.migrateTick();

        verify(upstoxClient).fetchHistoricalCandles(eq("NSE_EQ|INE848E01016"), eq("minutes"), eq(1), eq(LocalDate.now().minusDays(1)), eq(LocalDate.now().minusDays(2)));
        verify(upstoxClient).fetchIntradayCandles("NSE_EQ|INE848E01016", "minutes", 1);
        verify(candleRepository).upsert(eq("tenant-a"), eq("NSE_EQ|INE848E01016"), eq("minutes"), eq(1), any(), any(), any(), any(), any(), eq(1234L));
        verify(stateRepository, atLeast(2)).save(savedState);
    }

    @Test
    void migrateTick_whenWindowTooLarge_retriesWithSmallerWindow() {
        UpstoxMigrationStateEntity savedState = new UpstoxMigrationStateEntity(
                "tenant-a",
                "NSE_EQ|INE848E01016",
                "minutes",
                1,
                LocalDate.now().minusDays(4)
        );
        when(stateRepository.findByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeInterval(
                "tenant-a", "NSE_EQ|INE848E01016", "minutes", 1)).thenReturn(Optional.of(savedState));
        when(stateRepository.save(any(UpstoxMigrationStateEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        when(upstoxClient.fetchHistoricalCandles(any(), any(), any(Integer.class), any(), any()))
                .thenThrow(new ValidationException("UDAPI1148"))
                .thenReturn(new UpstoxCandleResponse("success", 0, List.of()));

        service.migrateTick();

        verify(upstoxClient, times(2)).fetchHistoricalCandles(eq("NSE_EQ|INE848E01016"), eq("minutes"), eq(1), any(), eq(LocalDate.now().minusDays(4)));
    }

    @Test
    void migrateTick_whenCandlePayloadMalformed_marksFailedAndContinues() {
        UpstoxMigrationStateEntity savedState = new UpstoxMigrationStateEntity(
                "tenant-a",
                "NSE_EQ|INE848E01016",
                "minutes",
                1,
                LocalDate.now().minusDays(1)
        );
        when(stateRepository.findByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeInterval(
                "tenant-a", "NSE_EQ|INE848E01016", "minutes", 1)).thenReturn(Optional.of(savedState));
        when(stateRepository.save(any(UpstoxMigrationStateEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(upstoxClient.fetchHistoricalCandles(eq("NSE_EQ|INE848E01016"), eq("minutes"), eq(1), eq(LocalDate.now().minusDays(1)), eq(LocalDate.now().minusDays(1)))).thenReturn(
                new UpstoxCandleResponse("success", 1, List.of(List.of("2025-01-01T09:15:00+05:30", 100)))
        );
        when(upstoxClient.fetchIntradayCandles("NSE_EQ|INE848E01016", "minutes", 1))
                .thenReturn(new UpstoxCandleResponse("success", 0, List.of()));

        service.migrateTick();

        ArgumentCaptor<UpstoxMigrationStateEntity> captor = ArgumentCaptor.forClass(UpstoxMigrationStateEntity.class);
        verify(stateRepository, atLeast(1)).save(captor.capture());
        UpstoxMigrationStateEntity lastState = captor.getValue();
        assertFalse(lastState.isCompleted());
        assertEquals("FAILED", lastState.getLastRunStatus());
    }

    @Test
    void migrateTickForTenant_runsOnlyRequestedTenantStreams() {
        properties = new UpstoxMigrationProperties(
                true,
                "0 */5 * * * *",
                5,
                2,
                30,
                List.of(
                        new UpstoxMigrationProperties.StreamConfig("tenant-a", "NSE_EQ|A", "1minute", LocalDate.now().minusDays(2)),
                        new UpstoxMigrationProperties.StreamConfig("tenant-b", "NSE_EQ|B", "1minute", LocalDate.now().minusDays(2))
                )
        );
        service = new UpstoxHistoricalMigrationService(upstoxClient, candleRepository, stateRepository, properties, transactionManager);

        UpstoxMigrationStateEntity stateA = new UpstoxMigrationStateEntity("tenant-a", "NSE_EQ|A", "minutes", 1, LocalDate.now().minusDays(2));
        when(stateRepository.findByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeInterval("tenant-a", "NSE_EQ|A", "minutes", 1))
                .thenReturn(Optional.of(stateA));
        when(stateRepository.save(any(UpstoxMigrationStateEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(upstoxClient.fetchHistoricalCandles(eq("NSE_EQ|A"), eq("minutes"), eq(1), any(), any()))
                .thenReturn(new UpstoxCandleResponse("success", 0, List.of()));
        when(upstoxClient.fetchIntradayCandles("NSE_EQ|A", "minutes", 1))
                .thenReturn(new UpstoxCandleResponse("success", 0, List.of()));

        service.migrateTickForTenant("tenant-a");

        verify(upstoxClient, times(1)).fetchHistoricalCandles(eq("NSE_EQ|A"), eq("minutes"), eq(1), any(), any());
        verify(upstoxClient, times(1)).fetchIntradayCandles("NSE_EQ|A", "minutes", 1);
        verify(upstoxClient, never()).fetchHistoricalCandles(eq("NSE_EQ|B"), eq("minutes"), eq(1), any(), any());
    }

    @Test
    void migrateTick_continuesOtherStreamsWhenOneStreamFails() {
        properties = new UpstoxMigrationProperties(
                true,
                "0 */5 * * * *",
                5,
                2,
                30,
                List.of(
                        new UpstoxMigrationProperties.StreamConfig("tenant-a", "NSE_EQ|BAD", "1minute", LocalDate.now().minusDays(2)),
                        new UpstoxMigrationProperties.StreamConfig("tenant-a", "NSE_EQ|GOOD", "1minute", LocalDate.now().minusDays(2))
                )
        );
        service = new UpstoxHistoricalMigrationService(upstoxClient, candleRepository, stateRepository, properties, transactionManager);

        UpstoxMigrationStateEntity badState = new UpstoxMigrationStateEntity("tenant-a", "NSE_EQ|BAD", "minutes", 1, LocalDate.now().minusDays(2));
        UpstoxMigrationStateEntity goodState = new UpstoxMigrationStateEntity("tenant-a", "NSE_EQ|GOOD", "minutes", 1, LocalDate.now().minusDays(2));
        when(stateRepository.findByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeInterval("tenant-a", "NSE_EQ|BAD", "minutes", 1))
                .thenReturn(Optional.of(badState));
        when(stateRepository.findByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeInterval("tenant-a", "NSE_EQ|GOOD", "minutes", 1))
                .thenReturn(Optional.of(goodState));
        when(stateRepository.save(any(UpstoxMigrationStateEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(upstoxClient.fetchHistoricalCandles(eq("NSE_EQ|BAD"), eq("minutes"), eq(1), any(), any()))
                .thenThrow(new RuntimeException("upstream failure"));
        when(upstoxClient.fetchHistoricalCandles(eq("NSE_EQ|GOOD"), eq("minutes"), eq(1), any(), any()))
                .thenReturn(new UpstoxCandleResponse("success", 0, List.of()));
        when(upstoxClient.fetchIntradayCandles("NSE_EQ|GOOD", "minutes", 1))
                .thenReturn(new UpstoxCandleResponse("success", 0, List.of()));

        service.migrateTick();

        verify(upstoxClient).fetchHistoricalCandles(eq("NSE_EQ|BAD"), eq("minutes"), eq(1), any(), any());
        verify(upstoxClient).fetchHistoricalCandles(eq("NSE_EQ|GOOD"), eq("minutes"), eq(1), any(), any());
        verify(upstoxClient).fetchIntradayCandles("NSE_EQ|GOOD", "minutes", 1);
    }

    @Test
    void migrateTick_reopensCompletedStateWhenNewTradingDayStarts() {
        LocalDate today = LocalDate.now();
        UpstoxMigrationStateEntity completedState = new UpstoxMigrationStateEntity(
                "tenant-a",
                "NSE_EQ|INE848E01016",
                "minutes",
                1,
                today
        );
        completedState.markCompleted();

        when(stateRepository.findByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeInterval(
                "tenant-a", "NSE_EQ|INE848E01016", "minutes", 1)).thenReturn(Optional.of(completedState));
        when(stateRepository.save(any(UpstoxMigrationStateEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(upstoxClient.fetchIntradayCandles("NSE_EQ|INE848E01016", "minutes", 1))
                .thenReturn(new UpstoxCandleResponse("success", 0, List.of()));

        service.migrateTick();

        verify(upstoxClient).fetchIntradayCandles("NSE_EQ|INE848E01016", "minutes", 1);
        assertEquals("SUCCESS", completedState.getLastRunStatus());
        assertEquals(today.plusDays(1), completedState.getNextFromDate());
    }

    @Test
    void loadOrCreateState_resumesFromLatestPersistedCandleWhenStateMissing() {
        reset(stateRepository, candleRepository);
        when(stateRepository.findByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeInterval(
                "tenant-a", "NSE_EQ|INE848E01016", "minutes", 1)).thenReturn(Optional.empty());
        when(stateRepository.save(any(UpstoxMigrationStateEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var latestCandle = new com.inalgo.trade.entity.CandleEntity(
                "tenant-a",
                "NSE_EQ|INE848E01016",
                "minutes",
                1,
                LocalDate.now().minusDays(2).atStartOfDay(ZoneId.systemDefault()).toInstant(),
                java.math.BigDecimal.ONE,
                java.math.BigDecimal.ONE,
                java.math.BigDecimal.ONE,
                java.math.BigDecimal.ONE,
                1L
        );
        when(candleRepository.findTopByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeIntervalOrderByCandleTsDesc(
                "tenant-a", "NSE_EQ|INE848E01016", "minutes", 1
        )).thenReturn(Optional.of(latestCandle));

        UpstoxMigrationStateEntity state = service.loadOrCreateState(
                properties.streams().getFirst(),
                SupportedTimeframe.parse("1minute")
        );

        assertEquals(LocalDate.now().minusDays(1), state.getNextFromDate());
    }

    @Test
    void restartStreamFromLastCandle_reopensCompletedStateFromLatestCandleDate() {
        reset(stateRepository, candleRepository);

        UpstoxMigrationStateEntity completedState = new UpstoxMigrationStateEntity(
                "tenant-a",
                "NSE_EQ|INE848E01016",
                "minutes",
                1,
                LocalDate.now().plusDays(1)
        );
        completedState.markCompleted();
        when(stateRepository.findByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeInterval(
                "tenant-a", "NSE_EQ|INE848E01016", "minutes", 1
        )).thenReturn(Optional.of(completedState));
        when(stateRepository.save(any(UpstoxMigrationStateEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var latestCandle = new com.inalgo.trade.entity.CandleEntity(
                "tenant-a",
                "NSE_EQ|INE848E01016",
                "minutes",
                1,
                LocalDate.now().minusDays(2).atStartOfDay(ZoneId.systemDefault()).toInstant(),
                java.math.BigDecimal.ONE,
                java.math.BigDecimal.ONE,
                java.math.BigDecimal.ONE,
                java.math.BigDecimal.ONE,
                1L
        );
        when(candleRepository.findTopByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeIntervalOrderByCandleTsDesc(
                "tenant-a", "NSE_EQ|INE848E01016", "minutes", 1
        )).thenReturn(Optional.of(latestCandle));

        UpstoxMigrationStateEntity restartedState = service.restartStreamFromLastCandle(
                "tenant-a",
                "NSE_EQ|INE848E01016",
                "minutes",
                1,
                LocalDate.now().minusDays(5)
        );

        assertEquals(LocalDate.now().minusDays(2), restartedState.getNextFromDate());
        assertFalse(restartedState.isCompleted());
        assertEquals("PENDING", restartedState.getLastRunStatus());
    }

    @Test
    void migrateSingleChunkForStream_fetchesTodayFromIntradayEndpoint() {
        reset(stateRepository, candleRepository, upstoxClient);

        LocalDate today = LocalDate.now();
        UpstoxMigrationStateEntity state = new UpstoxMigrationStateEntity(
                "tenant-a",
                "NSE_EQ|INE848E01016",
                "minutes",
                1,
                today
        );
        when(stateRepository.findByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeInterval(
                "tenant-a", "NSE_EQ|INE848E01016", "minutes", 1
        )).thenReturn(Optional.of(state));
        when(stateRepository.save(any(UpstoxMigrationStateEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(upstoxClient.fetchIntradayCandles("NSE_EQ|INE848E01016", "minutes", 1))
                .thenReturn(new UpstoxCandleResponse("success", 1,
                        List.of(List.of("2025-01-01T09:15:00+05:30", 100, 101, 99, 100.5, 1234))));

        service.migrateSingleChunkForStream(
                "tenant-a",
                "NSE_EQ|INE848E01016",
                "minutes",
                1,
                today.minusDays(5)
        );

        verify(upstoxClient, never()).fetchHistoricalCandles(eq("NSE_EQ|INE848E01016"), eq("minutes"), eq(1), any(), eq(today));
        verify(upstoxClient, times(1)).fetchIntradayCandles("NSE_EQ|INE848E01016", "minutes", 1);
    }

    @Test
    void migrateSingleChunkForStream_fetchesPriorDaysHistoricallyAndTodayIntraday() {
        reset(stateRepository, candleRepository, upstoxClient);

        LocalDate today = LocalDate.now();
        LocalDate resumeFrom = today.minusDays(2);
        UpstoxMigrationStateEntity state = new UpstoxMigrationStateEntity(
                "tenant-a",
                "NSE_EQ|INE848E01016",
                "minutes",
                1,
                resumeFrom
        );
        when(stateRepository.findByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeInterval(
                "tenant-a", "NSE_EQ|INE848E01016", "minutes", 1
        )).thenReturn(Optional.of(state));
        when(stateRepository.save(any(UpstoxMigrationStateEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(upstoxClient.fetchHistoricalCandles("NSE_EQ|INE848E01016", "minutes", 1, today.minusDays(1), resumeFrom))
                .thenReturn(new UpstoxCandleResponse("success", 1,
                        List.of(List.of("2025-01-01T09:15:00+05:30", 100, 101, 99, 100.5, 1234))));
        when(upstoxClient.fetchIntradayCandles("NSE_EQ|INE848E01016", "minutes", 1))
                .thenReturn(new UpstoxCandleResponse("success", 1,
                        List.of(List.of("2025-01-02T09:15:00+05:30", 101, 102, 100, 101.5, 2234))));

        service.migrateSingleChunkForStream(
                "tenant-a",
                "NSE_EQ|INE848E01016",
                "minutes",
                1,
                today.minusDays(5)
        );

        verify(upstoxClient, times(1)).fetchHistoricalCandles("NSE_EQ|INE848E01016", "minutes", 1, today.minusDays(1), resumeFrom);
        verify(upstoxClient, times(1)).fetchIntradayCandles("NSE_EQ|INE848E01016", "minutes", 1);
        verify(candleRepository, times(2)).upsert(eq("tenant-a"), eq("NSE_EQ|INE848E01016"), eq("minutes"), eq(1), any(), any(), any(), any(), any(), any());
    }
}
