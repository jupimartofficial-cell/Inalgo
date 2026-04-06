package com.inalgo.trade.admin;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.inalgo.trade.entity.IntraTradeExecutionEntity;
import com.inalgo.trade.repository.IntraRuntimeStrategyRepository;
import com.inalgo.trade.repository.IntraTradeExecutionRepository;
import com.inalgo.trade.service.IndiaMarketHoursProperties;
import jakarta.validation.ValidationException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

@Service
public class IntraTradeService {

    private static final Set<String> ALLOWED_MODES = Set.of("LIVE", "PAPER", "BACKTEST");
    private static final Set<Integer> LIVE_SCAN_INTERVALS = Set.of(1, 5, 15, 30, 60);
    private static final Set<String> ACTIVE_LIVE_STATUSES = Set.of("WAITING", "ENTERED", "PARTIAL_EXIT", "PAUSED", "ERROR");

    private final IntraTradeExecutionRepository intraTradeExecutionRepository;
    private final IntraRuntimeStrategyRepository intraRuntimeStrategyRepository;
    private final BacktestStrategyService backtestStrategyService;
    private final BacktestRunService backtestRunService;
    private final IntraTradeTrendAdvisor trendAdvisor;
    private final IntraTradeExecutionMapper executionMapper;
    private final Clock clock;
    private final IntraTradeScanWindowResolver scanWindowResolver;
    private final IndiaMarketHoursProperties marketHoursProperties;

    @Autowired
    public IntraTradeService(
            IntraTradeExecutionRepository intraTradeExecutionRepository,
            IntraRuntimeStrategyRepository intraRuntimeStrategyRepository,
            BacktestStrategyService backtestStrategyService,
            BacktestRunService backtestRunService,
            IntraTradeTrendAdvisor trendAdvisor,
            ObjectMapper objectMapper,
            IndiaMarketHoursProperties marketHoursProperties
    ) {
        this(
                intraTradeExecutionRepository,
                intraRuntimeStrategyRepository,
                backtestStrategyService,
                backtestRunService,
                trendAdvisor,
                objectMapper,
                Clock.system(marketHoursProperties.zone()),
                new IntraTradeScanWindowResolver(marketHoursProperties),
                marketHoursProperties
        );
    }

    IntraTradeService(
            IntraTradeExecutionRepository intraTradeExecutionRepository,
            IntraRuntimeStrategyRepository intraRuntimeStrategyRepository,
            BacktestStrategyService backtestStrategyService,
            BacktestRunService backtestRunService,
            IntraTradeTrendAdvisor trendAdvisor,
            ObjectMapper objectMapper,
            Clock clock,
            IntraTradeScanWindowResolver scanWindowResolver,
            IndiaMarketHoursProperties marketHoursProperties
    ) {
        this.intraTradeExecutionRepository = intraTradeExecutionRepository;
        this.intraRuntimeStrategyRepository = intraRuntimeStrategyRepository;
        this.backtestStrategyService = backtestStrategyService;
        this.backtestRunService = backtestRunService;
        this.trendAdvisor = trendAdvisor;
        this.executionMapper = new IntraTradeExecutionMapper(objectMapper);
        this.clock = clock;
        this.scanWindowResolver = scanWindowResolver;
        this.marketHoursProperties = marketHoursProperties;
    }

    public Page<IntraTradeDtos.IntraTradeExecutionSummary> listExecutions(
            String tenantId,
            String username,
            Integer page,
            Integer size
    ) {
        String normalizedUsername = requireUsername(username);
        int boundedPage = Math.max(page == null ? 0 : page, 0);
        int boundedSize = Math.min(Math.max(size == null ? 10 : size, 1), 100);
        return intraTradeExecutionRepository
                .findAllByTenantIdAndUsernameOrderByUpdatedAtDesc(
                        tenantId,
                        normalizedUsername,
                        PageRequest.of(boundedPage, boundedSize)
                )
                .map(executionMapper::toSummary);
    }

