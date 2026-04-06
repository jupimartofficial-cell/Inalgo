package com.inalgo.trade.admin;

import com.inalgo.trade.entity.AdminTriggerEntity;
import com.inalgo.trade.repository.AdminTriggerRepository;
import com.inalgo.trade.service.IndiaMarketHoursService;
import com.inalgo.trade.service.MarketSentimentService;
import com.inalgo.trade.service.TradingAnalyticsService;
import com.inalgo.trade.upstox.UpstoxHistoricalMigrationService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

import java.lang.reflect.Field;
import java.time.Instant;
import java.util.Comparator;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AdminTriggerServiceBusinessHoursTest {

    @Test
    void runDueTriggers_defersExecutionOutsideIndiaBusinessWindow() {
        AdminTriggerRepository repository = mock(AdminTriggerRepository.class);
        @SuppressWarnings("unchecked")
        ObjectProvider<UpstoxHistoricalMigrationService> migrationProvider = mock(ObjectProvider.class);
        TradingAnalyticsService tradingAnalyticsService = mock(TradingAnalyticsService.class);
        MarketSentimentService marketSentimentService = mock(MarketSentimentService.class);
        IndiaMarketHoursService marketHoursService = mock(IndiaMarketHoursService.class);

        Map<Long, AdminTriggerEntity> storedTriggers = new ConcurrentHashMap<>();
        AtomicLong triggerIds = new AtomicLong(1L);
        when(marketHoursService.alignToNextBusinessWindow(any(Instant.class)))
                .thenReturn(Instant.parse("2026-03-23T03:45:00Z"));
        when(marketHoursService.isWithinBusinessWindow(any(Instant.class))).thenReturn(false);
        when(repository.findByIdAndTenantId(anyLong(), anyString())).thenAnswer(invocation ->
                Optional.ofNullable(storedTriggers.get(invocation.getArgument(0)))
                        .filter(trigger -> invocation.getArgument(1).equals(trigger.getTenantId())));
        when(repository.findAllByTenantIdOrderByUpdatedAtDescInstrumentKeyAscTimeframeUnitAscTimeframeIntervalAsc(anyString()))
                .thenAnswer(invocation -> storedTriggers.values().stream()
                        .filter(trigger -> invocation.getArgument(0).equals(trigger.getTenantId()))
                        .sorted(Comparator.comparing(AdminTriggerEntity::getUpdatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                        .toList());
        when(repository.findTop20ByStatusAndNextRunAtLessThanEqualOrderByNextRunAtAsc(anyString(), any(Instant.class)))
                .thenAnswer(invocation -> storedTriggers.values().stream()
                        .filter(trigger -> invocation.getArgument(0).equals(trigger.getStatus()))
                        .filter(trigger -> trigger.getNextRunAt() != null && !trigger.getNextRunAt().isAfter(invocation.getArgument(1)))
                        .sorted(Comparator.comparing(AdminTriggerEntity::getNextRunAt))
                        .toList());
        when(repository.save(any(AdminTriggerEntity.class))).thenAnswer(invocation -> {
            AdminTriggerEntity entity = invocation.getArgument(0);
            if (entity.getId() == null) {
                setField(entity, "id", triggerIds.getAndIncrement());
            }
            Instant now = Instant.now();
            if (entity.getCreatedAt() == null) {
                setField(entity, "createdAt", now);
            }
            setField(entity, "updatedAt", now);
            storedTriggers.put(entity.getId(), entity);
            return entity;
        });

        AdminTriggerService service = new AdminTriggerService(
                repository,
                migrationProvider,
                tradingAnalyticsService,
                marketSentimentService,
                marketHoursService
        );

        AdminDtos.TriggerResponse trigger = service.createTrigger("tenant-a", new AdminDtos.CreateTriggerRequest(
                AdminTriggerService.JOB_KEY_MARKET_SENTIMENT_REFRESH,
                AdminTriggerService.INSTRUMENT_KEY_MARKET_SENTIMENT,
                null,
                null,
                "TIME_DRIVEN",
                "MINUTES_TIMER",
                5,
                null
        ));
        service.startTrigger("tenant-a", trigger.id());

        service.processDueTriggers();

        AdminDtos.TriggerResponse refreshed = service.listTriggers("tenant-a").getFirst();
        assertEquals(Instant.parse("2026-03-23T03:45:00Z"), refreshed.nextRunAt());
        verify(marketSentimentService, never()).refreshTenant("tenant-a");
    }

    private static void setField(Object target, String fieldName, Object value) {
        try {
            Field field = target.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (ReflectiveOperationException ex) {
            throw new IllegalStateException(ex);
        }
    }
}
