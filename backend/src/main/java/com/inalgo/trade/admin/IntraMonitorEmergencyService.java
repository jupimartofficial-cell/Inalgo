package com.inalgo.trade.admin;

import com.inalgo.trade.entity.IntraPositionSnapshotEntity;
import com.inalgo.trade.entity.IntraRuntimeStrategyEntity;
import com.inalgo.trade.repository.IntraPositionSnapshotRepository;
import com.inalgo.trade.repository.IntraRuntimeStrategyRepository;
import jakarta.validation.ValidationException;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
public class IntraMonitorEmergencyService {

    private static final String LIVE_ACK_TEXT = "CONFIRM LIVE";
    private static final Set<String> OPEN_RUNTIME_STATES = Set.of("WAITING", "ENTERED", "PARTIAL_EXIT", "PAUSED");

    private final IntraRuntimeStrategyRepository runtimeRepository;
    private final IntraPositionSnapshotRepository positionRepository;
    private final IntraMonitorMapper mapper;
    private final IntraMonitorAuditService auditService;
    private final IntraLiveOrderService liveOrderService;

    public IntraMonitorEmergencyService(
            IntraRuntimeStrategyRepository runtimeRepository,
            IntraPositionSnapshotRepository positionRepository,
            IntraMonitorMapper mapper,
            IntraMonitorAuditService auditService,
            IntraLiveOrderService liveOrderService
    ) {
        this.runtimeRepository = runtimeRepository;
        this.positionRepository = positionRepository;
        this.mapper = mapper;
        this.auditService = auditService;
        this.liveOrderService = liveOrderService;
    }

