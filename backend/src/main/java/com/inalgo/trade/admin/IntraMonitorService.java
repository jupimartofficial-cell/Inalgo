package com.inalgo.trade.admin;

import com.inalgo.trade.entity.IntraEventAuditEntity;
import com.inalgo.trade.entity.IntraPositionSnapshotEntity;
import com.inalgo.trade.entity.IntraRuntimeStrategyEntity;
import com.inalgo.trade.repository.IntraEventAuditRepository;
import com.inalgo.trade.repository.IntraPositionSnapshotRepository;
import com.inalgo.trade.repository.IntraRuntimeStrategyRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

@Service
public class IntraMonitorService {

    private static final ZoneId MARKET_ZONE = ZoneId.of("Asia/Kolkata");

    private final IntraRuntimeStrategyRepository runtimeRepository;
    private final IntraPositionSnapshotRepository positionRepository;
    private final IntraEventAuditRepository eventRepository;
    private final IntraMonitorMapper mapper;
    private final IntraMonitorActionService actionService;
    private final IntraMonitorEmergencyService emergencyService;
    private final IntraMonitorAuditService auditService;
    private final IntraLiveOrderService liveOrderService;
    private final IntraMonitorBrokerPnlSupport brokerPnlSupport;

    @Autowired
    public IntraMonitorService(
            IntraRuntimeStrategyRepository runtimeRepository,
            IntraPositionSnapshotRepository positionRepository,
            IntraEventAuditRepository eventRepository,
            IntraMonitorMapper mapper,
            IntraMonitorActionService actionService,
            IntraMonitorEmergencyService emergencyService,
            IntraMonitorAuditService auditService,
            IntraLiveOrderService liveOrderService,
            IntraMonitorBrokerPnlSupport brokerPnlSupport
    ) {
        this.runtimeRepository = runtimeRepository;
        this.positionRepository = positionRepository;
        this.eventRepository = eventRepository;
        this.mapper = mapper;
        this.actionService = actionService;
        this.emergencyService = emergencyService;
        this.auditService = auditService;
        this.liveOrderService = liveOrderService;
        this.brokerPnlSupport = brokerPnlSupport;
    }

    @Transactional
    public void syncFromExecution(
            String tenantId,
            IntraTradeDtos.IntraTradeExecutionResponse execution,
            String eventType,
            String message,
            String reason,
            String actor
    ) {
        if (!mapper.isLivePaper(execution.mode())) {
            return;
        }

        IntraRuntimeStrategyEntity runtime = runtimeRepository
                .findByTenantIdAndExecutionId(tenantId, execution.id())
                .orElseGet(IntraRuntimeStrategyEntity::new);
        Map<String, Object> beforeState = buildRuntimeState(runtime);

        runtime.setTenantId(tenantId);
        runtime.setUsername(execution.username());
        runtime.setExecutionId(execution.id());
        runtime.setStrategyId(execution.strategyId());
        runtime.setStrategyName(execution.strategyName());
        runtime.setInstrumentKey(execution.scanInstrumentKey());
        runtime.setMode(execution.mode());
        runtime.setStatus(mapper.mapRuntimeStatus(execution.status()));
        runtime.setEntryTime(mapper.resolveEntryInstant(execution));
        runtime.setCurrentSignal(mapper.resolveSignal(tenantId, execution));
        runtime.setCurrentMtm(mapper.safe(execution.result() == null ? null : execution.result().totalPnl()));
        runtime.setSlState(mapper.resolveSlState(execution));
        runtime.setTargetState(mapper.resolveTargetState(execution));
        runtime.setNextExpectedAction(mapper.resolveNextAction(runtime.getStatus()));
        Instant refreshedAt = execution.evaluatedAt() == null ? Instant.now() : execution.evaluatedAt();
        runtime.setDataRefreshedAt(refreshedAt);
        runtime.setFreshnessSeconds((int) Duration.between(refreshedAt, Instant.now()).getSeconds());
        Instant lastEventAt = Instant.now();
        runtime.setLastEventAt(lastEventAt);

        IntraRuntimeStrategyEntity savedRuntime = runtimeRepository.save(runtime);
        syncPositionsFromExecution(tenantId, savedRuntime, execution);
        liveOrderService.syncOrdersForExecution(tenantId, execution, savedRuntime, actor);
        Map<String, Object> afterState = buildRuntimeState(savedRuntime);
        boolean shouldAppendAudit = !"SNAPSHOT_REFRESHED".equals(eventType) || !beforeState.equals(afterState);
        if (shouldAppendAudit) {
            auditService.appendEvent(
                    tenantId,
                    execution.username(),
                    savedRuntime,
                    null,
                    eventType,
                    "INFO",
                    execution.mode(),
                    message,
                    reason,
                    beforeState,
                    afterState,
                    actor
            );
        }
    }

