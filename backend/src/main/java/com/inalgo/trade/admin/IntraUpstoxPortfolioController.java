package com.inalgo.trade.admin;

import com.inalgo.trade.security.TenantContext;
import com.inalgo.trade.upstox.UpstoxOrderDtos;
import com.inalgo.trade.upstox.UpstoxOrderService;
import jakarta.validation.ValidationException;
import jakarta.validation.constraints.NotBlank;
import org.springframework.util.StringUtils;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Admin-protected endpoints that proxy Upstox portfolio data (live positions
 * and today's orders) directly from the Upstox v2 API.
 *
 * <p>All endpoints require a valid JWT issued by {@link AdminAuthService} and a
 * tenant-scoped {@code X-Tenant-Id} header resolved by the security filter.
 */
@Validated
@RestController
@RequestMapping("/api/v1/admin/intra-trade/upstox")
public class IntraUpstoxPortfolioController {

    private final AdminAuthService adminAuthService;
    private final UpstoxOrderService upstoxOrderService;

    public IntraUpstoxPortfolioController(
            AdminAuthService adminAuthService,
            UpstoxOrderService upstoxOrderService
    ) {
        this.adminAuthService = adminAuthService;
        this.upstoxOrderService = upstoxOrderService;
    }

    /**
     * Returns current day positions from Upstox portfolio API.
     * Includes net quantity, average buy/sell prices, LTP, and unrealised P&amp;L
     * for every instrument held in the session.
     */
    @GetMapping("/positions")
    public UpstoxOrderDtos.IntraPositionsResponse positions(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @RequestParam @NotBlank String username
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        return upstoxOrderService.fetchPositions(tenantId);
    }

    /**
     * Returns all orders placed during today's trading session from the Upstox
     * order book. Includes status, fill details, and the intra-trade tag so
     * orders can be correlated back to strategy executions.
     */
    @GetMapping("/orders")
    public UpstoxOrderDtos.IntraOrdersResponse orders(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @RequestParam @NotBlank String username
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        return upstoxOrderService.fetchOrders(tenantId);
    }

    private String requireTenantId() {
        String tenantId = TenantContext.getTenantId();
        if (!StringUtils.hasText(tenantId)) {
            throw new ValidationException("Missing tenant context");
        }
        return tenantId;
    }
}
