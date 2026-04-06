package com.inalgo.trade.admin;

import com.inalgo.trade.entity.AdminTriggerEntity;
import com.inalgo.trade.service.IndiaMarketHoursService;
import com.inalgo.trade.upstox.SupportedTimeframe;
import jakarta.validation.ValidationException;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Locale;
import java.util.Set;

/**
 * Stateless helper that handles trigger config normalization, validation, and schedule calculation.
 * Extracted from AdminTriggerService to keep the main service under the line-budget.
 */
@Component
class TriggerScheduleHelper {

    private static final String EVENT_SOURCE_TIME_DRIVEN = "TIME_DRIVEN";
    static final String TRIGGER_TYPE_SPECIFIC_DATE_TIME = "SPECIFIC_DATE_TIME";
    private static final Set<Integer> MINUTE_INTERVALS = Set.of(1, 2, 3, 4, 5, 6, 7, 10, 15, 30);
    private static final Set<Integer> HOUR_INTERVALS = Set.of(1, 2, 4, 6, 8, 12);
    private static final Set<Integer> DAY_INTERVALS = Set.of(1, 2, 5, 7);
    private static final Set<Integer> WEEK_INTERVALS = Set.of(1, 2, 4);
    private static final Set<Integer> MONTH_INTERVALS = Set.of(1, 3, 6, 12);
    private final IndiaMarketHoursService marketHoursService;

    TriggerScheduleHelper(IndiaMarketHoursService marketHoursService) {
        this.marketHoursService = marketHoursService;
    }

    TriggerConfig prepareTriggerConfig(
            String jobKey,
            String instrumentKey,
            String timeframeUnit,
            Integer timeframeInterval,
            String eventSource,
            String triggerType,
            Integer intervalValue,
            Instant scheduledAt,
            AdminTriggerEntity existingTrigger
    ) {
        String normalizedJobKey = normalizeJobKey(jobKey);
        String normalizedInstrumentKey = instrumentKey.trim();
        String normalizedTimeframeUnit = normalizeTimeframeUnit(timeframeUnit);
        validateJobConfiguration(normalizedJobKey, normalizedTimeframeUnit, timeframeInterval);
        String normalizedEventSource = eventSource.trim().toUpperCase(Locale.ROOT);
        if (!EVENT_SOURCE_TIME_DRIVEN.equals(normalizedEventSource)) {
            throw new ValidationException("Only TIME_DRIVEN triggers are supported");
        }

        String normalizedType = triggerType.trim().toUpperCase(Locale.ROOT);
        switch (normalizedType) {
            case TRIGGER_TYPE_SPECIFIC_DATE_TIME -> {
                if (scheduledAt == null) {
                    throw new ValidationException("scheduledAt is required for SPECIFIC_DATE_TIME triggers");
                }
                if (intervalValue != null) {
                    throw new ValidationException("intervalValue is not used for SPECIFIC_DATE_TIME triggers");
                }
            }
            case "MINUTES_TIMER" -> validateInterval(normalizedType, intervalValue, MINUTE_INTERVALS);
            case "HOUR_TIMER" -> validateInterval(normalizedType, intervalValue, HOUR_INTERVALS);
            case "DAY_TIMER" -> validateInterval(normalizedType, intervalValue, DAY_INTERVALS);
            case "WEEK_TIMER" -> validateInterval(normalizedType, intervalValue, WEEK_INTERVALS);
            case "MONTH_TIMER" -> validateInterval(normalizedType, intervalValue, MONTH_INTERVALS);
            default -> throw new ValidationException("Unsupported triggerType");
        }

        return new TriggerConfig(
                normalizedJobKey,
                normalizedInstrumentKey,
                normalizedTimeframeUnit,
                timeframeInterval,
                normalizedEventSource,
                normalizedType,
                normalizeIntervalValue(normalizedType, intervalValue),
                normalizeScheduledAt(normalizedType, scheduledAt),
                determineBootstrapFromDate(normalizedJobKey, existingTrigger)
        );
    }

