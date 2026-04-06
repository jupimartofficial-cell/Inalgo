package com.inalgo.trade.admin;

import com.inalgo.trade.repository.CandleRepository;
import com.inalgo.trade.upstox.FuturesContractRollService;
import com.inalgo.trade.upstox.UpstoxMigrationProperties;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Seeds default catalog jobs so the admin UI shows all standard instrument/timeframe combinations
 * before any migration has been triggered.
 */
@Component
class MigrationCatalogSeeder {

    static final LocalDate DEFAULT_BOOTSTRAP_FALLBACK = LocalDate.of(2024, 1, 1);

    private static final String NO_DATA_STATUS_MESSAGE = "No candle data found. Start this job to ingest data.";

    // Spot indices are stable and hardcoded; futures keys are resolved dynamically from
    // FuturesContractRollService so the seeder always uses the current front-month contract.
    static final List<String> SPOT_INSTRUMENT_KEYS = List.of(
            "NSE_INDEX|Nifty 50",
            "NSE_INDEX|Nifty Bank",
            "BSE_INDEX|SENSEX"
    );

    static final List<TimeframeOption> DEFAULT_TIMEFRAMES = List.of(
            new TimeframeOption("minutes", 1),
            new TimeframeOption("minutes", 5),
            new TimeframeOption("minutes", 15),
            new TimeframeOption("minutes", 30),
            new TimeframeOption("minutes", 60),
            new TimeframeOption("days", 1),
            new TimeframeOption("weeks", 1),
            new TimeframeOption("months", 1)
    );

    private final CandleRepository candleRepository;
    private final UpstoxMigrationProperties migrationProperties;
    private final FuturesContractRollService futuresContractRollService;

    MigrationCatalogSeeder(
            CandleRepository candleRepository,
            UpstoxMigrationProperties migrationProperties,
            FuturesContractRollService futuresContractRollService
    ) {
        this.candleRepository = candleRepository;
        this.migrationProperties = migrationProperties;
        this.futuresContractRollService = futuresContractRollService;
    }

    /** Returns the effective instrument key list: spot indices + current futures from registry. */
    List<String> effectiveInstrumentKeys() {
        List<String> keys = new ArrayList<>(SPOT_INSTRUMENT_KEYS);
        if (futuresContractRollService != null) {
            keys.addAll(futuresContractRollService.getActiveFuturesInstrumentKeys());
        }
        return keys;
    }

    /**
     * Seeds default instrument/timeframe combinations for the given job type.
     * Only creates a runtime job entry when no persisted or state row already exists.
     */
    void seedDefaultCatalogJobs(
            String tenantId,
            Set<String> persistedKeys,
            Set<String> stateKeys,
            String jobType,
            Map<String, MigrationRuntimeJob> jobs,
            JobSnapshotSaver snapshotSaver
    ) {
        LocalDate defaultBootstrap = defaultBootstrapFromTenantStreams(tenantId);

        for (String instrumentKey : effectiveInstrumentKeys()) {
            for (TimeframeOption timeframe : DEFAULT_TIMEFRAMES) {
                String key = AdminMigrationJobKeySupport.jobKey(instrumentKey, timeframe.unit, timeframe.interval, jobType);
                if (persistedKeys.contains(key) || stateKeys.contains(key)) {
                    continue;
                }

                MigrationRuntimeJob runtimeJob = jobs.computeIfAbsent(
                        AdminMigrationJobKeySupport.tenantScopedKey(tenantId, key),
                        ignored -> new MigrationRuntimeJob(instrumentKey, timeframe.unit, timeframe.interval, jobType, defaultBootstrap)
                );

                synchronized (runtimeJob) {
                    boolean idle = runtimeJob.future == null || runtimeJob.future.isDone();
                    if (!idle) {
                        continue;
                    }
                    boolean hasCandleData = candleRepository.existsByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeInterval(
                            tenantId,
                            instrumentKey,
                            timeframe.unit,
                            timeframe.interval
                    );
                    runtimeJob.bootstrapFromDate = defaultBootstrap;
                    runtimeJob.jobType = jobType;
                    runtimeJob.progressPercent = 0;
                    runtimeJob.nextFromDate = null;
                    runtimeJob.pauseRequested = false;
                    runtimeJob.stopRequested = false;
                    runtimeJob.consecutiveRetriableErrors = 0;
                    runtimeJob.updatedAt = Instant.now();
                    if (hasCandleData) {
                        runtimeJob.status = "PENDING";
                        runtimeJob.lastError = null;
                    } else {
                        runtimeJob.status = "FAILED";
                        runtimeJob.lastError = NO_DATA_STATUS_MESSAGE;
                    }
                }
                snapshotSaver.save(tenantId, runtimeJob);
            }
        }
    }

    /**
     * Resolves the earliest bootstrap date from tenant stream configs, falling back to the default.
     */
    LocalDate defaultBootstrapFromTenantStreams(String tenantId) {
        List<UpstoxMigrationProperties.StreamConfig> streams = migrationProperties.streams();
        if (streams == null || streams.isEmpty()) {
            return DEFAULT_BOOTSTRAP_FALLBACK;
        }
        LocalDate selected = null;
        for (UpstoxMigrationProperties.StreamConfig stream : streams) {
            if (stream == null || !tenantId.equals(stream.tenantId())) {
                continue;
            }
            if (selected == null || stream.bootstrapFromDate().isBefore(selected)) {
                selected = stream.bootstrapFromDate();
            }
        }
        return selected == null ? DEFAULT_BOOTSTRAP_FALLBACK : selected;
    }

    /**
     * Functional interface for saving a job snapshot without a circular dependency.
     */
    @FunctionalInterface
    interface JobSnapshotSaver {
        void save(String tenantId, MigrationRuntimeJob job);
    }
}
