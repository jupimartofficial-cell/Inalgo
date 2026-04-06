package com.inalgo.trade.admin;

import com.inalgo.trade.entity.AdminTriggerEntity;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Stateless helper that builds browser facets and trigger descriptors for the trigger browse view.
 * Extracted from AdminTriggerService to keep the main service under the line-budget.
 */
@Component
class TriggerBrowserHelper {

    private static final String TIMEFRAME_KEY_NONE = "NO_TIMEFRAME";
    private static final String TRIGGER_TYPE_SPECIFIC_DATE_TIME = "SPECIFIC_DATE_TIME";

    List<AdminDtos.TriggerFacetOption> buildTabOptions(List<TriggerDescriptor> triggers) {
        long candleSyncCount = triggers.stream()
                .filter(t -> AdminTriggerService.TAB_GROUP_CANDLE_SYNC.equals(t.tabGroup()))
                .count();
        long othersCount = triggers.stream()
                .filter(t -> AdminTriggerService.TAB_GROUP_OTHERS.equals(t.tabGroup()))
                .count();
        return List.of(
                new AdminDtos.TriggerFacetOption(AdminTriggerService.TAB_GROUP_CANDLE_SYNC, "Candle sync Jobs", candleSyncCount),
                new AdminDtos.TriggerFacetOption(AdminTriggerService.TAB_GROUP_OTHERS, "Others", othersCount)
        );
    }

    List<AdminDtos.TriggerFacetOption> buildInstrumentOptions(List<TriggerDescriptor> triggers) {
        Map<String, Long> counts = new LinkedHashMap<>();
        for (TriggerDescriptor trigger : triggers) {
            counts.merge(trigger.trigger().getInstrumentKey(), 1L, Long::sum);
        }
        return counts.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(entry -> new AdminDtos.TriggerFacetOption(entry.getKey(), entry.getKey(), entry.getValue()))
                .toList();
    }

    List<AdminDtos.TriggerTimeframeFacetOption> buildTimeframeOptions(List<TriggerDescriptor> triggers) {
        record TimeframeFacet(String value, String label, String timeframeUnit, Integer timeframeInterval, long count) {}

        Map<String, TimeframeFacet> counts = new LinkedHashMap<>();
        for (TriggerDescriptor trigger : triggers) {
            TimeframeFacet existing = counts.get(trigger.timeframeKey());
            if (existing == null) {
                counts.put(
                        trigger.timeframeKey(),
                        new TimeframeFacet(
                                trigger.timeframeKey(),
                                trigger.timeframeLabel(),
                                trigger.trigger().getTimeframeUnit(),
                                trigger.trigger().getTimeframeInterval(),
                                1L
                        )
                );
            } else {
                counts.put(
                        trigger.timeframeKey(),
                        new TimeframeFacet(
                                existing.value(),
                                existing.label(),
                                existing.timeframeUnit(),
                                existing.timeframeInterval(),
                                existing.count() + 1L
                        )
                );
            }
        }

        return counts.values().stream()
                .sorted(Comparator
                        .comparing((TimeframeFacet option) -> TIMEFRAME_KEY_NONE.equals(option.value()) ? 0 : 1)
                        .thenComparing(TimeframeFacet::label))
                .map(option -> new AdminDtos.TriggerTimeframeFacetOption(
                        option.value(),
                        option.label(),
                        option.timeframeUnit(),
                        option.timeframeInterval(),
                        option.count()
                ))
                .toList();
    }

    List<AdminDtos.TriggerFacetOption> buildJobNatureOptions(List<TriggerDescriptor> triggers) {
        Map<String, AdminDtos.TriggerFacetOption> counts = new LinkedHashMap<>();
        for (TriggerDescriptor trigger : triggers) {
            AdminDtos.TriggerFacetOption existing = counts.get(trigger.jobNatureKey());
            if (existing == null) {
                counts.put(trigger.jobNatureKey(), new AdminDtos.TriggerFacetOption(
                        trigger.jobNatureKey(),
                        trigger.jobNatureLabel(),
                        1L
                ));
            } else {
                counts.put(trigger.jobNatureKey(), new AdminDtos.TriggerFacetOption(
                        existing.value(),
                        existing.label(),
                        existing.count() + 1L
                ));
            }
        }
        List<AdminDtos.TriggerFacetOption> ordered = new ArrayList<>(counts.values());
        ordered.sort(Comparator.comparingInt(option -> jobNatureSortOrder(option.value())));
        return ordered;
    }

