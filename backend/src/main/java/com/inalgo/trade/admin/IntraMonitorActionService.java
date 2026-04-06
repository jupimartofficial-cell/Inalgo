package com.inalgo.trade.admin;

import com.inalgo.trade.entity.IntraPositionSnapshotEntity;
import com.inalgo.trade.entity.IntraRuntimeStrategyEntity;
import com.inalgo.trade.repository.IntraPositionSnapshotRepository;
import com.inalgo.trade.repository.IntraRuntimeStrategyRepository;
import com.inalgo.trade.repository.IntraTradeExecutionRepository;
import jakarta.validation.ValidationException;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;
import java.util.Map;

@Service
public class IntraMonitorActionService {

    private static final String LIVE_ACK_TEXT = "CONFIRM LIVE";

    private final IntraRuntimeStrategyRepository runtimeRepository;
    private final IntraPositionSnapshotRepository positionRepository;
    private final IntraTradeExecutionRepository executionRepository;
    private final IntraMonitorMapper mapper;
    private final IntraMonitorAuditService auditService;
    private final IntraLiveOrderService liveOrderService;

    public IntraMonitorActionService(
            IntraRuntimeStrategyRepository runtimeRepository,
            IntraPositionSnapshotRepository positionRepository,
            IntraTradeExecutionRepository executionRepository,
            IntraMonitorMapper mapper,
            IntraMonitorAuditService auditService,
            IntraLiveOrderService liveOrderService
    ) {
        this.runtimeRepository = runtimeRepository;
        this.positionRepository = positionRepository;
        this.executionRepository = executionRepository;
        this.mapper = mapper;
        this.auditService = auditService;
        this.liveOrderService = liveOrderService;
    }

    public IntraMonitorDtos.RuntimeActionResponse pauseRuntime(String tenantId, String username, Long runtimeId, IntraMonitorDtos.LiveActionRequest request) {
        IntraRuntimeStrategyEntity runtime = loadRuntime(tenantId, username, runtimeId);
        validateLiveGuard(runtime.getMode(), request);

        String before = runtime.getStatus();
        runtime.setStatus("PAUSED");
        runtime.setNextExpectedAction("Resume strategy");
        runtime.setLastEventAt(Instant.now());
        runtimeRepository.save(runtime);

        List<IntraPositionSnapshotEntity> positions = positionRepository.findAllByTenantIdAndRuntime(tenantId, runtime);
        positions.forEach(p -> {
            if (!"CLOSED".equals(p.getStatus())) {
                p.setStatus("PAUSED");
            }
        });
        positionRepository.saveAll(positions);

        auditService.appendEvent(
                tenantId,
                username,
                runtime,
                null,
                "MANUAL_PAUSE",
                "WARNING",
                runtime.getMode(),
                "Strategy paused manually",
                request.reason(),
                Map.of("status", before),
                Map.of("status", runtime.getStatus()),
                username
        );

        return new IntraMonitorDtos.RuntimeActionResponse(runtime.getStatus(), "Strategy paused", runtime.getId(), runtime.getUpdatedAt());
    }

    public IntraMonitorDtos.RuntimeActionResponse resumeRuntime(String tenantId, String username, Long runtimeId, String reason) {
        IntraRuntimeStrategyEntity runtime = loadRuntime(tenantId, username, runtimeId);
        String before = runtime.getStatus();
        boolean hasOpen = positionRepository.findAllByTenantIdAndRuntime(tenantId, runtime).stream()
                .anyMatch(p -> !"CLOSED".equals(p.getStatus()));
        runtime.setStatus(hasOpen ? "ENTERED" : "WAITING");
        runtime.setNextExpectedAction(hasOpen ? "Monitor position" : "Wait for signal");
        runtime.setLastEventAt(Instant.now());
        runtimeRepository.save(runtime);

        List<IntraPositionSnapshotEntity> positions = positionRepository.findAllByTenantIdAndRuntime(tenantId, runtime);
        positions.forEach(p -> {
            if ("PAUSED".equals(p.getStatus())) {
                p.setStatus("OPEN");
            }
        });
        positionRepository.saveAll(positions);

        auditService.appendEvent(
                tenantId,
                username,
                runtime,
                null,
                "MANUAL_RESUME",
                "INFO",
                runtime.getMode(),
                "Strategy resumed manually",
                StringUtils.hasText(reason) ? reason.trim() : "Manual resume",
                Map.of("status", before),
                Map.of("status", runtime.getStatus()),
                username
        );

        return new IntraMonitorDtos.RuntimeActionResponse(runtime.getStatus(), "Strategy resumed", runtime.getId(), runtime.getUpdatedAt());
    }

