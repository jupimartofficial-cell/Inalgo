package com.inalgo.trade.admin;

import com.inalgo.trade.entity.AdminTriggerEntity;
import com.inalgo.trade.repository.AdminTriggerRepository;
import com.inalgo.trade.service.IndiaMarketHoursService;
import com.inalgo.trade.service.MarketSentimentService;
import com.inalgo.trade.service.TradingAnalyticsService;
import com.inalgo.trade.upstox.UpstoxHistoricalMigrationService;
import jakarta.annotation.PreDestroy;
import jakarta.validation.ValidationException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Owns the admin trigger lifecycle from CRUD through execution.
 * The service keeps scheduling rules and job dispatch in one place so the controller and scheduler stay thin.
 */
@Service
public class AdminTriggerService {
    public static final String JOB_KEY_CANDLE_SYNC = "CANDLE_SYNC";
    public static final String JOB_KEY_TRADING_SIGNAL_REFRESH = "TRADING_SIGNAL_REFRESH";
    public static final String JOB_KEY_TRADING_DAY_PARAM_REFRESH = "TRADING_DAY_PARAM_REFRESH";
    public static final String JOB_KEY_MARKET_SENTIMENT_REFRESH = "MARKET_SENTIMENT_REFRESH";
    public static final String JOB_KEY_GLOBAL_INDEX_REFRESH = "GLOBAL_INDEX_REFRESH";
    public static final String INSTRUMENT_KEY_MARKET_SENTIMENT = "SYSTEM|MARKET_TREND";
    public static final String INSTRUMENT_KEY_GLOBAL_INDEX = "SYSTEM|GLOBAL_INDEX";
    public static final String TAB_GROUP_CANDLE_SYNC = "CANDLE_SYNC";
    public static final String TAB_GROUP_OTHERS = "OTHERS";

    private static final String TRIGGER_TYPE_SPECIFIC_DATE_TIME = "SPECIFIC_DATE_TIME";

    private final AdminTriggerRepository adminTriggerRepository;
    private final ObjectProvider<UpstoxHistoricalMigrationService> migrationServiceProvider;
    private final TradingAnalyticsService tradingAnalyticsService;
    private final MarketSentimentService marketSentimentService;
    private final TriggerBrowserHelper browserHelper;
    private final TriggerScheduleHelper scheduleHelper;
    private final IndiaMarketHoursService marketHoursService;
    private final ExecutorService triggerExecutor = Executors.newFixedThreadPool(6);
    private final Set<Long> runningTriggerIds = ConcurrentHashMap.newKeySet();

    @Autowired
    public AdminTriggerService(
            AdminTriggerRepository adminTriggerRepository,
            ObjectProvider<UpstoxHistoricalMigrationService> migrationServiceProvider,
            TradingAnalyticsService tradingAnalyticsService,
            MarketSentimentService marketSentimentService,
            TriggerBrowserHelper browserHelper,
            TriggerScheduleHelper scheduleHelper,
            IndiaMarketHoursService marketHoursService
    ) {
        this.adminTriggerRepository = adminTriggerRepository;
        this.migrationServiceProvider = migrationServiceProvider;
        this.tradingAnalyticsService = tradingAnalyticsService;
        this.marketSentimentService = marketSentimentService;
        this.browserHelper = browserHelper;
        this.scheduleHelper = scheduleHelper;
        this.marketHoursService = marketHoursService;
    }

    AdminTriggerService(
            AdminTriggerRepository adminTriggerRepository,
            ObjectProvider<UpstoxHistoricalMigrationService> migrationServiceProvider,
            TradingAnalyticsService tradingAnalyticsService,
            MarketSentimentService marketSentimentService,
            IndiaMarketHoursService marketHoursService
    ) {
        this(
                adminTriggerRepository,
                migrationServiceProvider,
                tradingAnalyticsService,
                marketSentimentService,
                new TriggerBrowserHelper(),
                new TriggerScheduleHelper(marketHoursService),
                marketHoursService
        );
    }

    public List<AdminDtos.TriggerResponse> listTriggers(String tenantId) {
        return adminTriggerRepository
                .findAllByTenantIdOrderByUpdatedAtDescInstrumentKeyAscTimeframeUnitAscTimeframeIntervalAsc(tenantId)
                .stream()
                .map(trigger -> browserHelper.toResponse(browserHelper.describeTrigger(trigger)))
                .toList();
    }