    public IntraTradeDtos.IntraTradeExecutionResponse runExecution(
            String tenantId,
            IntraTradeDtos.IntraTradeRunRequest request
    ) {
        String normalizedUsername = requireUsername(request.username());
        String normalizedMode = normalizeMode(request.mode());
        String scanInstrumentKey = requireText(request.scanInstrumentKey(), "scanInstrumentKey");
        String scanTimeframeUnit = normalizeScanTimeframeUnit(request.scanTimeframeUnit(), normalizedMode);
        Integer scanTimeframeInterval = normalizeScanTimeframeInterval(request.scanTimeframeInterval(), scanTimeframeUnit, normalizedMode);
        ensureNoDuplicateLiveRuntime(tenantId, normalizedUsername, normalizedMode, request.strategyId());

        AdminDtos.BacktestStrategyPayload strategy = normalizeStrategy(request.strategy(), scanInstrumentKey);
        validateIntraTradeStrategy(strategy, normalizedMode);

        ExecutionSnapshot snapshot = evaluateExecution(
                tenantId,
                normalizedUsername,
                normalizedMode,
                strategy,
                scanTimeframeUnit,
                scanTimeframeInterval
        );
        IntraTradeExecutionEntity entity = new IntraTradeExecutionEntity(
                tenantId,
                normalizedUsername,
                request.strategyId(),
                normalizedMode,
                snapshot.status(),
                strategy.strategyName(),
                scanInstrumentKey,
                scanTimeframeUnit,
                scanTimeframeInterval,
                executionMapper.serialize(strategy),
                executionMapper.serialize(snapshot.result()),
                snapshot.result().totalPnl(),
                snapshot.result().executedTrades(),
                snapshot.statusMessage(),
                snapshot.evaluatedAt()
        );
        IntraTradeExecutionEntity saved = intraTradeExecutionRepository.save(entity);
        return executionMapper.toResponse(saved, strategy, snapshot.result());
    }

    public IntraTradeDtos.IntraTradeTrendCheckResponse checkTrend(
            String tenantId,
            IntraTradeDtos.IntraTradeRunRequest request
    ) {
        String normalizedMode = normalizeMode(request.mode());
        if ("BACKTEST".equals(normalizedMode)) {
            return new IntraTradeDtos.IntraTradeTrendCheckResponse(false, "NEUTRAL", "UNAVAILABLE", "");
        }
        String scanInstrumentKey = requireText(request.scanInstrumentKey(), "scanInstrumentKey");
        String scanTimeframeUnit = normalizeScanTimeframeUnit(request.scanTimeframeUnit(), normalizedMode);
        Integer scanTimeframeInterval = normalizeScanTimeframeInterval(request.scanTimeframeInterval(), scanTimeframeUnit, normalizedMode);
        AdminDtos.BacktestStrategyPayload strategy = normalizeStrategy(request.strategy(), scanInstrumentKey);
        validateIntraTradeStrategy(strategy, normalizedMode);
        return trendAdvisor.checkTrend(tenantId, scanInstrumentKey, scanTimeframeUnit, scanTimeframeInterval, strategy);
    }

    public IntraTradeDtos.IntraTradeExecutionResponse getExecution(
            String tenantId,
            Long executionId,
            String username
    ) {
        String normalizedUsername = requireUsername(username);
        IntraTradeExecutionEntity entity = intraTradeExecutionRepository.findByIdAndTenantId(executionId, tenantId)
                .orElseThrow(() -> new ValidationException("Intra Trade execution was not found"));
        if (!normalizedUsername.equals(entity.getUsername())) {
            throw new ValidationException("Execution belongs to another user");
        }
        AdminDtos.BacktestStrategyPayload strategy = executionMapper.deserialize(
                entity.getStrategyJson(),
                AdminDtos.BacktestStrategyPayload.class,
                "Stored Intra Trade strategy is invalid"
        );
        AdminDtos.BacktestRunResponse result = executionMapper.deserialize(
                entity.getResultJson(),
                AdminDtos.BacktestRunResponse.class,
                "Stored Intra Trade result is invalid"
        );
        return executionMapper.toResponse(entity, strategy, result);
    }

