package com.inalgo.trade.upstox;
import com.inalgo.trade.entity.UpstoxMigrationStateEntity;
import com.inalgo.trade.repository.CandleRepository;
import com.inalgo.trade.repository.UpstoxMigrationStateRepository;
import com.inalgo.trade.security.TenantContext;
import jakarta.validation.ValidationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
/**
* Coordinates historical candle backfill from Upstox into tenant-isolated storage.
* <p>
* Multi-agent architecture guideline: this class is the only component that knows
* the migration state machine (RUNNING/FAILED/COMPLETED + adaptive chunking).
* Other agents/services should call this service instead of re-implementing the flow.
*/
@Service
@ConditionalOnProperty(prefix = "upstox.migration", name = "enabled", havingValue = "true")
public class UpstoxHistoricalMigrationService {
private static final Logger log = LoggerFactory.getLogger(UpstoxHistoricalMigrationService.class);
private final UpstoxClient upstoxClient;
private final CandleRepository candleRepository;
private final UpstoxMigrationStateRepository stateRepository;
private final UpstoxMigrationProperties migrationProperties;
private final TransactionTemplate transactionTemplate;
private final UpstoxMigrationWindowHelper windowHelper;
private final AtomicBoolean inProgress = new AtomicBoolean(false);
@Autowired
public UpstoxHistoricalMigrationService(
UpstoxClient upstoxClient,
CandleRepository candleRepository,
UpstoxMigrationStateRepository stateRepository,
UpstoxMigrationProperties migrationProperties,
PlatformTransactionManager transactionManager,
UpstoxMigrationWindowHelper windowHelper
) {
this.upstoxClient = upstoxClient;
this.candleRepository = candleRepository;
this.stateRepository = stateRepository;
this.migrationProperties = migrationProperties;
this.transactionTemplate = new TransactionTemplate(transactionManager);
this.windowHelper = windowHelper;
}

UpstoxHistoricalMigrationService(
UpstoxClient upstoxClient,
CandleRepository candleRepository,
UpstoxMigrationStateRepository stateRepository,
UpstoxMigrationProperties migrationProperties,
PlatformTransactionManager transactionManager
) {
this(
upstoxClient,
candleRepository,
stateRepository,
migrationProperties,
transactionManager,
new UpstoxMigrationWindowHelper(candleRepository, stateRepository, migrationProperties, transactionManager)
);
}
/**
* Executes one scheduler tick and iterates over configured streams safely.
*/
public void migrateTick() {
runMigrationTick(null);
}
/**
* Executes one scheduler/admin tick for only one tenant's streams.
*/
public void migrateTickForTenant(String tenantId) {
if (tenantId == null || tenantId.isBlank()) {
throw new ValidationException("tenantId is required for tenant-scoped migration run");
}
runMigrationTick(tenantId);
}
/**
* Realigns one stream to restart from the last persisted candle date for on-demand runs.
*/
public UpstoxMigrationStateEntity restartStreamFromLastCandle(
String tenantId,
String instrumentKey,
String timeframeUnit,
Integer timeframeInterval,
LocalDate bootstrapFromDate
) {
if (tenantId == null || tenantId.isBlank()) {
throw new ValidationException("tenantId is required for migration");
}
if (instrumentKey == null || instrumentKey.isBlank()) {
throw new ValidationException("instrumentKey is required for migration");
}
if (timeframeUnit == null || timeframeUnit.isBlank() || timeframeInterval == null || timeframeInterval < 1) {
throw new ValidationException("Valid timeframe unit and interval are required");
}
if (bootstrapFromDate == null) {
throw new ValidationException("bootstrapFromDate is required");
}
String normalizedInstrumentKey = instrumentKey.trim();
String normalizedTimeframeUnit = timeframeUnit.trim();
TenantContext.setTenantId(tenantId);
try {
LocalDate restartFrom = windowHelper.inferRestartDateFromExistingData(
tenantId,
normalizedInstrumentKey,
normalizedTimeframeUnit,
timeframeInterval,
bootstrapFromDate
);
return transactionTemplate.execute(status -> {
UpstoxMigrationStateEntity state = stateRepository
.findByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeInterval(
tenantId,
normalizedInstrumentKey,
normalizedTimeframeUnit,
timeframeInterval
)
.orElseGet(() -> new UpstoxMigrationStateEntity(
tenantId,
normalizedInstrumentKey,
normalizedTimeframeUnit,
timeframeInterval,
restartFrom
));
state.restartFrom(restartFrom);
return stateRepository.save(state);
});
} finally {
TenantContext.clear();
}
}
/**
* Migrates exactly one chunk for an on-demand UI stream and returns latest state.
*/
public UpstoxMigrationStateEntity migrateSingleChunkForStream(
String tenantId,
String instrumentKey,
String timeframeUnit,
Integer timeframeInterval,
LocalDate bootstrapFromDate
) {
if (tenantId == null || tenantId.isBlank()) {
throw new ValidationException("tenantId is required for migration");
}
if (instrumentKey == null || instrumentKey.isBlank()) {
throw new ValidationException("instrumentKey is required for migration");
}
if (timeframeUnit == null || timeframeUnit.isBlank() || timeframeInterval == null || timeframeInterval < 1) {
throw new ValidationException("Valid timeframe unit and interval are required");
}
if (bootstrapFromDate == null) {
throw new ValidationException("bootstrapFromDate is required");
}
TenantContext.setTenantId(tenantId);
try {
UpstoxMigrationStateEntity state = transactionTemplate.execute(status ->
stateRepository.findByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeInterval(
tenantId,
instrumentKey.trim(),
timeframeUnit.trim(),
timeframeInterval)
.orElseGet(() -> stateRepository.save(new UpstoxMigrationStateEntity(
tenantId,
instrumentKey.trim(),
timeframeUnit.trim(),
timeframeInterval,
bootstrapFromDate
))));
if (state == null) {
throw new ValidationException("Unable to initialize migration state");
}
LocalDate today = LocalDate.now();
state = windowHelper.reopenCompletedStateIfDue(state, today);
if (state.isCompleted()) {
return state;
}
if (state.getNextFromDate().isAfter(today)) {
completeState(state);
return stateRepository.findByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeInterval(
tenantId,
instrumentKey.trim(),
timeframeUnit.trim(),
timeframeInterval
).orElse(state);
}
int requestedWindow = windowHelper.initialWindowDays(timeframeUnit.trim());
syncStreamWithAdaptiveWindow(state, requestedWindow, windowHelper.minWindowDays(timeframeUnit.trim()), today);
return stateRepository.findByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeInterval(
tenantId,
instrumentKey.trim(),
timeframeUnit.trim(),
timeframeInterval
).orElse(state);
} finally {
TenantContext.clear();
}
}
/**
* Returns true when at least one migration stream is configured for the tenant.
*/
public boolean hasConfiguredStreamForTenant(String tenantId) {
if (tenantId == null || tenantId.isBlank()) {
return false;
}
return configuredStreamsForTenant(tenantId).stream()
.anyMatch(stream -> tenantId.equals(stream.tenantId()));
}
private void runMigrationTick(String tenantIdFilter) {
if (!migrationProperties.enabled()) {
return;
}
if (!inProgress.compareAndSet(false, true)) {
log.info("Upstox migration tick skipped because previous run is still active");
return;
}
try {
List<UpstoxMigrationProperties.StreamConfig> streams = configuredStreamsForTenant(tenantIdFilter);
if (streams == null || streams.isEmpty()) {
if (tenantIdFilter == null) {
log.debug("Upstox migration tick has no configured streams");
} else {
log.info("Upstox migration tick has no configured streams for tenant={}", tenantIdFilter);
}
return;
}
log.info("Upstox migration tick started. tenantFilter={}, configuredStreams={}", tenantIdFilter, streams.size());
for (UpstoxMigrationProperties.StreamConfig stream : streams) {
if (tenantIdFilter != null && !tenantIdFilter.equals(stream.tenantId())) {
continue;
}
try {
migrateSingleStream(stream);
} catch (RuntimeException ex) {
log.error("Migration stream failed tenant={} instrument={} interval={} error={}",
stream.tenantId(), stream.instrumentKey(), stream.interval(), ex.getMessage(), ex);
}
}
log.info("Upstox migration tick finished. tenantFilter={}", tenantIdFilter);
} finally {
inProgress.set(false);
}
}
/**
* Migrates one stream from current checkpoint until the next chunk boundary.
*/
private void migrateSingleStream(UpstoxMigrationProperties.StreamConfig stream) {
TenantContext.setTenantId(stream.tenantId());
try {
SupportedTimeframe.ParsedInterval parsed = SupportedTimeframe.parse(stream.interval());
UpstoxMigrationStateEntity state = loadOrCreateState(stream, parsed);
LocalDate today = LocalDate.now();
state = windowHelper.reopenCompletedStateIfDue(state, today);
if (state.isCompleted()) {
return;
}
if (state.getNextFromDate().isAfter(today)) {
completeState(state);
return;
}
int requestedWindow = windowHelper.initialWindowDays(parsed.unit());
syncStreamWithAdaptiveWindow(state, requestedWindow, windowHelper.minWindowDays(parsed.unit()), today);
} finally {
TenantContext.clear();
}
}
/**
* Loads durable migration state or initializes a new checkpoint for first run.
*/
protected UpstoxMigrationStateEntity loadOrCreateState(
UpstoxMigrationProperties.StreamConfig stream,
SupportedTimeframe.ParsedInterval parsed
) {
return transactionTemplate.execute(status -> stateRepository.findByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeInterval(
stream.tenantId(),
stream.instrumentKey(),
parsed.unit(),
parsed.value())
.orElseGet(() -> stateRepository.save(new UpstoxMigrationStateEntity(
stream.tenantId(),
stream.instrumentKey(),
parsed.unit(),
parsed.value(),
windowHelper.inferResumeDateFromExistingData(
stream.tenantId(),
stream.instrumentKey(),
parsed.unit(),
parsed.value(),
stream.bootstrapFromDate()
)
))));
}
/**
* Requests the next migration chunk and shrinks the window only when the provider rejects the date span.
* CRITICAL: adaptive windowing is the primary defense against Upstox API rate limits — do not remove.
*/
private void syncStreamWithAdaptiveWindow(
UpstoxMigrationStateEntity state,
int requestedWindowDays,
int minWindowDays,
LocalDate today
) {
int currentWindow = requestedWindowDays;
while (currentWindow >= minWindowDays) {
LocalDate chunkFrom = state.getNextFromDate();
LocalDate chunkTo = windowHelper.minDate(chunkFrom.plusDays(currentWindow - 1L), today);
try {
List<List<Object>> candles = fetchChunkCandlesForState(state, chunkFrom, chunkTo, today);
persistChunkAndAdvanceState(state, chunkTo, candles);
if (chunkTo.equals(today)) {
completeState(state);
}
return;
} catch (ValidationException ex) {
if (UpstoxCandleParser.shouldShrinkWindow(ex) && currentWindow > minWindowDays) {
currentWindow = Math.max(currentWindow / 2, minWindowDays);
log.warn("Reducing migration window for {} {} {} to {} days due to API window validation failure: {}",
state.getTenantId(), state.getInstrumentKey(), state.getTimeframeUnit(), currentWindow, ex.getMessage());
continue;
}
if (UpstoxCandleParser.isRetriableProviderError(ex)) {
log.warn("Transient provider failure for tenant={} instrument={} unit={} interval={}: {}",
state.getTenantId(), state.getInstrumentKey(), state.getTimeframeUnit(), state.getTimeframeInterval(), ex.getMessage());
throw ex;
}
markFailed(state, ex.getMessage());
throw ex;
} catch (RuntimeException ex) {
if (UpstoxCandleParser.isRetriableProviderError(ex)) {
log.warn("Transient runtime failure for tenant={} instrument={} unit={} interval={}: {}",
state.getTenantId(), state.getInstrumentKey(), state.getTimeframeUnit(), state.getTimeframeInterval(), ex.getMessage());
throw ex;
}
markFailed(state, ex.getMessage());
throw ex;
}
}
}
/**
* Historical endpoints cover closed dates; intraday data is appended only when the active trading day is included.
*/
private List<List<Object>> fetchChunkCandlesForState(
UpstoxMigrationStateEntity state,
LocalDate chunkFrom,
LocalDate chunkTo,
LocalDate today
) {
if (!chunkTo.equals(today) || !windowHelper.supportsIntradayTodaySync(state.getTimeframeUnit())) {
return UpstoxCandleParser.safeCandles(upstoxClient.fetchHistoricalCandles(
state.getInstrumentKey(),
state.getTimeframeUnit(),
state.getTimeframeInterval(),
chunkTo,
chunkFrom
));
}
List<List<Object>> mergedCandles = new ArrayList<>();
LocalDate historicalTo = today.minusDays(1);
if (!chunkFrom.isAfter(historicalTo)) {
mergedCandles.addAll(UpstoxCandleParser.safeCandles(upstoxClient.fetchHistoricalCandles(
state.getInstrumentKey(),
state.getTimeframeUnit(),
state.getTimeframeInterval(),
historicalTo,
chunkFrom
)));
}
// Upstox may return no intraday payload outside market hours; treat that as an empty append, not a failed run.
mergedCandles.addAll(UpstoxCandleParser.safeCandles(upstoxClient.fetchIntradayCandles(
state.getInstrumentKey(),
state.getTimeframeUnit(),
state.getTimeframeInterval()
)));
return mergedCandles;
}
/**
* Persists one API chunk via idempotent upsert and advances checkpoint atomically.
*/
protected void persistChunkAndAdvanceState(UpstoxMigrationStateEntity state, LocalDate chunkTo, List<List<Object>> candles) {
transactionTemplate.executeWithoutResult(status -> {
state.markRunning();
stateRepository.save(state);
List<List<Object>> safeCandles = candles == null ? List.of() : candles;
for (List<Object> candle : safeCandles) {
UpstoxCandleParser.ParsedCandle parsedCandle = UpstoxCandleParser.parseCandleRow(candle);
candleRepository.upsert(
state.getTenantId(),
state.getInstrumentKey(),
state.getTimeframeUnit(),
state.getTimeframeInterval(),
parsedCandle.candleTs(),
parsedCandle.openPrice(),
parsedCandle.highPrice(),
parsedCandle.lowPrice(),
parsedCandle.closePrice(),
parsedCandle.volume()
);
}
// Advance the checkpoint only after the whole chunk is safely upserted.
state.advanceTo(chunkTo.plusDays(1));
stateRepository.save(state);
log.info("Migration chunk persisted tenant={} instrument={} unit={} interval={} candles={} nextFrom={}",
state.getTenantId(),
state.getInstrumentKey(),
state.getTimeframeUnit(),
state.getTimeframeInterval(),
safeCandles.size(),
state.getNextFromDate());
});
}
/**
* Marks a stream as fully synchronized up to today.
*/
protected void completeState(UpstoxMigrationStateEntity state) {
transactionTemplate.executeWithoutResult(status -> {
state.markCompleted();
stateRepository.save(state);
});
}
/**
* Records failure details for operational visibility and retry analysis.
*/
protected void markFailed(UpstoxMigrationStateEntity state, String errorMessage) {
transactionTemplate.executeWithoutResult(status -> {
state.markFailed(errorMessage == null ? "unknown migration failure" : errorMessage);
stateRepository.save(state);
});
}
private List<UpstoxMigrationProperties.StreamConfig> configuredStreamsForTenant(String tenantIdFilter) {
List<UpstoxMigrationProperties.StreamConfig> configuredStreams = migrationProperties.streams();
if (configuredStreams == null || configuredStreams.isEmpty()) {
return List.of();
}
List<UpstoxMigrationProperties.StreamConfig> result = new ArrayList<>();
for (UpstoxMigrationProperties.StreamConfig stream : configuredStreams) {
if (stream == null) {
continue;
}
if (tenantIdFilter != null && !tenantIdFilter.equals(stream.tenantId())) {
continue;
}
result.add(stream);
}
return result;
}
}
