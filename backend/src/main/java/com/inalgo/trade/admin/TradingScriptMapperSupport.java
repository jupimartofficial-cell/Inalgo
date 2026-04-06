package com.inalgo.trade.admin;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.inalgo.trade.entity.TradingScriptEntity;
import com.inalgo.trade.entity.TradingScriptPerfSnapshotEntity;
import com.inalgo.trade.entity.TradingScriptVersionEntity;
import jakarta.validation.ValidationException;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

@Component
public class TradingScriptMapperSupport {

    private static final List<String> ALLOWED_SORT = List.of("RECENT_EDITED", "NAME", "PERFORMANCE");
    private static final List<String> ALLOWED_PUBLISH_TARGET = List.of("PAPER_READY", "LIVE_READY");

    private final ObjectMapper objectMapper;

    public TradingScriptMapperSupport(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public TradingScriptDtos.TradingScriptLibraryItem toLibraryItem(
            TradingScriptEntity item,
            TradingScriptPerfSnapshotEntity perf
    ) {
        return new TradingScriptDtos.TradingScriptLibraryItem(
                item.getId(),
                item.getScriptName(),
                item.getInstrumentKey(),
                item.getTimeframeUnit(),
                item.getTimeframeInterval(),
                item.getStrategyType(),
                item.getStatus(),
                item.getCompileStatus(),
                item.getUpdatedAt(),
                item.getCreator(),
                item.getCurrentVersion(),
                item.getPaperEligible(),
                item.getLiveEligible(),
                perf == null ? null : perf.getLatestTotalPnl(),
                perf == null ? null : perf.getLatestExecutedTrades(),
                perf == null ? null : perf.getLatestRealWorldAccuracyPct()
        );
    }

    public TradingScriptDtos.TradingScriptVersionResponse toVersionResponse(TradingScriptVersionEntity entity) {
        return new TradingScriptDtos.TradingScriptVersionResponse(
                entity.getId(),
                entity.getScriptId(),
                entity.getVersion(),
                entity.getSourceJs(),
                toCompileResponse(entity),
                entity.getCreatedAt(),
                entity.getCompiledAt()
        );
    }

    public TradingScriptDtos.TradingScriptCompileResponse toCompileResponse(TradingScriptVersionEntity entity) {
        List<TradingScriptDtos.TradingScriptDiagnostic> diagnostics = parseDiagnostics(entity.getCompileDiagnosticsJson());
        TradingScriptDtos.TradingScriptCompiledArtifact artifact = parseArtifact(entity.getCompiledArtifactJson());
        boolean valid = "SUCCESS".equalsIgnoreCase(entity.getCompileStatus()) && diagnostics.stream().noneMatch(item -> "error".equalsIgnoreCase(item.severity()));
        return new TradingScriptDtos.TradingScriptCompileResponse(
                entity.getCompileStatus(),
                valid,
                Boolean.TRUE.equals(entity.getPaperEligible()),
                Boolean.TRUE.equals(entity.getLiveEligible()),
                diagnostics,
                artifact,
                artifact == null ? List.of() : artifact.notes()
        );
    }

    public TradingScriptDtos.TradingScriptCompiledArtifact parseArtifact(String json) {
        if (!StringUtils.hasText(json)) {
            return null;
        }
        try {
            return objectMapper.readValue(json, TradingScriptDtos.TradingScriptCompiledArtifact.class);
        } catch (JsonProcessingException ex) {
            throw new ValidationException("Stored trading script artifact is invalid");
        }
    }

    public List<TradingScriptDtos.TradingScriptDiagnostic> parseDiagnostics(String json) {
        if (!StringUtils.hasText(json)) {
            return List.of();
        }
        try {
            return objectMapper.readValue(
                    json,
                    new TypeReference<List<TradingScriptDtos.TradingScriptDiagnostic>>() {
                    }
            );
        } catch (JsonProcessingException ex) {
            return List.of();
        }
    }

    public String normalizeSort(String sort) {
        String normalized = sort == null ? "RECENT_EDITED" : sort.trim().toUpperCase(Locale.ENGLISH);
        if (!ALLOWED_SORT.contains(normalized)) {
            throw new ValidationException("sort must be RECENT_EDITED, NAME, or PERFORMANCE");
        }
        return normalized;
    }

    public Comparator<TradingScriptDtos.TradingScriptLibraryItem> comparatorForSort(String sort) {
        if ("NAME".equals(sort)) {
            return Comparator.comparing(TradingScriptDtos.TradingScriptLibraryItem::scriptName, String.CASE_INSENSITIVE_ORDER)
                    .thenComparing(TradingScriptDtos.TradingScriptLibraryItem::id, Comparator.nullsLast(Long::compareTo));
        }
        if ("PERFORMANCE".equals(sort)) {
            return Comparator
                    .comparing(TradingScriptDtos.TradingScriptLibraryItem::latestPerformancePnl, Comparator.nullsLast(BigDecimal::compareTo))
                    .reversed()
                    .thenComparing(TradingScriptDtos.TradingScriptLibraryItem::lastModifiedAt, Comparator.nullsLast(Instant::compareTo).reversed());
        }
        return Comparator.comparing(TradingScriptDtos.TradingScriptLibraryItem::lastModifiedAt, Comparator.nullsLast(Instant::compareTo).reversed())
                .thenComparing(TradingScriptDtos.TradingScriptLibraryItem::id, Comparator.nullsLast(Long::compareTo).reversed());
    }

    public String normalizePublishTarget(String targetStatus) {
        String normalized = requireText(targetStatus, "targetStatus").toUpperCase(Locale.ENGLISH);
        if (!ALLOWED_PUBLISH_TARGET.contains(normalized)) {
            throw new ValidationException("targetStatus must be PAPER_READY or LIVE_READY");
        }
        return normalized;
    }

    public IntraStrategyMapperSupport.TimeframeFilter parseTimeframeFilter(String raw) {
        if (!StringUtils.hasText(raw)) {
            return IntraStrategyMapperSupport.TimeframeFilter.empty();
        }
        String[] parts = raw.split("\\|");
        if (parts.length != 2) {
            throw new ValidationException("timeframe must be formatted as unit|interval");
        }
        try {
            return new IntraStrategyMapperSupport.TimeframeFilter(parts[0].trim().toLowerCase(Locale.ENGLISH), Integer.parseInt(parts[1].trim()));
        } catch (NumberFormatException ex) {
            throw new ValidationException("Invalid timeframe interval");
        }
    }

    public String toJson(Object object) {
        try {
            return objectMapper.writeValueAsString(object);
        } catch (JsonProcessingException ex) {
            throw new ValidationException("Unable to serialize trading script state");
        }
    }

    public String requireText(String value, String field) {
        if (!StringUtils.hasText(value)) {
            throw new ValidationException(field + " is required");
        }
        return value.trim();
    }
}