    public IntraTradeDtos.IntraTradeExecutionResponse refreshExecution(
            String tenantId,
            Long executionId,
            String username
    ) {
        IntraTradeExecutionEntity entity = loadExecution(tenantId, executionId, username);

        AdminDtos.BacktestStrategyPayload strategy = executionMapper.deserialize(
                entity.getStrategyJson(),
                AdminDtos.BacktestStrategyPayload.class,
                "Stored Intra Trade strategy is invalid"
        );
        ExecutionSnapshot snapshot = evaluateExecution(
                tenantId,
                entity.getUsername(),
                entity.getMode(),
                strategy,
                entity.getScanTimeframeUnit(),
                entity.getScanTimeframeInterval()
        );

        entity.setStatus(snapshot.status());
        entity.setStrategyName(strategy.strategyName());
        entity.setResultJson(executionMapper.serialize(snapshot.result()));
        entity.setTotalPnl(snapshot.result().totalPnl());
        entity.setExecutedTrades(snapshot.result().executedTrades());
        entity.setStatusMessage(snapshot.statusMessage());
        entity.setEvaluatedAt(snapshot.evaluatedAt());

        IntraTradeExecutionEntity saved = intraTradeExecutionRepository.save(entity);
        return executionMapper.toResponse(saved, strategy, snapshot.result());
    }

    public IntraTradeDtos.IntraTradeExecutionResponse updateExecution(
            String tenantId,
            Long executionId,
            IntraTradeDtos.IntraTradeRunRequest request
    ) {
        IntraTradeExecutionEntity entity = loadExecution(tenantId, executionId, request.username());
        if ("ENTERED".equals(entity.getStatus())) {
            throw new ValidationException("Entered executions must be exited before editing");
        }
        String normalizedMode = normalizeMode(request.mode());
        String scanInstrumentKey = requireText(request.scanInstrumentKey(), "scanInstrumentKey");
        String scanTimeframeUnit = normalizeScanTimeframeUnit(request.scanTimeframeUnit(), normalizedMode);
        Integer scanTimeframeInterval = normalizeScanTimeframeInterval(request.scanTimeframeInterval(), scanTimeframeUnit, normalizedMode);
        AdminDtos.BacktestStrategyPayload strategy = normalizeStrategy(request.strategy(), scanInstrumentKey);
        validateIntraTradeStrategy(strategy, normalizedMode);
        ExecutionSnapshot snapshot = evaluateExecution(
                tenantId,
                entity.getUsername(),
                normalizedMode,
                strategy,
                scanTimeframeUnit,
                scanTimeframeInterval
        );
        entity.setStrategyId(request.strategyId());
        entity.setMode(normalizedMode);
        entity.setStatus(snapshot.status());
        entity.setStrategyName(strategy.strategyName());
        entity.setScanInstrumentKey(scanInstrumentKey);
        entity.setScanTimeframeUnit(scanTimeframeUnit);
        entity.setScanTimeframeInterval(scanTimeframeInterval);
        entity.setStrategyJson(executionMapper.serialize(strategy));
        entity.setResultJson(executionMapper.serialize(snapshot.result()));
        entity.setTotalPnl(snapshot.result().totalPnl());
        entity.setExecutedTrades(snapshot.result().executedTrades());
        entity.setStatusMessage(snapshot.statusMessage());
        entity.setEvaluatedAt(snapshot.evaluatedAt());
        IntraTradeExecutionEntity saved = intraTradeExecutionRepository.save(entity);
        return executionMapper.toResponse(saved, strategy, snapshot.result());
    }

