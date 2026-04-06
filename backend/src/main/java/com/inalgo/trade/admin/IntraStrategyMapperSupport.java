package com.inalgo.trade.admin;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.inalgo.trade.entity.IntraStrategyEntity;
import com.inalgo.trade.entity.IntraStrategyPerfSnapshotEntity;
import com.inalgo.trade.entity.IntraStrategyVersionEntity;
import jakarta.validation.ValidationException;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

@Component
public class IntraStrategyMapperSupport {

    private static final List<String> ALLOWED_SORT = List.of("RECENT_EDITED", "NAME", "PERFORMANCE");
    private static final List<String> ALLOWED_PUBLISH_TARGET = List.of("PAPER_READY", "LIVE_READY");

    private final ObjectMapper objectMapper;

    public IntraStrategyMapperSupport(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public IntraStrategyDtos.IntraStrategyLibraryItem toLibraryItem(
            IntraStrategyEntity item,
            IntraStrategyPerfSnapshotEntity perf
    ) {
        return new IntraStrategyDtos.IntraStrategyLibraryItem(
                item.getId(),
                item.getStrategyName(),
                item.getUnderlyingKey(),
                item.getTimeframeUnit(),
                item.getTimeframeInterval(),
                item.getStrategyType(),
                item.getStatus(),
                item.getUpdatedAt(),
                item.getCreator(),
                item.getCurrentVersion(),
                item.getPaperEligible(),
                item.getLiveEligible(),
                perf == null ? null : perf.getLatestTotalPnl(),
                perf == null ? null : perf.getLatestExecutedTrades()
        );
    }

    public IntraStrategyDtos.IntraStrategyVersionResponse toVersionResponse(IntraStrategyVersionEntity entity) {
        IntraStrategyDtos.IntraStrategyValidationResult validation = new IntraStrategyDtos.IntraStrategyValidationResult(
                parseIssues(entity.getValidationErrorsJson()).isEmpty(),
                Boolean.TRUE.equals(entity.getPaperEligible()),
                Boolean.TRUE.equals(entity.getLiveEligible()),
                parseIssues(entity.getValidationErrorsJson()),
                parseStringList(entity.getValidationSummaryJson()),
                parseStringList(entity.getValidationWarningsJson())
        );
        return toVersionResponse(entity, validation);
    }

    public IntraStrategyDtos.IntraStrategyVersionResponse toVersionResponse(
            IntraStrategyVersionEntity entity,
            IntraStrategyDtos.IntraStrategyValidationResult validation
    ) {
        return new IntraStrategyDtos.IntraStrategyVersionResponse(
                entity.getId(),
                entity.getStrategyId(),
                entity.getVersion(),
                Boolean.TRUE.equals(entity.getAdvancedMode()),
                entity.getTimeframeUnit(),
                entity.getTimeframeInterval(),
                readStrategy(entity.getStrategyJson()),
                validation,
                entity.getCreatedAt(),
                entity.getValidatedAt()
        );
    }

    public Comparator<IntraStrategyDtos.IntraStrategyLibraryItem> comparatorForSort(String sort) {
        if ("NAME".equals(sort)) {
            return Comparator.comparing(IntraStrategyDtos.IntraStrategyLibraryItem::strategyName, String.CASE_INSENSITIVE_ORDER)
                    .thenComparing(IntraStrategyDtos.IntraStrategyLibraryItem::id, Comparator.nullsLast(Long::compareTo));
        }
        if ("PERFORMANCE".equals(sort)) {
            return Comparator
                    .comparing(IntraStrategyDtos.IntraStrategyLibraryItem::latestPerformancePnl, Comparator.nullsLast(BigDecimal::compareTo))
                    .reversed()
                    .thenComparing(IntraStrategyDtos.IntraStrategyLibraryItem::lastModifiedAt, Comparator.nullsLast(Instant::compareTo).reversed());
        }
        return Comparator.comparing(IntraStrategyDtos.IntraStrategyLibraryItem::lastModifiedAt, Comparator.nullsLast(Instant::compareTo).reversed())
                .thenComparing(IntraStrategyDtos.IntraStrategyLibraryItem::id, Comparator.nullsLast(Long::compareTo).reversed());
    }

    public String normalizeSort(String sort) {
        String normalized = sort == null ? "RECENT_EDITED" : sort.trim().toUpperCase(Locale.ENGLISH);
        if (!ALLOWED_SORT.contains(normalized)) {
            throw new ValidationException("sort must be RECENT_EDITED, NAME, or PERFORMANCE");
        }
        return normalized;
    }

    public String normalizePublishTarget(String targetStatus) {
        String normalized = requireText(targetStatus, "targetStatus").toUpperCase(Locale.ENGLISH);
        if (!ALLOWED_PUBLISH_TARGET.contains(normalized)) {
            throw new ValidationException("targetStatus must be PAPER_READY or LIVE_READY");
        }
        return normalized;
    }

    public TimeframeFilter parseTimeframeFilter(String raw) {
        if (!StringUtils.hasText(raw)) {
            return TimeframeFilter.empty();
        }
        String[] parts = raw.split("\\|");
        if (parts.length != 2) {
            throw new ValidationException("timeframe must be formatted as unit|interval");
        }
        int interval;
        try {
            interval = Integer.parseInt(parts[1].trim());
        } catch (NumberFormatException ex) {
            throw new ValidationException("Invalid timeframe interval");
        }
        return new TimeframeFilter(parts[0].trim().toLowerCase(Locale.ENGLISH), interval);
    }

    public AdminDtos.BacktestStrategyPayload readStrategy(String json) {
        try {
            return objectMapper.readValue(json, AdminDtos.BacktestStrategyPayload.class);
        } catch (JsonProcessingException ex) {
            throw new ValidationException("Stored intra strategy payload is invalid");
        }
    }

    public List<IntraStrategyDtos.IntraStrategyValidationIssue> parseIssues(String json) {
        if (!StringUtils.hasText(json)) {
            return List.of();
        }
        try {
            return objectMapper.readValue(
                    json,
                    new TypeReference<List<IntraStrategyDtos.IntraStrategyValidationIssue>>() {
                    }
            );
        } catch (JsonProcessingException ex) {
            return List.of();
        }
    }

    public List<String> parseStringList(String json) {
        if (!StringUtils.hasText(json)) {
            return List.of();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {
            });
        } catch (JsonProcessingException ex) {
            return List.of();
        }
    }

    public String toJson(Object object) {
        try {
            return objectMapper.writeValueAsString(object);
        } catch (JsonProcessingException ex) {
            throw new ValidationException("Unable to serialize intra strategy state");
        }
    }

    public String inferMarketSession(String entry, String exit) {
        if (!StringUtils.hasText(entry) || !StringUtils.hasText(exit)) {
            return "REGULAR_MARKET";
        }
        return "REGULAR_MARKET " + entry + "-" + exit;
    }

    public String requireText(String value, String field) {
        if (!StringUtils.hasText(value)) {
            throw new ValidationException(field + " is required");
        }
        return value.trim();
    }

    public record TimeframeFilter(String unit, Integer interval) {
        static TimeframeFilter empty() {
            return new TimeframeFilter("", null);
        }

        boolean matches(String sourceUnit, Integer sourceInterval) {
            if (!StringUtils.hasText(unit)) {
                return true;
            }
            return unit.equalsIgnoreCase(sourceUnit) && interval != null && interval.equals(sourceInterval);
        }
    }
}
