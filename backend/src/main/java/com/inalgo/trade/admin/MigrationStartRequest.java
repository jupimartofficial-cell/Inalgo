package com.inalgo.trade.admin;

import java.time.LocalDate;

/**
 * Holds the key and bootstrap date for a single job enqueued in the sequential queue.
 */
final class MigrationStartRequest {
    final String tenantScopedJobKey;
    final LocalDate bootstrapFromDate;

    MigrationStartRequest(String tenantScopedJobKey, LocalDate bootstrapFromDate) {
        this.tenantScopedJobKey = tenantScopedJobKey;
        this.bootstrapFromDate = bootstrapFromDate;
    }
}