    public IntraTradeDtos.IntraTradeExecutionResponse exitExecution(
            String tenantId,
            Long executionId,
            String username
    ) {
        IntraTradeExecutionEntity entity = loadExecution(tenantId, executionId, username);
        if (!"ENTERED".equals(entity.getStatus())) {
            throw new ValidationException("Only entered executions can be exited immediately");
        }
        AdminDtos.BacktestStrategyPayload strategy = executionMapper.deserialize(
                entity.getStrategyJson(),
                AdminDtos.BacktestStrategyPayload.class,
                "Stored Intra Trade strategy is invalid"
        );
        ExecutionSnapshot snapshot = evaluateExecution(
                tenantId,
                entity.getUsername(),
                entity.getMode(),
                strategy,
                entity.getScanTimeframeUnit(),
                entity.getScanTimeframeInterval(),
                true
        );
        entity.setStatus(snapshot.status());
        entity.setResultJson(executionMapper.serialize(snapshot.result()));
        entity.setTotalPnl(snapshot.result().totalPnl());
        entity.setExecutedTrades(snapshot.result().executedTrades());
        entity.setStatusMessage(snapshot.statusMessage());
        entity.setEvaluatedAt(snapshot.evaluatedAt());
        IntraTradeExecutionEntity saved = intraTradeExecutionRepository.save(entity);
        return executionMapper.toResponse(saved, strategy, snapshot.result());
    }

    public void deleteExecution(
            String tenantId,
            Long executionId,
            String username
    ) {
        IntraTradeExecutionEntity entity = loadExecution(tenantId, executionId, username);
        if ("ENTERED".equals(entity.getStatus())) {
            throw new ValidationException("Entered executions must be exited before delete");
        }
        intraTradeExecutionRepository.delete(entity);
    }

    private ExecutionSnapshot evaluateExecution(
            String tenantId,
            String username,
            String mode,
            AdminDtos.BacktestStrategyPayload strategy,
            String scanTimeframeUnit,
            Integer scanTimeframeInterval
    ) {
        Instant evaluatedAt = clock.instant();
        if ("BACKTEST".equals(mode)) {
            AdminDtos.BacktestRunResponse result = appendContextNote(
                    backtestRunService.runBacktest(tenantId, new AdminDtos.BacktestRunRequest(username, strategy)),
                    "Historical Intra Trade backtest saved for " + strategy.startDate() + " to " + strategy.endDate() + "."
            );
            return new ExecutionSnapshot(
                    "COMPLETED",
                    result.executedTrades() > 0 ? "Historical backtest completed" : "Historical backtest completed without trades",
                    evaluatedAt,
                    result
            );
        }

        return evaluateExecution(tenantId, username, mode, strategy, scanTimeframeUnit, scanTimeframeInterval, false);
    }

    private ExecutionSnapshot evaluateExecution(
            String tenantId,
            String username,
            String mode,
            AdminDtos.BacktestStrategyPayload strategy,
            String scanTimeframeUnit,
            Integer scanTimeframeInterval,
            boolean forceExit
    ) {
        Instant evaluatedAt = clock.instant();
        return evaluateLiveSnapshot(tenantId, username, mode, strategy, scanTimeframeUnit, scanTimeframeInterval, evaluatedAt, forceExit);
    }

