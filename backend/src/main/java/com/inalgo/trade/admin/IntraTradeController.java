package com.inalgo.trade.admin;

import com.inalgo.trade.security.TenantContext;
import com.inalgo.trade.upstox.UpstoxOrderDtos;
import com.inalgo.trade.upstox.UpstoxOrderService;
import jakarta.validation.Valid;
import jakarta.validation.ValidationException;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.data.domain.Page;
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
import java.util.Map;

@Validated
@RestController
@RequestMapping("/api/v1/admin/intra-trade")
public class IntraTradeController {

    private final AdminAuthService adminAuthService;
    private final IntraTradeService intraTradeService;
    private final UpstoxOrderService upstoxOrderService;
    private final IntraMonitorService intraMonitorService;
    private final IntraPnlService intraPnlService;

    public IntraTradeController(
            AdminAuthService adminAuthService,
            IntraTradeService intraTradeService,
            UpstoxOrderService upstoxOrderService,
            IntraMonitorService intraMonitorService,
            IntraPnlService intraPnlService
    ) {
        this.adminAuthService = adminAuthService;
        this.intraTradeService = intraTradeService;
        this.upstoxOrderService = upstoxOrderService;
        this.intraMonitorService = intraMonitorService;
        this.intraPnlService = intraPnlService;
    }

    @GetMapping("/executions")
    public Page<IntraTradeDtos.IntraTradeExecutionSummary> listExecutions(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @RequestParam @NotBlank String username,
            @RequestParam(defaultValue = "0") @Min(0) Integer page,
            @RequestParam(defaultValue = "10") @Min(1) @Max(100) Integer size
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        return intraTradeService.listExecutions(tenantId, username, page, size);
    }

    @GetMapping("/executions/{executionId}")
    public IntraTradeDtos.IntraTradeExecutionResponse getExecution(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @PathVariable Long executionId,
            @RequestParam @NotBlank String username
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        return intraTradeService.getExecution(tenantId, executionId, username);
    }

    @PostMapping("/run")
    public IntraTradeDtos.IntraTradeExecutionResponse runExecution(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @Valid @RequestBody IntraTradeDtos.IntraTradeRunRequest request
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        IntraTradeDtos.IntraTradeExecutionResponse response = intraTradeService.runExecution(tenantId, request);
        intraMonitorService.syncFromExecution(
                tenantId,
                response,
                "STRATEGY_STARTED",
                "Strategy run started from Intra Monitor",
                "Run execution",
                request.username()
        );
        intraPnlService.refreshDailyAggregates(tenantId, request.username());
        return response;
    }

    @PostMapping("/trend-check")
    public IntraTradeDtos.IntraTradeTrendCheckResponse checkTrend(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @Valid @RequestBody IntraTradeDtos.IntraTradeRunRequest request
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        return intraTradeService.checkTrend(tenantId, request);
    }

    @PostMapping("/executions/{executionId}/refresh")
    public IntraTradeDtos.IntraTradeExecutionResponse refreshExecution(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @PathVariable Long executionId,
            @RequestParam @NotBlank String username
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        IntraTradeDtos.IntraTradeExecutionResponse response = intraTradeService.refreshExecution(tenantId, executionId, username);
        intraMonitorService.syncFromExecution(
                tenantId,
                response,
                "SNAPSHOT_REFRESHED",
                "Execution snapshot refreshed",
                "Manual refresh",
                username
        );
        intraPnlService.refreshDailyAggregates(tenantId, username);
        return response;
    }

    @PutMapping("/executions/{executionId}")
    public IntraTradeDtos.IntraTradeExecutionResponse updateExecution(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @PathVariable Long executionId,
            @Valid @RequestBody IntraTradeDtos.IntraTradeRunRequest request
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        IntraTradeDtos.IntraTradeExecutionResponse response = intraTradeService.updateExecution(tenantId, executionId, request);
        intraMonitorService.syncFromExecution(
                tenantId,
                response,
                "RUN_UPDATED",
                "Saved run updated from Intra Monitor",
                "Run update",
                request.username()
        );
        intraPnlService.refreshDailyAggregates(tenantId, request.username());
        return response;
    }

