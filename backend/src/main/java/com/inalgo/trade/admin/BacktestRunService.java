package com.inalgo.trade.admin;

import com.inalgo.trade.entity.CandleEntity;
import com.inalgo.trade.repository.CandleRepository;
import com.inalgo.trade.upstox.UpstoxCandleResponse;
import com.inalgo.trade.upstox.UpstoxClient;
import com.inalgo.trade.upstox.ExpiredInstrumentCatalogService;
import jakarta.validation.ValidationException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Simulates a saved backtest strategy day by day against locally available candle data.
 * When derivative candles are missing, the service falls back to underlying or synthetic pricing and records that in the notes.
 */
@Service
public class BacktestRunService {
    private static final ZoneId MARKET_ZONE = ZoneId.of("Asia/Kolkata");
    private static final DateTimeFormatter EXPIRY_LABEL_FORMAT = DateTimeFormatter.ofPattern("dd-MMM-uuuu");
    private static final BigDecimal SYNTHETIC_TIME_VALUE = new BigDecimal("10");
    private static final long EXECUTION_LOOKUP_WINDOW_SECONDS = 60L * 60L;
    private static final int EXECUTION_CANDLE_INTERVAL_MINUTES = 5;
    private static final Set<Integer> SUPPORTED_EXECUTION_INTERVALS = Set.of(1, 5, 15, 30, 60);

    private final CandleRepository candleRepository;
    private final UpstoxClient upstoxClient;
    private final ExpiredInstrumentCatalogService expiredInstrumentCatalogService;
    private final BacktestConditionService backtestConditionService;
    private final BacktestStrategyService backtestStrategyService;
    private final BacktestCandleSyncService backtestCandleSyncService;

    @Autowired
    public BacktestRunService(
            CandleRepository candleRepository,
            UpstoxClient upstoxClient,
            ExpiredInstrumentCatalogService expiredInstrumentCatalogService,
            BacktestConditionService backtestConditionService,
            BacktestStrategyService backtestStrategyService,
            BacktestCandleSyncService backtestCandleSyncService
    ) {
        this.candleRepository = candleRepository;
        this.upstoxClient = upstoxClient;
        this.expiredInstrumentCatalogService = expiredInstrumentCatalogService;
        this.backtestConditionService = backtestConditionService;
        this.backtestStrategyService = backtestStrategyService;
        this.backtestCandleSyncService = backtestCandleSyncService;
    }

    BacktestRunService(
            CandleRepository candleRepository,
            UpstoxClient upstoxClient,
            ExpiredInstrumentCatalogService expiredInstrumentCatalogService,
            BacktestConditionService backtestConditionService,
            BacktestStrategyService backtestStrategyService,
            PlatformTransactionManager transactionManager
    ) {
        this(
                candleRepository,
                upstoxClient,
                expiredInstrumentCatalogService,
                backtestConditionService,
                backtestStrategyService,
                new BacktestCandleSyncService(candleRepository, upstoxClient, transactionManager)
        );
    }

    public AdminDtos.BacktestRunResponse runBacktest(String tenantId, AdminDtos.BacktestRunRequest request) {
        return runBacktest(tenantId, request, EXECUTION_CANDLE_INTERVAL_MINUTES);
    }