    public AdminDtos.TriggerBrowserResponse browseTriggers(
            String tenantId,
            String tabGroup,
            String instrumentKey,
            String timeframeKey,
            String jobNatureKey,
            int page,
            int size
    ) {
        String normalizedTabGroup = normalizeTabGroup(tabGroup);
        String normalizedInstrumentKey = normalizeOptional(instrumentKey);
        String normalizedTimeframeKey = normalizeOptional(timeframeKey);
        String normalizedJobNatureKey = normalizeUpperOptional(jobNatureKey);

        List<TriggerDescriptor> allTriggers = adminTriggerRepository
                .findAllByTenantIdOrderByUpdatedAtDescInstrumentKeyAscTimeframeUnitAscTimeframeIntervalAsc(tenantId)
                .stream()
                .map(browserHelper::describeTrigger)
                .toList();

        List<TriggerDescriptor> tabTriggers = allTriggers.stream()
                .filter(trigger -> normalizedTabGroup.equals(trigger.tabGroup()))
                .toList();

        List<TriggerDescriptor> filteredTriggers = tabTriggers.stream()
                .filter(trigger -> normalizedInstrumentKey == null || normalizedInstrumentKey.equals(trigger.trigger().getInstrumentKey()))
                .filter(trigger -> normalizedTimeframeKey == null || normalizedTimeframeKey.equals(trigger.timeframeKey()))
                .filter(trigger -> normalizedJobNatureKey == null || normalizedJobNatureKey.equals(trigger.jobNatureKey()))
                .toList();

        int fromIndex = Math.min(page * size, filteredTriggers.size());
        int toIndex = Math.min(fromIndex + size, filteredTriggers.size());
        List<AdminDtos.TriggerResponse> items = filteredTriggers.subList(fromIndex, toIndex).stream()
                .map(browserHelper::toResponse)
                .toList();

        return new AdminDtos.TriggerBrowserResponse(
                items,
                filteredTriggers.size(),
                page,
                size,
                browserHelper.buildTabOptions(allTriggers),
                browserHelper.buildInstrumentOptions(tabTriggers),
                browserHelper.buildTimeframeOptions(tabTriggers),
                browserHelper.buildJobNatureOptions(tabTriggers),
                new AdminDtos.TriggerBrowserSummary(
                        tabTriggers.size(),
                        filteredTriggers.size(),
                        filteredTriggers.stream().filter(t -> "RUNNING".equals(t.trigger().getStatus())).count(),
                        filteredTriggers.stream().filter(t -> "PAUSED".equals(t.trigger().getStatus())).count(),
                        filteredTriggers.stream().filter(t -> "FAILED".equals(t.trigger().getLastRunStatus())).count(),
                        filteredTriggers.stream().filter(TriggerDescriptor::oneTime).count(),
                        filteredTriggers.stream()
                                .filter(t -> "PAUSED".equals(t.trigger().getStatus()) || "FAILED".equals(t.trigger().getLastRunStatus()))
                                .count()
                )
        );
    }

    /**
     * New triggers always start in STOPPED so admins can review configuration before the first run.
     */
    public AdminDtos.TriggerResponse createTrigger(String tenantId, AdminDtos.CreateTriggerRequest request) {
        TriggerConfig config = scheduleHelper.prepareTriggerConfig(
                request.jobKey(),
                request.instrumentKey(),
                request.timeframeUnit(),
                request.timeframeInterval(),
                request.eventSource(),
                request.triggerType(),
                request.intervalValue(),
                request.scheduledAt(),
                null
        );

        AdminTriggerEntity entity = new AdminTriggerEntity(
                tenantId,
                config.jobKey(),
                config.instrumentKey(),
                config.timeframeUnit(),
                config.timeframeInterval(),
                config.eventSource(),
                config.triggerType(),
                config.intervalValue(),
                config.scheduledAt(),
                config.bootstrapFromDate()
        );

        return browserHelper.toResponse(browserHelper.describeTrigger(adminTriggerRepository.save(entity)));
    }

    /**
     * Running triggers are intentionally immutable because execution may already be using the stored schedule.
     */
    public AdminDtos.TriggerResponse updateTrigger(String tenantId, Long triggerId, AdminDtos.UpdateTriggerRequest request) {
        AdminTriggerEntity trigger = requireTrigger(tenantId, triggerId);
        if ("RUNNING".equals(trigger.getStatus())) {
            throw new ValidationException("Running triggers must be paused or stopped before editing");
        }

        TriggerConfig config = scheduleHelper.prepareTriggerConfig(
                request.jobKey(),
                request.instrumentKey(),
                request.timeframeUnit(),
                request.timeframeInterval(),
                request.eventSource(),
                request.triggerType(),
                request.intervalValue(),
                request.scheduledAt(),
                trigger
        );

        synchronized (trigger) {
            trigger.reconfigure(
                    config.jobKey(),
                    config.instrumentKey(),
                    config.timeframeUnit(),
                    config.timeframeInterval(),
                    config.eventSource(),
                    config.triggerType(),
                    config.intervalValue(),
                    config.scheduledAt(),
                    config.bootstrapFromDate()
            );
        }

        return browserHelper.toResponse(browserHelper.describeTrigger(adminTriggerRepository.save(trigger)));
    }