    public IntraMonitorDtos.RuntimeActionResponse exitRuntime(String tenantId, String username, Long runtimeId, IntraMonitorDtos.LiveActionRequest request) {
        IntraRuntimeStrategyEntity runtime = loadRuntime(tenantId, username, runtimeId);
        validateLiveGuard(runtime.getMode(), request);

        String before = runtime.getStatus();
        liveOrderService.placeExitOrdersForRuntime(tenantId, runtime, request.reason(), username);
        runtime.setStatus("EXITED");
        runtime.setNextExpectedAction("None");
        runtime.setLastEventAt(Instant.now());

        BigDecimal totalPnl = BigDecimal.ZERO;
        List<IntraPositionSnapshotEntity> positions = positionRepository.findAllByTenantIdAndRuntime(tenantId, runtime);
        for (IntraPositionSnapshotEntity p : positions) {
            if (!"CLOSED".equals(p.getStatus())) {
                p.setStatus("CLOSED");
                p.setRealizedPnl(mapper.safe(p.getRealizedPnl()).add(mapper.safe(p.getUnrealizedPnl())));
                p.setUnrealizedPnl(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
            }
            totalPnl = totalPnl.add(mapper.safe(p.getRealizedPnl()));
        }
        positionRepository.saveAll(positions);

        runtime.setCurrentMtm(totalPnl.setScale(2, RoundingMode.HALF_UP));
        runtimeRepository.save(runtime);

        executionRepository.findByIdAndTenantId(runtime.getExecutionId(), tenantId).ifPresent(execution -> {
            execution.setStatus("EXITED");
            execution.setExitReason("manual exit");
            execution.setTotalPnl(runtime.getCurrentMtm());
            execution.setStatusMessage("Position exited manually from Intra Monitor");
            execution.setEvaluatedAt(Instant.now());
            executionRepository.save(execution);
        });

        auditService.appendEvent(
                tenantId,
                username,
                runtime,
                null,
                "MANUAL_EXIT",
                "WARNING",
                runtime.getMode(),
                "Strategy exited manually",
                request.reason(),
                Map.of("status", before),
                Map.of("status", runtime.getStatus()),
                username
        );

        return new IntraMonitorDtos.RuntimeActionResponse(runtime.getStatus(), "Strategy exited", runtime.getId(), runtime.getUpdatedAt());
    }

    public IntraMonitorDtos.RuntimeActionResponse partialExitRuntime(String tenantId, String username, Long runtimeId, IntraMonitorDtos.LiveActionRequest request) {
        IntraRuntimeStrategyEntity runtime = loadRuntime(tenantId, username, runtimeId);
        validateLiveGuard(runtime.getMode(), request);

        String before = runtime.getStatus();
        if ("LIVE".equalsIgnoreCase(runtime.getMode())) {
            for (IntraPositionSnapshotEntity position : positionRepository.findAllByTenantIdAndRuntime(tenantId, runtime)) {
                liveOrderService.placeExitOrderForPosition(tenantId, position, request.reason(), username, true);
            }
        }
        runtime.setStatus("PARTIAL_EXIT");
        runtime.setNextExpectedAction("Monitor residual position");

        List<IntraPositionSnapshotEntity> positions = positionRepository.findAllByTenantIdAndRuntime(tenantId, runtime);
        for (IntraPositionSnapshotEntity p : positions) {
            if ("CLOSED".equals(p.getStatus())) {
                continue;
            }
            BigDecimal unrealized = mapper.safe(p.getUnrealizedPnl());
            BigDecimal booking = unrealized.divide(BigDecimal.valueOf(2), 2, RoundingMode.HALF_UP);
            p.setRealizedPnl(mapper.safe(p.getRealizedPnl()).add(booking));
            p.setUnrealizedPnl(unrealized.subtract(booking));
            p.setQuantityLots(mapper.safeQty(p.getQuantityLots()).divide(BigDecimal.valueOf(2), 4, RoundingMode.HALF_UP));
            p.setStatus("PARTIAL_EXIT");
        }
        positionRepository.saveAll(positions);

        runtime.setCurrentMtm(positions.stream().map(p -> mapper.safe(p.getRealizedPnl()).add(mapper.safe(p.getUnrealizedPnl()))).reduce(BigDecimal.ZERO, BigDecimal::add));
        runtimeRepository.save(runtime);

        executionRepository.findByIdAndTenantId(runtime.getExecutionId(), tenantId).ifPresent(execution -> {
            execution.setStatusMessage("Partial exit applied manually from Intra Monitor");
            execution.setExitReason("partial exit");
            execution.setTotalPnl(runtime.getCurrentMtm());
            execution.setEvaluatedAt(Instant.now());
            executionRepository.save(execution);
        });

        auditService.appendEvent(
                tenantId,
                username,
                runtime,
                null,
                "MANUAL_PARTIAL_EXIT",
                "WARNING",
                runtime.getMode(),
                "Partial exit applied manually",
                request.reason(),
                Map.of("status", before),
                Map.of("status", runtime.getStatus()),
                username
        );

        return new IntraMonitorDtos.RuntimeActionResponse(runtime.getStatus(), "Partial exit executed", runtime.getId(), runtime.getUpdatedAt());
    }

    public IntraMonitorDtos.PositionActionResponse exitPosition(String tenantId, String username, Long positionId, IntraMonitorDtos.LiveActionRequest request) {
        IntraPositionSnapshotEntity position = loadPosition(tenantId, username, positionId);
        validateLiveGuard(position.getMode(), request);

        String before = position.getStatus();
        liveOrderService.placeExitOrderForPosition(tenantId, position, request.reason(), username, false);
        position.setStatus("CLOSED");
        position.setRealizedPnl(mapper.safe(position.getRealizedPnl()).add(mapper.safe(position.getUnrealizedPnl())));
        position.setUnrealizedPnl(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
        positionRepository.save(position);

        recalcRuntimeAfterPositionChange(position.getRuntime(), tenantId);

        auditService.appendEvent(
                tenantId,
                username,
                position.getRuntime(),
                position,
                "POSITION_EXIT",
                "WARNING",
                position.getMode(),
                "Position exited manually",
                request.reason(),
                Map.of("status", before),
                Map.of("status", position.getStatus()),
                username
        );

        return new IntraMonitorDtos.PositionActionResponse(position.getStatus(), "Position exited", position.getId(), position.getUpdatedAt());
    }

    public IntraMonitorDtos.PositionActionResponse partialExitPosition(String tenantId, String username, Long positionId, IntraMonitorDtos.LiveActionRequest request) {
        IntraPositionSnapshotEntity position = loadPosition(tenantId, username, positionId);
        validateLiveGuard(position.getMode(), request);

        String before = position.getStatus();
        liveOrderService.placeExitOrderForPosition(tenantId, position, request.reason(), username, true);
        BigDecimal booking = mapper.safe(position.getUnrealizedPnl()).divide(BigDecimal.valueOf(2), 2, RoundingMode.HALF_UP);
        position.setRealizedPnl(mapper.safe(position.getRealizedPnl()).add(booking));
        position.setUnrealizedPnl(mapper.safe(position.getUnrealizedPnl()).subtract(booking));
        position.setQuantityLots(mapper.safeQty(position.getQuantityLots()).divide(BigDecimal.valueOf(2), 4, RoundingMode.HALF_UP));
        position.setStatus("PARTIAL_EXIT");
        positionRepository.save(position);

        recalcRuntimeAfterPositionChange(position.getRuntime(), tenantId);

        auditService.appendEvent(
                tenantId,
                username,
                position.getRuntime(),
                position,
                "POSITION_PARTIAL_EXIT",
                "WARNING",
                position.getMode(),
                "Position partially exited manually",
                request.reason(),
                Map.of("status", before),
                Map.of("status", position.getStatus()),
                username
        );

        return new IntraMonitorDtos.PositionActionResponse(position.getStatus(), "Position partially exited", position.getId(), position.getUpdatedAt());
    }

    public IntraMonitorDtos.PositionActionResponse convertToManualWatch(String tenantId, String username, Long positionId, String reason) {
        IntraPositionSnapshotEntity position = loadPosition(tenantId, username, positionId);
        String before = position.getStatus();
        position.setManualWatch(true);
        position.setStatus("MANUAL_WATCH");
        positionRepository.save(position);

        auditService.appendEvent(
                tenantId,
                username,
                position.getRuntime(),
                position,
                "MANUAL_WATCH_ENABLED",
                "INFO",
                position.getMode(),
                "Position moved to manual watch",
                mapper.safeReason(reason, "Manual watch"),
                Map.of("status", before),
                Map.of("status", position.getStatus(), "manualWatch", true),
                username
        );

        return new IntraMonitorDtos.PositionActionResponse(position.getStatus(), "Manual watch enabled", position.getId(), position.getUpdatedAt());
    }

    private void recalcRuntimeAfterPositionChange(IntraRuntimeStrategyEntity runtime, String tenantId) {
        List<IntraPositionSnapshotEntity> positions = positionRepository.findAllByTenantIdAndRuntime(tenantId, runtime);
        BigDecimal total = positions.stream()
                .map(p -> mapper.safe(p.getRealizedPnl()).add(mapper.safe(p.getUnrealizedPnl())))
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);

        runtime.setCurrentMtm(total);
        boolean allClosed = positions.stream().allMatch(p -> "CLOSED".equals(p.getStatus()));
        if (allClosed) {
            runtime.setStatus("EXITED");
            runtime.setNextExpectedAction("None");
        } else if (positions.stream().anyMatch(p -> "PARTIAL_EXIT".equals(p.getStatus()))) {
            runtime.setStatus("PARTIAL_EXIT");
            runtime.setNextExpectedAction("Monitor residual position");
        }
        runtime.setLastEventAt(Instant.now());
        runtimeRepository.save(runtime);

        executionRepository.findByIdAndTenantId(runtime.getExecutionId(), tenantId).ifPresent(execution -> {
            execution.setTotalPnl(total);
            execution.setEvaluatedAt(Instant.now());
            executionRepository.save(execution);
        });
    }

    private void validateLiveGuard(String mode, IntraMonitorDtos.LiveActionRequest request) {
        if (!"LIVE".equals(mode)) {
            return;
        }
        if (request == null || !Boolean.TRUE.equals(request.confirmLiveAction())) {
            throw new ValidationException("confirmLiveAction must be true for live actions");
        }
        if (!LIVE_ACK_TEXT.equalsIgnoreCase(request.liveAcknowledgement().trim())) {
            throw new ValidationException("liveAcknowledgement must be 'CONFIRM LIVE'");
        }
        if (!StringUtils.hasText(request.reason())) {
            throw new ValidationException("reason is required for live actions");
        }
    }

    private IntraRuntimeStrategyEntity loadRuntime(String tenantId, String username, Long runtimeId) {
        IntraRuntimeStrategyEntity runtime = runtimeRepository.findById(runtimeId)
                .orElseThrow(() -> new ValidationException("Runtime strategy was not found"));
        if (!tenantId.equals(runtime.getTenantId()) || !username.equals(runtime.getUsername())) {
            throw new ValidationException("Runtime strategy belongs to another user");
        }
        return runtime;
    }

    private IntraPositionSnapshotEntity loadPosition(String tenantId, String username, Long positionId) {
        IntraPositionSnapshotEntity position = positionRepository.findById(positionId)
                .orElseThrow(() -> new ValidationException("Position was not found"));
        if (!tenantId.equals(position.getTenantId()) || !username.equals(position.getUsername())) {
            throw new ValidationException("Position belongs to another user");
        }
        return position;
    }

}