    public AdminDtos.BacktestRunResponse runBacktest(String tenantId, AdminDtos.BacktestRunRequest request, int executionIntervalMinutes) {
        if (!SUPPORTED_EXECUTION_INTERVALS.contains(executionIntervalMinutes)) {
            throw new ValidationException("executionIntervalMinutes must be one of 1, 5, 15, 30, 60");
        }
        String normalizedUsername = request.username() == null ? "" : request.username().trim();
        if (normalizedUsername.isEmpty()) {
            throw new ValidationException("username is required");
        }
        AdminDtos.BacktestStrategyPayload strategy = backtestStrategyService.normalizeStrategyPayload(request.strategy());
        backtestStrategyService.validateStrategyPayload(strategy);
        BacktestConditionService.EvaluationContext conditionContext = backtestConditionService.prepareEvaluationContext(
                tenantId,
                strategy
        );
        Map<String, BacktestConditionService.EvaluationContext> legConditionContexts = new HashMap<>();
        for (AdminDtos.BacktestLegPayload leg : strategy.legs()) {
            legConditionContexts.put(
                    leg.id(),
                    backtestConditionService.prepareEvaluationContext(
                            tenantId,
                            strategy.underlyingKey(),
                            strategy.startDate(),
                            strategy.endDate(),
                            leg.legConditions()
                    )
            );
        }

        RunContext context = new RunContext();
        ensureHistoricalRangeAvailable(
                context,
                tenantId,
                strategy.underlyingKey(),
                strategy.startDate().minusDays(2),
                strategy.endDate().plusDays(2),
                false,
                executionIntervalMinutes
        );

        List<AdminDtos.BacktestResultRow> rows = new ArrayList<>();
        AccuracyStats accuracyStats = new AccuracyStats();

        for (LocalDate tradeDate = strategy.startDate(); !tradeDate.isAfter(strategy.endDate()); tradeDate = tradeDate.plusDays(1)) {
            if (tradeDate.getDayOfWeek() == DayOfWeek.SATURDAY || tradeDate.getDayOfWeek() == DayOfWeek.SUNDAY) {
                continue;
            }

            LocalDate plannedExitDate = determineExitDate(strategy, tradeDate);
            Instant scheduledEntryTs = toMarketInstant(tradeDate, strategy.entryTime());
            Instant plannedExitTs = toMarketInstant(plannedExitDate, strategy.exitTime());
            if (!plannedExitTs.isAfter(scheduledEntryTs)) {
                plannedExitTs = scheduledEntryTs.plusSeconds(60);
            }

            Instant seriesFrom = scheduledEntryTs.minusSeconds(EXECUTION_LOOKUP_WINDOW_SECONDS);
            Instant seriesToExclusive = plannedExitTs.plusSeconds(EXECUTION_LOOKUP_WINDOW_SECONDS + 1);
            List<CandleEntity> underlyingSeries = loadCandleSeries(
                    tenantId,
                    strategy.underlyingKey(),
                    seriesFrom,
                    seriesToExclusive,
                    executionIntervalMinutes
            );

            // Resolve the actual intraday entry timestamp: first candle where all entry conditions
            // are met at or after the scheduled entry time. For basic mode (no conditions) this
            // returns scheduledEntryTs immediately. For advanced conditions it scans candles.
            Instant entryTs = resolveIntradayEntryTs(conditionContext, tradeDate, underlyingSeries, scheduledEntryTs, plannedExitTs);
            if (entryTs == null) {
                context.notes.add("Skipped " + tradeDate + " because intraday entry conditions were never met before exit time");
                continue;
            }

            PriceResolution underlyingEntry = resolveTradePriceNearTimestamp(underlyingSeries, entryTs, true);
            PriceResolution underlyingPlannedExit = resolveTradePriceNearTimestamp(underlyingSeries, plannedExitTs, false);
            if (underlyingEntry.price() == null || underlyingPlannedExit.price() == null) {
                context.notes.add("Skipped " + tradeDate + " due to missing underlying candles for " + strategy.underlyingKey());
                continue;
            }

            TradeContext tradeContext = new TradeContext(seriesFrom, seriesToExclusive);
            List<PreparedLeg> preparedLegs = new ArrayList<>();
            for (AdminDtos.BacktestLegPayload leg : strategy.legs()) {
                BacktestConditionService.EvaluationContext legConditionContext = legConditionContexts.get(leg.id());
                if (!evaluateLegEntryAtTimestamp(legConditionContext, tradeDate, underlyingSeries, entryTs)) {
                    context.notes.add("Skipped " + leg.id() + " on " + tradeDate + " because leg entry conditions were not met");
                    continue;
                }
                preparedLegs.add(prepareLeg(
                        context,
                        tradeContext,
                        tenantId,
                        strategy,
                        leg,
                        tradeDate,
                        entryTs,
                        underlyingEntry.price(),
                        executionIntervalMinutes
                ));
            }
            if (preparedLegs.isEmpty()) {
                context.notes.add("Skipped " + tradeDate + " because no legs met their entry conditions");
                continue;
            }

            ExitDecision exitDecision = resolveExitDecision(
                    conditionContext,
                    strategy.overallSettings(),
                    underlyingSeries,
                    preparedLegs,
                    entryTs,
                    plannedExitTs
            );
            Instant finalExitTs = exitDecision.exitTs();
            List<PreparedLegExit> preparedLegExits = resolveLegExitPlans(
                    legConditionContexts,
                    underlyingSeries,
                    preparedLegs,
                    tradeDate,
                    entryTs,
                    finalExitTs
            );
            Instant rowExitTs = preparedLegExits.stream()
                    .map(PreparedLegExit::exitTs)
                    .max(Instant::compareTo)
                    .orElse(finalExitTs);
            PriceResolution underlyingFinalExit = resolveTradePriceNearTimestamp(underlyingSeries, rowExitTs, false);
            BigDecimal underlyingExitPrice = underlyingFinalExit.price() == null
                    ? underlyingPlannedExit.price()
                    : underlyingFinalExit.price();

            List<AdminDtos.BacktestLegResult> legResults = new ArrayList<>();
            BigDecimal rowPnl = BigDecimal.ZERO;
            LocalDate rowExpiryDate = null;
            boolean allTradePricingFromMarket = true;

            allTradePricingFromMarket &= underlyingEntry.fromMarket();
            allTradePricingFromMarket &= underlyingFinalExit.fromMarket();
            accuracyStats.capturePoint(underlyingEntry.fromMarket());
            accuracyStats.capturePoint(underlyingFinalExit.fromMarket());

            boolean allLegsExitedByLegCondition = !preparedLegExits.isEmpty();
            for (PreparedLegExit preparedLegExit : preparedLegExits) {
                PreparedLeg preparedLeg = preparedLegExit.leg();
                Instant legExitTs = preparedLegExit.exitTs();
                if (preparedLegExit.reason() != ExitReason.LEG_EXIT_CONDITION) {
                    allLegsExitedByLegCondition = false;
                }
                if (preparedLeg.expiryDate() != null) {
                    Instant expiryCutoffTs = toMarketInstant(preparedLeg.expiryDate(), strategy.exitTime());
                    if (legExitTs.isAfter(expiryCutoffTs)) {
                        legExitTs = expiryCutoffTs;
                        context.notes.add(
                                "Capped " + preparedLeg.legLabel()
                                        + " exit to contract expiry " + preparedLeg.expiryDate()
                        );
                    }
                }

                PriceResolution legUnderlyingExit = resolveTradePriceNearTimestamp(underlyingSeries, legExitTs, false);
                BigDecimal legUnderlyingExitPrice = legUnderlyingExit.price() == null
                        ? underlyingExitPrice
                        : legUnderlyingExit.price();
                PriceResolution legExit = resolveLegExitPrice(preparedLeg, legExitTs, legUnderlyingExitPrice);
                BigDecimal pnl = legExit.price()
                        .subtract(preparedLeg.entryPrice())
                        .multiply(preparedLeg.sign())
                        .multiply(preparedLeg.multiplier());
                rowPnl = rowPnl.add(pnl);

                if (preparedLeg.expiryDate() != null && rowExpiryDate == null) {
                    rowExpiryDate = preparedLeg.expiryDate();
                }

                allTradePricingFromMarket &= preparedLeg.entryFromMarket();
                allTradePricingFromMarket &= legExit.fromMarket();
                accuracyStats.capturePoint(preparedLeg.entryFromMarket());
                accuracyStats.capturePoint(legExit.fromMarket());

                if (!legExit.fromMarket() && !preparedLeg.series().isEmpty()) {
                    if (preparedLeg.optionLeg()) {
                        context.notes.add("Used partial synthetic option pricing fallback on " + tradeDate + " for " + preparedLeg.optionType());
                    } else {
                        context.notes.add("Used partial underlying fallback for futures leg on " + tradeDate + " because contract candles were missing");
                    }
                }
                if (preparedLegExit.reason() == ExitReason.LEG_EXIT_CONDITION) {
                    context.notes.add(
                            preparedLeg.legLabel()
                                    + " leg exit condition hit on " + tradeDate
                                    + " at " + formatInMarketTime(legExitTs)
                    );
                }

                legResults.add(new AdminDtos.BacktestLegResult(
                        preparedLeg.leg().id(),
                        preparedLeg.legLabel(),
                        preparedLeg.instrumentKey(),
                        preparedLeg.expiryDate(),
                        preparedLeg.strikePrice(),
                        preparedLeg.lotSize(),
                        preparedLeg.leg().lots(),
                        scalePrice(preparedLeg.entryPrice()),
                        scalePrice(legExit.price()),
                        scalePrice(pnl)
                ));
            }

            if (allTradePricingFromMarket) {
                accuracyStats.marketOnlyTrades += 1;
            } else {
                accuracyStats.fallbackPricedTrades += 1;
            }

            if (allLegsExitedByLegCondition && rowExitTs.isBefore(finalExitTs)) {
                context.notes.add("Advance exit condition hit on " + tradeDate + " at " + formatInMarketTime(rowExitTs));
            }
            if (exitDecision.reason() != ExitReason.SCHEDULED && !rowExitTs.isBefore(finalExitTs)) {
                context.notes.add(exitDecision.reason().label() + " hit on " + tradeDate + " at " + formatInMarketTime(finalExitTs));
            }

            String legsSummary = legResults.stream()
                    .map(legResult -> legResult.legLabel() + ": " + legResult.pnlAmount())
                    .reduce((left, right) -> left + " | " + right)
                    .orElse("-");
            rows.add(new AdminDtos.BacktestResultRow(
                    tradeDate,
                    LocalDateTime.ofInstant(rowExitTs, MARKET_ZONE).toLocalDate(),
                    rowExpiryDate == null ? "-" : rowExpiryDate.format(EXPIRY_LABEL_FORMAT),
                    entryTs,
                    findCandleTsNearTimestamp(underlyingSeries, rowExitTs, false),
                    scalePrice(underlyingEntry.price()),
                    scalePrice(underlyingExitPrice),
                    scalePrice(rowPnl),
                    legsSummary,
                    legResults
            ));
        }

        BigDecimal totalPnl = rows.stream()
                .map(AdminDtos.BacktestResultRow::pnlAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        int winTrades = (int) rows.stream().filter(row -> row.pnlAmount().compareTo(BigDecimal.ZERO) > 0).count();
        int lossTrades = (int) rows.stream().filter(row -> row.pnlAmount().compareTo(BigDecimal.ZERO) < 0).count();
        BigDecimal averagePnl = rows.isEmpty()
                ? BigDecimal.ZERO
                : totalPnl.divide(BigDecimal.valueOf(rows.size()), 2, RoundingMode.HALF_UP);

        BigDecimal realWorldAccuracy = accuracyStats.totalPricingPoints == 0
                ? BigDecimal.ZERO
                : BigDecimal.valueOf(accuracyStats.marketPricingPoints)
                .multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(accuracyStats.totalPricingPoints), 2, RoundingMode.HALF_UP);

        context.notes.add(
                "Real-world pricing accuracy " + scalePrice(realWorldAccuracy)
                        + "% (market-priced points " + accuracyStats.marketPricingPoints
                        + "/" + accuracyStats.totalPricingPoints + ")"
        );

        return new AdminDtos.BacktestRunResponse(
                strategy,
                rows,
                scalePrice(totalPnl),
                scalePrice(averagePnl),
                rows.size(),
                winTrades,
                lossTrades,
                context.syncedInstruments.size(),
                context.syncedCandles,
                scalePrice(realWorldAccuracy),
                accuracyStats.marketOnlyTrades,
                accuracyStats.fallbackPricedTrades,
                List.copyOf(context.notes)
        );
    }