    @Transactional
    public void removeExecutionRuntime(String tenantId, Long executionId, String actor, String username) {
        runtimeRepository.findByTenantIdAndExecutionId(tenantId, executionId).ifPresent(runtime -> {
            auditService.appendEvent(
                    tenantId,
                    username,
                    runtime,
                    null,
                    "RUN_DELETED",
                    "WARNING",
                    runtime.getMode(),
                    "Execution removed from runtime monitor",
                    "Manual delete",
                    Map.of("status", runtime.getStatus()),
                    Map.of("status", "DELETED"),
                    actor
            );
            positionRepository.deleteAllByTenantIdAndExecutionId(tenantId, executionId);
            runtimeRepository.delete(runtime);
        });
    }

    public IntraMonitorDtos.MarketSummaryResponse fetchMarketSummary(String tenantId, String username) {
        List<IntraRuntimeStrategyEntity> runtimes = runtimeRepository.findAllByTenantIdAndUsername(tenantId, username);
        Instant refreshedAt = runtimes.stream()
                .map(IntraRuntimeStrategyEntity::getDataRefreshedAt)
                .filter(Objects::nonNull)
                .max(Comparator.naturalOrder())
                .orElse(Instant.now());
        int freshness = Math.max(0, (int) Duration.between(refreshedAt, Instant.now()).getSeconds());

        List<String> instrumentKeys = new ArrayList<>();
        if (runtimes.isEmpty()) {
            instrumentKeys.addAll(List.of("NSE_INDEX|Nifty 50", "NSE_INDEX|Nifty Bank", "BSE_INDEX|SENSEX"));
        } else {
            instrumentKeys.addAll(runtimes.stream().map(IntraRuntimeStrategyEntity::getInstrumentKey).distinct().toList());
        }

        List<IntraMonitorDtos.IndexValue> indexValues = mapper.resolveIndexValues(tenantId, instrumentKeys);
        String trend = mapper.resolveTrend(tenantId, instrumentKeys);
        String sessionStatus = mapper.resolveSessionStatus(LocalDateTime.now(MARKET_ZONE));
        boolean stale = freshness > 30;

        return new IntraMonitorDtos.MarketSummaryResponse(
                trend,
                sessionStatus,
                refreshedAt,
                stale,
                freshness,
                indexValues
        );
    }