    TriggerDescriptor describeTrigger(AdminTriggerEntity trigger) {
        JobNature jobNature = determineJobNature(trigger);
        return new TriggerDescriptor(
                trigger,
                AdminTriggerService.JOB_KEY_CANDLE_SYNC.equals(trigger.getJobKey())
                        ? AdminTriggerService.TAB_GROUP_CANDLE_SYNC
                        : AdminTriggerService.TAB_GROUP_OTHERS,
                jobNature.key(),
                jobNature.label(),
                buildTimeframeKey(trigger.getTimeframeUnit(), trigger.getTimeframeInterval()),
                formatTimeframeLabel(trigger.getTimeframeUnit(), trigger.getTimeframeInterval()),
                TRIGGER_TYPE_SPECIFIC_DATE_TIME.equals(trigger.getTriggerType())
        );
    }

    AdminDtos.TriggerResponse toResponse(TriggerDescriptor descriptor) {
        AdminTriggerEntity trigger = descriptor.trigger();
        return new AdminDtos.TriggerResponse(
                trigger.getId(),
                trigger.getJobKey(),
                trigger.getInstrumentKey(),
                trigger.getTimeframeUnit(),
                trigger.getTimeframeInterval(),
                trigger.getEventSource(),
                trigger.getTriggerType(),
                trigger.getIntervalValue(),
                trigger.getScheduledAt(),
                trigger.getBootstrapFromDate(),
                trigger.getStatus(),
                trigger.getLastRunStatus(),
                trigger.getLastError(),
                trigger.getLastRunAt(),
                trigger.getNextRunAt(),
                trigger.getCreatedAt(),
                trigger.getUpdatedAt(),
                descriptor.tabGroup(),
                descriptor.jobNatureKey(),
                descriptor.jobNatureLabel(),
                descriptor.oneTime()
        );
    }

    private JobNature determineJobNature(AdminTriggerEntity trigger) {
        return switch (trigger.getJobKey()) {
            case AdminTriggerService.JOB_KEY_CANDLE_SYNC -> {
                if (TRIGGER_TYPE_SPECIFIC_DATE_TIME.equals(trigger.getTriggerType())) {
                    yield new JobNature("CANDLE_ONE_TIME", "One-time backfill");
                }
                if ("minutes".equals(trigger.getTimeframeUnit())
                        && trigger.getTimeframeInterval() != null
                        && trigger.getTimeframeInterval() <= 60) {
                    yield new JobNature("CANDLE_INTRADAY", "Intraday sync");
                }
                yield new JobNature("CANDLE_POSITIONAL", "Positional sync");
            }
            case AdminTriggerService.JOB_KEY_TRADING_SIGNAL_REFRESH ->
                    new JobNature("SIGNAL_ANALYTICS", "Signal analytics");
            case AdminTriggerService.JOB_KEY_TRADING_DAY_PARAM_REFRESH ->
                    new JobNature("OPENING_RANGE_ANALYTICS", "Opening range analytics");
            case AdminTriggerService.JOB_KEY_MARKET_SENTIMENT_REFRESH ->
                    new JobNature("MARKET_SENTIMENT_ANALYTICS", "Market trend analytics");
            case AdminTriggerService.JOB_KEY_GLOBAL_INDEX_REFRESH ->
                    new JobNature("GLOBAL_INDEX_ANALYTICS", "Global index analytics");
            default -> new JobNature("OTHER", "Other");
        };
    }

    private int jobNatureSortOrder(String jobNatureKey) {
        return switch (jobNatureKey) {
            case "CANDLE_INTRADAY" -> 0;
            case "CANDLE_POSITIONAL" -> 1;
            case "CANDLE_ONE_TIME" -> 2;
            case "SIGNAL_ANALYTICS" -> 3;
            case "OPENING_RANGE_ANALYTICS" -> 4;
            case "MARKET_SENTIMENT_ANALYTICS" -> 5;
            case "GLOBAL_INDEX_ANALYTICS" -> 6;
            default -> 99;
        };
    }

    private String buildTimeframeKey(String timeframeUnit, Integer timeframeInterval) {
        if (!StringUtils.hasText(timeframeUnit) || timeframeInterval == null) {
            return TIMEFRAME_KEY_NONE;
        }
        return timeframeUnit.trim().toLowerCase(Locale.ROOT) + "|" + timeframeInterval;
    }

    private String formatTimeframeLabel(String timeframeUnit, Integer timeframeInterval) {
        if (!StringUtils.hasText(timeframeUnit) || timeframeInterval == null) {
            return "No timeframe";
        }
        String unitLabel = switch (timeframeUnit.trim().toLowerCase(Locale.ROOT)) {
            case "minutes" -> "Min";
            case "hours" -> "Hour";
            case "days" -> "Day";
            case "weeks" -> "Week";
            case "months" -> "Month";
            default -> timeframeUnit;
        };
        return timeframeInterval + " " + unitLabel;
    }

    record JobNature(String key, String label) {}
}