    private List<PreparedLegExit> resolveLegExitPlans(
            Map<String, BacktestConditionService.EvaluationContext> legConditionContexts,
            List<CandleEntity> underlyingSeries,
            List<PreparedLeg> preparedLegs,
            LocalDate tradeDate,
            Instant entryTs,
            Instant finalExitTs
    ) {
        List<PreparedLegExit> legExits = new ArrayList<>();
        for (PreparedLeg preparedLeg : preparedLegs) {
            Instant legExitTs = resolveLegConditionExitTimestamp(
                    legConditionContexts.get(preparedLeg.leg().id()),
                    underlyingSeries,
                    tradeDate,
                    entryTs,
                    finalExitTs
            );
            if (legExitTs != null && legExitTs.isBefore(finalExitTs)) {
                legExits.add(new PreparedLegExit(preparedLeg, legExitTs, ExitReason.LEG_EXIT_CONDITION));
            } else {
                legExits.add(new PreparedLegExit(preparedLeg, finalExitTs, ExitReason.SCHEDULED));
            }
        }
        return legExits;
    }

    private Instant resolveLegConditionExitTimestamp(
            BacktestConditionService.EvaluationContext legConditionContext,
            List<CandleEntity> underlyingSeries,
            LocalDate tradeDate,
            Instant entryTs,
            Instant finalExitTs
    ) {
        if (legConditionContext == null || !legConditionContext.enabled()) {
            return null;
        }
        BigDecimal prevClose = findPriceAtOrBefore(underlyingSeries, entryTs, null);
        for (CandleEntity candle : underlyingSeries) {
            Instant ts = candle.getCandleTs();
            if (!ts.isAfter(entryTs)) {
                prevClose = candle.getClosePrice();
                continue;
            }
            if (ts.isAfter(finalExitTs)) break;
            if (backtestConditionService.evaluateIntradayExit(legConditionContext, tradeDate, candle.getClosePrice(), prevClose)) {
                return ts;
            }
            prevClose = candle.getClosePrice();
        }
        return null;
    }

