package com.inalgo.trade.admin;

import com.inalgo.trade.security.TenantContext;
import jakarta.validation.Valid;
import jakarta.validation.ValidationException;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Validated
@RestController
@RequestMapping("/api/v1/admin/intra-strategies")
public class IntraStrategyController {

    private final AdminAuthService adminAuthService;
    private final IntraStrategyService intraStrategyService;
    private final IntraStrategyAiGenerationService intraStrategyAiGenerationService;

    public IntraStrategyController(
            AdminAuthService adminAuthService,
            IntraStrategyService intraStrategyService,
            IntraStrategyAiGenerationService intraStrategyAiGenerationService
    ) {
        this.adminAuthService = adminAuthService;
        this.intraStrategyService = intraStrategyService;
        this.intraStrategyAiGenerationService = intraStrategyAiGenerationService;
    }

    @GetMapping("/library")
    public IntraStrategyDtos.IntraStrategyLibraryResponse library(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @RequestParam @NotBlank String username,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String instrument,
            @RequestParam(required = false) String timeframe,
            @RequestParam(required = false) Boolean paperEligible,
            @RequestParam(required = false) Boolean liveEligible,
            @RequestParam(defaultValue = "RECENT_EDITED") String sort,
            @RequestParam(defaultValue = "0") @Min(0) Integer page,
            @RequestParam(defaultValue = "10") @Min(1) @Max(200) Integer size
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        return intraStrategyService.listLibrary(
                tenantId,
                username,
                q,
                status,
                instrument,
                timeframe,
                paperEligible,
                liveEligible,
                sort,
                page,
                size
        );
    }

    @PostMapping("/draft")
    public IntraStrategyDtos.IntraStrategyDetailsResponse createDraft(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @Valid @RequestBody IntraStrategyDtos.IntraStrategyCreateDraftRequest request
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        return intraStrategyService.createDraft(tenantId, request);
    }

    @PutMapping("/{strategyId}/draft")
    public IntraStrategyDtos.IntraStrategyDetailsResponse updateDraft(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @PathVariable Long strategyId,
            @Valid @RequestBody IntraStrategyDtos.IntraStrategyUpdateDraftRequest request
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        return intraStrategyService.updateDraft(tenantId, strategyId, request);
    }

    @PostMapping("/{strategyId}/validate")
    public IntraStrategyDtos.IntraStrategyValidationResult validateStrategy(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @PathVariable Long strategyId,
            @Valid @RequestBody IntraStrategyDtos.IntraStrategyValidateRequest request
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        return intraStrategyService.validate(tenantId, strategyId, request);
    }

    @PostMapping("/{strategyId}/publish")
    public IntraStrategyDtos.IntraStrategyDetailsResponse publish(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @PathVariable Long strategyId,
            @Valid @RequestBody IntraStrategyDtos.IntraStrategyPublishRequest request
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        return intraStrategyService.publish(tenantId, strategyId, request);
    }

    @PostMapping("/{strategyId}/duplicate")
    public IntraStrategyDtos.IntraStrategyDetailsResponse duplicate(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @PathVariable Long strategyId,
            @Valid @RequestBody IntraStrategyDtos.IntraStrategyDuplicateRequest request
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        return intraStrategyService.duplicate(tenantId, strategyId, request);
    }

    @PostMapping("/{strategyId}/archive")
    public IntraStrategyDtos.IntraStrategyActionResponse archive(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @PathVariable Long strategyId,
            @Valid @RequestBody IntraStrategyDtos.IntraStrategyArchiveRequest request
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        return intraStrategyService.archive(tenantId, strategyId, request);
    }

    @DeleteMapping("/{strategyId}")
    public IntraStrategyDtos.IntraStrategyActionResponse delete(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @PathVariable Long strategyId,
            @RequestParam @NotBlank String username
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        return intraStrategyService.delete(tenantId, strategyId, username);
    }

    @GetMapping("/{strategyId}/versions")
    public List<IntraStrategyDtos.IntraStrategyVersionResponse> versions(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @PathVariable Long strategyId,
            @RequestParam @NotBlank String username
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        return intraStrategyService.listVersions(tenantId, strategyId, username);
    }

    @GetMapping("/{strategyId}/versions/{version}")
    public IntraStrategyDtos.IntraStrategyVersionResponse version(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @PathVariable Long strategyId,
            @PathVariable Integer version,
            @RequestParam @NotBlank String username
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        return intraStrategyService.getVersion(tenantId, strategyId, version, username);
    }

    @PostMapping("/import-from-backtest")
    public IntraStrategyDtos.IntraStrategyImportResponse importFromBacktest(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @Valid @RequestBody IntraStrategyDtos.IntraStrategyImportFromBacktestRequest request
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        return intraStrategyService.importFromBacktest(tenantId, request);
    }

    @PostMapping("/ai-generate")
    public IntraStrategyDtos.IntraStrategyAiGenerateResponse generateWithAi(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @Valid @RequestBody IntraStrategyDtos.IntraStrategyAiGenerateRequest request
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        return intraStrategyAiGenerationService.generate(tenantId, request);
    }

    private String requireTenantId() {
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            throw new ValidationException("Missing tenant context");
        }
        return tenantId;
    }
}