    public AdminDtos.TriggerDeleteResponse deleteTrigger(String tenantId, Long triggerId) {
        AdminTriggerEntity trigger = requireTrigger(tenantId, triggerId);
        if ("RUNNING".equals(trigger.getStatus())) {
            throw new ValidationException("Running triggers must be paused or stopped before deleting");
        }
        adminTriggerRepository.delete(trigger);
        return new AdminDtos.TriggerDeleteResponse("DELETED", triggerId);
    }

    public String startTrigger(String tenantId, Long triggerId) {
        AdminTriggerEntity trigger = requireTrigger(tenantId, triggerId);
        synchronized (trigger) {
            if ("RUNNING".equals(trigger.getStatus())) {
                return trigger.getStatus();
            }
            trigger.start(scheduleHelper.calculateInitialNextRunAt(trigger, Instant.now()));
        }
        adminTriggerRepository.save(trigger);
        return trigger.getStatus();
    }

    public String pauseTrigger(String tenantId, Long triggerId) {
        AdminTriggerEntity trigger = requireTrigger(tenantId, triggerId);
        synchronized (trigger) {
            if (!"RUNNING".equals(trigger.getStatus())) {
                return trigger.getStatus();
            }
            trigger.pause();
        }
        adminTriggerRepository.save(trigger);
        return trigger.getStatus();
    }

    public String resumeTrigger(String tenantId, Long triggerId) {
        AdminTriggerEntity trigger = requireTrigger(tenantId, triggerId);
        synchronized (trigger) {
            if (!"PAUSED".equals(trigger.getStatus())) {
                return trigger.getStatus();
            }
            trigger.resume(scheduleHelper.calculateInitialNextRunAt(trigger, Instant.now()));
        }
        adminTriggerRepository.save(trigger);
        return trigger.getStatus();
    }

    public String stopTrigger(String tenantId, Long triggerId) {
        AdminTriggerEntity trigger = requireTrigger(tenantId, triggerId);
        synchronized (trigger) {
            if (!"RUNNING".equals(trigger.getStatus()) && !"PAUSED".equals(trigger.getStatus())) {
                return trigger.getStatus();
            }
            trigger.stop();
        }
        adminTriggerRepository.save(trigger);
        return trigger.getStatus();
    }

    /**
     * Claims due triggers and hands them to the small worker pool.
     * The in-memory guard prevents the same trigger from being scheduled twice while a run is still active.
     */
    public void processDueTriggers() {
        Instant now = Instant.now();
        List<AdminTriggerEntity> dueTriggers = adminTriggerRepository
                .findTop20ByStatusAndNextRunAtLessThanEqualOrderByNextRunAtAsc("RUNNING", now);

        if (!marketHoursService.isWithinBusinessWindow(now)) {
            deferDueTriggersToNextBusinessWindow(dueTriggers, now);
            return;
        }

        for (AdminTriggerEntity trigger : dueTriggers) {
            Long triggerId = trigger.getId();
            if (triggerId == null || !runningTriggerIds.add(triggerId)) {
                continue;
            }

            trigger.markExecutionStarted();
            adminTriggerRepository.save(trigger);
            triggerExecutor.submit(() -> executeTrigger(triggerId));
        }
    }

    private void deferDueTriggersToNextBusinessWindow(List<AdminTriggerEntity> dueTriggers, Instant now) {
        Instant deferredRunAt = marketHoursService.alignToNextBusinessWindow(now);
        for (AdminTriggerEntity trigger : dueTriggers) {
            if (trigger.getNextRunAt() == null || !trigger.getNextRunAt().equals(deferredRunAt)) {
                synchronized (trigger) {
                    trigger.deferTo(deferredRunAt);
                }
                adminTriggerRepository.save(trigger);
            }
        }
    }

