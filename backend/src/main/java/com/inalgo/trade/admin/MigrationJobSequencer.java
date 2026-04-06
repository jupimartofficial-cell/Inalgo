package com.inalgo.trade.admin;

import com.inalgo.trade.upstox.UpstoxHistoricalMigrationService;
import org.springframework.stereotype.Component;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Manages the per-tenant sequential job queue and drives job launch ordering.
 * Works alongside {@link AdminMigrationService} to ensure only one job runs at a time
 * when SEQUENTIAL run mode is requested.
 */
@Component
class MigrationJobSequencer {

    private final Map<String, Deque<MigrationStartRequest>> sequentialQueueByTenant = new ConcurrentHashMap<>();

    /**
     * Appends or replaces requests in the tenant queue (de-duplicated by key).
     */
    void enqueueSequentialJobs(String tenantId, List<MigrationStartRequest> requests) {
        Deque<MigrationStartRequest> queue = sequentialQueueByTenant.computeIfAbsent(tenantId, ignored -> new ArrayDeque<>());
        synchronized (queue) {
            for (MigrationStartRequest request : requests) {
                queue.removeIf(queued -> queued.tenantScopedJobKey.equals(request.tenantScopedJobKey));
                queue.addLast(request);
            }
        }
    }

    /**
     * Clears the entire sequential queue for a tenant (used when switching to concurrent mode).
     */
    void clearQueue(String tenantId) {
        sequentialQueueByTenant.remove(tenantId);
    }

    /**
     * Removes a specific job from the queue (called when the job is explicitly started/stopped/resumed).
     */
    void removeQueuedJob(String tenantId, String tenantScopedJobKey) {
        Deque<MigrationStartRequest> queue = sequentialQueueByTenant.get(tenantId);
        if (queue == null) {
            return;
        }
        synchronized (queue) {
            queue.removeIf(queued -> queued.tenantScopedJobKey.equals(tenantScopedJobKey));
            if (queue.isEmpty()) {
                sequentialQueueByTenant.remove(tenantId, queue);
            }
        }
    }

    /**
     * Called when a job completes, pauses, or stops — starts the next queued job if nothing is running.
     */
    void maybeStartNextSequentialJob(
            String tenantId,
            MigrationRuntimeJob completedJob,
            MigrationJobLauncher launcher,
            Map<String, MigrationRuntimeJob> jobs,
            UpstoxHistoricalMigrationService migrationService
    ) {
        synchronized (completedJob) {
            if ("PAUSED".equals(completedJob.status)) {
                return;
            }
        }
        startNextSequentialJobIfIdle(tenantId, launcher, jobs, migrationService);
    }

    /**
     * Drains queued jobs until one successfully transitions to RUNNING or the queue is empty.
     */
    void startNextSequentialJobIfIdle(
            String tenantId,
            MigrationJobLauncher launcher,
            Map<String, MigrationRuntimeJob> jobs,
            UpstoxHistoricalMigrationService migrationService
    ) {
        Deque<MigrationStartRequest> queue = sequentialQueueByTenant.get(tenantId);
        if (queue == null || hasRunningJob(tenantId, jobs)) {
            return;
        }
        while (true) {
            MigrationStartRequest next;
            synchronized (queue) {
                next = queue.pollFirst();
                if (next == null) {
                    sequentialQueueByTenant.remove(tenantId, queue);
                    return;
                }
            }

            MigrationRuntimeJob nextJob = jobs.get(next.tenantScopedJobKey);
            if (nextJob == null) {
                continue;
            }
            launcher.launch(tenantId, nextJob, next.bootstrapFromDate, migrationService);
            synchronized (nextJob) {
                if ("RUNNING".equals(nextJob.status)) {
                    return;
                }
            }
        }
    }

    private boolean hasRunningJob(String tenantId, Map<String, MigrationRuntimeJob> jobs) {
        for (Map.Entry<String, MigrationRuntimeJob> entry : jobs.entrySet()) {
            if (!entry.getKey().startsWith(tenantId + "::")) {
                continue;
            }
            MigrationRuntimeJob job = entry.getValue();
            synchronized (job) {
                if ("RUNNING".equals(job.status)) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Functional interface so MigrationJobSequencer can trigger job launches without a circular dependency.
     */
    @FunctionalInterface
    interface MigrationJobLauncher {
        void launch(String tenantId, MigrationRuntimeJob job, java.time.LocalDate bootstrapFromDate, UpstoxHistoricalMigrationService migrationService);
    }
}