    private PreparedLeg prepareLeg(
            RunContext context,
            TradeContext tradeContext,
            String tenantId,
            AdminDtos.BacktestStrategyPayload strategy,
            AdminDtos.BacktestLegPayload leg,
            LocalDate tradeDate,
            Instant entryTs,
            BigDecimal underlyingEntryPrice,
            int executionIntervalMinutes
    ) {
        // Every leg shares the same underlying entry timestamp, but contract resolution differs for futures vs options.
        if ("FUTURES".equals(leg.segment())) {
            return prepareFutureLeg(
                    context,
                    tradeContext,
                    tenantId,
                    strategy.underlyingKey(),
                    leg,
                    tradeDate,
                    entryTs,
                    underlyingEntryPrice,
                    executionIntervalMinutes
            );
        }
        return prepareOptionLeg(
                context,
                tradeContext,
                tenantId,
                strategy.underlyingKey(),
                leg,
                tradeDate,
                entryTs,
                underlyingEntryPrice,
                executionIntervalMinutes
        );
    }

    private PreparedLeg prepareFutureLeg(
            RunContext context,
            TradeContext tradeContext,
            String tenantId,
            String underlyingKey,
            AdminDtos.BacktestLegPayload leg,
            LocalDate tradeDate,
            Instant entryTs,
            BigDecimal underlyingEntryPrice,
            int executionIntervalMinutes
    ) {
        Optional<UpstoxClient.ExpiredDerivativeContractView> maybeContract = resolveFutureContract(
                context,
                tenantId,
                underlyingKey,
                tradeDate,
                leg.expiryType()
        );

        String instrumentKey = maybeContract.map(UpstoxClient.ExpiredDerivativeContractView::instrumentKey).orElse(underlyingKey);
        LocalDate expiryDate = maybeContract.map(UpstoxClient.ExpiredDerivativeContractView::expiry).orElse(null);
        Integer lotSize = maybeContract.map(UpstoxClient.ExpiredDerivativeContractView::lotSize).orElse(1);

        List<CandleEntity> series = List.of();
        if (maybeContract.isPresent()) {
            ensureHistoricalRangeAvailable(
                    context,
                    tenantId,
                    instrumentKey,
                    tradeDate.minusDays(3),
                    tradeDate.plusDays(2),
                    true,
                    executionIntervalMinutes
            );
            series = loadCandleSeries(tenantId, instrumentKey, tradeContext.seriesFrom(), tradeContext.seriesToExclusive(), executionIntervalMinutes);
        }

        PriceResolution entryResolution = resolveTradePriceNearTimestamp(series, entryTs, true);
        BigDecimal entryPrice = entryResolution.price() == null ? underlyingEntryPrice : entryResolution.price();
        boolean entryFromMarket = entryResolution.price() != null && entryResolution.fromMarket();

        if (maybeContract.isPresent() && entryResolution.price() == null) {
            context.notes.add("Used underlying fallback for futures leg entry on " + tradeDate + " because contract candles were missing");
        }
        if (maybeContract.isEmpty()) {
            context.notes.add("No expired futures contract found for " + tradeDate + " on " + underlyingKey + "; used underlying");
        }

        BigDecimal sign = "BUY".equals(leg.position()) ? BigDecimal.ONE : BigDecimal.ONE.negate();
        BigDecimal multiplier = BigDecimal.valueOf((long) lotSize * leg.lots());
        String label = "FUT " + leg.position();

        return new PreparedLeg(
                leg,
                label,
                instrumentKey,
                expiryDate,
                null,
                lotSize,
                entryPrice,
                entryFromMarket,
                sign,
                multiplier,
                "",
                false,
                series
        );
    }

    private PreparedLeg prepareOptionLeg(
            RunContext context,
            TradeContext tradeContext,
            String tenantId,
            String underlyingKey,
            AdminDtos.BacktestLegPayload leg,
            LocalDate tradeDate,
            Instant entryTs,
            BigDecimal underlyingEntryPrice,
            int executionIntervalMinutes
    ) {
        Optional<UpstoxClient.ExpiredDerivativeContractView> maybeContract = resolveOptionContract(
                context,
                tenantId,
                underlyingKey,
                tradeDate,
                leg,
                underlyingEntryPrice
        );

        String optionType = normalizeOptionType(leg.optionType());
        String instrumentKey = maybeContract.map(UpstoxClient.ExpiredDerivativeContractView::instrumentKey).orElse(underlyingKey);
        LocalDate expiryDate = maybeContract.map(UpstoxClient.ExpiredDerivativeContractView::expiry).orElse(null);
        BigDecimal strikePrice = maybeContract.map(UpstoxClient.ExpiredDerivativeContractView::strikePrice).orElse(underlyingEntryPrice);
        Integer lotSize = maybeContract.map(UpstoxClient.ExpiredDerivativeContractView::lotSize).orElse(1);
        boolean useExpiredContractHistory = expiryDate != null && expiryDate.isBefore(LocalDate.now(MARKET_ZONE));

        List<CandleEntity> series = List.of();
        if (maybeContract.isPresent()) {
            ensureHistoricalRangeAvailable(
                    context,
                    tenantId,
                    instrumentKey,
                    tradeDate.minusDays(3),
                    tradeDate.plusDays(2),
                    useExpiredContractHistory,
                    executionIntervalMinutes
            );
            series = loadCandleSeries(tenantId, instrumentKey, tradeContext.seriesFrom(), tradeContext.seriesToExclusive(), executionIntervalMinutes);
        }

        PriceResolution entryResolution = resolveTradePriceNearTimestamp(series, entryTs, true);
        BigDecimal entryPrice = entryResolution.price() == null
                ? syntheticOptionPrice(optionType, strikePrice, underlyingEntryPrice)
                : entryResolution.price();
        boolean entryFromMarket = entryResolution.price() != null && entryResolution.fromMarket();

        if (maybeContract.isPresent() && entryResolution.price() == null) {
            context.notes.add("Used partial synthetic option pricing fallback on " + tradeDate + " for " + optionType);
        }
        if (maybeContract.isEmpty()) {
            context.notes.add("No expired option contract found for " + tradeDate + " on " + underlyingKey + "; used synthetic option pricing");
        }

        BigDecimal sign = "BUY".equals(leg.position()) ? BigDecimal.ONE : BigDecimal.ONE.negate();
        BigDecimal multiplier = BigDecimal.valueOf((long) lotSize * leg.lots());
        String label = optionType + " " + leg.strikeType() + " " + leg.position();

        return new PreparedLeg(
                leg,
                label,
                instrumentKey,
                expiryDate,
                strikePrice,
                lotSize,
                entryPrice,
                entryFromMarket,
                sign,
                multiplier,
                optionType,
                true,
                series
        );
    }

