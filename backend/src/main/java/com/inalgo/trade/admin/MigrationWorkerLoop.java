package com.inalgo.trade.admin;

import com.inalgo.trade.entity.UpstoxMigrationStateEntity;
import com.inalgo.trade.service.TradingAnalyticsService;
import com.inalgo.trade.upstox.UpstoxHistoricalMigrationService;
import jakarta.validation.ValidationException;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

/**
 * Contains the worker-loop logic that drives each migration job to completion.
 * Handles the retry/pause/stop state machine, candle sync loops, and analytics backfill.
 */
@Component
class MigrationWorkerLoop {

    static final int RETRY_BACKOFF_MS = 2500;
    static final int MAX_RETRIABLE_ATTEMPTS = 18;
    private static final String NO_DATA_STATUS_MESSAGE = "No candle data found. Start this job to ingest data.";

    private final TradingAnalyticsService tradingAnalyticsService;

    MigrationWorkerLoop(TradingAnalyticsService tradingAnalyticsService) {
        this.tradingAnalyticsService = tradingAnalyticsService;
    }

    /**
     * Keeps requesting chunks until the stream completes, pauses, stops, or exhausts retriable failures.
     */
    void runMigrationLoop(
            String tenantId,
            MigrationRuntimeJob job,
            UpstoxHistoricalMigrationService migrationService,
            JobSnapshotSaver snapshotSaver
    ) {
        if (AdminMigrationService.JOB_TYPE_TRADING_ANALYTICS_BACKFILL.equals(job.jobType)) {
            runTradingAnalyticsBackfill(tenantId, job, snapshotSaver);
            return;
        }
        if (migrationService == null) {
            synchronized (job) {
                job.status = "FAILED";
                job.lastError = "Migration service is disabled";
                job.updatedAt = Instant.now();
            }
            snapshotSaver.save(tenantId, job);
            return;
        }

        while (true) {
            synchronized (job) {
                if (job.stopRequested) {
                    job.status = "STOPPED";
                    job.updatedAt = Instant.now();
                    snapshotSaver.save(tenantId, job);
                    return;
                }
                if (job.pauseRequested) {
                    job.status = "PAUSED";
                    job.updatedAt = Instant.now();
                    snapshotSaver.save(tenantId, job);
                    return;
                }
            }

            try {
                UpstoxMigrationStateEntity state = migrationService.migrateSingleChunkForStream(
                        tenantId,
                        job.instrumentKey,
                        job.timeframeUnit,
                        job.timeframeInterval,
                        job.bootstrapFromDate
                );
                updateJobFromState(job, state);
                snapshotSaver.save(tenantId, job);
                synchronized (job) {
                    job.consecutiveRetriableErrors = 0;
                }
                if (state.isCompleted()) {
                    synchronized (job) {
                        job.status = "COMPLETED";
                        job.progressPercent = 100;
                        job.updatedAt = Instant.now();
                    }
                    snapshotSaver.save(tenantId, job);
                    return;
                }
            } catch (RuntimeException ex) {
                if (isRetriableUpstoxError(ex) && bumpRetriableCount(job) <= MAX_RETRIABLE_ATTEMPTS) {
                    synchronized (job) {
                        job.status = "RUNNING";
                        job.lastError = "Upstox rate-limit/transient error. Retrying shortly: " + ex.getMessage();
                        job.updatedAt = Instant.now();
                    }
                    snapshotSaver.save(tenantId, job);
                    sleepQuietly(RETRY_BACKOFF_MS);
                    continue;
                }
                synchronized (job) {
                    job.status = "FAILED";
                    job.lastError = ex.getMessage();
                    job.updatedAt = Instant.now();
                }
                snapshotSaver.save(tenantId, job);
                return;
            }
        }
    }

    private void runTradingAnalyticsBackfill(String tenantId, MigrationRuntimeJob job, JobSnapshotSaver snapshotSaver) {
        synchronized (job) {
            if (job.stopRequested) {
                job.status = "STOPPED";
                job.updatedAt = Instant.now();
                snapshotSaver.save(tenantId, job);
                return;
            }
            if (job.pauseRequested) {
                job.status = "PAUSED";
                job.updatedAt = Instant.now();
                snapshotSaver.save(tenantId, job);
                return;
            }
        }

        try {
            TradingAnalyticsService.TradingAnalyticsBackfillResult result = tradingAnalyticsService.backfillTradingAnalytics(
                    tenantId,
                    job.instrumentKey,
                    job.timeframeUnit,
                    job.timeframeInterval,
                    job.bootstrapFromDate,
                    LocalDate.now()
            );

            if (result.processedTradingDays() == 0) {
                throw new ValidationException(NO_DATA_STATUS_MESSAGE);
            }

            synchronized (job) {
                job.nextFromDate = result.toDate().plusDays(1);
                job.progressPercent = 100;
                job.status = "COMPLETED";
                job.lastError = null;
                job.updatedAt = Instant.now();
            }
            snapshotSaver.save(tenantId, job);
        } catch (RuntimeException ex) {
            synchronized (job) {
                job.status = "FAILED";
                job.lastError = ex.getMessage();
                job.updatedAt = Instant.now();
            }
            snapshotSaver.save(tenantId, job);
        }
    }

    private void updateJobFromState(MigrationRuntimeJob job, UpstoxMigrationStateEntity state) {
        long totalDays = Math.max(1L, ChronoUnit.DAYS.between(job.bootstrapFromDate, LocalDate.now()) + 1L);
        long completedDays = Math.max(0L, ChronoUnit.DAYS.between(job.bootstrapFromDate, state.getNextFromDate()));
        int progress = (int) Math.min(100L, (completedDays * 100L) / totalDays);

        synchronized (job) {
            job.nextFromDate = state.getNextFromDate();
            job.lastError = state.getLastError();
            job.progressPercent = state.isCompleted() ? 100 : progress;
            job.status = state.isCompleted() ? "COMPLETED" : "RUNNING";
            job.updatedAt = Instant.now();
        }
    }

    private int bumpRetriableCount(MigrationRuntimeJob job) {
        synchronized (job) {
            job.consecutiveRetriableErrors += 1;
            return job.consecutiveRetriableErrors;
        }
    }

    boolean isRetriableUpstoxError(RuntimeException ex) {
        String message = ex.getMessage();
        if (message == null) return false;
        String normalized = message.toLowerCase();
        return normalized.contains("status: 429")
                || normalized.contains("too_many_requests")
                || normalized.contains("temporarily unavailable")
                || normalized.contains("connection reset")
                || normalized.contains("read timed out");
    }

    void sleepQuietly(long delayMs) {
        try {
            Thread.sleep(delayMs);
        } catch (InterruptedException interruptedException) {
            Thread.currentThread().interrupt();
        }
    }

    /**
     * Functional interface for saving job snapshots without circular dependency.
     */
    @FunctionalInterface
    interface JobSnapshotSaver {
        void save(String tenantId, MigrationRuntimeJob job);
    }
}