    public Page<IntraMonitorDtos.RuntimeSummary> listRuntimes(
            String tenantId,
            String username,
            String mode,
            String status,
            Integer page,
            Integer size
    ) {
        int boundedPage = Math.max(0, page == null ? 0 : page);
        int boundedSize = Math.min(100, Math.max(1, size == null ? 20 : size));
        PageRequest request = PageRequest.of(boundedPage, boundedSize);
        Page<IntraRuntimeStrategyEntity> rows;
        if (StringUtils.hasText(mode) && StringUtils.hasText(status)) {
            rows = runtimeRepository.findByTenantIdAndUsernameAndModeAndStatusOrderByUpdatedAtDesc(
                    tenantId,
                    username,
                    mode.trim().toUpperCase(Locale.ROOT),
                    status.trim().toUpperCase(Locale.ROOT),
                    request
            );
        } else if (StringUtils.hasText(mode)) {
            rows = runtimeRepository.findByTenantIdAndUsernameAndModeOrderByUpdatedAtDesc(
                    tenantId,
                    username,
                    mode.trim().toUpperCase(Locale.ROOT),
                    request
            );
        } else {
            rows = runtimeRepository.findByTenantIdAndUsernameOrderByUpdatedAtDesc(tenantId, username, request);
        }

        Map<Long, BigDecimal> brokerRuntimeMtm = brokerPnlSupport.resolveLiveRuntimeBrokerMtm(tenantId, username, rows.getContent());

        return rows.map(r -> new IntraMonitorDtos.RuntimeSummary(
                r.getId(),
                r.getExecutionId(),
                r.getStrategyId(),
                r.getStrategyName(),
                r.getInstrumentKey(),
                r.getMode(),
                r.getStatus(),
                r.getEntryTime(),
                r.getCurrentSignal(),
                mapper.safe(brokerRuntimeMtm.getOrDefault(r.getId(), r.getCurrentMtm())),
                r.getSlState(),
                r.getTargetState(),
                r.getNextExpectedAction(),
                r.getDataRefreshedAt(),
                Math.max(0, (int) Duration.between(r.getDataRefreshedAt(), Instant.now()).getSeconds())
        ));
    }

    public Page<IntraMonitorDtos.PositionSummary> listPositions(
            String tenantId,
            String username,
            String mode,
            String status,
            Integer page,
            Integer size
    ) {
        int boundedPage = Math.max(0, page == null ? 0 : page);
        int boundedSize = Math.min(100, Math.max(1, size == null ? 20 : size));
        PageRequest request = PageRequest.of(boundedPage, boundedSize);
        Page<IntraPositionSnapshotEntity> rows;
        if (StringUtils.hasText(mode) && StringUtils.hasText(status)) {
            rows = positionRepository.findByTenantIdAndUsernameAndModeAndStatusOrderByUpdatedAtDesc(
                    tenantId,
                    username,
                    mode.trim().toUpperCase(Locale.ROOT),
                    status.trim().toUpperCase(Locale.ROOT),
                    request
            );
        } else if (StringUtils.hasText(mode)) {
            rows = positionRepository.findByTenantIdAndUsernameAndModeOrderByUpdatedAtDesc(
                    tenantId,
                    username,
                    mode.trim().toUpperCase(Locale.ROOT),
                    request
            );
        } else {
            rows = positionRepository.findByTenantIdAndUsernameOrderByUpdatedAtDesc(tenantId, username, request);
        }

        Map<Long, IntraMonitorBrokerPnlSupport.PositionMarkOverride> liveOverrides = brokerPnlSupport.resolveLivePositionBrokerOverrides(tenantId, username, rows.getContent());

        return rows.map(row -> {
            IntraMonitorBrokerPnlSupport.PositionMarkOverride override = liveOverrides.get(row.getId());
            return new IntraMonitorDtos.PositionSummary(
                    row.getId(),
                    row.getRuntime() == null ? null : row.getRuntime().getId(),
                    row.getExecutionId(),
                    row.getInstrumentKey(),
                    mapper.safeQty(row.getQuantityLots()),
                    row.getEntryPrice(),
                    override == null ? row.getCurrentPrice() : override.ltp(),
                    override == null ? mapper.safe(row.getUnrealizedPnl()) : mapper.safe(override.pnl()),
                    mapper.safe(row.getRealizedPnl()),
                    row.getSlPrice(),
                    row.getTargetPrice(),
                    row.getStrategyName(),
                    row.getTimeInTradeSeconds(),
                    row.getStatus(),
                    row.isManualWatch(),
                    row.getMode(),
                    row.getUpdatedAt()
            );
        });
    }

