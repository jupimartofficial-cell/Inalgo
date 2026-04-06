package com.inalgo.trade.admin;

import com.inalgo.trade.entity.AdminMigrationJobEntity;
import com.inalgo.trade.entity.UpstoxMigrationStateEntity;
import com.inalgo.trade.repository.AdminMigrationJobRepository;
import com.inalgo.trade.repository.CandleRepository;
import com.inalgo.trade.repository.UpstoxMigrationStateRepository;
import com.inalgo.trade.service.TradingAnalyticsService;
import com.inalgo.trade.upstox.UpstoxHistoricalMigrationService;
import com.inalgo.trade.upstox.UpstoxMigrationProperties;
import jakarta.annotation.PreDestroy;
import jakarta.validation.ValidationException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Coordinates operator-facing migration jobs on top of the lower-level Upstox migration engine.
 * It owns runtime status, the job map, and persistence for the admin grid.
 * Delegates to:
 * <ul>
 *   <li>{@link MigrationWorkerLoop} — per-job execution loop and retry logic</li>
 *   <li>{@link MigrationJobSequencer} — sequential queue management</li>
 *   <li>{@link MigrationRuntimeJobLoader} — loading runtime state from DB/config</li>
 * </ul>
 */
@Service
public class AdminMigrationService {
    private static final String RUN_MODE_CONCURRENT = "CONCURRENT";
    private static final String RUN_MODE_SEQUENTIAL = "SEQUENTIAL";
    static final String JOB_TYPE_CANDLE_SYNC = "CANDLE_SYNC";
    static final String JOB_TYPE_TRADING_ANALYTICS_BACKFILL = "TRADING_ANALYTICS_BACKFILL";

    private final AdminMigrationJobRepository migrationJobRepository;
    private final UpstoxMigrationStateRepository migrationStateRepository;
    private final ObjectProvider<UpstoxHistoricalMigrationService> migrationServiceProvider;
    private final MigrationWorkerLoop workerLoop;
    private final MigrationJobSequencer sequencer;
    private final MigrationRuntimeJobLoader jobLoader;
    // Keep runtime concurrency conservative to reduce Upstox 429 bursts.
    private final ExecutorService migrationExecutor = Executors.newFixedThreadPool(2);
    final Map<String, MigrationRuntimeJob> jobs = new ConcurrentHashMap<>();

    @Autowired
    public AdminMigrationService(
            AdminMigrationJobRepository migrationJobRepository,
            UpstoxMigrationStateRepository migrationStateRepository,
            ObjectProvider<UpstoxHistoricalMigrationService> migrationServiceProvider,
            MigrationWorkerLoop workerLoop,
            MigrationJobSequencer sequencer,
            MigrationRuntimeJobLoader jobLoader
    ) {
        this.migrationJobRepository = migrationJobRepository;
        this.migrationStateRepository = migrationStateRepository;
        this.migrationServiceProvider = migrationServiceProvider;
        this.workerLoop = workerLoop;
        this.sequencer = sequencer;
        this.jobLoader = jobLoader;
    }

    AdminMigrationService(
            AdminMigrationJobRepository migrationJobRepository,
            CandleRepository candleRepository,
            UpstoxMigrationStateRepository migrationStateRepository,
            ObjectProvider<UpstoxHistoricalMigrationService> migrationServiceProvider,
            UpstoxMigrationProperties migrationProperties,
            TradingAnalyticsService tradingAnalyticsService
    ) {
        this(
                migrationJobRepository,
                migrationStateRepository,
                migrationServiceProvider,
                new MigrationWorkerLoop(tradingAnalyticsService),
                new MigrationJobSequencer(),
                new MigrationRuntimeJobLoader(
                        migrationJobRepository,
                        migrationStateRepository,
                        migrationProperties,
                        new MigrationCatalogSeeder(candleRepository, migrationProperties, null)
                )
        );
    }