    private ExitDecision resolveExitDecision(
            BacktestConditionService.EvaluationContext conditionContext,
            AdminDtos.BacktestOverallSettingsPayload overallSettings,
            List<CandleEntity> underlyingSeries,
            List<PreparedLeg> preparedLegs,
            Instant entryTs,
            Instant plannedExitTs
    ) {
        BigDecimal stopLoss = enabledThreshold(overallSettings.stopLossEnabled(), overallSettings.stopLossValue());
        BigDecimal target = enabledThreshold(overallSettings.targetEnabled(), overallSettings.targetValue());
        BigDecimal trailingStopLoss = enabledThreshold(overallSettings.trailingEnabled(), overallSettings.trailingTrigger());

        List<CandleEntity> checkpointCandles = underlyingSeries.stream()
                .filter(c -> c.getCandleTs().isAfter(entryTs) && !c.getCandleTs().isAfter(plannedExitTs))
                .toList();

        BigDecimal peakPnl = BigDecimal.ZERO;
        // Track the previous underlying price for intraday CROSSES condition evaluation
        BigDecimal prevUnderlyingPrice = findPriceAtOrBefore(underlyingSeries, entryTs, null);

        for (CandleEntity checkpointCandle : checkpointCandles) {
            Instant checkpoint = checkpointCandle.getCandleTs();
            BigDecimal underlyingPrice = checkpointCandle.getClosePrice();
            BigDecimal pnl = BigDecimal.ZERO;
            for (PreparedLeg preparedLeg : preparedLegs) {
                PriceResolution mark = resolveLegMarkPrice(preparedLeg, checkpoint, underlyingPrice);
                pnl = pnl.add(mark.price().subtract(preparedLeg.entryPrice())
                        .multiply(preparedLeg.sign())
                        .multiply(preparedLeg.multiplier()));
            }

            if (trailingStopLoss != null && pnl.compareTo(peakPnl) > 0) {
                peakPnl = pnl;
            }
            if (stopLoss != null && pnl.compareTo(stopLoss.negate()) <= 0) {
                return new ExitDecision(checkpoint, ExitReason.STOP_LOSS);
            }
            if (target != null && pnl.compareTo(target) >= 0) {
                return new ExitDecision(checkpoint, ExitReason.TARGET);
            }
            if (trailingStopLoss != null && peakPnl.compareTo(BigDecimal.ZERO) > 0) {
                BigDecimal trailingFloor = peakPnl.subtract(trailingStopLoss);
                if (pnl.compareTo(trailingFloor) <= 0) {
                    return new ExitDecision(checkpoint, ExitReason.TRAILING_STOP_LOSS);
                }
            }
            LocalDate evaluationDate = LocalDateTime.ofInstant(checkpoint, MARKET_ZONE).toLocalDate();
            if (backtestConditionService.evaluateIntradayExit(conditionContext, evaluationDate, underlyingPrice, prevUnderlyingPrice)) {
                return new ExitDecision(checkpoint, ExitReason.EXIT_CONDITION);
            }
            prevUnderlyingPrice = underlyingPrice;
        }

        return new ExitDecision(plannedExitTs, ExitReason.SCHEDULED);
    }

    private PriceResolution resolveLegExitPrice(PreparedLeg leg, Instant exitTs, BigDecimal underlyingExitPrice) {
        return resolveLegMarkPrice(leg, exitTs, underlyingExitPrice);
    }

    /**
     * Uses nearby derivative candles for mark-to-market first, then falls back to synthetic or underlying prices.
     */
    private PriceResolution resolveLegMarkPrice(PreparedLeg leg, Instant markTs, BigDecimal underlyingPrice) {
        BigDecimal market = findPriceAtOrBefore(
                leg.series(),
                markTs,
                markTs.minusSeconds(EXECUTION_LOOKUP_WINDOW_SECONDS)
        );
        if (market == null) {
            market = findPriceAtOrAfter(
                    leg.series(),
                    markTs,
                    markTs.plusSeconds(EXECUTION_LOOKUP_WINDOW_SECONDS)
            );
        }
        if (market != null) {
            return new PriceResolution(market, true);
        }
        if (leg.optionLeg()) {
            return new PriceResolution(
                    syntheticOptionPrice(leg.optionType(), leg.strikePrice(), underlyingPrice),
                    false
            );
        }
        return new PriceResolution(underlyingPrice, false);
    }

