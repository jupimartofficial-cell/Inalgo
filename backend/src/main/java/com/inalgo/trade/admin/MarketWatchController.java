package com.inalgo.trade.admin;

import com.inalgo.trade.security.TenantContext;
import com.inalgo.trade.service.MarketSentimentService;
import jakarta.validation.ValidationException;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

@Validated
@RestController
@RequestMapping("/api/v1/admin/market-watch")
public class MarketWatchController {

    private final AdminAuthService adminAuthService;
    private final MarketWatchService marketWatchService;
    private final MarketSentimentService marketSentimentService;
    private final MarketTrendAccuracyService marketTrendAccuracyService;

    public MarketWatchController(
            AdminAuthService adminAuthService,
            MarketWatchService marketWatchService,
            MarketSentimentService marketSentimentService,
            MarketTrendAccuracyService marketTrendAccuracyService
    ) {
        this.adminAuthService = adminAuthService;
        this.marketWatchService = marketWatchService;
        this.marketSentimentService = marketSentimentService;
        this.marketTrendAccuracyService = marketTrendAccuracyService;
    }

    @GetMapping("/config")
    public MarketWatchDtos.MarketWatchConfigResponse getConfig(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @RequestParam @NotBlank String username
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        return marketWatchService.getConfig(tenantId, username);
    }

    @PutMapping("/config")
    public MarketWatchDtos.MarketWatchConfigResponse saveConfig(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @RequestBody @NotNull MarketWatchDtos.MarketWatchConfigSaveRequest request
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        return marketWatchService.saveConfig(tenantId, request);
    }

    @GetMapping("/data")
    public MarketWatchDtos.MarketWatchDataResponse getData(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @RequestParam @NotBlank String username
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        return marketWatchService.getData(tenantId, username);
    }

    @PostMapping("/refresh")
    public MarketWatchDtos.MarketSentimentRefreshResponse refresh(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        var results = marketSentimentService.refreshTenant(tenantId);
        return new MarketWatchDtos.MarketSentimentRefreshResponse(results.size(), Instant.now().toString());
    }

    @GetMapping("/accuracy")
    public MarketWatchDtos.TrendAccuracyReport getAccuracy(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @RequestParam(defaultValue = "60") int lookbackDays,
            @RequestParam(defaultValue = "15") int candleIntervalMinutes
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        int boundedLookback = Math.min(Math.max(lookbackDays, 1), 180);
        int boundedCandleInterval = candleIntervalMinutes == 5 ? 5 : 15;
        return marketTrendAccuracyService.compute(tenantId, boundedLookback, boundedCandleInterval);
    }

    @GetMapping("/news-preview")
    public MarketSentimentService.NewsFeedPreviewResponse newsPreview(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @RequestParam(defaultValue = "GLOBAL_NEWS") String scope
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        return marketSentimentService.previewNewsFeed(tenantId, scope);
    }

    private String requireTenantId() {
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            throw new ValidationException("Missing tenant context");
        }
        return tenantId;
    }
}