    public Page<IntraMonitorDtos.EventLogItem> listEvents(
            String tenantId,
            String username,
            String eventType,
            Integer page,
            Integer size
    ) {
        int boundedPage = Math.max(0, page == null ? 0 : page);
        int boundedSize = Math.min(200, Math.max(1, size == null ? 50 : size));
        PageRequest request = PageRequest.of(boundedPage, boundedSize);
        Page<IntraEventAuditEntity> rows = StringUtils.hasText(eventType)
                ? eventRepository.findByTenantIdAndUsernameAndEventTypeOrderByCreatedAtDesc(tenantId, username, eventType.trim().toUpperCase(Locale.ROOT), request)
                : eventRepository.findByTenantIdAndUsernameOrderByCreatedAtDesc(tenantId, username, request);

        return rows.map(e -> new IntraMonitorDtos.EventLogItem(
                e.getId(),
                e.getCreatedAt(),
                e.getEventType(),
                e.getSeverity(),
                e.getMode(),
                e.getMessage(),
                e.getReason(),
                e.getActor(),
                e.getRuntime() == null ? null : e.getRuntime().getId(),
                e.getPosition() == null ? null : e.getPosition().getId(),
                e.getCorrelationId()
        ));
    }

    public IntraMonitorDtos.RuntimeActionResponse pauseRuntime(String tenantId, String username, Long runtimeId, IntraMonitorDtos.LiveActionRequest request) {
        return actionService.pauseRuntime(tenantId, username, runtimeId, request);
    }

    public IntraMonitorDtos.RuntimeActionResponse resumeRuntime(String tenantId, String username, Long runtimeId, String reason) {
        return actionService.resumeRuntime(tenantId, username, runtimeId, reason);
    }

    public IntraMonitorDtos.RuntimeActionResponse exitRuntime(String tenantId, String username, Long runtimeId, IntraMonitorDtos.LiveActionRequest request) {
        return actionService.exitRuntime(tenantId, username, runtimeId, request);
    }

    public IntraMonitorDtos.RuntimeActionResponse partialExitRuntime(String tenantId, String username, Long runtimeId, IntraMonitorDtos.LiveActionRequest request) {
        return actionService.partialExitRuntime(tenantId, username, runtimeId, request);
    }

    public IntraMonitorDtos.PositionActionResponse exitPosition(String tenantId, String username, Long positionId, IntraMonitorDtos.LiveActionRequest request) {
        return actionService.exitPosition(tenantId, username, positionId, request);
    }

    public IntraMonitorDtos.PositionActionResponse partialExitPosition(String tenantId, String username, Long positionId, IntraMonitorDtos.LiveActionRequest request) {
        return actionService.partialExitPosition(tenantId, username, positionId, request);
    }

    public IntraMonitorDtos.PositionActionResponse convertToManualWatch(String tenantId, String username, Long positionId, String reason) {
        return actionService.convertToManualWatch(tenantId, username, positionId, reason);
    }

    public IntraMonitorDtos.EmergencyActionResponse emergencyAction(
            String tenantId,
            String username,
            IntraMonitorDtos.EmergencyActionRequest request
    ) {
        return emergencyService.emergencyAction(tenantId, username, request);
    }

