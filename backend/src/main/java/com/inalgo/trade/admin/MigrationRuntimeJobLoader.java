package com.inalgo.trade.admin;

import com.inalgo.trade.entity.AdminMigrationJobEntity;
import com.inalgo.trade.entity.UpstoxMigrationStateEntity;
import com.inalgo.trade.repository.AdminMigrationJobRepository;
import com.inalgo.trade.repository.UpstoxMigrationStateRepository;
import com.inalgo.trade.upstox.SupportedTimeframe;
import com.inalgo.trade.upstox.UpstoxMigrationProperties;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Rebuilds in-memory runtime jobs from persisted rows, migration-state rows, and stream config.
 * Called lazily by {@link AdminMigrationService} before any read or write operation on the job map.
 */
@Component
class MigrationRuntimeJobLoader {

    private final AdminMigrationJobRepository migrationJobRepository;
    private final UpstoxMigrationStateRepository migrationStateRepository;
    private final UpstoxMigrationProperties migrationProperties;
    private final MigrationCatalogSeeder catalogSeeder;

    MigrationRuntimeJobLoader(
            AdminMigrationJobRepository migrationJobRepository,
            UpstoxMigrationStateRepository migrationStateRepository,
            UpstoxMigrationProperties migrationProperties,
            MigrationCatalogSeeder catalogSeeder
    ) {
        this.migrationJobRepository = migrationJobRepository;
        this.migrationStateRepository = migrationStateRepository;
        this.migrationProperties = migrationProperties;
        this.catalogSeeder = catalogSeeder;
    }

    /**
     * Populates the given {@code jobs} map with runtime state from all sources (persisted rows,
     * migration-state rows, stream config, and default catalog).
     */
    void load(
            String tenantId,
            Map<String, MigrationRuntimeJob> jobs,
            MigrationCatalogSeeder.JobSnapshotSaver snapshotSaver
    ) {
        Set<String> persistedKeys = loadFromPersistedJobs(tenantId, jobs);
        Set<String> stateKeys = loadFromStateRows(tenantId, jobs, persistedKeys, snapshotSaver);
        loadFromStreamConfig(tenantId, jobs, persistedKeys, stateKeys, snapshotSaver);

        catalogSeeder.seedDefaultCatalogJobs(tenantId, persistedKeys, stateKeys, AdminMigrationService.JOB_TYPE_CANDLE_SYNC, jobs, snapshotSaver);
        catalogSeeder.seedDefaultCatalogJobs(tenantId, persistedKeys, stateKeys, AdminMigrationService.JOB_TYPE_TRADING_ANALYTICS_BACKFILL, jobs, snapshotSaver);
    }

    private Set<String> loadFromPersistedJobs(String tenantId, Map<String, MigrationRuntimeJob> jobs) {
        List<AdminMigrationJobEntity> persistedJobs = migrationJobRepository
                .findAllByTenantIdOrderByInstrumentKeyAscTimeframeUnitAscTimeframeIntervalAscJobTypeAsc(tenantId);
        Set<String> persistedKeys = new HashSet<>();
        for (AdminMigrationJobEntity persisted : persistedJobs) {
            String persistedJobType = StringUtils.hasText(persisted.getJobType())
                    ? persisted.getJobType().trim()
                    : AdminMigrationService.JOB_TYPE_CANDLE_SYNC;
            String key = AdminMigrationJobKeySupport.jobKey(
                    persisted.getInstrumentKey(),
                    persisted.getTimeframeUnit(),
                    persisted.getTimeframeInterval(),
                    persistedJobType
            );
            persistedKeys.add(key);
            MigrationRuntimeJob runtimeJob = jobs.computeIfAbsent(
                    AdminMigrationJobKeySupport.tenantScopedKey(tenantId, key),
                    ignored -> new MigrationRuntimeJob(
                            persisted.getInstrumentKey(),
                            persisted.getTimeframeUnit(),
                            persisted.getTimeframeInterval(),
                            persistedJobType,
                            persisted.getBootstrapFromDate()
                    )
            );
            synchronized (runtimeJob) {
                runtimeJob.bootstrapFromDate = persisted.getBootstrapFromDate();
                runtimeJob.jobType = persistedJobType;
                runtimeJob.status = persisted.getStatus();
                runtimeJob.progressPercent = persisted.getProgressPercent() == null ? 0 : persisted.getProgressPercent();
                runtimeJob.lastError = persisted.getLastError();
                runtimeJob.nextFromDate = persisted.getNextFromDate();
                runtimeJob.updatedAt = persisted.getUpdatedAt() == null ? Instant.now() : persisted.getUpdatedAt();
            }
        }
        return persistedKeys;
    }

