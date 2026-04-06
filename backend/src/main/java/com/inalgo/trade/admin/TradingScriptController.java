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
@RequestMapping("/api/v1/admin/trading-scripts")
public class TradingScriptController {

    private final AdminAuthService adminAuthService;
    private final TradingScriptService tradingScriptService;

    public TradingScriptController(AdminAuthService adminAuthService, TradingScriptService tradingScriptService) {
        this.adminAuthService = adminAuthService;
        this.tradingScriptService = tradingScriptService;
    }

    @GetMapping("/library")
    public TradingScriptDtos.TradingScriptLibraryResponse library(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @RequestParam @NotBlank String username,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String instrument,
            @RequestParam(required = false) String timeframe,
            @RequestParam(required = false) String compileStatus,
            @RequestParam(defaultValue = "RECENT_EDITED") String sort,
            @RequestParam(defaultValue = "0") @Min(0) Integer page,
            @RequestParam(defaultValue = "10") @Min(1) @Max(200) Integer size
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        return tradingScriptService.listLibrary(tenantId, username, q, status, instrument, timeframe, compileStatus, sort, page, size);
    }

    @PostMapping("/draft")
    public TradingScriptDtos.TradingScriptDetailsResponse createDraft(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @Valid @RequestBody TradingScriptDtos.TradingScriptCreateDraftRequest request
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        return tradingScriptService.createDraft(tenantId, request);
    }

    @PutMapping("/{scriptId}/draft")
    public TradingScriptDtos.TradingScriptDetailsResponse updateDraft(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @PathVariable Long scriptId,
            @Valid @RequestBody TradingScriptDtos.TradingScriptUpdateDraftRequest request
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        return tradingScriptService.updateDraft(tenantId, scriptId, request);
    }

    @PostMapping("/{scriptId}/compile")
    public TradingScriptDtos.TradingScriptCompileResponse compile(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @PathVariable Long scriptId,
            @Valid @RequestBody TradingScriptDtos.TradingScriptCompileRequest request
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        return tradingScriptService.compile(tenantId, scriptId, request.username());
    }

    @PostMapping("/{scriptId}/validate")
    public TradingScriptDtos.TradingScriptCompileResponse validate(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @PathVariable Long scriptId,
            @Valid @RequestBody TradingScriptDtos.TradingScriptValidateRequest request
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        return tradingScriptService.validate(tenantId, scriptId, request.username());
    }

    @PostMapping("/{scriptId}/backtest")
    public TradingScriptDtos.TradingScriptBacktestResponse backtest(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @PathVariable Long scriptId,
            @Valid @RequestBody TradingScriptDtos.TradingScriptValidateRequest request
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        return tradingScriptService.backtest(tenantId, scriptId, request.username());
    }

    @PostMapping("/{scriptId}/publish")
    public TradingScriptDtos.TradingScriptDetailsResponse publish(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @PathVariable Long scriptId,
            @Valid @RequestBody TradingScriptDtos.TradingScriptPublishRequest request
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        return tradingScriptService.publish(tenantId, scriptId, request);
    }

    @PostMapping("/{scriptId}/duplicate")
    public TradingScriptDtos.TradingScriptDetailsResponse duplicate(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @PathVariable Long scriptId,
            @Valid @RequestBody TradingScriptDtos.TradingScriptDuplicateRequest request
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        return tradingScriptService.duplicate(tenantId, scriptId, request);
    }

    @PostMapping("/{scriptId}/archive")
    public TradingScriptDtos.TradingScriptActionResponse archive(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @PathVariable Long scriptId,
            @Valid @RequestBody TradingScriptDtos.TradingScriptArchiveRequest request
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        return tradingScriptService.archive(tenantId, scriptId, request.username());
    }

    @DeleteMapping("/{scriptId}")
    public TradingScriptDtos.TradingScriptActionResponse delete(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @PathVariable Long scriptId,
            @RequestParam @NotBlank String username
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        return tradingScriptService.delete(tenantId, scriptId, username);
    }

    @GetMapping("/{scriptId}/versions")
    public List<TradingScriptDtos.TradingScriptVersionResponse> versions(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @PathVariable Long scriptId,
            @RequestParam @NotBlank String username
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        return tradingScriptService.listVersions(tenantId, scriptId, username);
    }

    @GetMapping("/{scriptId}/versions/{version}")
    public TradingScriptDtos.TradingScriptVersionResponse version(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @PathVariable Long scriptId,
            @PathVariable Integer version,
            @RequestParam @NotBlank String username
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        return tradingScriptService.getVersion(tenantId, scriptId, version, username);
    }

    private String requireTenantId() {
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            throw new ValidationException("Missing tenant context");
        }
        return tenantId;
    }
}