    private BigDecimal enabledThreshold(Boolean enabled, BigDecimal value) {
        if (!Boolean.TRUE.equals(enabled) || value == null) {
            return null;
        }
        if (value.compareTo(BigDecimal.ZERO) <= 0) {
            return null;
        }
        return value;
    }

    /**
     * Entry pricing prefers the first candle after the requested time, while exit pricing prefers the last candle before it.
     * If only the opposite side exists inside the lookup window, that price is still returned but flagged as non-market.
     */
    private PriceResolution resolveTradePriceNearTimestamp(List<CandleEntity> series, Instant targetTs, boolean entrySide) {
        if (series == null || series.isEmpty()) {
            return new PriceResolution(null, false);
        }
        Instant minTs = targetTs.minusSeconds(EXECUTION_LOOKUP_WINDOW_SECONDS);
        Instant maxTs = targetTs.plusSeconds(EXECUTION_LOOKUP_WINDOW_SECONDS);

        BigDecimal preferred = entrySide
                ? findPriceAtOrAfter(series, targetTs, maxTs)
                : findPriceAtOrBefore(series, targetTs, minTs);
        if (preferred != null) {
            return new PriceResolution(preferred, true);
        }

        BigDecimal oppositeSide = entrySide
                ? findPriceAtOrBefore(series, targetTs, minTs)
                : findPriceAtOrAfter(series, targetTs, maxTs);
        if (oppositeSide != null) {
            return new PriceResolution(oppositeSide, false);
        }

        return new PriceResolution(null, false);
    }

    /**
     * Scans intraday candles starting at scheduledEntryTs and returns the timestamp of the first
     * candle where all advanced entry conditions are satisfied using the actual candle close price.
     * For basic mode (no entry conditions configured), returns scheduledEntryTs immediately.
     * Returns null if conditions are enabled but never met before plannedExitTs.
     */
    private Instant resolveIntradayEntryTs(
            BacktestConditionService.EvaluationContext conditionContext,
            LocalDate tradeDate,
            List<CandleEntity> underlyingSeries,
            Instant scheduledEntryTs,
            Instant plannedExitTs
    ) {
        if (!conditionContext.enabled() || conditionContext.conditions().entry() == null) {
            return scheduledEntryTs;
        }
        // Seed prevCandleClose from the last candle before the scheduled entry window
        BigDecimal prevClose = findPriceAtOrBefore(underlyingSeries, scheduledEntryTs, null);
        for (CandleEntity candle : underlyingSeries) {
            Instant ts = candle.getCandleTs();
            if (ts.isBefore(scheduledEntryTs)) {
                prevClose = candle.getClosePrice();
                continue;
            }
            if (ts.isAfter(plannedExitTs)) break;
            if (backtestConditionService.evaluateIntradayEntry(conditionContext, tradeDate, candle.getClosePrice(), prevClose)) {
                return ts;
            }
            prevClose = candle.getClosePrice();
        }
        return null; // conditions never met intraday
    }

    /**
     * Finds the actual candle timestamp nearest to targetTs using the same preference rules as
     * resolveTradePriceNearTimestamp (entry: first at-or-after; exit: last at-or-before).
     * Falls back to targetTs when no candle is found within the lookup window.
     */
    private Instant findCandleTsNearTimestamp(List<CandleEntity> series, Instant targetTs, boolean entrySide) {
        if (series == null || series.isEmpty()) {
            return targetTs;
        }
        Instant minTs = targetTs.minusSeconds(EXECUTION_LOOKUP_WINDOW_SECONDS);
        Instant maxTs = targetTs.plusSeconds(EXECUTION_LOOKUP_WINDOW_SECONDS);
        if (entrySide) {
            for (CandleEntity candle : series) {
                Instant ts = candle.getCandleTs();
                if (!ts.isBefore(targetTs) && !ts.isAfter(maxTs)) {
                    return ts;
                }
            }
            for (int i = series.size() - 1; i >= 0; i--) {
                Instant ts = series.get(i).getCandleTs();
                if (!ts.isAfter(targetTs) && !ts.isBefore(minTs)) {
                    return ts;
                }
            }
        } else {
            for (int i = series.size() - 1; i >= 0; i--) {
                Instant ts = series.get(i).getCandleTs();
                if (!ts.isAfter(targetTs) && !ts.isBefore(minTs)) {
                    return ts;
                }
            }
            for (CandleEntity candle : series) {
                Instant ts = candle.getCandleTs();
                if (!ts.isBefore(targetTs) && !ts.isAfter(maxTs)) {
                    return ts;
                }
            }
        }
        return targetTs;
    }

    private BigDecimal findPriceAtOrAfter(List<CandleEntity> series, Instant fromTs, Instant maxTs) {
        for (CandleEntity candle : series) {
            Instant candleTs = candle.getCandleTs();
            if (candleTs.isBefore(fromTs)) {
                continue;
            }
            if (maxTs != null && candleTs.isAfter(maxTs)) {
                break;
            }
            return candle.getClosePrice();
        }
        return null;
    }

    private BigDecimal findPriceAtOrBefore(List<CandleEntity> series, Instant toTs, Instant minTs) {
        for (int i = series.size() - 1; i >= 0; i -= 1) {
            CandleEntity candle = series.get(i);
            Instant candleTs = candle.getCandleTs();
            if (candleTs.isAfter(toTs)) {
                continue;
            }
            if (minTs != null && candleTs.isBefore(minTs)) {
                break;
            }
            return candle.getClosePrice();
        }
        return null;
    }

    private List<CandleEntity> loadCandleSeries(
            String tenantId,
            String instrumentKey,
            Instant from,
            Instant toExclusive,
            int executionIntervalMinutes
    ) {
        if (instrumentKey == null || instrumentKey.isBlank() || !from.isBefore(toExclusive)) {
            return List.of();
        }
        return candleRepository
                .findByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeIntervalAndCandleTsGreaterThanEqualAndCandleTsLessThanOrderByCandleTsAsc(
                        tenantId,
                        instrumentKey,
                        "minutes",
                        executionIntervalMinutes,
                        from,
                        toExclusive
                );
    }