    private ExecutionSnapshot evaluateLiveSnapshot(
            String tenantId,
            String username,
            String mode,
            AdminDtos.BacktestStrategyPayload strategy,
            String scanTimeframeUnit,
            Integer scanTimeframeInterval,
            Instant evaluatedAt,
            boolean forceExit
    ) {
        LocalDateTime marketNow = LocalDateTime.ofInstant(evaluatedAt, marketHoursProperties.zone()).withSecond(0).withNano(0);
        IntraTradeScanWindowResolver.LiveScanWindow scanWindow = scanWindowResolver.resolve(
                marketNow,
                strategy.entryTime(),
                strategy.exitTime(),
                scanTimeframeInterval
        );
        if (!scanWindow.ready()) {
            return waitingSnapshot(strategy, evaluatedAt, scanWindow.waitingReason(), scanTimeframeUnit, scanTimeframeInterval);
        }

        AdminDtos.BacktestStrategyPayload snapshotStrategy = new AdminDtos.BacktestStrategyPayload(
                strategy.strategyName(),
                strategy.underlyingKey(),
                strategy.underlyingSource(),
                strategy.strategyType(),
                scanWindow.alignedEntryTime(),
                scanWindow.alignedExitTime(),
                scanWindow.tradeDate(),
                scanWindow.tradeDate(),
                strategy.legs(),
                strategy.legwiseSettings(),
                strategy.overallSettings(),
                strategy.advancedConditions()
        );

        AdminDtos.BacktestRunResponse result = backtestRunService.runBacktest(
                tenantId,
                new AdminDtos.BacktestRunRequest(username, snapshotStrategy),
                scanTimeframeInterval
        );

        // Re-entry scan: after a stop-loss / target exit that still falls inside the
        // trading window, keep looking for new entry opportunities candle-by-candle until
        // the window closes or no further trade is found (max 10 re-entries per day).
        if (!forceExit && result.executedTrades() > 0 && containsEarlyExit(result.notes())) {
            LocalTime windowExitTime = snapshotStrategy.exitTime();
            int reentries = 0;
            while (reentries < 10 && containsEarlyExit(result.notes())) {
                if (result.rows().isEmpty()) {
                    break;
                }
                Instant lastExitTs = result.rows().get(result.rows().size() - 1).exitTs();
                LocalTime lastExitTime = LocalDateTime.ofInstant(lastExitTs, marketHoursProperties.zone()).toLocalTime();
                LocalTime reentryTime = scanWindowResolver.nextCandleBoundaryAfter(lastExitTime, scanTimeframeInterval);
                if (!reentryTime.isBefore(windowExitTime)) {
                    break;
                }
                AdminDtos.BacktestStrategyPayload reentryStrategy = new AdminDtos.BacktestStrategyPayload(
                        snapshotStrategy.strategyName(),
                        snapshotStrategy.underlyingKey(),
                        snapshotStrategy.underlyingSource(),
                        snapshotStrategy.strategyType(),
                        reentryTime,
                        windowExitTime,
                        scanWindow.tradeDate(),
                        scanWindow.tradeDate(),
                        snapshotStrategy.legs(),
                        snapshotStrategy.legwiseSettings(),
                        snapshotStrategy.overallSettings(),
                        snapshotStrategy.advancedConditions()
                );
                AdminDtos.BacktestRunResponse reentryResult = backtestRunService.runBacktest(
                        tenantId,
                        new AdminDtos.BacktestRunRequest(username, reentryStrategy),
                        scanTimeframeInterval
                );
                if (reentryResult.executedTrades() == 0) {
                    break;
                }
                result = appendContextNote(
                        reentryResult,
                        mode + " re-entry scan found a new opportunity at " + reentryTime
                                + " after earlier stop/target exit."
                );
                reentries++;
            }
        }

        if (result.executedTrades() == 0) {
            return new ExecutionSnapshot(
                    "WAITING_ENTRY",
                    "No entry conditions have triggered yet",
                    evaluatedAt,
                    appendContextNote(
                            result,
                            mode + " scan evaluated intraday data up to "
                                    + scanWindow.alignedExitTime()
                                    + " using the "
                                    + scanTimeframeInterval
                                    + " "
                                    + scanTimeframeUnit
                                    + " cadence and did not open a position."
                    )
            );
        }

        boolean exited = forceExit || !marketNow.toLocalTime().isBefore(strategy.exitTime()) || containsEarlyExit(result.notes());
        String status = exited ? "EXITED" : "ENTERED";
        String message = forceExit
                ? "Position exited immediately and result saved"
                : exited
                ? "Position exited and result saved"
                : "Position is open and marked to market";
        String contextNote = forceExit
                ? "Immediate exit requested. " + mode + " scan closed the position using intraday data up to "
                        + scanWindow.alignedExitTime() + " on the " + scanTimeframeInterval + " " + scanTimeframeUnit + " cadence."
                : exited
                ? mode + " scan exited the position using intraday data up to " + scanWindow.alignedExitTime()
                        + " on the " + scanTimeframeInterval + " " + scanTimeframeUnit + " cadence."
                : mode + " scan keeps the position open and marks it to market at " + scanWindow.alignedExitTime()
                        + " on the " + scanTimeframeInterval + " " + scanTimeframeUnit + " cadence.";

        return new ExecutionSnapshot(
                status,
                message,
                evaluatedAt,
                appendContextNote(result, contextNote)
        );
    }