    public IntraMonitorDtos.EmergencyActionResponse emergencyAction(
            String tenantId,
            String username,
            IntraMonitorDtos.EmergencyActionRequest request
    ) {
        String action = request.action().trim().toUpperCase(Locale.ROOT);
        List<IntraRuntimeStrategyEntity> runtimes = runtimeRepository.findAllByTenantIdAndUsername(tenantId, username);

        int affectedRuntimes = 0;
        int affectedPositions = 0;

        switch (action) {
            case "SQUARE_OFF_ALL" -> {
                validateLiveEmergencyGuard(request);
                for (IntraRuntimeStrategyEntity runtime : runtimes) {
                    if (!OPEN_RUNTIME_STATES.contains(runtime.getStatus())) {
                        continue;
                    }
                    if ("LIVE".equals(runtime.getMode())) {
                        liveOrderService.placeExitOrdersForRuntime(tenantId, runtime, request.reason(), username);
                    }
                    affectedRuntimes++;
                    affectedPositions += closeAllPositions(tenantId, runtime);
                    runtime.setStatus("EXITED");
                    runtime.setNextExpectedAction("None");
                    runtimeRepository.save(runtime);
                    auditService.appendEvent(tenantId, username, runtime, null, "EMERGENCY_SQUARE_OFF", "CRITICAL", runtime.getMode(), "Emergency square-off executed", request.reason(), Map.of("status", "OPEN"), Map.of("status", "EXITED"), username);
                }
            }
            case "EXIT_ALL_LIVE" -> {
                validateLiveEmergencyGuard(request);
                for (IntraRuntimeStrategyEntity runtime : runtimes) {
                    if (!"LIVE".equals(runtime.getMode()) || !OPEN_RUNTIME_STATES.contains(runtime.getStatus())) {
                        continue;
                    }
                    liveOrderService.placeExitOrdersForRuntime(tenantId, runtime, request.reason(), username);
                    affectedRuntimes++;
                    affectedPositions += closeAllPositions(tenantId, runtime);
                    runtime.setStatus("EXITED");
                    runtime.setNextExpectedAction("None");
                    runtimeRepository.save(runtime);
                    auditService.appendEvent(tenantId, username, runtime, null, "EMERGENCY_EXIT_LIVE", "CRITICAL", runtime.getMode(), "Emergency live exit executed", request.reason(), Map.of("status", "OPEN"), Map.of("status", "EXITED"), username);
                }
            }
            case "EXIT_ALL_PAPER" -> {
                for (IntraRuntimeStrategyEntity runtime : runtimes) {
                    if (!"PAPER".equals(runtime.getMode()) || !OPEN_RUNTIME_STATES.contains(runtime.getStatus())) {
                        continue;
                    }
                    affectedRuntimes++;
                    affectedPositions += closeAllPositions(tenantId, runtime);
                    runtime.setStatus("EXITED");
                    runtime.setNextExpectedAction("None");
                    runtimeRepository.save(runtime);
                    auditService.appendEvent(tenantId, username, runtime, null, "EMERGENCY_EXIT_PAPER", "WARNING", runtime.getMode(), "Emergency paper exit executed", mapper.safeReason(request.reason(), "Emergency paper exit"), Map.of("status", "OPEN"), Map.of("status", "EXITED"), username);
                }
            }
            case "PAUSE_ALL" -> {
                for (IntraRuntimeStrategyEntity runtime : runtimes) {
                    if (!OPEN_RUNTIME_STATES.contains(runtime.getStatus()) || "PAUSED".equals(runtime.getStatus())) {
                        continue;
                    }
                    affectedRuntimes++;
                    runtime.setStatus("PAUSED");
                    runtime.setNextExpectedAction("Resume strategy");
                    runtimeRepository.save(runtime);
                    for (IntraPositionSnapshotEntity p : positionRepository.findAllByTenantIdAndRuntime(tenantId, runtime)) {
                        if (!"CLOSED".equals(p.getStatus())) {
                            p.setStatus("PAUSED");
                            positionRepository.save(p);
                            affectedPositions++;
                        }
                    }
                    auditService.appendEvent(tenantId, username, runtime, null, "EMERGENCY_PAUSE_ALL", "WARNING", runtime.getMode(), "All strategies paused", mapper.safeReason(request.reason(), "Emergency pause"), Map.of("status", "OPEN"), Map.of("status", "PAUSED"), username);
                }
            }
            case "RESUME_SELECTED" -> {
                if (request.selectedRuntimeId() == null) {
                    throw new ValidationException("selectedRuntimeId is required for RESUME_SELECTED");
                }
                IntraRuntimeStrategyEntity runtime = loadRuntime(tenantId, username, request.selectedRuntimeId());
                affectedRuntimes = 1;
                runtime.setStatus("ENTERED");
                runtime.setNextExpectedAction("Monitor position");
                runtimeRepository.save(runtime);
                auditService.appendEvent(tenantId, username, runtime, null, "EMERGENCY_RESUME_SELECTED", "INFO", runtime.getMode(), "Selected strategy resumed", mapper.safeReason(request.reason(), "Resume selected"), Map.of("status", "PAUSED"), Map.of("status", "ENTERED"), username);
            }
            default -> throw new ValidationException("Unsupported emergency action");
        }

        return new IntraMonitorDtos.EmergencyActionResponse("ok", action, affectedRuntimes, affectedPositions, Instant.now());
    }

    private void validateLiveEmergencyGuard(IntraMonitorDtos.EmergencyActionRequest request) {
        if (!Boolean.TRUE.equals(request.confirmLiveAction())) {
            throw new ValidationException("confirmLiveAction must be true for live emergency actions");
        }
        if (!LIVE_ACK_TEXT.equalsIgnoreCase(String.valueOf(request.liveAcknowledgement()).trim())) {
            throw new ValidationException("liveAcknowledgement must be 'CONFIRM LIVE'");
        }
        if (!StringUtils.hasText(request.reason())) {
            throw new ValidationException("reason is required for live emergency actions");
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

    private int closeAllPositions(String tenantId, IntraRuntimeStrategyEntity runtime) {
        int affected = 0;
        for (IntraPositionSnapshotEntity p : positionRepository.findAllByTenantIdAndRuntime(tenantId, runtime)) {
            if (!"CLOSED".equals(p.getStatus())) {
                p.setStatus("CLOSED");
                p.setRealizedPnl(mapper.safe(p.getRealizedPnl()).add(mapper.safe(p.getUnrealizedPnl())));
                p.setUnrealizedPnl(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
                positionRepository.save(p);
                affected++;
            }
        }
        return affected;
    }
}