    private void syncPositionsFromExecution(String tenantId, IntraRuntimeStrategyEntity runtime, IntraTradeDtos.IntraTradeExecutionResponse execution) {
        positionRepository.deleteAllByTenantIdAndExecutionId(tenantId, execution.id());
        if (execution.result() == null || execution.result().rows() == null || execution.result().rows().isEmpty()) {
            return;
        }

        AdminDtos.BacktestResultRow row = execution.result().rows().get(execution.result().rows().size() - 1);
        boolean open = "ENTERED".equals(runtime.getStatus()) || "PARTIAL_EXIT".equals(runtime.getStatus()) || "PAUSED".equals(runtime.getStatus());
        List<AdminDtos.BacktestLegPayload> strategyLegs = execution.strategy() == null ? List.of() : execution.strategy().legs();
        Map<String, AdminDtos.BacktestLegPayload> legById = new LinkedHashMap<>();
        for (AdminDtos.BacktestLegPayload leg : strategyLegs) {
            legById.put(leg.id(), leg);
        }

        if (row.legs() == null || row.legs().isEmpty()) {
            return;
        }

        List<IntraPositionSnapshotEntity> positions = new ArrayList<>();
        for (AdminDtos.BacktestLegResult legResult : row.legs()) {
            IntraPositionSnapshotEntity position = new IntraPositionSnapshotEntity();
            position.setTenantId(tenantId);
            position.setUsername(execution.username());
            position.setRuntime(runtime);
            position.setExecutionId(execution.id());
            position.setMode(execution.mode());
            position.setInstrumentKey(legResult.instrumentKey() == null ? execution.scanInstrumentKey() : legResult.instrumentKey());
            position.setLegId(legResult.legId());
            position.setLegLabel(legResult.legLabel());
            position.setTradeInstrumentKey(legResult.instrumentKey());

            AdminDtos.BacktestLegPayload strategyLeg = legById.get(legResult.legId());
            String entrySide = strategyLeg == null ? null : strategyLeg.position();
            position.setEntrySide(entrySide);
            position.setExitSide(resolveExitSide(entrySide));
            position.setLotSize(legResult.lotSize());
            position.setLots(legResult.lots());
            position.setQuantityUnits(resolveQuantityUnits(legResult));
            position.setQuantityLots(resolveLots(legResult));
            position.setEntryPrice(mapper.toBigDecimal(legResult.entryPrice()));
            position.setCurrentPrice(mapper.toBigDecimal(legResult.exitPrice()));
            BigDecimal legPnl = mapper.safe(legResult.pnlAmount());
            position.setUnrealizedPnl(open ? legPnl : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
            position.setRealizedPnl(open ? BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP) : legPnl);
            position.setSlPrice(mapper.resolveSlValue(execution));
            position.setTargetPrice(mapper.resolveTargetValue(execution));
            position.setStrategyName(execution.strategyName());
            position.setEntryTime(mapper.parseInstant(row.entryTs()));
            position.setTimeInTradeSeconds(mapper.resolveTimeInTradeSeconds(position.getEntryTime()));
            position.setStatus(open ? "OPEN" : "CLOSED");
            positions.add(position);
        }
        positionRepository.saveAll(positions);
    }

    private String resolveExitSide(String entrySide) {
        if (!StringUtils.hasText(entrySide)) {
            return null;
        }
        String normalized = entrySide.trim().toUpperCase(Locale.ROOT);
        return "BUY".equals(normalized) ? "SELL" : "BUY";
    }

    private Integer resolveQuantityUnits(AdminDtos.BacktestLegResult leg) {
        if (leg.lotSize() == null || leg.lots() == null) {
            return null;
        }
        return leg.lotSize() * leg.lots();
    }

    private BigDecimal resolveLots(AdminDtos.BacktestLegResult leg) {
        if (leg.lots() == null) {
            return BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP);
        }
        return BigDecimal.valueOf(leg.lots()).setScale(4, RoundingMode.HALF_UP);
    }

    private Map<String, Object> buildRuntimeState(IntraRuntimeStrategyEntity runtime) {
        Map<String, Object> state = new LinkedHashMap<>();
        state.put("status", runtime.getStatus());
        state.put("currentSignal", runtime.getCurrentSignal());
        state.put("currentMtm", mapper.safe(runtime.getCurrentMtm()));
        state.put("nextExpectedAction", runtime.getNextExpectedAction());
        state.put("refreshedAt", runtime.getDataRefreshedAt());
        return state;
    }

}
