package com.inalgo.trade.upstox;

import jakarta.validation.ValidationException;

import java.util.Map;
import java.util.Set;

/**
 * Canonical set of intervals allowed in the MVP.
 */
public final class SupportedTimeframe {
    private static final Map<String, ParsedInterval> SUPPORTED_INTERVALS = Map.ofEntries(
            Map.entry("1minute", new ParsedInterval("minutes", 1)),
            Map.entry("5minute", new ParsedInterval("minutes", 5)),
            Map.entry("15minute", new ParsedInterval("minutes", 15)),
            Map.entry("30minute", new ParsedInterval("minutes", 30)),
            Map.entry("60minute", new ParsedInterval("minutes", 60)),
            Map.entry("1day", new ParsedInterval("days", 1)),
            Map.entry("1week", new ParsedInterval("weeks", 1)),
            Map.entry("1month", new ParsedInterval("months", 1))
    );

    private SupportedTimeframe() {
    }

    public static ParsedInterval parse(String interval) {
        if (interval == null || interval.isBlank()) {
            throw new ValidationException("interval is required");
        }

        String normalized = interval.trim().toLowerCase();
        ParsedInterval parsedInterval = SUPPORTED_INTERVALS.get(normalized);
        if (parsedInterval == null) {
            throw new ValidationException("interval must be one of: " + String.join(", ", SUPPORTED_INTERVALS.keySet()));
        }
        return parsedInterval;
    }

    public static Set<String> all() {
        return SUPPORTED_INTERVALS.keySet();
    }

    public static ParsedInterval requireSupported(String unit, Integer value) {
        if (unit == null || unit.isBlank() || value == null || value < 1) {
            throw new ValidationException("Valid timeframe unit and interval are required");
        }

        String normalizedUnit = unit.trim().toLowerCase();
        for (ParsedInterval supported : SUPPORTED_INTERVALS.values()) {
            if (supported.unit().equals(normalizedUnit) && supported.value() == value) {
                return supported;
            }
        }

        throw new ValidationException("Unsupported timeframe. Allowed values: " + String.join(", ", SUPPORTED_INTERVALS.keySet()));
    }

    public record ParsedInterval(String unit, int value) {
    }
}