    public void startJobs(String tenantId, List<AdminDtos.MigrationStreamRequest> streams, String runMode) {
        UpstoxHistoricalMigrationService migrationService = requireMigrationService();
        if (streams == null || streams.isEmpty()) {
            throw new ValidationException("At least one migration stream must be provided");
        }
        String normalizedRunMode = normalizeRunMode(runMode);
        List<MigrationStartRequest> requests = new ArrayList<>();

        for (AdminDtos.MigrationStreamRequest stream : streams) {
            String jobKey = AdminMigrationJobKeySupport.jobKey(stream.instrumentKey(), stream.timeframeUnit(), stream.timeframeInterval(), JOB_TYPE_CANDLE_SYNC);
            String tenantScopedJobKey = AdminMigrationJobKeySupport.tenantScopedKey(tenantId, jobKey);
            MigrationRuntimeJob job = jobs.computeIfAbsent(tenantScopedJobKey, ignored ->
                    new MigrationRuntimeJob(
                            stream.instrumentKey().trim(),
                            stream.timeframeUnit().trim(),
                            stream.timeframeInterval(),
                            JOB_TYPE_CANDLE_SYNC,
                            stream.bootstrapFromDate()
                    ));
            requests.add(new MigrationStartRequest(tenantScopedJobKey, stream.bootstrapFromDate()));
            if (RUN_MODE_SEQUENTIAL.equals(normalizedRunMode)) {
                synchronized (job) {
                    if (!"RUNNING".equals(job.status) && (job.future == null || job.future.isDone())) {
                        job.status = "PENDING";
                        job.updatedAt = Instant.now();
                    }
                }
                saveJobSnapshot(tenantId, job);
            } else {
                launchRuntimeJob(tenantId, job, stream.bootstrapFromDate(), migrationService);
            }
        }

        if (RUN_MODE_SEQUENTIAL.equals(normalizedRunMode)) {
            sequencer.enqueueSequentialJobs(tenantId, requests);
            sequencer.startNextSequentialJobIfIdle(tenantId, this::launchRuntimeJob, jobs, migrationService);
        } else {
            sequencer.clearQueue(tenantId);
        }
    }

    public String startJob(String tenantId, String jobKey) {
        String normalizedJobKey = AdminMigrationJobKeySupport.normalizeJobKeyForLookup(jobKey, JOB_TYPE_CANDLE_SYNC);
        sequencer.removeQueuedJob(tenantId, AdminMigrationJobKeySupport.tenantScopedKey(tenantId, normalizedJobKey));
        MigrationRuntimeJob job = requireJob(tenantId, normalizedJobKey);
        UpstoxHistoricalMigrationService migrationService = JOB_TYPE_CANDLE_SYNC.equals(job.jobType)
                ? requireMigrationService()
                : null;
        launchRuntimeJob(tenantId, job, job.bootstrapFromDate, migrationService);
        return currentStatus(job);
    }

    public String pauseJob(String tenantId, String jobKey) {
        MigrationRuntimeJob job = requireJob(tenantId, AdminMigrationJobKeySupport.normalizeJobKeyForLookup(jobKey, JOB_TYPE_CANDLE_SYNC));
        synchronized (job) {
            if (!"RUNNING".equals(job.status)) {
                return job.status;
            }
            job.pauseRequested = true;
            job.updatedAt = Instant.now();
            return job.status;
        }
    }

    public String resumeJob(String tenantId, String jobKey) {
        String normalizedJobKey = AdminMigrationJobKeySupport.normalizeJobKeyForLookup(jobKey, JOB_TYPE_CANDLE_SYNC);
        sequencer.removeQueuedJob(tenantId, AdminMigrationJobKeySupport.tenantScopedKey(tenantId, normalizedJobKey));
        MigrationRuntimeJob job = requireJob(tenantId, normalizedJobKey);
        synchronized (job) {
            if (!"PAUSED".equals(job.status)) {
                return job.status;
            }
        }
        UpstoxHistoricalMigrationService migrationService = JOB_TYPE_CANDLE_SYNC.equals(job.jobType)
                ? requireMigrationService()
                : null;
        launchRuntimeJob(tenantId, job, job.bootstrapFromDate, migrationService);
        return currentStatus(job);
    }

    public String stopJob(String tenantId, String jobKey) {
        String normalizedJobKey = AdminMigrationJobKeySupport.normalizeJobKeyForLookup(jobKey, JOB_TYPE_CANDLE_SYNC);
        sequencer.removeQueuedJob(tenantId, AdminMigrationJobKeySupport.tenantScopedKey(tenantId, normalizedJobKey));
        MigrationRuntimeJob job = requireJob(tenantId, normalizedJobKey);
        synchronized (job) {
            if (!"RUNNING".equals(job.status) && !"PAUSED".equals(job.status) && !"PENDING".equals(job.status)) {
                return job.status;
            }
            job.stopRequested = true;
            job.pauseRequested = false;
            job.status = "STOPPED";
            job.updatedAt = Instant.now();
        }
        saveJobSnapshot(tenantId, job);
        return currentStatus(job);
    }

