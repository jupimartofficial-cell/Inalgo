package com.inalgo.trade.admin;

import com.inalgo.trade.entity.IntraPositionSnapshotEntity;
import com.inalgo.trade.entity.IntraRuntimeStrategyEntity;
import com.inalgo.trade.repository.IntraPositionSnapshotRepository;
import com.inalgo.trade.upstox.UpstoxOrderDtos;
import com.inalgo.trade.upstox.UpstoxOrderService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@Component
public class IntraMonitorBrokerPnlSupport {

    private static final Logger log = LoggerFactory.getLogger(IntraMonitorBrokerPnlSupport.class);

    private final IntraPositionSnapshotRepository positionRepository;
    private final UpstoxOrderService upstoxOrderService;

    public IntraMonitorBrokerPnlSupport(
            IntraPositionSnapshotRepository positionRepository,
            UpstoxOrderService upstoxOrderService
    ) {
        this.positionRepository = positionRepository;
        this.upstoxOrderService = upstoxOrderService;
    }

    public Map<Long, BigDecimal> resolveLiveRuntimeBrokerMtm(
            String tenantId,
            String username,
            List<IntraRuntimeStrategyEntity> runtimeRows
    ) {
        if (runtimeRows == null || runtimeRows.isEmpty()) {
            return Map.of();
        }
        List<IntraRuntimeStrategyEntity> liveActiveRuntimes = runtimeRows.stream()
                .filter(r -> "LIVE".equalsIgnoreCase(r.getMode()) && isRuntimeActiveForBrokerMtm(r.getStatus()))
                .toList();
        if (liveActiveRuntimes.isEmpty()) {
            return Map.of();
        }
        Map<String, PositionMarkOverride> brokerByInstrument = fetchBrokerPositionMarks(tenantId);
        if (brokerByInstrument.isEmpty()) {
            return Map.of();
        }
        List<Long> executionIds = liveActiveRuntimes.stream()
                .map(IntraRuntimeStrategyEntity::getExecutionId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (executionIds.isEmpty()) {
            return Map.of();
        }
        List<IntraPositionSnapshotEntity> positions = positionRepository
                .findAllByTenantIdAndUsernameAndExecutionIdIn(tenantId, username, executionIds);
        return calculateRuntimeBrokerMtm(liveActiveRuntimes, positions, brokerByInstrument);
    }

    public Map<Long, PositionMarkOverride> resolveLivePositionBrokerOverrides(
            String tenantId,
            String username,
            List<IntraPositionSnapshotEntity> rows
    ) {
        if (rows == null || rows.isEmpty()) {
            return Map.of();
        }
        Map<String, PositionMarkOverride> brokerByInstrument = fetchBrokerPositionMarks(tenantId);
        if (brokerByInstrument.isEmpty()) {
            return Map.of();
        }
        List<IntraPositionSnapshotEntity> allOpenLivePositions = positionRepository
                .findAllByTenantIdAndUsernameAndModeAndStatus(tenantId, username, "LIVE", "OPEN");
        Map<String, Integer> keyCounts = new HashMap<>();
        for (IntraPositionSnapshotEntity row : allOpenLivePositions) {
            String key = resolveLiveInstrumentKey(row);
            if (key == null) {
                continue;
            }
            keyCounts.merge(key, 1, Integer::sum);
        }
        if (keyCounts.isEmpty()) {
            return Map.of();
        }
        Map<Long, PositionMarkOverride> overrides = new HashMap<>();
        for (IntraPositionSnapshotEntity row : rows) {
            if (!"LIVE".equalsIgnoreCase(row.getMode()) || !"OPEN".equalsIgnoreCase(row.getStatus())) {
                continue;
            }
            String key = resolveLiveInstrumentKey(row);
            if (key == null || keyCounts.getOrDefault(key, 0) != 1) {
                continue;
            }
            PositionMarkOverride broker = brokerByInstrument.get(key);
            if (broker != null) {
                overrides.put(row.getId(), broker);
            }
        }
        return overrides;
    }

    private Map<String, PositionMarkOverride> fetchBrokerPositionMarks(String tenantId) {
        try {
            UpstoxOrderDtos.IntraPositionsResponse response = upstoxOrderService.fetchPositions(tenantId);
            if (response == null || response.positions() == null || response.positions().isEmpty()) {
                return Map.of();
            }
            Map<String, PositionMarkOverride> marks = new HashMap<>();
            for (UpstoxOrderDtos.IntraPositionSummary p : response.positions()) {
                String key = normalizeInstrumentKey(p.instrumentToken());
                if (key == null) {
                    continue;
                }
                marks.put(key, new PositionMarkOverride(p.ltp(), safeMoney(p.pnl())));
            }
            return marks;
        } catch (Exception ex) {
            log.warn("Unable to fetch live broker positions for monitor MTM sync: {}", ex.getMessage());
            return Map.of();
        }
    }

    private Map<Long, BigDecimal> calculateRuntimeBrokerMtm(
            List<IntraRuntimeStrategyEntity> liveActiveRuntimes,
            List<IntraPositionSnapshotEntity> allRuntimePositions,
            Map<String, PositionMarkOverride> brokerByInstrument
    ) {
        if (allRuntimePositions == null || allRuntimePositions.isEmpty()) {
            return Map.of();
        }
        Set<Long> runtimeIds = new HashSet<>();
        for (IntraRuntimeStrategyEntity runtime : liveActiveRuntimes) {
            if (runtime.getId() != null) {
                runtimeIds.add(runtime.getId());
            }
        }
        if (runtimeIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, Set<String>> runtimeKeys = new HashMap<>();
        for (IntraPositionSnapshotEntity row : allRuntimePositions) {
            Long runtimeId = row.getRuntime() == null ? null : row.getRuntime().getId();
            if (runtimeId == null || !runtimeIds.contains(runtimeId)) {
                continue;
            }
            if (!"LIVE".equalsIgnoreCase(row.getMode()) || !"OPEN".equalsIgnoreCase(row.getStatus())) {
                continue;
            }
            String key = resolveLiveInstrumentKey(row);
            if (key == null) {
                continue;
            }
            runtimeKeys.computeIfAbsent(runtimeId, ignored -> new HashSet<>()).add(key);
        }
        Map<String, Integer> keyOwnerCounts = new HashMap<>();
        for (Set<String> keys : runtimeKeys.values()) {
            for (String key : keys) {
                keyOwnerCounts.merge(key, 1, Integer::sum);
            }
        }

        Map<Long, BigDecimal> runtimeMtm = new HashMap<>();
        for (Map.Entry<Long, Set<String>> entry : runtimeKeys.entrySet()) {
            BigDecimal total = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
            boolean usedBrokerKey = false;
            for (String key : entry.getValue()) {
                if (keyOwnerCounts.getOrDefault(key, 0) != 1) {
                    continue;
                }
                PositionMarkOverride broker = brokerByInstrument.get(key);
                if (broker == null) {
                    continue;
                }
                total = total.add(safeMoney(broker.pnl()));
                usedBrokerKey = true;
            }
            if (usedBrokerKey) {
                runtimeMtm.put(entry.getKey(), safeMoney(total));
            }
        }
        return runtimeMtm;
    }

    private boolean isRuntimeActiveForBrokerMtm(String status) {
        if (!StringUtils.hasText(status)) {
            return false;
        }
        String normalized = status.trim().toUpperCase(Locale.ROOT);
        return "ENTERED".equals(normalized) || "PARTIAL_EXIT".equals(normalized) || "PAUSED".equals(normalized);
    }

    private String resolveLiveInstrumentKey(IntraPositionSnapshotEntity row) {
        String tradeInstrument = normalizeInstrumentKey(row.getTradeInstrumentKey());
        if (tradeInstrument != null) {
            return tradeInstrument;
        }
        return normalizeInstrumentKey(row.getInstrumentKey());
    }

    private String normalizeInstrumentKey(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.trim();
    }

    private BigDecimal safeMoney(BigDecimal value) {
        return value == null ? BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP) : value.setScale(2, RoundingMode.HALF_UP);
    }

    public record PositionMarkOverride(
            BigDecimal ltp,
            BigDecimal pnl
    ) {
    }
}