    private ExecutionSnapshot waitingSnapshot(
            AdminDtos.BacktestStrategyPayload strategy,
            Instant evaluatedAt,
            IntraTradeScanWindowResolver.WaitingReason waitingReason,
            String scanTimeframeUnit,
            Integer scanTimeframeInterval
    ) {
        return switch (waitingReason) {
            case NEXT_TRADING_DAY -> new ExecutionSnapshot(
                    "WAITING_ENTRY",
                    "Live scan is waiting for the next trading day",
                    evaluatedAt,
                    emptyResult(strategy, List.of("Live and paper scans run only on market trading days."))
            );
            case ENTRY_WINDOW -> new ExecutionSnapshot(
                    "WAITING_ENTRY",
                    "Waiting for the configured entry window",
                    evaluatedAt,
                    emptyResult(strategy, List.of("Current market time is before the entry window."))
            );
            case SCAN_CANDLE -> new ExecutionSnapshot(
                    "WAITING_ENTRY",
                    "Waiting for the first eligible scan candle",
                    evaluatedAt,
                    emptyResult(
                            strategy,
                            List.of(
                                    "A completed "
                                            + scanTimeframeInterval
                                            + " "
                                            + scanTimeframeUnit
                                            + " candle is required after the entry window before evaluation."
                            )
                    )
            );
        };
    }

    private AdminDtos.BacktestStrategyPayload normalizeStrategy(
            AdminDtos.BacktestStrategyPayload strategy,
            String scanInstrumentKey
    ) {
        AdminDtos.BacktestStrategyPayload normalized = backtestStrategyService.normalizeStrategyPayload(strategy);
        AdminDtos.BacktestStrategyPayload aligned = new AdminDtos.BacktestStrategyPayload(
                normalized.strategyName(),
                scanInstrumentKey,
                normalized.underlyingSource(),
                normalized.strategyType(),
                normalized.entryTime(),
                normalized.exitTime(),
                normalized.startDate(),
                normalized.endDate(),
                normalized.legs(),
                normalized.legwiseSettings(),
                normalized.overallSettings(),
                normalized.advancedConditions()
        );
        backtestStrategyService.validateStrategyPayload(aligned);
        return aligned;
    }

    private void validateIntraTradeStrategy(AdminDtos.BacktestStrategyPayload strategy, String mode) {
        boolean optionsOnly = strategy.legs().stream().allMatch(leg -> "OPTIONS".equals(leg.segment()));
        if (!optionsOnly) {
            throw new ValidationException("Intra Trade currently supports option legs only");
        }
        if (!"BACKTEST".equals(mode) && !"INTRADAY".equals(strategy.strategyType())) {
            throw new ValidationException("Live and paper modes currently support INTRADAY strategies only");
        }
    }

    private void ensureNoDuplicateLiveRuntime(
            String tenantId,
            String username,
            String mode,
            Long strategyId
    ) {
        if (!"LIVE".equals(mode) || strategyId == null) {
            return;
        }
        boolean hasActiveRuntime = intraRuntimeStrategyRepository
                .existsByTenantIdAndUsernameAndStrategyIdAndModeAndStatusIn(
                        tenantId,
                        username,
                        strategyId,
                        mode,
                        ACTIVE_LIVE_STATUSES
                );
        if (hasActiveRuntime) {
            throw new ValidationException("Live strategy is already running. Resume or exit the active runtime first.");
        }
    }