    Instant calculateInitialNextRunAt(AdminTriggerEntity trigger, Instant now) {
        if (TRIGGER_TYPE_SPECIFIC_DATE_TIME.equals(trigger.getTriggerType())) {
            if (trigger.getScheduledAt() == null) {
                throw new ValidationException("scheduledAt is required for specific date triggers");
            }
            Instant requestedRunAt = trigger.getScheduledAt().isAfter(now) ? trigger.getScheduledAt() : now;
            return marketHoursService.alignToNextBusinessWindow(requestedRunAt);
        }
        return marketHoursService.alignToNextBusinessWindow(now);
    }

    Instant calculateRecurringNextRunAt(AdminTriggerEntity trigger, Instant from) {
        Integer intervalValue = trigger.getIntervalValue();
        Instant rawNextRunAt = switch (trigger.getTriggerType()) {
            case "MINUTES_TIMER" -> from.plusSeconds(intervalValue.longValue() * 60L);
            case "HOUR_TIMER" -> from.plusSeconds(intervalValue.longValue() * 3600L);
            case "DAY_TIMER" -> from.plusSeconds(intervalValue.longValue() * 86400L);
            case "WEEK_TIMER" -> from.plusSeconds(intervalValue.longValue() * 7L * 86400L);
            case "MONTH_TIMER" -> from.atZone(marketHoursService.marketZone()).plusMonths(intervalValue).toInstant();
            default -> throw new ValidationException("Unsupported recurring triggerType");
        };
        return marketHoursService.alignToNextBusinessWindow(rawNextRunAt);
    }

    private void validateJobConfiguration(String jobKey, String timeframeUnit, Integer timeframeInterval) {
        switch (jobKey) {
            case AdminTriggerService.JOB_KEY_CANDLE_SYNC, AdminTriggerService.JOB_KEY_TRADING_SIGNAL_REFRESH ->
                    SupportedTimeframe.requireSupported(timeframeUnit, timeframeInterval);
            case AdminTriggerService.JOB_KEY_TRADING_DAY_PARAM_REFRESH,
                 AdminTriggerService.JOB_KEY_MARKET_SENTIMENT_REFRESH,
                 AdminTriggerService.JOB_KEY_GLOBAL_INDEX_REFRESH -> {
                if (StringUtils.hasText(timeframeUnit) || timeframeInterval != null) {
                    throw new ValidationException("Timeframe is not used for " + jobKey);
                }
            }
            default -> throw new ValidationException("Unsupported jobKey");
        }
    }

    private void validateInterval(String triggerType, Integer intervalValue, Set<Integer> supportedValues) {
        if (intervalValue == null || !supportedValues.contains(intervalValue)) {
            throw new ValidationException("Unsupported intervalValue for " + triggerType);
        }
    }

    private String normalizeJobKey(String jobKey) {
        return StringUtils.hasText(jobKey)
                ? jobKey.trim().toUpperCase(Locale.ROOT)
                : AdminTriggerService.JOB_KEY_CANDLE_SYNC;
    }

    private String normalizeTimeframeUnit(String timeframeUnit) {
        return StringUtils.hasText(timeframeUnit)
                ? timeframeUnit.trim().toLowerCase(Locale.ROOT)
                : null;
    }

    /**
     * Candle sync bootstrap dates are sticky so later edits do not silently expand or shrink the backfill window.
     */
    private LocalDate determineBootstrapFromDate(String jobKey, AdminTriggerEntity existingTrigger) {
        if (!AdminTriggerService.JOB_KEY_CANDLE_SYNC.equals(jobKey)) {
            return null;
        }
        if (existingTrigger != null && existingTrigger.getBootstrapFromDate() != null) {
            return existingTrigger.getBootstrapFromDate();
        }
        return LocalDate.now();
    }

    private Instant normalizeScheduledAt(String triggerType, Instant scheduledAt) {
        if (!TRIGGER_TYPE_SPECIFIC_DATE_TIME.equals(triggerType)) {
            return null;
        }
        return scheduledAt;
    }

    private Integer normalizeIntervalValue(String triggerType, Integer intervalValue) {
        if (TRIGGER_TYPE_SPECIFIC_DATE_TIME.equals(triggerType)) {
            return null;
        }
        return intervalValue;
    }
}
