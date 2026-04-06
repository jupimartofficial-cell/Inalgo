package com.inalgo.trade.admin;

import com.inalgo.trade.security.TenantContext;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
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

import java.time.LocalDate;
import java.time.Instant;

@Validated
@RestController
@RequestMapping("/api/v1/admin/backtest")
public class BacktestAdminController {
private final AdminAuthService adminAuthService;
private final BacktestAnalyticsService backtestAnalyticsService;
private final BacktestStrategyService backtestStrategyService;
private final BacktestRunService backtestRunService;

public BacktestAdminController(
AdminAuthService adminAuthService,
BacktestAnalyticsService backtestAnalyticsService,
BacktestStrategyService backtestStrategyService,
BacktestRunService backtestRunService
) {
this.adminAuthService = adminAuthService;
this.backtestAnalyticsService = backtestAnalyticsService;
this.backtestStrategyService = backtestStrategyService;
this.backtestRunService = backtestRunService;
}

@GetMapping("/trading-signals")
public Page<AdminDtos.TradingSignalResponse> backtestTradingSignals(
@RequestHeader("Authorization") @NotBlank String authorizationHeader,
@RequestParam(required = false) String instrumentKey,
@RequestParam(required = false) String timeframeUnit,
@RequestParam(required = false) @Min(1) @Max(1440) Integer timeframeInterval,
@RequestParam(required = false) String signal,
@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
@RequestParam(defaultValue = "0") @Min(0) Integer page,
@RequestParam(defaultValue = "25") @Min(1) @Max(500) Integer size
) {
String tenantId = requireTenantId();
adminAuthService.validateToken(tenantId, authorizationHeader);
return backtestAnalyticsService.listTradingSignals(tenantId, instrumentKey, timeframeUnit, timeframeInterval, signal, fromDate, toDate, page, size);
}

@GetMapping("/trading-day-params")
public Page<AdminDtos.TradingDayParamResponse> backtestTradingDayParams(
@RequestHeader("Authorization") @NotBlank String authorizationHeader,
@RequestParam(required = false) String instrumentKey,
@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
@RequestParam(defaultValue = "0") @Min(0) Integer page,
@RequestParam(defaultValue = "25") @Min(1) @Max(500) Integer size
) {
String tenantId = requireTenantId();
adminAuthService.validateToken(tenantId, authorizationHeader);
return backtestAnalyticsService.listTradingDayParams(tenantId, instrumentKey, fromDate, toDate, page, size);
}

@GetMapping("/market-trends")
public Page<AdminDtos.MarketSentimentResponse> backtestMarketTrends(
@RequestHeader("Authorization") @NotBlank String authorizationHeader,
@RequestParam(required = false) String marketScope,
@RequestParam(required = false) String trendStatus,
@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant fromSnapshotAt,
@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant toSnapshotAt,
@RequestParam(defaultValue = "0") @Min(0) Integer page,
@RequestParam(defaultValue = "25") @Min(1) @Max(500) Integer size
) {
String tenantId = requireTenantId();
adminAuthService.validateToken(tenantId, authorizationHeader);
return backtestAnalyticsService.listMarketSentiments(tenantId, marketScope, trendStatus, fromSnapshotAt, toSnapshotAt, page, size);
}

@GetMapping("/strategies")
public Page<AdminDtos.BacktestStrategyResponse> backtestStrategies(
@RequestHeader("Authorization") @NotBlank String authorizationHeader,
@RequestParam @NotBlank String username,
@RequestParam(defaultValue = "0") @Min(0) Integer page,
@RequestParam(defaultValue = "10") @Min(1) @Max(500) Integer size
) {
String tenantId = requireTenantId();
adminAuthService.validateToken(tenantId, authorizationHeader);
return backtestStrategyService.listStrategies(tenantId, username, page, size);
}

@PostMapping("/strategies")
public AdminDtos.BacktestStrategyResponse createBacktestStrategy(
@RequestHeader("Authorization") @NotBlank String authorizationHeader,
@Valid @RequestBody AdminDtos.BacktestStrategySaveRequest request
) {
String tenantId = requireTenantId();
adminAuthService.validateToken(tenantId, authorizationHeader);
return backtestStrategyService.createStrategy(tenantId, request);
}

@PutMapping("/strategies/{strategyId}")
public AdminDtos.BacktestStrategyResponse updateBacktestStrategy(
@RequestHeader("Authorization") @NotBlank String authorizationHeader,
@PathVariable Long strategyId,
@Valid @RequestBody AdminDtos.BacktestStrategySaveRequest request
) {
String tenantId = requireTenantId();
adminAuthService.validateToken(tenantId, authorizationHeader);
return backtestStrategyService.updateStrategy(tenantId, strategyId, request);
}

@DeleteMapping("/strategies/{strategyId}")
public AdminDtos.BacktestStrategyDeleteResponse deleteBacktestStrategy(
@RequestHeader("Authorization") @NotBlank String authorizationHeader,
@PathVariable Long strategyId,
@RequestParam @NotBlank String username
) {
String tenantId = requireTenantId();
adminAuthService.validateToken(tenantId, authorizationHeader);
return backtestStrategyService.deleteStrategy(tenantId, strategyId, username);
}

@PostMapping("/run")
public AdminDtos.BacktestRunResponse runBacktest(
@RequestHeader("Authorization") @NotBlank String authorizationHeader,
@Valid @RequestBody AdminDtos.BacktestRunRequest request
) {
String tenantId = requireTenantId();
adminAuthService.validateToken(tenantId, authorizationHeader);
return backtestRunService.runBacktest(tenantId, request);
}

private String requireTenantId() {
String tenantId = TenantContext.getTenantId();
if (tenantId == null || tenantId.isBlank()) {
throw new jakarta.validation.ValidationException("Missing tenant context");
}
return tenantId;
}
}
