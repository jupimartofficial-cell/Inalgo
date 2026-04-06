package com.inalgo.trade.upstox;

import com.inalgo.trade.admin.AdminTriggerService;
import com.inalgo.trade.repository.AdminTriggerRepository;
import com.inalgo.trade.service.IndiaMarketHoursService;
import com.inalgo.trade.service.MarketSentimentProperties;
import com.inalgo.trade.service.MarketSentimentScheduler;
import com.inalgo.trade.service.MarketSentimentService;
import jakarta.validation.ValidationException;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class UpstoxSchedulersTest {

    @Test
    void optionChainScheduler_swallowsValidationException() {
        OptionChainService optionChainService = mock(OptionChainService.class);
        UpstoxOptionChainProperties properties = mock(UpstoxOptionChainProperties.class);
        IndiaMarketHoursService marketHoursService = mock(IndiaMarketHoursService.class);
        when(marketHoursService.isWithinBusinessWindow(any(Instant.class))).thenReturn(true);

        doThrow(new ValidationException("Upstox token is not configured"))
                .when(optionChainService)
                .refreshConfiguredUnderlyings(nullable(String.class), anyBoolean());

        UpstoxOptionChainScheduler scheduler = new UpstoxOptionChainScheduler(optionChainService, properties, marketHoursService);
        scheduler.runScheduledSnapshotTick();

        verify(optionChainService).refreshConfiguredUnderlyings(nullable(String.class), anyBoolean());
    }

    @Test
    void migrationScheduler_swallowsValidationException() {
        UpstoxHistoricalMigrationService migrationService = mock(UpstoxHistoricalMigrationService.class);
        IndiaMarketHoursService marketHoursService = mock(IndiaMarketHoursService.class);
        when(marketHoursService.isWithinBusinessWindow(any(Instant.class))).thenReturn(true);
        doThrow(new ValidationException("Upstox token is not configured"))
                .when(migrationService)
                .migrateTick();

        UpstoxMigrationScheduler scheduler = new UpstoxMigrationScheduler(migrationService, marketHoursService);
        scheduler.runMigrationTick();

        verify(migrationService).migrateTick();
    }

    @Test
    void marketSentimentScheduler_swallowsValidationException() {
        MarketSentimentService marketSentimentService = mock(MarketSentimentService.class);
        AdminTriggerRepository adminTriggerRepository = mock(AdminTriggerRepository.class);
        IndiaMarketHoursService marketHoursService = mock(IndiaMarketHoursService.class);
        when(marketHoursService.isWithinBusinessWindow(any(Instant.class))).thenReturn(true);
        doThrow(new ValidationException("External market data unavailable"))
                .when(marketSentimentService)
                .refreshConfiguredTenant();
        when(adminTriggerRepository.existsByTenantIdAndJobKeyAndStatusIn("local-desktop", AdminTriggerService.JOB_KEY_MARKET_SENTIMENT_REFRESH, java.util.Set.of("RUNNING", "PAUSED")))
                .thenReturn(false);

        MarketSentimentScheduler scheduler = new MarketSentimentScheduler(
                marketSentimentService,
                adminTriggerRepository,
                new MarketSentimentProperties(true, "local-desktop", "0 */5 * * * *", 20, 48, 8),
                marketHoursService
        );
        scheduler.refreshSnapshotTick();

        verify(marketSentimentService).refreshConfiguredTenant();
    }

    @Test
    void marketSentimentScheduler_skipsCronWhenTriggerManagedScheduleExists() {
        MarketSentimentService marketSentimentService = mock(MarketSentimentService.class);
        AdminTriggerRepository adminTriggerRepository = mock(AdminTriggerRepository.class);
        IndiaMarketHoursService marketHoursService = mock(IndiaMarketHoursService.class);
        when(marketHoursService.isWithinBusinessWindow(any(Instant.class))).thenReturn(true);
        when(adminTriggerRepository.existsByTenantIdAndJobKeyAndStatusIn("local-desktop", AdminTriggerService.JOB_KEY_MARKET_SENTIMENT_REFRESH, java.util.Set.of("RUNNING", "PAUSED")))
                .thenReturn(true);

        MarketSentimentScheduler scheduler = new MarketSentimentScheduler(
                marketSentimentService,
                adminTriggerRepository,
                new MarketSentimentProperties(true, "local-desktop", "0 */5 * * * *", 20, 48, 8),
                marketHoursService
        );
        scheduler.refreshSnapshotTick();

        verify(marketSentimentService, never()).refreshConfiguredTenant();
    }

    @Test
    void schedulers_skipOutsideIndiaBusinessWindow() {
        OptionChainService optionChainService = mock(OptionChainService.class);
        UpstoxHistoricalMigrationService migrationService = mock(UpstoxHistoricalMigrationService.class);
        MarketSentimentService marketSentimentService = mock(MarketSentimentService.class);
        AdminTriggerRepository adminTriggerRepository = mock(AdminTriggerRepository.class);
        UpstoxOptionChainProperties optionChainProperties = mock(UpstoxOptionChainProperties.class);
        IndiaMarketHoursService marketHoursService = mock(IndiaMarketHoursService.class);
        when(marketHoursService.isWithinBusinessWindow(any(Instant.class))).thenReturn(false);

        new UpstoxOptionChainScheduler(optionChainService, optionChainProperties, marketHoursService)
                .runScheduledSnapshotTick();
        new UpstoxMigrationScheduler(migrationService, marketHoursService)
                .runMigrationTick();
        new MarketSentimentScheduler(
                marketSentimentService,
                adminTriggerRepository,
                new MarketSentimentProperties(true, "local-desktop", "0 */5 * * * *", 20, 48, 8),
                marketHoursService
        ).refreshSnapshotTick();

        verify(optionChainService, never()).refreshConfiguredUnderlyings(nullable(String.class), anyBoolean());
        verify(migrationService, never()).migrateTick();
        verify(marketSentimentService, never()).refreshConfiguredTenant();
        verify(adminTriggerRepository, never()).existsByTenantIdAndJobKeyAndStatusIn(any(), any(), anyCollection());
    }
}