    private boolean evaluateLegEntryAtTimestamp(
            BacktestConditionService.EvaluationContext legConditionContext,
            LocalDate tradeDate,
            List<CandleEntity> underlyingSeries,
            Instant entryTs
    ) {
        if (legConditionContext == null || !legConditionContext.enabled() || legConditionContext.conditions().entry() == null) {
            return true;
        }
        BigDecimal entryClose = findPriceAtOrBefore(underlyingSeries, entryTs, entryTs);
        BigDecimal prevClose = findPriceStrictlyBefore(underlyingSeries, entryTs);
        if (entryClose == null) {
            return false;
        }
        return backtestConditionService.evaluateIntradayEntry(legConditionContext, tradeDate, entryClose, prevClose);
    }

    private BigDecimal findPriceStrictlyBefore(List<CandleEntity> series, Instant beforeTs) {
        for (int i = series.size() - 1; i >= 0; i -= 1) {
            CandleEntity candle = series.get(i);
            if (candle.getCandleTs().isBefore(beforeTs)) {
                return candle.getClosePrice();
            }
        }
        return null;
    }

    private Optional<UpstoxClient.ExpiredDerivativeContractView> resolveFutureContract(
            RunContext context,
            String tenantId,
            String underlyingKey,
            LocalDate tradeDate,
            String expiryType
    ) {
        LocalDate expiryDate = resolveExpiryDate(context, tenantId, underlyingKey, tradeDate, expiryType, false);
        if (expiryDate == null) {
            return Optional.empty();
        }
        Optional<UpstoxClient.ExpiredDerivativeContractView> exactMatch = loadFutureContract(
                context,
                tenantId,
                underlyingKey,
                expiryDate
        );
        if (exactMatch.isPresent()) {
            return exactMatch;
        }

        if ("WEEKLY".equals(expiryType)) {
            LocalDate monthlyExpiry = resolveExpiryDate(context, tenantId, underlyingKey, tradeDate, "MONTHLY", false);
            if (monthlyExpiry != null && !monthlyExpiry.equals(expiryDate)) {
                Optional<UpstoxClient.ExpiredDerivativeContractView> monthlyFallback = loadFutureContract(
                        context,
                        tenantId,
                        underlyingKey,
                        monthlyExpiry
                );
                if (monthlyFallback.isPresent()) {
                    context.notes.add(
                            "Weekly futures contract unavailable on " + tradeDate
                                    + "; used monthly futures expiry " + monthlyExpiry
                    );
                    return monthlyFallback;
                }
            }
        }
        return Optional.empty();
    }

    private Optional<UpstoxClient.ExpiredDerivativeContractView> resolveOptionContract(
            RunContext context,
            String tenantId,
            String underlyingKey,
            LocalDate tradeDate,
            AdminDtos.BacktestLegPayload leg,
            BigDecimal underlyingPrice
    ) {
        LocalDate expiryDate = resolveExpiryDate(context, tenantId, underlyingKey, tradeDate, leg.expiryType(), true);
        if (expiryDate == null) {
            return Optional.empty();
        }
        String cacheKey = underlyingKey + "|" + expiryDate + "|OPT";
        List<UpstoxClient.ExpiredDerivativeContractView> contracts = context.optionContractsByKey.computeIfAbsent(cacheKey, ignored ->
                expiredInstrumentCatalogService.getOptionContracts(tenantId, underlyingKey, expiryDate)
        );
        if (contracts.isEmpty()) {
            return Optional.empty();
        }

        String optionType = normalizeOptionType(leg.optionType());
        List<UpstoxClient.ExpiredDerivativeContractView> typedContracts = contracts.stream()
                .filter(contract -> optionTypeMatches(optionType, contract.optionType(), contract.tradingSymbol()))
                .filter(contract -> contract.strikePrice() != null)
                .sorted(Comparator.comparing(UpstoxClient.ExpiredDerivativeContractView::strikePrice))
                .toList();
        if (typedContracts.isEmpty()) {
            return Optional.empty();
        }

        List<BigDecimal> strikes = typedContracts.stream()
                .map(UpstoxClient.ExpiredDerivativeContractView::strikePrice)
                .distinct()
                .sorted()
                .toList();
        int atmIndex = nearestStrikeIndex(strikes, underlyingPrice);
        int targetIndex = adjustedStrikeIndex(atmIndex, leg, optionType, strikes.size());
        BigDecimal targetStrike = strikes.get(targetIndex);
        return typedContracts.stream()
                .filter(contract -> contract.strikePrice().compareTo(targetStrike) == 0)
                .findFirst();
    }

    private LocalDate resolveExpiryDate(
            RunContext context,
            String tenantId,
            String underlyingKey,
            LocalDate tradeDate,
            String expiryType,
            boolean optionContracts
    ) {
        Map<String, List<LocalDate>> expiryCache = optionContracts
                ? context.optionExpiriesByUnderlying
                : context.futureExpiriesByUnderlying;
        List<LocalDate> expiries = expiryCache.get(underlyingKey);
        boolean needsRefresh = expiries == null
                || expiries.isEmpty()
                || (tradeDate != null && expiries.getLast().isBefore(tradeDate));
        if (needsRefresh) {
            List<LocalDate> fetched = optionContracts
                    ? expiredInstrumentCatalogService.getOptionExpiries(tenantId, underlyingKey, tradeDate)
                    : expiredInstrumentCatalogService.getExpiries(tenantId, underlyingKey, tradeDate);
            expiries = fetched == null ? List.of() : fetched.stream().sorted().toList();
            expiryCache.put(underlyingKey, expiries);
        }
        if (expiries.isEmpty()) {
            return null;
        }

        if ("MONTHLY".equals(expiryType)) {
            Map<YearMonth, LocalDate> monthlyLastExpiry = new HashMap<>();
            for (LocalDate expiry : expiries) {
                YearMonth ym = YearMonth.from(expiry);
                LocalDate existing = monthlyLastExpiry.get(ym);
                if (existing == null || expiry.isAfter(existing)) {
                    monthlyLastExpiry.put(ym, expiry);
                }
            }
            return monthlyLastExpiry.values().stream()
                    .filter(expiry -> !expiry.isBefore(tradeDate))
                    .sorted()
                    .findFirst()
                    .orElse(expiries.get(expiries.size() - 1));
        }

        return expiries.stream()
                .filter(expiry -> !expiry.isBefore(tradeDate))
                .findFirst()
                .orElse(expiries.get(expiries.size() - 1));
    }

