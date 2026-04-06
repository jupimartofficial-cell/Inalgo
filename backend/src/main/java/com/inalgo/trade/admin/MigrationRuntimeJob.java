package com.inalgo.trade.admin;

import java.time.Instant;
import java.time.LocalDate;
import java.util.concurrent.CompletableFuture;

/**
 * Mutable runtime state for a single migration job.
 * All field mutations must be performed under {@code synchronized(this)}.
 */
final class MigrationRuntimeJob {
    final String instrumentKey;
    final String timeframeUnit;
    final Integer timeframeInterval;
    volatile String jobType;
    volatile LocalDate bootstrapFromDate;
    volatile String status = "PENDING";
    volatile int progressPercent;
    volatile String lastError;
    volatile LocalDate nextFromDate;
    volatile Instant updatedAt = Instant.now();
    volatile boolean pauseRequested;
    volatile boolean stopRequested;
    volatile int consecutiveRetriableErrors;
    volatile CompletableFuture<Void> future;

    MigrationRuntimeJob(
            String instrumentKey,
            String timeframeUnit,
            Integer timeframeInterval,
            String jobType,
            LocalDate bootstrapFromDate
    ) {
        this.instrumentKey = instrumentKey;
        this.timeframeUnit = timeframeUnit;
        this.timeframeInterval = timeframeInterval;
        this.jobType = jobType;
        this.bootstrapFromDate = bootstrapFromDate;
    }
}