    public List<AdminDtos.MigrationJobResponse> listJobs(String tenantId) {
        return listJobs(tenantId, null);
    }

    public List<AdminDtos.MigrationJobResponse> listJobs(String tenantId, String instrumentKey) {
        ensureRuntimeJobsLoaded(tenantId);
        String normalizedInstrumentKey = normalizeOptionalValue(instrumentKey);
        return migrationJobRepository
                .findAllByTenantIdOrderByInstrumentKeyAscTimeframeUnitAscTimeframeIntervalAscJobTypeAsc(tenantId)
                .stream()
                .filter(job -> normalizedInstrumentKey == null || normalizedInstrumentKey.equals(job.getInstrumentKey()))
                .map(job -> new AdminDtos.MigrationJobResponse(
                        job.getInstrumentKey(),
                        job.getTimeframeUnit(),
                        job.getTimeframeInterval(),
                        job.getJobType(),
                        job.getBootstrapFromDate(),
                        job.getStatus(),
                        job.getProgressPercent(),
                        job.getLastError(),
                        job.getNextFromDate(),
                        job.getUpdatedAt()
                ))
                .toList();
    }

    public List<AdminDtos.MigrationStatusResponse> listMigrationStatus(
            String tenantId,
            String instrumentKey,
            String timeframeUnit,
            Integer timeframeInterval
    ) {
        String normalizedInstrumentKey = normalizeOptionalValue(instrumentKey);
        String normalizedTimeframeUnit = normalizeOptionalValue(timeframeUnit);
        List<UpstoxMigrationStateEntity> states = findMigrationStates(tenantId, normalizedTimeframeUnit, timeframeInterval);

        return states.stream()
                .filter(state -> normalizedInstrumentKey == null || normalizedInstrumentKey.equals(state.getInstrumentKey()))
                .map(state -> new AdminDtos.MigrationStatusResponse(
                        state.getInstrumentKey(),
                        state.getTimeframeUnit(),
                        state.getTimeframeInterval(),
                        state.getNextFromDate(),
                        state.isCompleted(),
                        state.getLastRunStatus(),
                        state.getLastError(),
                        state.getLastRunAt(),
                        state.getUpdatedAt()
                ))
                .toList();
    }

    /**
     * Aligns runtime state with the last saved candle before the worker loop starts.
     */
    void launchRuntimeJob(
            String tenantId,
            MigrationRuntimeJob job,
            LocalDate bootstrapFromDate,
            UpstoxHistoricalMigrationService migrationService
    ) {
        synchronized (job) {
            if ("RUNNING".equals(job.status)) return;
            if (job.future != null && !job.future.isDone()) return;
        }

        UpstoxMigrationStateEntity alignedState = null;
        if (JOB_TYPE_CANDLE_SYNC.equals(job.jobType)) {
            if (migrationService == null) {
                throw new ValidationException("Migration service is disabled");
            }
            alignedState = migrationService.restartStreamFromLastCandle(
                    tenantId, job.instrumentKey, job.timeframeUnit, job.timeframeInterval, bootstrapFromDate);
        }

        boolean started = false;
        synchronized (job) {
            if ("RUNNING".equals(job.status)) return;
            if (job.future != null && !job.future.isDone()) return;
            job.bootstrapFromDate = bootstrapFromDate;
            job.stopRequested = false;
            job.pauseRequested = false;
            job.status = "RUNNING";
            job.lastError = null;
            job.consecutiveRetriableErrors = 0;
            job.nextFromDate = alignedState == null ? null : alignedState.getNextFromDate();
            job.updatedAt = Instant.now();
            job.future = CompletableFuture
                    .runAsync(() -> workerLoop.runMigrationLoop(tenantId, job, migrationService, this::saveJobSnapshot), migrationExecutor)
                    .whenComplete((unused, throwable) ->
                            sequencer.maybeStartNextSequentialJob(tenantId, job, this::launchRuntimeJob, jobs, migrationService));
            started = true;
        }
        if (started) {
            saveJobSnapshot(tenantId, job);
        }
    }