    private void executeTrigger(Long triggerId) {
        try {
            AdminTriggerEntity trigger = adminTriggerRepository.findById(triggerId).orElse(null);
            if (trigger == null || !"RUNNING".equals(trigger.getStatus())) {
                return;
            }

            runTriggerJob(trigger);

            Instant completedAt = Instant.now();
            synchronized (trigger) {
                if (TRIGGER_TYPE_SPECIFIC_DATE_TIME.equals(trigger.getTriggerType())) {
                    trigger.markExecutionSuccess(completedAt, null, "STOPPED");
                } else {
                    trigger.markExecutionSuccess(completedAt, scheduleHelper.calculateRecurringNextRunAt(trigger, completedAt), "RUNNING");
                }
            }
            adminTriggerRepository.save(trigger);
        } catch (RuntimeException ex) {
            AdminTriggerEntity trigger = adminTriggerRepository.findById(triggerId).orElse(null);
            if (trigger == null) {
                return;
            }
            Instant failedAt = Instant.now();
            String persistedError = buildPersistedErrorMessage(ex);
            synchronized (trigger) {
                if (TRIGGER_TYPE_SPECIFIC_DATE_TIME.equals(trigger.getTriggerType())) {
                    trigger.markExecutionFailed(failedAt, persistedError, null, "STOPPED");
                } else {
                    trigger.markExecutionFailed(
                            failedAt,
                            persistedError,
                            scheduleHelper.calculateRecurringNextRunAt(trigger, failedAt),
                            "RUNNING"
                    );
                }
            }
            adminTriggerRepository.save(trigger);
        } finally {
            runningTriggerIds.remove(triggerId);
        }
    }

    /**
     * Dispatches the trigger to the business workflow it represents.
     */
    private void runTriggerJob(AdminTriggerEntity trigger) {
        switch (trigger.getJobKey()) {
            case JOB_KEY_CANDLE_SYNC -> runCandleSyncJob(trigger);
            case JOB_KEY_TRADING_SIGNAL_REFRESH -> tradingAnalyticsService.refreshTradingSignal(
                    trigger.getTenantId(),
                    trigger.getInstrumentKey(),
                    trigger.getTimeframeUnit(),
                    trigger.getTimeframeInterval()
            );
            case JOB_KEY_TRADING_DAY_PARAM_REFRESH -> tradingAnalyticsService.refreshTradingDayParam(
                    trigger.getTenantId(),
                    trigger.getInstrumentKey()
            );
            case JOB_KEY_MARKET_SENTIMENT_REFRESH -> marketSentimentService.refreshTenant(trigger.getTenantId());
            case JOB_KEY_GLOBAL_INDEX_REFRESH -> marketSentimentService.refreshTechnicalTenant(trigger.getTenantId());
            default -> throw new ValidationException("Unsupported jobKey");
        }
    }

    /**
     * Candle-sync triggers always realign to the last saved candle before requesting the next chunk.
     * That keeps retries idempotent and lets completed streams resume on the current trading day.
     */
    private void runCandleSyncJob(AdminTriggerEntity trigger) {
        UpstoxHistoricalMigrationService migrationService = requireMigrationService();
        migrationService.restartStreamFromLastCandle(
                trigger.getTenantId(),
                trigger.getInstrumentKey(),
                trigger.getTimeframeUnit(),
                trigger.getTimeframeInterval(),
                trigger.getBootstrapFromDate()
        );
        migrationService.migrateSingleChunkForStream(
                trigger.getTenantId(),
                trigger.getInstrumentKey(),
                trigger.getTimeframeUnit(),
                trigger.getTimeframeInterval(),
                trigger.getBootstrapFromDate()
        );
    }

    private AdminTriggerEntity requireTrigger(String tenantId, Long triggerId) {
        return adminTriggerRepository.findByIdAndTenantId(triggerId, tenantId)
                .orElseThrow(() -> new ValidationException("Trigger not found"));
    }

    private UpstoxHistoricalMigrationService requireMigrationService() {
        UpstoxHistoricalMigrationService migrationService = migrationServiceProvider.getIfAvailable();
        if (migrationService == null) {
            throw new ValidationException("Migration service is disabled");
        }
        return migrationService;
    }

    private String normalizeTabGroup(String tabGroup) {
        if (!StringUtils.hasText(tabGroup)) {
            return TAB_GROUP_CANDLE_SYNC;
        }
        String normalized = tabGroup.trim().toUpperCase(Locale.ROOT);
        if (TAB_GROUP_CANDLE_SYNC.equals(normalized) || TAB_GROUP_OTHERS.equals(normalized)) {
            return normalized;
        }
        throw new ValidationException("Unsupported tabGroup");
    }

    private String normalizeOptional(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private String normalizeUpperOptional(String value) {
        return StringUtils.hasText(value) ? value.trim().toUpperCase(Locale.ROOT) : null;
    }

    private String buildPersistedErrorMessage(RuntimeException ex) {
        String type = ex.getClass().getSimpleName();
        String message = StringUtils.hasText(ex.getMessage()) ? ex.getMessage().trim() : null;
        if (!StringUtils.hasText(message) && ex.getCause() != null && StringUtils.hasText(ex.getCause().getMessage())) {
            message = ex.getCause().getMessage().trim();
        }
        return StringUtils.hasText(message) ? type + ": " + message : type;
    }

    @PreDestroy
    public void shutdown() {
        triggerExecutor.shutdownNow();
    }
}
