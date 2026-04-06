package com.inalgo.trade.admin;

import com.inalgo.trade.entity.AdminTriggerEntity;

import java.time.Instant;
import java.time.LocalDate;

/**
 * Validated and normalized trigger configuration used by create and update paths.
 */
record TriggerConfig(
        String jobKey,
        String instrumentKey,
        String timeframeUnit,
        Integer timeframeInterval,
        String eventSource,
        String triggerType,
        Integer intervalValue,
        Instant scheduledAt,
        LocalDate bootstrapFromDate
) {
}