    private Set<String> loadFromStateRows(
            String tenantId,
            Map<String, MigrationRuntimeJob> jobs,
            Set<String> persistedKeys,
            MigrationCatalogSeeder.JobSnapshotSaver snapshotSaver
    ) {
        List<UpstoxMigrationStateEntity> stateRows =
                migrationStateRepository.findAllByTenantIdOrderByInstrumentKeyAscTimeframeUnitAscTimeframeIntervalAsc(tenantId);
        Set<String> stateKeys = new HashSet<>();
        for (UpstoxMigrationStateEntity state : stateRows) {
            String key = AdminMigrationJobKeySupport.jobKey(
                    state.getInstrumentKey(),
                    state.getTimeframeUnit(),
                    state.getTimeframeInterval(),
                    AdminMigrationService.JOB_TYPE_CANDLE_SYNC
            );
            stateKeys.add(key);
            if (persistedKeys.contains(key)) {
                continue;
            }
            MigrationRuntimeJob runtimeJob = jobs.computeIfAbsent(
                    AdminMigrationJobKeySupport.tenantScopedKey(tenantId, key),
                    ignored -> new MigrationRuntimeJob(
                            state.getInstrumentKey(),
                            state.getTimeframeUnit(),
                            state.getTimeframeInterval(),
                            AdminMigrationService.JOB_TYPE_CANDLE_SYNC,
                            state.getNextFromDate()
                    )
            );
            synchronized (runtimeJob) {
                runtimeJob.bootstrapFromDate = state.getNextFromDate();
                runtimeJob.jobType = AdminMigrationService.JOB_TYPE_CANDLE_SYNC;
                runtimeJob.nextFromDate = state.getNextFromDate();
                runtimeJob.lastError = state.getLastError();
                runtimeJob.progressPercent = state.isCompleted() ? 100 : 0;
                runtimeJob.status = state.isCompleted()
                        ? "COMPLETED"
                        : "FAILED".equalsIgnoreCase(state.getLastRunStatus()) ? "FAILED" : "PENDING";
                runtimeJob.updatedAt = state.getUpdatedAt() == null ? Instant.now() : state.getUpdatedAt();
            }
            snapshotSaver.save(tenantId, runtimeJob);
        }
        return stateKeys;
    }

    private void loadFromStreamConfig(
            String tenantId,
            Map<String, MigrationRuntimeJob> jobs,
            Set<String> persistedKeys,
            Set<String> stateKeys,
            MigrationCatalogSeeder.JobSnapshotSaver snapshotSaver
    ) {
        List<UpstoxMigrationProperties.StreamConfig> streams = migrationProperties.streams();
        if (streams == null || streams.isEmpty()) {
            return;
        }
        for (UpstoxMigrationProperties.StreamConfig stream : streams) {
            if (stream == null || !tenantId.equals(stream.tenantId())) {
                continue;
            }
            SupportedTimeframe.ParsedInterval parsed = SupportedTimeframe.parse(stream.interval());
            String key = AdminMigrationJobKeySupport.jobKey(
                    stream.instrumentKey(), parsed.unit(), parsed.value(), AdminMigrationService.JOB_TYPE_CANDLE_SYNC);
            MigrationRuntimeJob runtimeJob = jobs.computeIfAbsent(
                    AdminMigrationJobKeySupport.tenantScopedKey(tenantId, key),
                    ignored -> new MigrationRuntimeJob(
                            stream.instrumentKey().trim(),
                            parsed.unit(),
                            parsed.value(),
                            AdminMigrationService.JOB_TYPE_CANDLE_SYNC,
                            stream.bootstrapFromDate()
                    )
            );
            // If DB rows were truncated while runtime map held stale state, reset idle jobs.
            if (!persistedKeys.contains(key) && !stateKeys.contains(key)) {
                synchronized (runtimeJob) {
                    boolean idle = runtimeJob.future == null || runtimeJob.future.isDone();
                    if (idle) {
                        runtimeJob.bootstrapFromDate = stream.bootstrapFromDate();
                        runtimeJob.jobType = AdminMigrationService.JOB_TYPE_CANDLE_SYNC;
                        runtimeJob.status = "PENDING";
                        runtimeJob.progressPercent = 0;
                        runtimeJob.lastError = null;
                        runtimeJob.nextFromDate = null;
                        runtimeJob.pauseRequested = false;
                        runtimeJob.stopRequested = false;
                        runtimeJob.consecutiveRetriableErrors = 0;
                        runtimeJob.updatedAt = Instant.now();
                    }
                }
            }
            snapshotSaver.save(tenantId, runtimeJob);
        }
    }
}
