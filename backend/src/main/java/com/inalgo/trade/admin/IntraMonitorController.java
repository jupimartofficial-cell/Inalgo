package com.inalgo.trade.admin;

import com.inalgo.trade.security.TenantContext;
import jakarta.validation.Valid;
import jakarta.validation.ValidationException;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.data.domain.Page;
import org.springframework.util.StringUtils;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@Validated
@RestController
@RequestMapping("/api/v1/admin/intra-trade/monitor")
public class IntraMonitorController {

    private final AdminAuthService adminAuthService;
    private final IntraMonitorService intraMonitorService;
    private final IntraPnlService intraPnlService;

    public IntraMonitorController(
            AdminAuthService adminAuthService,
            IntraMonitorService intraMonitorService,
            IntraPnlService intraPnlService
    ) {
        this.adminAuthService = adminAuthService;
        this.intraMonitorService = intraMonitorService;
        this.intraPnlService = intraPnlService;
    }

    @GetMapping("/market-summary")
    public IntraMonitorDtos.MarketSummaryResponse marketSummary(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @RequestParam @NotBlank String username
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        return intraMonitorService.fetchMarketSummary(tenantId, username);
    }

    @GetMapping("/runtimes")
    public Page<IntraMonitorDtos.RuntimeSummary> runtimes(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @RequestParam @NotBlank String username,
            @RequestParam(required = false) String mode,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") @Min(0) Integer page,
            @RequestParam(defaultValue = "25") @Min(1) @Max(100) Integer size
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        return intraMonitorService.listRuntimes(tenantId, username, mode, status, page, size);
    }

    @GetMapping("/positions")
    public Page<IntraMonitorDtos.PositionSummary> positions(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @RequestParam @NotBlank String username,
            @RequestParam(required = false) String mode,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") @Min(0) Integer page,
            @RequestParam(defaultValue = "25") @Min(1) @Max(100) Integer size
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        return intraMonitorService.listPositions(tenantId, username, mode, status, page, size);
    }

    @GetMapping("/events")
    public Page<IntraMonitorDtos.EventLogItem> events(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @RequestParam @NotBlank String username,
            @RequestParam(required = false) String eventType,
            @RequestParam(defaultValue = "0") @Min(0) Integer page,
            @RequestParam(defaultValue = "50") @Min(1) @Max(200) Integer size
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        return intraMonitorService.listEvents(tenantId, username, eventType, page, size);
    }

    @PostMapping("/runtimes/{runtimeId}/pause")
    public IntraMonitorDtos.RuntimeActionResponse pauseRuntime(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @PathVariable Long runtimeId,
            @RequestParam @NotBlank String username,
            @Valid @RequestBody IntraMonitorDtos.LiveActionRequest request
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        IntraMonitorDtos.RuntimeActionResponse response = intraMonitorService.pauseRuntime(tenantId, username, runtimeId, request);
        intraPnlService.refreshDailyAggregates(tenantId, username);
        return response;
    }

    @PostMapping("/runtimes/{runtimeId}/resume")
    public IntraMonitorDtos.RuntimeActionResponse resumeRuntime(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @PathVariable Long runtimeId,
            @RequestParam @NotBlank String username,
            @RequestParam(required = false) String reason
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        IntraMonitorDtos.RuntimeActionResponse response = intraMonitorService.resumeRuntime(tenantId, username, runtimeId, reason);
        intraPnlService.refreshDailyAggregates(tenantId, username);
        return response;
    }

    @PostMapping("/runtimes/{runtimeId}/exit")
    public IntraMonitorDtos.RuntimeActionResponse exitRuntime(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @PathVariable Long runtimeId,
            @RequestParam @NotBlank String username,
            @Valid @RequestBody IntraMonitorDtos.LiveActionRequest request
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        IntraMonitorDtos.RuntimeActionResponse response = intraMonitorService.exitRuntime(tenantId, username, runtimeId, request);
        intraPnlService.refreshDailyAggregates(tenantId, username);
        return response;
    }

    @PostMapping("/runtimes/{runtimeId}/partial-exit")
    public IntraMonitorDtos.RuntimeActionResponse partialExitRuntime(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @PathVariable Long runtimeId,
            @RequestParam @NotBlank String username,
            @Valid @RequestBody IntraMonitorDtos.LiveActionRequest request
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        IntraMonitorDtos.RuntimeActionResponse response = intraMonitorService.partialExitRuntime(tenantId, username, runtimeId, request);
        intraPnlService.refreshDailyAggregates(tenantId, username);
        return response;
    }

    @PostMapping("/positions/{positionId}/exit")
    public IntraMonitorDtos.PositionActionResponse exitPosition(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @PathVariable Long positionId,
            @RequestParam @NotBlank String username,
            @Valid @RequestBody IntraMonitorDtos.LiveActionRequest request
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        IntraMonitorDtos.PositionActionResponse response = intraMonitorService.exitPosition(tenantId, username, positionId, request);
        intraPnlService.refreshDailyAggregates(tenantId, username);
        return response;
    }

    @PostMapping("/positions/{positionId}/partial-exit")
    public IntraMonitorDtos.PositionActionResponse partialExitPosition(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @PathVariable Long positionId,
            @RequestParam @NotBlank String username,
            @Valid @RequestBody IntraMonitorDtos.LiveActionRequest request
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        IntraMonitorDtos.PositionActionResponse response = intraMonitorService.partialExitPosition(tenantId, username, positionId, request);
        intraPnlService.refreshDailyAggregates(tenantId, username);
        return response;
    }

    @PostMapping("/positions/{positionId}/manual-watch")
    public IntraMonitorDtos.PositionActionResponse manualWatch(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @PathVariable Long positionId,
            @RequestParam @NotBlank String username,
            @RequestParam(required = false) String reason
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        return intraMonitorService.convertToManualWatch(tenantId, username, positionId, reason);
    }

    @PostMapping("/emergency")
    public IntraMonitorDtos.EmergencyActionResponse emergency(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @RequestParam @NotBlank String username,
            @Valid @RequestBody IntraMonitorDtos.EmergencyActionRequest request
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        IntraMonitorDtos.EmergencyActionResponse response = intraMonitorService.emergencyAction(tenantId, username, request);
        intraPnlService.refreshDailyAggregates(tenantId, username);
        return response;
    }

    private String requireTenantId() {
        String tenantId = TenantContext.getTenantId();
        if (!StringUtils.hasText(tenantId)) {
            throw new ValidationException("Missing tenant context");
        }
        return tenantId;
    }
}