    @PostMapping("/executions/{executionId}/exit")
    public IntraTradeDtos.IntraTradeExecutionResponse exitExecution(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @PathVariable Long executionId,
            @RequestParam @NotBlank String username
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        IntraTradeDtos.IntraTradeExecutionResponse response = intraTradeService.exitExecution(tenantId, executionId, username);
        intraMonitorService.syncFromExecution(
                tenantId,
                response,
                "MANUAL_EXIT",
                "Execution exited from run control",
                "Immediate exit",
                username
        );
        intraPnlService.refreshDailyAggregates(tenantId, username);
        return response;
    }

    @DeleteMapping("/executions/{executionId}")
    public IntraTradeDtos.IntraTradeDeleteResponse deleteExecution(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @PathVariable Long executionId,
            @RequestParam @NotBlank String username
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        intraTradeService.deleteExecution(tenantId, executionId, username);
        intraMonitorService.removeExecutionRuntime(tenantId, executionId, username, username);
        intraPnlService.refreshDailyAggregates(tenantId, username);
        return new IntraTradeDtos.IntraTradeDeleteResponse("deleted", executionId);
    }

    // ─── Order management (LIVE mode) ────────────────────────────────────────

    /**
     * Places an intraday order via Upstox for LIVE mode execution.
     * Requires an active Upstox access token for the tenant.
     */
    @PostMapping("/orders/place")
    public IntraTradeDtos.IntraOrderResult placeOrder(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @Valid @RequestBody IntraTradeDtos.IntraOrderPlaceRequest request
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        UpstoxOrderDtos.IntraOrderRequest orderRequest = new UpstoxOrderDtos.IntraOrderRequest(
                request.instrumentToken(),
                request.transactionType(),
                request.quantity(),
                request.orderType(),
                request.limitPrice(),
                request.tag()
        );
        UpstoxOrderDtos.IntraOrderResult result = upstoxOrderService.placeOrder(orderRequest, request.executionId());
        return new IntraTradeDtos.IntraOrderResult(
                result.orderId(),
                result.instrumentToken(),
                result.transactionType(),
                result.quantity(),
                result.orderType(),
                result.limitPrice(),
                result.tag(),
                result.status(),
                result.message()
        );
    }

    /**
     * Fetches all orders for the current intraday session from Upstox.
     */
    @GetMapping("/orders")
    public IntraTradeDtos.IntraOrdersResponse fetchOrders(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        UpstoxOrderDtos.IntraOrdersResponse result = upstoxOrderService.fetchOrders(tenantId);
        return new IntraTradeDtos.IntraOrdersResponse(
                result.tenantId(),
                result.orders().stream()
                        .map(o -> new IntraTradeDtos.IntraOrderResult(
                                o.orderId(), o.instrumentToken(), o.transactionType(),
                                o.quantity(), o.orderType(), o.limitPrice(), o.tag(), o.status(), o.message()))
                        .toList(),
                result.count()
        );
    }

    /**
     * Cancels an open order by its Upstox order ID.
     */
    @DeleteMapping("/orders/{orderId}")
    public Map<String, String> cancelOrder(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @PathVariable @NotBlank String orderId
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        upstoxOrderService.cancelOrder(orderId);
        return Map.of("status", "cancelled", "orderId", orderId);
    }

    /**
     * Fetches current intraday positions from Upstox portfolio.
     */
    @GetMapping("/positions")
    public IntraTradeDtos.IntraPositionsResponse fetchPositions(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        UpstoxOrderDtos.IntraPositionsResponse result = upstoxOrderService.fetchPositions(tenantId);
        return new IntraTradeDtos.IntraPositionsResponse(
                result.tenantId(),
                result.positions().stream()
                        .map(p -> new IntraTradeDtos.IntraPositionSummary(
                                p.instrumentToken(), p.tradingSymbol(), p.netQuantity(),
                                p.avgBuyPrice(), p.avgSellPrice(), p.ltp(), p.pnl()))
                        .toList(),
                result.count()
        );
    }

    private String requireTenantId() {
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            throw new ValidationException("Missing tenant context");
        }
        return tenantId;
    }
}