    private int nearestStrikeIndex(List<BigDecimal> strikes, BigDecimal spot) {
        int nearest = 0;
        BigDecimal minDiff = strikes.getFirst().subtract(spot).abs();
        for (int i = 1; i < strikes.size(); i += 1) {
            BigDecimal diff = strikes.get(i).subtract(spot).abs();
            if (diff.compareTo(minDiff) < 0) {
                minDiff = diff;
                nearest = i;
            }
        }
        return nearest;
    }

    private int adjustedStrikeIndex(int atmIndex, AdminDtos.BacktestLegPayload leg, String optionType, int strikeCount) {
        int steps = leg.strikeSteps() == null ? 0 : leg.strikeSteps();
        int shift = 0;
        if ("OTM".equals(leg.strikeType())) {
            shift = "CALL".equals(optionType) ? steps : -steps;
        } else if ("ITM".equals(leg.strikeType())) {
            shift = "CALL".equals(optionType) ? -steps : steps;
        }
        int target = atmIndex + shift;
        if (target < 0) {
            return 0;
        }
        if (target >= strikeCount) {
            return strikeCount - 1;
        }
        return target;
    }

    private String normalizeOptionType(String optionType) {
        if (optionType == null) {
            return "CALL";
        }
        String normalized = optionType.trim().toUpperCase();
        return normalized.startsWith("P") ? "PUT" : "CALL";
    }

    private boolean optionTypeMatches(String optionType, String contractOptionType, String tradingSymbol) {
        String source = (contractOptionType == null ? "" : contractOptionType) + " " + (tradingSymbol == null ? "" : tradingSymbol);
        String normalized = source.toUpperCase();
        if ("CALL".equals(optionType)) {
            return normalized.contains("CALL") || normalized.contains("CE");
        }
        return normalized.contains("PUT") || normalized.contains("PE");
    }

    private BigDecimal syntheticOptionPrice(String optionType, BigDecimal strikePrice, BigDecimal underlyingPrice) {
        BigDecimal intrinsic = "CALL".equals(optionType)
                ? underlyingPrice.subtract(strikePrice).max(BigDecimal.ZERO)
                : strikePrice.subtract(underlyingPrice).max(BigDecimal.ZERO);
        return intrinsic.add(SYNTHETIC_TIME_VALUE);
    }

    /**
     * Preloads the instrument/date range only once per backtest run so repeated legs do not trigger duplicate sync work.
     */
    private void ensureHistoricalRangeAvailable(
            RunContext context,
            String tenantId,
            String instrumentKey,
            LocalDate fromDate,
            LocalDate toDate,
            boolean expiredContract,
            int executionIntervalMinutes
    ) {
        if (instrumentKey == null || instrumentKey.isBlank()) {
            return;
        }
        if (fromDate.isAfter(toDate)) {
            return;
        }
        String syncKey = (expiredContract ? "EXP|" : "ACT|") + instrumentKey + "|" + fromDate + "|" + toDate;
        if (!context.syncKeys.add(syncKey)) {
            return;
        }

        try {
            int persisted = backtestCandleSyncService.syncRange(
                    tenantId,
                    instrumentKey,
                    fromDate,
                    toDate,
                    expiredContract,
                    executionIntervalMinutes
            );
            if (persisted > 0) {
                context.syncedInstruments.add(instrumentKey);
                context.syncedCandles += persisted;
            }
        } catch (RuntimeException ex) {
            context.notes.add("Sync failed for " + instrumentKey + ": " + ex.getMessage());
        }
    }

    private LocalDate determineExitDate(AdminDtos.BacktestStrategyPayload strategy, LocalDate tradeDate) {
        if ("POSITIONAL".equals(strategy.strategyType())) {
            LocalDate next = tradeDate.plusDays(1);
            while (next.getDayOfWeek() == DayOfWeek.SATURDAY || next.getDayOfWeek() == DayOfWeek.SUNDAY) {
                next = next.plusDays(1);
            }
            return next;
        }
        return tradeDate;
    }

    private Instant toMarketInstant(LocalDate date, LocalTime time) {
        return LocalDateTime.of(date, time).atZone(MARKET_ZONE).toInstant();
    }

    private String formatInMarketTime(Instant instant) {
        return LocalDateTime.ofInstant(instant, MARKET_ZONE).toLocalTime().toString();
    }

    private BigDecimal scalePrice(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private Optional<UpstoxClient.ExpiredDerivativeContractView> loadFutureContract(
            RunContext context,
            String tenantId,
            String underlyingKey,
            LocalDate expiryDate
    ) {
        String cacheKey = underlyingKey + "|" + expiryDate + "|FUT";
        List<UpstoxClient.ExpiredDerivativeContractView> contracts = context.futureContractsByKey.computeIfAbsent(cacheKey, ignored ->
                expiredInstrumentCatalogService.getFutureContracts(tenantId, underlyingKey, expiryDate)
        );
        return contracts.stream()
                .filter(contract -> contract.instrumentKey() != null && !contract.instrumentKey().isBlank())
                .findFirst();
    }
}