    private boolean containsEarlyExit(List<String> notes) {
        return notes.stream().anyMatch(note -> {
            String normalized = note.toLowerCase();
            return normalized.contains("stop loss hit")
                    || normalized.contains("target hit")
                    || normalized.contains("trailing stop loss hit")
                    || normalized.contains("advance exit condition hit");
        });
    }

    private AdminDtos.BacktestRunResponse appendContextNote(
            AdminDtos.BacktestRunResponse result,
            String note
    ) {
        List<String> notes = new ArrayList<>();
        notes.add(note);
        notes.addAll(result.notes());
        return new AdminDtos.BacktestRunResponse(
                result.strategy(),
                result.rows(),
                result.totalPnl(),
                result.averagePnl(),
                result.executedTrades(),
                result.winTrades(),
                result.lossTrades(),
                result.syncedInstruments(),
                result.syncedCandles(),
                result.realWorldAccuracyPct(),
                result.marketPricedTrades(),
                result.fallbackPricedTrades(),
                List.copyOf(notes)
        );
    }

    private AdminDtos.BacktestRunResponse emptyResult(
            AdminDtos.BacktestStrategyPayload strategy,
            List<String> notes
    ) {
        return new AdminDtos.BacktestRunResponse(
                strategy,
                List.of(),
                BigDecimal.ZERO.setScale(2),
                BigDecimal.ZERO.setScale(2),
                0,
                0,
                0,
                0,
                0,
                BigDecimal.ZERO.setScale(2),
                0,
                0,
                List.copyOf(notes)
        );
    }

    private String normalizeMode(String rawMode) {
        String normalized = requireText(rawMode, "mode").toUpperCase();
        if (!ALLOWED_MODES.contains(normalized)) {
            throw new ValidationException("mode must be LIVE, PAPER, or BACKTEST");
        }
        return normalized;
    }

    private String normalizeScanTimeframeUnit(String rawUnit, String mode) {
        String normalized = requireText(rawUnit, "scanTimeframeUnit").toLowerCase();
        if (!"minutes".equals(normalized) && !"days".equals(normalized) && !"weeks".equals(normalized) && !"months".equals(normalized)) {
            throw new ValidationException("scanTimeframeUnit is unsupported");
        }
        if (!"BACKTEST".equals(mode) && !"minutes".equals(normalized)) {
            throw new ValidationException("Live and paper scans currently support minute timeframes only");
        }
        return normalized;
    }

    private Integer normalizeScanTimeframeInterval(Integer interval, String unit, String mode) {
        if (interval == null || interval < 1 || interval > 1440) {
            throw new ValidationException("scanTimeframeInterval must be between 1 and 1440");
        }
        if (!"BACKTEST".equals(mode) && "minutes".equals(unit) && !LIVE_SCAN_INTERVALS.contains(interval)) {
            throw new ValidationException("Live and paper scans support 1, 5, 15, 30, or 60 minute intervals");
        }
        return interval;
    }

    private String requireUsername(String username) {
        return requireText(username, "username");
    }

    private IntraTradeExecutionEntity loadExecution(String tenantId, Long executionId, String username) {
        String normalizedUsername = requireUsername(username);
        IntraTradeExecutionEntity entity = intraTradeExecutionRepository.findByIdAndTenantId(executionId, tenantId)
                .orElseThrow(() -> new ValidationException("Intra Trade execution was not found"));
        if (!normalizedUsername.equals(entity.getUsername())) {
            throw new ValidationException("Execution belongs to another user");
        }
        return entity;
    }

    private String requireText(String value, String fieldName) {
        if (!StringUtils.hasText(value)) {
            throw new ValidationException(fieldName + " is required");
        }
        return value.trim();
    }

    private record ExecutionSnapshot(
            String status,
            String statusMessage,
            Instant evaluatedAt,
            AdminDtos.BacktestRunResponse result
    ) {
    }
}
