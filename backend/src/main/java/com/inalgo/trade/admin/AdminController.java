package com.inalgo.trade.admin;
import com.inalgo.trade.dto.CandleResponse;
import com.inalgo.trade.security.TenantContext;
import com.inalgo.trade.service.CandleService;
import com.inalgo.trade.service.OpenAiProperties;
import com.inalgo.trade.service.OpenAiTokenService;
import com.inalgo.trade.service.TradingAnalyticsService;
import com.inalgo.trade.upstox.FuturesContractRollService;
import com.inalgo.trade.upstox.OptionChainService;
import com.inalgo.trade.upstox.UpstoxTokenService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
@Validated
@RestController
@RequestMapping("/api/v1/admin")
public class AdminController {
private final AdminAuthService adminAuthService;
private final AdminMigrationService adminMigrationService;
private final CandleService candleService;
private final OptionChainService optionChainService;
private final UpstoxTokenService upstoxTokenService;
private final OpenAiTokenService openAiTokenService;
private final OpenAiProperties openAiProperties;
private final TradingPreferenceService tradingPreferenceService;
private final AdminTriggerService adminTriggerService;
private final TradingAnalyticsService tradingAnalyticsService;
private final FuturesContractRollService futuresContractRollService;
public AdminController(
AdminAuthService adminAuthService,
AdminMigrationService adminMigrationService,
CandleService candleService,
OptionChainService optionChainService,
UpstoxTokenService upstoxTokenService,
OpenAiTokenService openAiTokenService,
OpenAiProperties openAiProperties,
TradingPreferenceService tradingPreferenceService,
AdminTriggerService adminTriggerService,
TradingAnalyticsService tradingAnalyticsService,
FuturesContractRollService futuresContractRollService
) {
this.adminAuthService = adminAuthService;
this.adminMigrationService = adminMigrationService;
this.candleService = candleService;
this.optionChainService = optionChainService;
this.upstoxTokenService = upstoxTokenService;
this.openAiTokenService = openAiTokenService;
this.openAiProperties = openAiProperties;
this.tradingPreferenceService = tradingPreferenceService;
this.adminTriggerService = adminTriggerService;
this.tradingAnalyticsService = tradingAnalyticsService;
this.futuresContractRollService = futuresContractRollService;
}
@PostMapping("/login")
public AdminDtos.AdminLoginResponse login(@Valid @RequestBody AdminDtos.AdminLoginRequest request) {
String token = adminAuthService.login(requireTenantId(), request.username(), request.password());
return new AdminDtos.AdminLoginResponse(token);
}
@PostMapping("/migrations/{jobKey}/pause")
public AdminDtos.TriggerMigrationResponse pauseMigration(
@RequestHeader("Authorization") @NotBlank String authorizationHeader,
@PathVariable String jobKey
) {
String tenantId = requireTenantId();
adminAuthService.validateToken(tenantId, authorizationHeader);
return new AdminDtos.TriggerMigrationResponse(adminMigrationService.pauseJob(tenantId, jobKey));
}
@PostMapping("/migrations/{jobKey}/start")
public AdminDtos.TriggerMigrationResponse startMigration(
@RequestHeader("Authorization") @NotBlank String authorizationHeader,
@PathVariable String jobKey
) {
String tenantId = requireTenantId();
adminAuthService.validateToken(tenantId, authorizationHeader);
return new AdminDtos.TriggerMigrationResponse(adminMigrationService.startJob(tenantId, jobKey));
}
@PostMapping("/migrations/{jobKey}/resume")
public AdminDtos.TriggerMigrationResponse resumeMigration(
@RequestHeader("Authorization") @NotBlank String authorizationHeader,
@PathVariable String jobKey
) {
String tenantId = requireTenantId();
adminAuthService.validateToken(tenantId, authorizationHeader);
return new AdminDtos.TriggerMigrationResponse(adminMigrationService.resumeJob(tenantId, jobKey));
}
@PostMapping("/migrations/{jobKey}/stop")
public AdminDtos.TriggerMigrationResponse stopMigration(
@RequestHeader("Authorization") @NotBlank String authorizationHeader,
@PathVariable String jobKey
) {
String tenantId = requireTenantId();
adminAuthService.validateToken(tenantId, authorizationHeader);
return new AdminDtos.TriggerMigrationResponse(adminMigrationService.stopJob(tenantId, jobKey));
}
@GetMapping("/migrations/status")
public List<AdminDtos.MigrationStatusResponse> migrationStatus(
@RequestHeader("Authorization") @NotBlank String authorizationHeader,
@RequestParam(required = false) String instrumentKey,
@RequestParam(required = false) String timeframeUnit,
@RequestParam(required = false) @Min(1) @Max(1440) Integer timeframeInterval
) {
String tenantId = requireTenantId();
adminAuthService.validateToken(tenantId, authorizationHeader);
return adminMigrationService.listMigrationStatus(tenantId, instrumentKey, timeframeUnit, timeframeInterval);
}
@GetMapping("/migrations/jobs")
public List<AdminDtos.MigrationJobResponse> migrationJobs(
@RequestHeader("Authorization") @NotBlank String authorizationHeader,
@RequestParam(required = false) String instrumentKey
) {
String tenantId = requireTenantId();
adminAuthService.validateToken(tenantId, authorizationHeader);
return adminMigrationService.listJobs(tenantId, instrumentKey);
}
@GetMapping("/triggers")
public List<AdminDtos.TriggerResponse> triggers(
@RequestHeader("Authorization") @NotBlank String authorizationHeader
) {
String tenantId = requireTenantId();
adminAuthService.validateToken(tenantId, authorizationHeader);
return adminTriggerService.listTriggers(tenantId);
}
@GetMapping("/triggers/browser")
public AdminDtos.TriggerBrowserResponse triggerBrowser(
@RequestHeader("Authorization") @NotBlank String authorizationHeader,
@RequestParam(defaultValue = "CANDLE_SYNC") String tabGroup,
@RequestParam(required = false) String instrumentKey,
@RequestParam(required = false) String timeframeKey,
@RequestParam(required = false) String jobNatureKey,
@RequestParam(defaultValue = "0") @Min(0) Integer page,
@RequestParam(defaultValue = "25") @Min(1) @Max(100) Integer size
) {
String tenantId = requireTenantId();
adminAuthService.validateToken(tenantId, authorizationHeader);
return adminTriggerService.browseTriggers(tenantId, tabGroup, instrumentKey, timeframeKey, jobNatureKey, page, size);
}
@PostMapping("/triggers")
public AdminDtos.TriggerResponse createTrigger(
@RequestHeader("Authorization") @NotBlank String authorizationHeader,
@Valid @RequestBody AdminDtos.CreateTriggerRequest request
) {
String tenantId = requireTenantId();
adminAuthService.validateToken(tenantId, authorizationHeader);
return adminTriggerService.createTrigger(tenantId, request);
}
@PutMapping("/triggers/{triggerId}")
public AdminDtos.TriggerResponse updateTrigger(
@RequestHeader("Authorization") @NotBlank String authorizationHeader,
@PathVariable Long triggerId,
@Valid @RequestBody AdminDtos.UpdateTriggerRequest request
) {
String tenantId = requireTenantId();
adminAuthService.validateToken(tenantId, authorizationHeader);
return adminTriggerService.updateTrigger(tenantId, triggerId, request);
}
@DeleteMapping("/triggers/{triggerId}")
public AdminDtos.TriggerDeleteResponse deleteTrigger(
@RequestHeader("Authorization") @NotBlank String authorizationHeader,
@PathVariable Long triggerId
) {
String tenantId = requireTenantId();
adminAuthService.validateToken(tenantId, authorizationHeader);
return adminTriggerService.deleteTrigger(tenantId, triggerId);
}
@PostMapping("/triggers/{triggerId}/start")
public AdminDtos.TriggerActionResponse startTrigger(
@RequestHeader("Authorization") @NotBlank String authorizationHeader,
@PathVariable Long triggerId
) {
String tenantId = requireTenantId();
adminAuthService.validateToken(tenantId, authorizationHeader);
return new AdminDtos.TriggerActionResponse(adminTriggerService.startTrigger(tenantId, triggerId));
}
@PostMapping("/triggers/{triggerId}/pause")
public AdminDtos.TriggerActionResponse pauseTrigger(
@RequestHeader("Authorization") @NotBlank String authorizationHeader,
@PathVariable Long triggerId
) {
String tenantId = requireTenantId();
adminAuthService.validateToken(tenantId, authorizationHeader);
return new AdminDtos.TriggerActionResponse(adminTriggerService.pauseTrigger(tenantId, triggerId));
}
@PostMapping("/triggers/{triggerId}/resume")
public AdminDtos.TriggerActionResponse resumeTrigger(
@RequestHeader("Authorization") @NotBlank String authorizationHeader,
@PathVariable Long triggerId
) {
String tenantId = requireTenantId();
adminAuthService.validateToken(tenantId, authorizationHeader);
return new AdminDtos.TriggerActionResponse(adminTriggerService.resumeTrigger(tenantId, triggerId));
}
@PostMapping("/triggers/{triggerId}/stop")
public AdminDtos.TriggerActionResponse stopTrigger(
@RequestHeader("Authorization") @NotBlank String authorizationHeader,
@PathVariable Long triggerId
) {
String tenantId = requireTenantId();
adminAuthService.validateToken(tenantId, authorizationHeader);
return new AdminDtos.TriggerActionResponse(adminTriggerService.stopTrigger(tenantId, triggerId));
}
@GetMapping("/upstox/token")
public AdminDtos.UpstoxTokenStatusResponse upstoxTokenStatus(
@RequestHeader("Authorization") @NotBlank String authorizationHeader
) {
String tenantId = requireTenantId();
adminAuthService.validateToken(tenantId, authorizationHeader);
UpstoxTokenService.UpstoxTokenStatus status = upstoxTokenService.getTokenStatus(tenantId);
return new AdminDtos.UpstoxTokenStatusResponse(status.configured(), status.updatedAt());
}
@PostMapping("/upstox/token")
public AdminDtos.UpstoxTokenStatusResponse updateUpstoxToken(
@RequestHeader("Authorization") @NotBlank String authorizationHeader,
@Valid @RequestBody AdminDtos.UpstoxTokenUpdateRequest request
) {
String tenantId = requireTenantId();
adminAuthService.validateToken(tenantId, authorizationHeader);
upstoxTokenService.updateToken(tenantId, request.token());
UpstoxTokenService.UpstoxTokenStatus status = upstoxTokenService.getTokenStatus(tenantId);
return new AdminDtos.UpstoxTokenStatusResponse(status.configured(), status.updatedAt());
}
@GetMapping("/openai/token")
public AdminDtos.OpenAiTokenStatusResponse openAiTokenStatus(
@RequestHeader("Authorization") @NotBlank String authorizationHeader
) {
String tenantId = requireTenantId();
adminAuthService.validateToken(tenantId, authorizationHeader);
OpenAiTokenService.OpenAiTokenStatus status = openAiTokenService.getTokenStatus(tenantId, openAiProperties);
return new AdminDtos.OpenAiTokenStatusResponse(status.configured(), status.updatedAt(), status.model(), status.enabled());
}
@PostMapping("/openai/token")
public AdminDtos.OpenAiTokenStatusResponse updateOpenAiToken(
@RequestHeader("Authorization") @NotBlank String authorizationHeader,
@Valid @RequestBody AdminDtos.OpenAiTokenUpdateRequest request
) {
String tenantId = requireTenantId();
adminAuthService.validateToken(tenantId, authorizationHeader);
openAiTokenService.updateToken(tenantId, request.token());
OpenAiTokenService.OpenAiTokenStatus status = openAiTokenService.getTokenStatus(tenantId, openAiProperties);
return new AdminDtos.OpenAiTokenStatusResponse(status.configured(), status.updatedAt(), status.model(), status.enabled());
}
@GetMapping("/historical-data")
public Page<CandleResponse> historicalData(
@RequestHeader("Authorization") @NotBlank String authorizationHeader,
@RequestParam(required = false) String instrumentKey,
@RequestParam(required = false) String timeframeUnit,
@RequestParam(required = false) @Min(1) @Max(1440) Integer timeframeInterval,
@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
@RequestParam(defaultValue = "candleTs") String sortBy,
@RequestParam(defaultValue = "desc") String sortDirection,
@RequestParam(defaultValue = "0") @Min(0) Integer page,
@RequestParam(defaultValue = "50") @Min(1) @Max(500) Integer size
) {
adminAuthService.validateToken(requireTenantId(), authorizationHeader);
return candleService.fetchHistoricalData(instrumentKey, timeframeUnit, timeframeInterval, from, to, sortBy, sortDirection, page, size);
}
@PostMapping("/option-chain/migrate-historical")
public AdminDtos.OptionChainRefreshResponse migrateOptionChainHistorical(
@RequestHeader("Authorization") @NotBlank String authorizationHeader,
@Valid @RequestBody(required = false) AdminDtos.OptionChainRefreshRequest request
) {
String tenantId = requireTenantId();
adminAuthService.validateToken(tenantId, authorizationHeader);
boolean includeAllExpiries = request == null || request.includeAllExpiries() == null || request.includeAllExpiries();
List<OptionChainService.OptionChainRefreshResult> results;
if (request != null && request.underlyingKey() != null && !request.underlyingKey().isBlank()) {
results = List.of(optionChainService.refreshUnderlying(tenantId, request.underlyingKey(), includeAllExpiries));
} else {
results = optionChainService.refreshConfiguredUnderlyings(tenantId, includeAllExpiries);
}
return new AdminDtos.OptionChainRefreshResponse(results.stream()
.map(result -> new AdminDtos.OptionChainRefreshResult(
result.underlyingKey(),
result.processedExpiries(),
result.persistedRows(),
result.failedExpiries(),
result.errors()
))
.toList());
}
@GetMapping("/option-chain/expiries")
public AdminDtos.OptionChainExpiriesResponse optionChainExpiries(
@RequestHeader("Authorization") @NotBlank String authorizationHeader,
@RequestParam @NotBlank String underlyingKey,
@RequestParam(defaultValue = "true") boolean refreshFromProvider
) {
String tenantId = requireTenantId();
adminAuthService.validateToken(tenantId, authorizationHeader);
return new AdminDtos.OptionChainExpiriesResponse(
underlyingKey,
optionChainService.listAvailableExpiries(tenantId, underlyingKey, refreshFromProvider)
);
}
@GetMapping("/option-chain/latest")
public AdminDtos.OptionChainSnapshotResponse latestOptionChain(
@RequestHeader("Authorization") @NotBlank String authorizationHeader,
@RequestParam @NotBlank String underlyingKey,
@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate expiryDate,
@RequestParam(defaultValue = "true") boolean refreshIfMissing
) {
String tenantId = requireTenantId();
adminAuthService.validateToken(tenantId, authorizationHeader);
OptionChainService.OptionChainSnapshotView view = optionChainService.fetchLatestSnapshot(
tenantId,
underlyingKey,
expiryDate,
refreshIfMissing
);
return new AdminDtos.OptionChainSnapshotResponse(
view.underlyingKey(),
view.expiryDate(),
view.snapshotTs(),
view.underlyingSpotPrice(),
view.pcr(),
view.syntheticFuturePrice(),
        view.rows().stream()
        .map(row -> new AdminDtos.OptionChainRowResponse(
                row.strikePrice(),
                row.callInstrumentKey(),
                row.callLtp(),
                row.callOi(),
                row.callPrevOi(),
                row.callVolume(),
                row.callIv(),
                row.callOiChangePercent(),
                row.putInstrumentKey(),
                row.putLtp(),
                row.putOi(),
                row.putPrevOi(),
                row.putVolume(),
                row.putIv(),
row.putOiChangePercent()
))
.toList()
);
}
@GetMapping("/option-chain/history")
public Page<AdminDtos.OptionChainHistoryResponse> optionChainHistory(
@RequestHeader("Authorization") @NotBlank String authorizationHeader,
@RequestParam @NotBlank String underlyingKey,
@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate expiryDate,
@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
@RequestParam(defaultValue = "0") @Min(0) Integer page,
@RequestParam(defaultValue = "100") @Min(1) @Max(500) Integer size
) {
String tenantId = requireTenantId();
adminAuthService.validateToken(tenantId, authorizationHeader);
return optionChainService.fetchHistory(tenantId, underlyingKey, expiryDate, from, to, page, size)
.map(row -> new AdminDtos.OptionChainHistoryResponse(
row.underlyingKey(),
row.expiryDate(),
row.snapshotTs(),
row.strikePrice(),
row.callLtp(),
row.callOi(),
row.callPrevOi(),
row.callIv(),
row.putLtp(),
row.putOi(),
row.putPrevOi(),
row.putIv(),
row.underlyingSpotPrice(),
row.pcr()
));
}
@GetMapping("/trading/preferences")
public AdminDtos.TradingPreferencesResponse tradingPreferences(
@RequestHeader("Authorization") @NotBlank String authorizationHeader,
@RequestParam @NotBlank String username
) {
String tenantId = requireTenantId();
adminAuthService.validateToken(tenantId, authorizationHeader);
return tradingPreferenceService.getPreferences(tenantId, username);
}
@PutMapping("/trading/preferences")
public AdminDtos.TradingPreferencesResponse upsertTradingPreferences(
@RequestHeader("Authorization") @NotBlank String authorizationHeader,
@Valid @RequestBody AdminDtos.TradingPreferencesSaveRequest request
) {
String tenantId = requireTenantId();
adminAuthService.validateToken(tenantId, authorizationHeader);
return tradingPreferenceService.savePreferences(tenantId, request);
}
@PostMapping("/trading/day-params/refresh")
public AdminDtos.TradingDayParamRefreshResponse refreshTradingDayParams(
@RequestHeader("Authorization") @NotBlank String authorizationHeader,
@Valid @RequestBody AdminDtos.TradingDayParamRefreshRequest request
) {
String tenantId = requireTenantId();
adminAuthService.validateToken(tenantId, authorizationHeader);
TradingAnalyticsService.TradingDayParamRefreshResult result = tradingAnalyticsService.refreshTradingDayParams(
tenantId,
request.instrumentKey(),
request.fromDate(),
request.toDate()
);
return new AdminDtos.TradingDayParamRefreshResponse(
result.instrumentKey(),
result.fromDate(),
result.toDate(),
result.processedTradingDays(),
result.refreshedTradeDates()
);
}
/**
 * Returns the current active instrument catalog: spot indices + front-month futures from the registry.
 * Used by the frontend to build instrument dropdowns dynamically.
 * Requires JWT so only authenticated sessions can fetch it.
 */
@GetMapping("/instruments")
public List<AdminDtos.InstrumentDto> instruments(
@RequestHeader("Authorization") @NotBlank String authorizationHeader
) {
String tenantId = requireTenantId();
adminAuthService.validateToken(tenantId, authorizationHeader);

List<AdminDtos.InstrumentDto> result = new java.util.ArrayList<>();
// Spot indices (stable)
result.add(new AdminDtos.InstrumentDto("NSE_INDEX|Nifty 50", "Nifty 50", "NSE", null, null, false));
result.add(new AdminDtos.InstrumentDto("NSE_INDEX|Nifty Bank", "Nifty Bank", "NSE", null, null, false));
result.add(new AdminDtos.InstrumentDto("BSE_INDEX|SENSEX", "SENSEX", "BSE", null, null, false));
// Current monthly futures from the registry
futuresContractRollService.getActiveFuturesContracts().forEach(entry ->
    result.add(new AdminDtos.InstrumentDto(
        entry.getInstrumentKey(),
        entry.getLabel(),
        entry.getExchange(),
        entry.getContractName(),
        entry.getExpiryDate() != null ? entry.getExpiryDate().toString() : null,
        true
    ))
);
return result;
}

private String requireTenantId() {
String tenantId = TenantContext.getTenantId();
if (tenantId == null || tenantId.isBlank()) {
throw new jakarta.validation.ValidationException("Missing tenant context");
}
return tenantId;
}
}
