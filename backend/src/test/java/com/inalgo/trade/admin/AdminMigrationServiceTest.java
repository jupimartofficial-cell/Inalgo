package com.inalgo.trade.admin;

import com.inalgo.trade.entity.AdminMigrationJobEntity;
import com.inalgo.trade.entity.UpstoxMigrationStateEntity;
import com.inalgo.trade.repository.AdminMigrationJobRepository;
import com.inalgo.trade.repository.CandleRepository;
import com.inalgo.trade.repository.UpstoxMigrationStateRepository;
import com.inalgo.trade.service.TradingAnalyticsService;
import com.inalgo.trade.upstox.UpstoxHistoricalMigrationService;
import com.inalgo.trade.upstox.UpstoxMigrationProperties;
import jakarta.validation.ValidationException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeast;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminMigrationServiceTest {

    @Mock
    private AdminMigrationJobRepository migrationJobRepository;

    @Mock
    private UpstoxMigrationStateRepository migrationStateRepository;

    @Mock
    private CandleRepository candleRepository;

    @Mock
    private ObjectProvider<UpstoxHistoricalMigrationService> migrationServiceProvider;

    @Mock
    private UpstoxHistoricalMigrationService migrationService;

    @Mock
    private UpstoxMigrationProperties migrationProperties;

    @Mock
    private TradingAnalyticsService tradingAnalyticsService;

    private AdminMigrationService newService() {
        Map<String, AdminMigrationJobEntity> storedJobs = new ConcurrentHashMap<>();
        org.mockito.Mockito.lenient().when(migrationProperties.streams()).thenReturn(List.of());
        org.mockito.Mockito.lenient().when(migrationJobRepository.findAllByTenantIdOrderByInstrumentKeyAscTimeframeUnitAscTimeframeIntervalAscJobTypeAsc(any()))
                .thenAnswer(invocation -> storedJobs.values().stream()
                        .filter(entity -> invocation.getArgument(0).equals(entity.getTenantId()))
                        .toList());
        org.mockito.Mockito.lenient().when(migrationJobRepository.findByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeIntervalAndJobType(any(), any(), any(), any(), any()))
                .thenAnswer(invocation -> Optional.ofNullable(storedJobs.get(
                        invocation.getArgument(0)
                                + "|" + invocation.getArgument(1)
                                + "|" + invocation.getArgument(2)
                                + "|" + invocation.getArgument(3)
                                + "|" + invocation.getArgument(4)
                )));
        org.mockito.Mockito.lenient().when(migrationJobRepository.save(any(AdminMigrationJobEntity.class))).thenAnswer(invocation -> {
            AdminMigrationJobEntity entity = invocation.getArgument(0);
            storedJobs.put(
                    entity.getTenantId()
                            + "|" + entity.getInstrumentKey()
                            + "|" + entity.getTimeframeUnit()
                            + "|" + entity.getTimeframeInterval()
                            + "|" + entity.getJobType(),
                    entity
            );
            return entity;
        });
        org.mockito.Mockito.lenient().when(candleRepository.existsByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeInterval(any(), any(), any(), any()))
                .thenReturn(false);
        return new AdminMigrationService(
                migrationJobRepository,
                candleRepository,
                migrationStateRepository,
                migrationServiceProvider,
                migrationProperties,
                tradingAnalyticsService
        );
    }

    @Test
    void startJobs_throwsWhenStreamListIsEmpty() {
        AdminMigrationService service = newService();
        when(migrationServiceProvider.getIfAvailable()).thenReturn(migrationService);

        assertThrows(ValidationException.class, () -> service.startJobs("tenant-a", List.of(), null));
    }

    @Test
    void startJobs_runsStreamChunkWhenValidRequestProvided() throws Exception {
        AdminMigrationService service = newService();
        when(migrationServiceProvider.getIfAvailable()).thenReturn(migrationService);

        UpstoxMigrationStateEntity state = new UpstoxMigrationStateEntity(
                "tenant-a",
                "NSE_INDEX|Nifty 50",
                "days",
                1,
                LocalDate.now()
        );
        state.markCompleted();

        when(migrationService.restartStreamFromLastCandle(eq("tenant-a"), any(), any(), any(), any())).thenReturn(state);
        when(migrationService.migrateSingleChunkForStream(eq("tenant-a"), any(), any(), any(), any())).thenReturn(state);

        service.startJobs("tenant-a", List.of(new AdminDtos.MigrationStreamRequest(
                "NSE_INDEX|Nifty 50",
                "days",
                1,
                LocalDate.of(2024, 1, 1)
        )), null);

        Thread.sleep(300);

        verify(migrationService, atLeastOnce()).restartStreamFromLastCandle(eq("tenant-a"), any(), any(), any(), any());
        verify(migrationService, atLeastOnce()).migrateSingleChunkForStream(eq("tenant-a"), any(), any(), any(), any());
    }

    @Test
    void startJob_restartsExistingStoppedOrCompletedJob() throws Exception {
        AdminMigrationService service = newService();
        when(migrationServiceProvider.getIfAvailable()).thenReturn(migrationService);

        UpstoxMigrationStateEntity state = new UpstoxMigrationStateEntity(
                "tenant-a",
                "NSE_INDEX|Nifty 50",
                "days",
                1,
                LocalDate.now()
        );
        state.markCompleted();

        when(migrationService.restartStreamFromLastCandle(eq("tenant-a"), any(), any(), any(), any())).thenReturn(state);
        when(migrationService.migrateSingleChunkForStream(eq("tenant-a"), any(), any(), any(), any())).thenReturn(state);

        service.startJobs("tenant-a", List.of(new AdminDtos.MigrationStreamRequest(
                "NSE_INDEX|Nifty 50",
                "days",
                1,
                LocalDate.of(2024, 1, 1)
        )), null);
        Thread.sleep(300);

        service.startJob("tenant-a", "NSE_INDEX|Nifty 50|days|1");
        Thread.sleep(300);

        verify(migrationService, atLeast(2)).migrateSingleChunkForStream(eq("tenant-a"), any(), any(), any(), any());
    }

    @Test
    void startJob_onCompletedStream_realignsToLastPersistedCandleBeforeSync() throws Exception {
        AdminMigrationService service = newService();
        when(migrationServiceProvider.getIfAvailable()).thenReturn(migrationService);

        UpstoxMigrationStateEntity restartedState = new UpstoxMigrationStateEntity(
                "tenant-a",
                "NSE_INDEX|Nifty 50",
                "days",
                1,
                LocalDate.now().minusDays(1)
        );
        restartedState.markCompleted();

        when(migrationService.restartStreamFromLastCandle(eq("tenant-a"), any(), any(), any(), any())).thenReturn(restartedState);
        when(migrationService.migrateSingleChunkForStream(eq("tenant-a"), any(), any(), any(), any())).thenReturn(restartedState);
        service.startJobs("tenant-a", List.of(new AdminDtos.MigrationStreamRequest(
                "NSE_INDEX|Nifty 50",
                "days",
                1,
                LocalDate.of(2024, 1, 1)
        )), null);
        Thread.sleep(300);

        service.startJob("tenant-a", "NSE_INDEX|Nifty 50|days|1");
        Thread.sleep(300);

        verify(migrationService, atLeast(2)).restartStreamFromLastCandle(eq("tenant-a"), any(), any(), any(), any());
    }

    @Test
    void runJob_retriesOnRateLimitBeforeFailing() throws Exception {
        AdminMigrationService service = newService();
        when(migrationServiceProvider.getIfAvailable()).thenReturn(migrationService);

        UpstoxMigrationStateEntity completedState = new UpstoxMigrationStateEntity(
                "tenant-a",
                "NSE_INDEX|Nifty 50",
                "minutes",
                1,
                LocalDate.now()
        );
        completedState.markCompleted();

        when(migrationService.restartStreamFromLastCandle(eq("tenant-a"), any(), any(), any(), any()))
                .thenReturn(completedState);
        when(migrationService.migrateSingleChunkForStream(eq("tenant-a"), any(), any(), any(), any()))
                .thenThrow(new RuntimeException("Upstox request failed with status: 429 TOO_MANY_REQUESTS"))
                .thenReturn(completedState);

        service.startJobs("tenant-a", List.of(new AdminDtos.MigrationStreamRequest(
                "NSE_INDEX|Nifty 50",
                "minutes",
                1,
                LocalDate.of(2024, 1, 1)
        )), null);

        Thread.sleep(3200);

        verify(migrationService, atLeast(2)).migrateSingleChunkForStream(eq("tenant-a"), any(), any(), any(), any());
    }

    @Test
    void listJobs_createsPendingRowsFromConfiguredStreams() {
        UpstoxMigrationProperties.StreamConfig stream = new UpstoxMigrationProperties.StreamConfig(
                "tenant-a",
                "NSE_INDEX|Nifty 50",
                "1day",
                LocalDate.of(2024, 1, 1)
        );
        AdminMigrationService service = newService();
        when(migrationProperties.streams()).thenReturn(List.of(stream));

        List<AdminDtos.MigrationJobResponse> jobs = service.listJobs("tenant-a");

        assertTrue(jobs.stream().anyMatch(job ->
                "NSE_INDEX|Nifty 50".equals(job.instrumentKey())
                        && "days".equals(job.timeframeUnit())
                        && Integer.valueOf(1).equals(job.timeframeInterval())
                        && LocalDate.of(2024, 1, 1).equals(job.bootstrapFromDate())
        ));
    }

    @Test
    void listJobs_seedsDefaultCatalogIncludingSpotIndices() {
        // Futures keys now come from FuturesContractRollService (registry-backed).
        // The test constructor passes null for that service, so only spot indices are seeded here.
        AdminMigrationService service = newService();

        List<AdminDtos.MigrationJobResponse> jobs = service.listJobs("tenant-a");

        assertTrue(jobs.stream().anyMatch(job ->
                "NSE_INDEX|Nifty 50".equals(job.instrumentKey())
                        && "minutes".equals(job.timeframeUnit())
                        && Integer.valueOf(1).equals(job.timeframeInterval())
        ));
        assertTrue(jobs.stream().anyMatch(job ->
                "NSE_INDEX|Nifty Bank".equals(job.instrumentKey())
                        && "minutes".equals(job.timeframeUnit())
                        && Integer.valueOf(1).equals(job.timeframeInterval())
        ));
        assertTrue(jobs.stream().anyMatch(job ->
                "BSE_INDEX|SENSEX".equals(job.instrumentKey())
                        && "minutes".equals(job.timeframeUnit())
                        && Integer.valueOf(1).equals(job.timeframeInterval())
        ));
        assertTrue(jobs.stream().anyMatch(job ->
                "NSE_INDEX|Nifty 50".equals(job.instrumentKey())
                        && "minutes".equals(job.timeframeUnit())
                        && Integer.valueOf(1).equals(job.timeframeInterval())
                        && "TRADING_ANALYTICS_BACKFILL".equals(job.jobType())
        ));
    }

    @Test
    void listJobs_filtersByInstrumentKey() {
        AdminMigrationService service = newService();

        // Futures keys now come from FuturesContractRollService (null in test constructor).
        // Use a spot index key that is always seeded.
        List<AdminDtos.MigrationJobResponse> jobs = service.listJobs("tenant-a", "NSE_INDEX|Nifty 50");

        assertTrue(!jobs.isEmpty());
        assertTrue(jobs.stream().allMatch(job -> "NSE_INDEX|Nifty 50".equals(job.instrumentKey())));
    }

    @Test
    void listMigrationStatus_filtersByInstrumentKeyAfterTimeframeLookup() {
        AdminMigrationService service = newService();

        UpstoxMigrationStateEntity matchingState = new UpstoxMigrationStateEntity(
                "tenant-a",
                "NSE_INDEX|Nifty 50",
                "minutes",
                1,
                LocalDate.of(2025, 2, 1)
        );
        UpstoxMigrationStateEntity otherInstrument = new UpstoxMigrationStateEntity(
                "tenant-a",
                "NSE_INDEX|Nifty Bank",
                "minutes",
                1,
                LocalDate.of(2025, 2, 1)
        );

        when(migrationStateRepository.findAllByTenantIdAndTimeframeUnitAndTimeframeIntervalOrderByInstrumentKeyAscTimeframeUnitAscTimeframeIntervalAsc(
                "tenant-a",
                "minutes",
                1
        )).thenReturn(List.of(matchingState, otherInstrument));

        List<AdminDtos.MigrationStatusResponse> rows = service.listMigrationStatus("tenant-a", "NSE_INDEX|Nifty 50", "minutes", 1);

        assertEquals(1, rows.size());
        assertEquals("NSE_INDEX|Nifty 50", rows.getFirst().instrumentKey());
    }

    @Test
    void startJob_tradingAnalyticsBackfillDoesNotRequireMigrationService() throws Exception {
        AdminMigrationService service = newService();
        when(tradingAnalyticsService.backfillTradingAnalytics(
                eq("tenant-a"),
                eq("NSE_INDEX|Nifty 50"),
                eq("minutes"),
                eq(1),
                eq(LocalDate.of(2024, 1, 1)),
                any(LocalDate.class)
        )).thenReturn(new TradingAnalyticsService.TradingAnalyticsBackfillResult(
                "NSE_INDEX|Nifty 50",
                "minutes",
                1,
                LocalDate.of(2024, 1, 1),
                LocalDate.now(),
                List.of(LocalDate.now()),
                1,
                1
        ));

        service.listJobs("tenant-a");
        service.startJob("tenant-a", "NSE_INDEX|Nifty 50|minutes|1|TRADING_ANALYTICS_BACKFILL");
        Thread.sleep(300);

        verify(tradingAnalyticsService, atLeastOnce()).backfillTradingAnalytics(
                eq("tenant-a"),
                eq("NSE_INDEX|Nifty 50"),
                eq("minutes"),
                eq(1),
                eq(LocalDate.of(2024, 1, 1)),
                any(LocalDate.class)
        );
        verify(migrationService, never()).migrateSingleChunkForStream(any(), any(), any(), any(), any());
    }
}
