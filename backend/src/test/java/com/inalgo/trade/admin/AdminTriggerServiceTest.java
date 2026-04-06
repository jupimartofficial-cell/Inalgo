package com.inalgo.trade.admin;
import com.inalgo.trade.entity.AdminTriggerEntity;
import com.inalgo.trade.entity.UpstoxMigrationStateEntity;
import com.inalgo.trade.repository.AdminTriggerRepository;
import com.inalgo.trade.service.IndiaMarketHoursService;
import com.inalgo.trade.service.MarketSentimentService;
import com.inalgo.trade.service.TradingAnalyticsService;
import com.inalgo.trade.upstox.UpstoxHistoricalMigrationService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import java.lang.reflect.Field;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
@ExtendWith(MockitoExtension.class)
class AdminTriggerServiceTest {
@Mock
private AdminTriggerRepository adminTriggerRepository;
@Mock
private ObjectProvider<UpstoxHistoricalMigrationService> migrationServiceProvider;
@Mock
private UpstoxHistoricalMigrationService migrationService;
@Mock
private TradingAnalyticsService tradingAnalyticsService;
@Mock
private MarketSentimentService marketSentimentService;
@Mock
private IndiaMarketHoursService marketHoursService;
private AdminTriggerService newService() {
    Map<Long, AdminTriggerEntity> storedTriggers = new ConcurrentHashMap<>();
    AtomicLong triggerIds = new AtomicLong(1L);
    org.mockito.Mockito.lenient().when(marketHoursService.alignToNextBusinessWindow(any(Instant.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));
    org.mockito.Mockito.lenient().when(marketHoursService.isWithinBusinessWindow(any(Instant.class)))
            .thenReturn(true);
    org.mockito.Mockito.lenient()
            .when(adminTriggerRepository.findAllByTenantIdOrderByUpdatedAtDescInstrumentKeyAscTimeframeUnitAscTimeframeIntervalAsc(any()))
            .thenAnswer(invocation -> storedTriggers.values().stream()
                    .filter(trigger -> invocation.getArgument(0).equals(trigger.getTenantId()))
                    .sorted(Comparator
                            .comparing(AdminTriggerEntity::getUpdatedAt, Comparator.nullsLast(Comparator.reverseOrder()))
                            .thenComparing(AdminTriggerEntity::getInstrumentKey)
                            .thenComparing(AdminTriggerEntity::getTimeframeUnit, Comparator.nullsLast(String::compareTo))
                            .thenComparing(AdminTriggerEntity::getTimeframeInterval, Comparator.nullsLast(Integer::compareTo)))
                    .toList());
    org.mockito.Mockito.lenient()
            .when(adminTriggerRepository.findByIdAndTenantId(anyLong(), any()))
            .thenAnswer(invocation -> Optional.ofNullable(storedTriggers.get(invocation.getArgument(0)))
                    .filter(trigger -> invocation.getArgument(1).equals(trigger.getTenantId())));
    org.mockito.Mockito.lenient()
            .when(adminTriggerRepository.findById(anyLong()))
            .thenAnswer(invocation -> Optional.ofNullable(storedTriggers.get(invocation.getArgument(0))));
    org.mockito.Mockito.lenient()
            .when(adminTriggerRepository.findTop20ByStatusAndNextRunAtLessThanEqualOrderByNextRunAtAsc(any(), any()))
            .thenAnswer(invocation -> storedTriggers.values().stream()
                    .filter(trigger -> invocation.getArgument(0).equals(trigger.getStatus()))
                    .filter(trigger -> trigger.getNextRunAt() != null && !trigger.getNextRunAt().isAfter(invocation.getArgument(1)))
                    .sorted(Comparator.comparing(AdminTriggerEntity::getNextRunAt))
                    .limit(20)
                    .toList());
    org.mockito.Mockito.lenient()
            .when(adminTriggerRepository.save(any(AdminTriggerEntity.class)))
            .thenAnswer(invocation -> {
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
    org.mockito.Mockito.lenient()
            .doAnswer(invocation -> {
                AdminTriggerEntity entity = invocation.getArgument(0);
                storedTriggers.remove(entity.getId());
                return null;
            })
            .when(adminTriggerRepository)
            .delete(any(AdminTriggerEntity.class));
    return new AdminTriggerService(
            adminTriggerRepository,
            migrationServiceProvider,
            tradingAnalyticsService,
            marketSentimentService,
            marketHoursService
    );
}
@Test
void createTrigger_persistsStoppedTrigger() {
    AdminTriggerService service = newService();
    AdminDtos.TriggerResponse response = service.createTrigger("tenant-a", new AdminDtos.CreateTriggerRequest(
            AdminTriggerService.JOB_KEY_CANDLE_SYNC,
            "NSE_INDEX|Nifty 50",
            "minutes",
            5,
            "TIME_DRIVEN",
            "MINUTES_TIMER",
            5,
            null
    ));
    assertNotNull(response.id());
    assertEquals("STOPPED", response.status());
    assertEquals("PENDING", response.lastRunStatus());
    assertEquals(Integer.valueOf(5), response.intervalValue());
    assertEquals(AdminTriggerService.JOB_KEY_CANDLE_SYNC, response.jobKey());
}
@Test
void createTrigger_acceptsMarketSentimentRefreshWithoutTimeframe() {
    AdminTriggerService service = newService();
    AdminDtos.TriggerResponse response = service.createTrigger("tenant-a", new AdminDtos.CreateTriggerRequest(
            AdminTriggerService.JOB_KEY_MARKET_SENTIMENT_REFRESH,
            AdminTriggerService.INSTRUMENT_KEY_MARKET_SENTIMENT,
            null,
            null,
            "TIME_DRIVEN",
            "MINUTES_TIMER",
            5,
            null
    ));
    assertEquals(AdminTriggerService.JOB_KEY_MARKET_SENTIMENT_REFRESH, response.jobKey());
    assertEquals(AdminTriggerService.INSTRUMENT_KEY_MARKET_SENTIMENT, response.instrumentKey());
    assertNull(response.timeframeUnit());
    assertNull(response.timeframeInterval());
}
@Test
void createTrigger_acceptsExpandedMinuteCadencesAndRejectsUnsupportedValues() {
    AdminTriggerService service = newService();
    List<Integer> supportedMinuteIntervals = List.of(1, 2, 3, 4, 5, 6, 7, 10, 15, 30);
    for (Integer minuteInterval : supportedMinuteIntervals) {
        AdminDtos.TriggerResponse response = service.createTrigger("tenant-a", new AdminDtos.CreateTriggerRequest(
                AdminTriggerService.JOB_KEY_CANDLE_SYNC,
                "NSE_INDEX|Nifty 50",
                "minutes",
                1,
                "TIME_DRIVEN",
                "MINUTES_TIMER",
                minuteInterval,
                null
        ));
        assertEquals(minuteInterval, response.intervalValue());
        assertEquals("MINUTES_TIMER", response.triggerType());
    }
    assertThrows(jakarta.validation.ValidationException.class, () -> service.createTrigger(
            "tenant-a",
            new AdminDtos.CreateTriggerRequest(
                    AdminTriggerService.JOB_KEY_CANDLE_SYNC,
                    "NSE_INDEX|Nifty 50",
                    "minutes",
                    1,
                    "TIME_DRIVEN",
                    "MINUTES_TIMER",
                    8,
                    null
            )
    ));
}
@Test
void lifecycleActions_updateTriggerStatus() {
    AdminTriggerService service = newService();
    AdminDtos.TriggerResponse trigger = service.createTrigger("tenant-a", new AdminDtos.CreateTriggerRequest(
            AdminTriggerService.JOB_KEY_CANDLE_SYNC,
            "NSE_INDEX|Nifty 50",
            "minutes",
            1,
            "TIME_DRIVEN",
            "MINUTES_TIMER",
            1,
            null
    ));
    assertEquals("RUNNING", service.startTrigger("tenant-a", trigger.id()));
    assertEquals("PAUSED", service.pauseTrigger("tenant-a", trigger.id()));
    assertEquals("RUNNING", service.resumeTrigger("tenant-a", trigger.id()));
    assertEquals("STOPPED", service.stopTrigger("tenant-a", trigger.id()));
}
@Test
void updateTrigger_reconfiguresStoppedTrigger() {
    AdminTriggerService service = newService();
    AdminDtos.TriggerResponse trigger = service.createTrigger("tenant-a", new AdminDtos.CreateTriggerRequest(
            AdminTriggerService.JOB_KEY_CANDLE_SYNC,
            "NSE_INDEX|Nifty 50",
            "minutes",
            1,
            "TIME_DRIVEN",
            "MINUTES_TIMER",
            1,
            null
    ));
    AdminDtos.TriggerResponse updated = service.updateTrigger("tenant-a", trigger.id(), new AdminDtos.UpdateTriggerRequest(
            AdminTriggerService.JOB_KEY_TRADING_SIGNAL_REFRESH,
            "NSE_INDEX|Nifty Bank",
            "minutes",
            15,
            "TIME_DRIVEN",
            "HOUR_TIMER",
            2,
            null
    ));
    assertEquals(AdminTriggerService.JOB_KEY_TRADING_SIGNAL_REFRESH, updated.jobKey());
    assertEquals("NSE_INDEX|Nifty Bank", updated.instrumentKey());
    assertEquals("minutes", updated.timeframeUnit());
    assertEquals(Integer.valueOf(15), updated.timeframeInterval());
    assertEquals("HOUR_TIMER", updated.triggerType());
    assertEquals(Integer.valueOf(2), updated.intervalValue());
    assertEquals("STOPPED", updated.status());
}
@Test
void updateTrigger_rejectsRunningTrigger() {
    AdminTriggerService service = newService();
    AdminDtos.TriggerResponse trigger = service.createTrigger("tenant-a", new AdminDtos.CreateTriggerRequest(
            AdminTriggerService.JOB_KEY_CANDLE_SYNC,
            "NSE_INDEX|Nifty 50",
            "minutes",
            1,
            "TIME_DRIVEN",
            "MINUTES_TIMER",
            1,
            null
    ));
    service.startTrigger("tenant-a", trigger.id());
    assertThrows(jakarta.validation.ValidationException.class, () -> service.updateTrigger(
            "tenant-a",
            trigger.id(),
            new AdminDtos.UpdateTriggerRequest(
                    AdminTriggerService.JOB_KEY_TRADING_DAY_PARAM_REFRESH,
                    "NSE_INDEX|Nifty 50",
                    null,
                    null,
                    "TIME_DRIVEN",
                    "MINUTES_TIMER",
                    5,
                    null
            )
    ));
}
@Test
void deleteTrigger_removesPausedTrigger() {
    AdminTriggerService service = newService();
    AdminDtos.TriggerResponse trigger = service.createTrigger("tenant-a", new AdminDtos.CreateTriggerRequest(
            AdminTriggerService.JOB_KEY_CANDLE_SYNC,
            "NSE_INDEX|Nifty 50",
            "minutes",
            1,
            "TIME_DRIVEN",
            "MINUTES_TIMER",
            1,
            null
    ));
    service.startTrigger("tenant-a", trigger.id());
    service.pauseTrigger("tenant-a", trigger.id());
    AdminDtos.TriggerDeleteResponse response = service.deleteTrigger("tenant-a", trigger.id());
    assertEquals("DELETED", response.status());
    assertEquals(trigger.id(), response.id());
    assertTrue(service.listTriggers("tenant-a").isEmpty());
}
@Test
void runDueTriggers_executesRecurringTriggerAndSchedulesNextRun() throws Exception {
    AdminTriggerService service = newService();
    when(migrationServiceProvider.getIfAvailable()).thenReturn(migrationService);
    when(migrationService.restartStreamFromLastCandle(eq("tenant-a"), any(), any(), any(), any()))
            .thenReturn(new UpstoxMigrationStateEntity("tenant-a", "NSE_INDEX|Nifty 50", "minutes", 1, LocalDate.now()));
    when(migrationService.migrateSingleChunkForStream(eq("tenant-a"), any(), any(), any(), any()))
            .thenReturn(new UpstoxMigrationStateEntity("tenant-a", "NSE_INDEX|Nifty 50", "minutes", 1, LocalDate.now()));
    AdminDtos.TriggerResponse trigger = service.createTrigger("tenant-a", new AdminDtos.CreateTriggerRequest(
            AdminTriggerService.JOB_KEY_CANDLE_SYNC,
            "NSE_INDEX|Nifty 50",
            "minutes",
            1,
            "TIME_DRIVEN",
            "MINUTES_TIMER",
            1,
            null
    ));
    service.startTrigger("tenant-a", trigger.id());
    service.processDueTriggers();
    Thread.sleep(300);
    AdminDtos.TriggerResponse refreshed = service.listTriggers("tenant-a").getFirst();
    assertEquals("RUNNING", refreshed.status());
    assertEquals("SUCCESS", refreshed.lastRunStatus());
    assertNotNull(refreshed.nextRunAt());
    verify(migrationService, atLeastOnce()).restartStreamFromLastCandle(eq("tenant-a"), any(), any(), any(), any());
    verify(migrationService, atLeastOnce()).migrateSingleChunkForStream(eq("tenant-a"), any(), any(), any(), any());
}
@Test
void runDueTriggers_executesMarketSentimentRefresh() throws Exception {
    AdminTriggerService service = newService();
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
    Thread.sleep(300);
    verify(marketSentimentService, atLeastOnce()).refreshTenant("tenant-a");
}

@Test
void runDueTriggers_persistsFallbackErrorWhenExceptionMessageMissing() throws Exception {
    AdminTriggerService service = newService();
    doThrow(new RuntimeException()).when(marketSentimentService).refreshTenant("tenant-a");
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
    Thread.sleep(300);

    AdminDtos.TriggerResponse refreshed = service.listTriggers("tenant-a").getFirst();
    assertEquals("FAILED", refreshed.lastRunStatus());
    assertNotNull(refreshed.lastError());
    assertTrue(refreshed.lastError().contains("RuntimeException"));
}
@Test
void runDueTriggers_restartsCandleSyncFromLastPersistedCandle() throws Exception {
    AdminTriggerService service = newService();
    when(migrationServiceProvider.getIfAvailable()).thenReturn(migrationService);
    when(migrationService.restartStreamFromLastCandle(eq("tenant-a"), any(), any(), any(), any()))
            .thenReturn(new UpstoxMigrationStateEntity(
                    "tenant-a",
                    "NSE_INDEX|Nifty 50",
                    "minutes",
                    1,
                    LocalDate.now().minusDays(2)
            ));
    when(migrationService.migrateSingleChunkForStream(eq("tenant-a"), any(), any(), any(), any()))
            .thenReturn(new UpstoxMigrationStateEntity("tenant-a", "NSE_INDEX|Nifty 50", "minutes", 1, LocalDate.now()));
    AdminDtos.TriggerResponse trigger = service.createTrigger("tenant-a", new AdminDtos.CreateTriggerRequest(
            AdminTriggerService.JOB_KEY_CANDLE_SYNC,
            "NSE_INDEX|Nifty 50",
            "minutes",
            1,
            "TIME_DRIVEN",
            "MINUTES_TIMER",
            1,
            null
    ));
    service.startTrigger("tenant-a", trigger.id());
    service.processDueTriggers();
    Thread.sleep(300);
    verify(migrationService, atLeastOnce()).restartStreamFromLastCandle(
            "tenant-a",
            "NSE_INDEX|Nifty 50",
            "minutes",
            1,
            LocalDate.now()
    );
}
@Test
void runDueTriggers_stopsSpecificDateTriggerAfterExecution() throws Exception {
    AdminTriggerService service = newService();
    when(migrationServiceProvider.getIfAvailable()).thenReturn(migrationService);
    when(migrationService.restartStreamFromLastCandle(eq("tenant-a"), any(), any(), any(), any()))
            .thenReturn(new UpstoxMigrationStateEntity("tenant-a", "NSE_INDEX|Nifty 50", "days", 1, LocalDate.now()));
    when(migrationService.migrateSingleChunkForStream(eq("tenant-a"), any(), any(), any(), any()))
            .thenReturn(new UpstoxMigrationStateEntity("tenant-a", "NSE_INDEX|Nifty 50", "days", 1, LocalDate.now()));
    AdminDtos.TriggerResponse trigger = service.createTrigger("tenant-a", new AdminDtos.CreateTriggerRequest(
            AdminTriggerService.JOB_KEY_CANDLE_SYNC,
            "NSE_INDEX|Nifty 50",
            "days",
            1,
            "TIME_DRIVEN",
            "SPECIFIC_DATE_TIME",
            null,
            Instant.now()
    ));
    service.startTrigger("tenant-a", trigger.id());
    service.processDueTriggers();
    Thread.sleep(300);
    AdminDtos.TriggerResponse refreshed = service.listTriggers("tenant-a").getFirst();
    assertEquals("STOPPED", refreshed.status());
    assertEquals("SUCCESS", refreshed.lastRunStatus());
    assertNull(refreshed.nextRunAt());
}
@Test
void runDueTriggers_executesTradingSignalRefreshJob() throws Exception {
    AdminTriggerService service = newService();
    AdminDtos.TriggerResponse trigger = service.createTrigger("tenant-a", new AdminDtos.CreateTriggerRequest(
            AdminTriggerService.JOB_KEY_TRADING_SIGNAL_REFRESH,
            "NSE_INDEX|Nifty 50",
            "minutes",
            5,
            "TIME_DRIVEN",
            "MINUTES_TIMER",
            5,
            null
    ));
    service.startTrigger("tenant-a", trigger.id());
    service.processDueTriggers();
    Thread.sleep(300);
    verify(tradingAnalyticsService, atLeastOnce()).refreshTradingSignal("tenant-a", "NSE_INDEX|Nifty 50", "minutes", 5);
    AdminDtos.TriggerResponse refreshed = service.listTriggers("tenant-a").getFirst();
    assertEquals("RUNNING", refreshed.status());
    assertEquals("SUCCESS", refreshed.lastRunStatus());
}
@Test
void runDueTriggers_executesTradingDayParamRefreshJobWithoutTimeframe() throws Exception {
    AdminTriggerService service = newService();
    AdminDtos.TriggerResponse trigger = service.createTrigger("tenant-a", new AdminDtos.CreateTriggerRequest(
            AdminTriggerService.JOB_KEY_TRADING_DAY_PARAM_REFRESH,
            "NSE_INDEX|Nifty 50",
            null,
            null,
            "TIME_DRIVEN",
            "MINUTES_TIMER",
            5,
            null
    ));
    service.startTrigger("tenant-a", trigger.id());
    service.processDueTriggers();
    Thread.sleep(300);
    verify(tradingAnalyticsService, atLeastOnce()).refreshTradingDayParam("tenant-a", "NSE_INDEX|Nifty 50");
    AdminDtos.TriggerResponse refreshed = service.listTriggers("tenant-a").getFirst();
    assertEquals(AdminTriggerService.JOB_KEY_TRADING_DAY_PARAM_REFRESH, refreshed.jobKey());
    assertNull(refreshed.timeframeUnit());
    assertNull(refreshed.timeframeInterval());
    assertEquals("SUCCESS", refreshed.lastRunStatus());
}
@Test
void browseTriggers_groupsRowsAndBuildsFacetMetadata() {
    AdminTriggerService service = newService();
    service.createTrigger("tenant-a", new AdminDtos.CreateTriggerRequest(
            AdminTriggerService.JOB_KEY_CANDLE_SYNC,
            "NSE_INDEX|Nifty 50",
            "minutes",
            5,
            "TIME_DRIVEN",
            "MINUTES_TIMER",
            5,
            null
    ));
    service.createTrigger("tenant-a", new AdminDtos.CreateTriggerRequest(
            AdminTriggerService.JOB_KEY_CANDLE_SYNC,
            "NSE_FO|51714",
            "days",
            1,
            "TIME_DRIVEN",
            "DAY_TIMER",
            1,
            null
    ));
    service.createTrigger("tenant-a", new AdminDtos.CreateTriggerRequest(
            AdminTriggerService.JOB_KEY_TRADING_DAY_PARAM_REFRESH,
            "NSE_INDEX|Nifty Bank",
            null,
            null,
            "TIME_DRIVEN",
            "SPECIFIC_DATE_TIME",
            null,
            Instant.now().plusSeconds(300)
    ));
    AdminDtos.TriggerBrowserResponse candleBrowser = service.browseTriggers(
            "tenant-a",
            AdminTriggerService.TAB_GROUP_CANDLE_SYNC,
            null,
            null,
            null,
            0,
            25
    );
    assertEquals(2, candleBrowser.totalElements());
    assertEquals(2, candleBrowser.summary().totalInTab());
    assertEquals(2, candleBrowser.tabs().stream().filter(tab -> AdminTriggerService.TAB_GROUP_CANDLE_SYNC.equals(tab.value())).findFirst().orElseThrow().count());
    assertEquals(List.of("CANDLE_INTRADAY", "CANDLE_POSITIONAL"), candleBrowser.jobNatures().stream().map(AdminDtos.TriggerFacetOption::value).toList());
    AdminDtos.TriggerBrowserResponse otherBrowser = service.browseTriggers(
            "tenant-a",
            AdminTriggerService.TAB_GROUP_OTHERS,
            "NSE_INDEX|Nifty Bank",
            "NO_TIMEFRAME",
            "OPENING_RANGE_ANALYTICS",
            0,
            25
    );
    assertEquals(1, otherBrowser.totalElements());
    assertEquals(1, otherBrowser.summary().filteredTotal());
    assertEquals(1, otherBrowser.summary().oneTimeCount());
    assertEquals("OPENING_RANGE_ANALYTICS", otherBrowser.items().getFirst().jobNatureKey());
    assertTrue(otherBrowser.items().getFirst().oneTime());
}
private void setField(Object target, String fieldName, Object value) {
    try {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    } catch (ReflectiveOperationException ex) {
        throw new IllegalStateException("Unable to set field " + fieldName, ex);
    }
}
}