    void saveJobSnapshot(String tenantId, MigrationRuntimeJob job) {
        MigrationJobSnapshot snapshot;
        synchronized (job) {
            snapshot = new MigrationJobSnapshot(
                    job.instrumentKey, job.timeframeUnit, job.timeframeInterval, job.jobType,
                    job.bootstrapFromDate, job.status, job.progressPercent, job.lastError, job.nextFromDate
            );
        }

        AdminMigrationJobEntity entity = migrationJobRepository
                .findByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeIntervalAndJobType(
                        tenantId, snapshot.instrumentKey, snapshot.timeframeUnit,
                        snapshot.timeframeInterval, snapshot.jobType)
                .orElseGet(() -> new AdminMigrationJobEntity(
                        tenantId, snapshot.instrumentKey, snapshot.timeframeUnit,
                        snapshot.timeframeInterval, snapshot.jobType, snapshot.bootstrapFromDate));

        entity.updateSnapshot(
                snapshot.jobType, snapshot.bootstrapFromDate, snapshot.status,
                snapshot.progressPercent, snapshot.lastError, snapshot.nextFromDate);
        migrationJobRepository.save(entity);
    }

    private void ensureRuntimeJobsLoaded(String tenantId) {
        jobLoader.load(tenantId, jobs, this::saveJobSnapshot);
    }

    private List<UpstoxMigrationStateEntity> findMigrationStates(
            String tenantId, String timeframeUnit, Integer timeframeInterval
    ) {
        if (timeframeUnit != null && timeframeInterval != null) {
            return migrationStateRepository
                    .findAllByTenantIdAndTimeframeUnitAndTimeframeIntervalOrderByInstrumentKeyAscTimeframeUnitAscTimeframeIntervalAsc(
                            tenantId, timeframeUnit, timeframeInterval);
        }
        if (timeframeUnit != null) {
            return migrationStateRepository
                    .findAllByTenantIdAndTimeframeUnitOrderByInstrumentKeyAscTimeframeUnitAscTimeframeIntervalAsc(
                            tenantId, timeframeUnit);
        }
        if (timeframeInterval != null) {
            return migrationStateRepository
                    .findAllByTenantIdAndTimeframeIntervalOrderByInstrumentKeyAscTimeframeUnitAscTimeframeIntervalAsc(
                            tenantId, timeframeInterval);
        }
        return migrationStateRepository.findAllByTenantIdOrderByInstrumentKeyAscTimeframeUnitAscTimeframeIntervalAsc(tenantId);
    }

    private UpstoxHistoricalMigrationService requireMigrationService() {
        UpstoxHistoricalMigrationService migrationService = migrationServiceProvider.getIfAvailable();
        if (migrationService == null) {
            throw new ValidationException("Migration service is disabled");
        }
        return migrationService;
    }

    private MigrationRuntimeJob requireJob(String tenantId, String jobKey) {
        ensureRuntimeJobsLoaded(tenantId);
        MigrationRuntimeJob job = jobs.get(AdminMigrationJobKeySupport.tenantScopedKey(tenantId, jobKey));
        if (job == null) {
            throw new ValidationException("Migration job not found");
        }
        return job;
    }

    private String normalizeOptionalValue(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private String normalizeRunMode(String runMode) {
        if (!StringUtils.hasText(runMode)) {
            return RUN_MODE_CONCURRENT;
        }
        String normalized = runMode.trim().toUpperCase(Locale.ROOT);
        if (RUN_MODE_CONCURRENT.equals(normalized) || RUN_MODE_SEQUENTIAL.equals(normalized)) {
            return normalized;
        }
        throw new ValidationException("Invalid runMode. Allowed values: CONCURRENT, SEQUENTIAL");
    }

    private String currentStatus(MigrationRuntimeJob job) {
        synchronized (job) {
            return job.status;
        }
    }

    @PreDestroy
    public void shutdown() {
        migrationExecutor.shutdownNow();
    }

    private record MigrationJobSnapshot(
            String instrumentKey,
            String timeframeUnit,
            Integer timeframeInterval,
            String jobType,
            LocalDate bootstrapFromDate,
            String status,
            int progressPercent,
            String lastError,
            LocalDate nextFromDate
    ) {
    }
}
