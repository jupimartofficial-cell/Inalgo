package com.inalgo.trade.admin;

import com.inalgo.trade.entity.CandleEntity;
import com.inalgo.trade.upstox.ExpiredInstrumentCatalogService;
import com.inalgo.trade.upstox.UpstoxClient;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Resolves derivative contracts and prepares each strategy leg for simulation.
 * Handles futures, options, expiry date resolution, and strike selection.
 */
@Component
class BacktestLegPreparer {

    private static final ZoneId MARKET_ZONE = ZoneId.of("Asia/Kolkata");

    private final ExpiredInstrumentCatalogService expiredInstrumentCatalogService;
    private final BacktestPriceResolver priceResolver;

    BacktestLegPreparer(
            ExpiredInstrumentCatalogService expiredInstrumentCatalogService,
            BacktestPriceResolver priceResolver
    ) {
        this.expiredInstrumentCatalogService = expiredInstrumentCatalogService;
        this.priceResolver = priceResolver;
    }

    PreparedLeg prepareLeg(
            RunContext context,
            TradeContext tradeContext,
            String tenantId,
            AdminDtos.BacktestStrategyPayload strategy,
            AdminDtos.BacktestLegPayload leg,
            LocalDate tradeDate,
            Instant entryTs,
            BigDecimal underlyingEntryPrice,
            LegSeriesLoader seriesLoader
    ) {
        if ("FUTURES".equals(leg.segment())) {
            return prepareFutureLeg(context, tradeContext, tenantId, strategy.underlyingKey(),
                    leg, tradeDate, entryTs, underlyingEntryPrice, seriesLoader);
        }
        return prepareOptionLeg(context, tradeContext, tenantId, strategy.underlyingKey(),
                leg, tradeDate, entryTs, underlyingEntryPrice, seriesLoader);
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
            LegSeriesLoader seriesLoader
    ) {
        Optional<UpstoxClient.ExpiredDerivativeContractView> maybeContract =
                resolveFutureContract(context, tenantId, underlyingKey, tradeDate, leg.expiryType());

        String instrumentKey = maybeContract.map(UpstoxClient.ExpiredDerivativeContractView::instrumentKey).orElse(underlyingKey);
        LocalDate expiryDate = maybeContract.map(UpstoxClient.ExpiredDerivativeContractView::expiry).orElse(null);
        Integer lotSize = maybeContract.map(UpstoxClient.ExpiredDerivativeContractView::lotSize).orElse(1);

        List<CandleEntity> series = List.of();
        if (maybeContract.isPresent()) {
            seriesLoader.ensureAvailable(context, tenantId, instrumentKey, tradeDate.minusDays(3), tradeDate.plusDays(2), true);
            series = seriesLoader.load(tenantId, instrumentKey, tradeContext.seriesFrom(), tradeContext.seriesToExclusive());
        }

        PriceResolution entryResolution = priceResolver.resolveTradePriceNearTimestamp(series, entryTs, true);
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
        return new PreparedLeg(leg, "FUT " + leg.position(), instrumentKey, expiryDate, null, lotSize,
                entryPrice, entryFromMarket, sign, multiplier, "", false, series);
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
            LegSeriesLoader seriesLoader
    ) {
        Optional<UpstoxClient.ExpiredDerivativeContractView> maybeContract =
                resolveOptionContract(context, tenantId, underlyingKey, tradeDate, leg, underlyingEntryPrice);

        String optionType = normalizeOptionType(leg.optionType());
        String instrumentKey = maybeContract.map(UpstoxClient.ExpiredDerivativeContractView::instrumentKey).orElse(underlyingKey);
        LocalDate expiryDate = maybeContract.map(UpstoxClient.ExpiredDerivativeContractView::expiry).orElse(null);
        BigDecimal strikePrice = maybeContract.map(UpstoxClient.ExpiredDerivativeContractView::strikePrice).orElse(underlyingEntryPrice);
        Integer lotSize = maybeContract.map(UpstoxClient.ExpiredDerivativeContractView::lotSize).orElse(1);
        boolean useExpiredContractHistory = expiryDate != null && expiryDate.isBefore(LocalDate.now(MARKET_ZONE));

        List<CandleEntity> series = List.of();
        if (maybeContract.isPresent()) {
            seriesLoader.ensureAvailable(context, tenantId, instrumentKey, tradeDate.minusDays(3), tradeDate.plusDays(2), useExpiredContractHistory);
            series = seriesLoader.load(tenantId, instrumentKey, tradeContext.seriesFrom(), tradeContext.seriesToExclusive());
        }

        PriceResolution entryResolution = priceResolver.resolveTradePriceNearTimestamp(series, entryTs, true);
        BigDecimal entryPrice = entryResolution.price() == null
                ? priceResolver.syntheticOptionPrice(optionType, strikePrice, underlyingEntryPrice)
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
        return new PreparedLeg(leg, label, instrumentKey, expiryDate, strikePrice, lotSize,
                entryPrice, entryFromMarket, sign, multiplier, optionType, true, series);
    }

    Optional<UpstoxClient.ExpiredDerivativeContractView> resolveFutureContract(
            RunContext context, String tenantId, String underlyingKey, LocalDate tradeDate, String expiryType
    ) {
        LocalDate expiryDate = resolveExpiryDate(context, tenantId, underlyingKey, tradeDate, expiryType, false);
        if (expiryDate == null) return Optional.empty();

        Optional<UpstoxClient.ExpiredDerivativeContractView> exactMatch = loadFutureContract(context, tenantId, underlyingKey, expiryDate);
        if (exactMatch.isPresent()) return exactMatch;

        if ("WEEKLY".equals(expiryType)) {
            LocalDate monthlyExpiry = resolveExpiryDate(context, tenantId, underlyingKey, tradeDate, "MONTHLY", false);
            if (monthlyExpiry != null && !monthlyExpiry.equals(expiryDate)) {
                Optional<UpstoxClient.ExpiredDerivativeContractView> monthlyFallback = loadFutureContract(context, tenantId, underlyingKey, monthlyExpiry);
                if (monthlyFallback.isPresent()) {
                    context.notes.add("Weekly futures contract unavailable on " + tradeDate + "; used monthly futures expiry " + monthlyExpiry);
                    return monthlyFallback;
                }
            }
        }
        return Optional.empty();
    }

    Optional<UpstoxClient.ExpiredDerivativeContractView> resolveOptionContract(
            RunContext context, String tenantId, String underlyingKey,
            LocalDate tradeDate, AdminDtos.BacktestLegPayload leg, BigDecimal underlyingPrice
    ) {
        LocalDate expiryDate = resolveExpiryDate(context, tenantId, underlyingKey, tradeDate, leg.expiryType(), true);
        if (expiryDate == null) return Optional.empty();

        String cacheKey = underlyingKey + "|" + expiryDate + "|OPT";
        List<UpstoxClient.ExpiredDerivativeContractView> contracts = context.optionContractsByKey.computeIfAbsent(
                cacheKey, ignored -> expiredInstrumentCatalogService.getOptionContracts(tenantId, underlyingKey, expiryDate));
        if (contracts.isEmpty()) return Optional.empty();

        String optionType = normalizeOptionType(leg.optionType());
        List<UpstoxClient.ExpiredDerivativeContractView> typedContracts = contracts.stream()
                .filter(contract -> optionTypeMatches(optionType, contract.optionType(), contract.tradingSymbol()))
                .filter(contract -> contract.strikePrice() != null)
                .sorted(Comparator.comparing(UpstoxClient.ExpiredDerivativeContractView::strikePrice))
                .toList();
        if (typedContracts.isEmpty()) return Optional.empty();

        List<BigDecimal> strikes = typedContracts.stream()
                .map(UpstoxClient.ExpiredDerivativeContractView::strikePrice)
                .distinct().sorted().toList();
        int atmIndex = nearestStrikeIndex(strikes, underlyingPrice);
        int targetIndex = adjustedStrikeIndex(atmIndex, leg, optionType, strikes.size());
        BigDecimal targetStrike = strikes.get(targetIndex);
        return typedContracts.stream()
                .filter(contract -> contract.strikePrice().compareTo(targetStrike) == 0)
                .findFirst();
    }

    LocalDate resolveExpiryDate(
            RunContext context, String tenantId, String underlyingKey,
            LocalDate tradeDate, String expiryType, boolean optionContracts
    ) {
        Map<String, List<LocalDate>> expiryCache = optionContracts
                ? context.optionExpiriesByUnderlying
                : context.futureExpiriesByUnderlying;
        List<LocalDate> expiries = expiryCache.get(underlyingKey);
        boolean needsRefresh = expiries == null || expiries.isEmpty()
                || (tradeDate != null && expiries.getLast().isBefore(tradeDate));
        if (needsRefresh) {
            List<LocalDate> fetched = optionContracts
                    ? expiredInstrumentCatalogService.getOptionExpiries(tenantId, underlyingKey, tradeDate)
                    : expiredInstrumentCatalogService.getExpiries(tenantId, underlyingKey, tradeDate);
            expiries = fetched == null ? List.of() : fetched.stream().sorted().toList();
            expiryCache.put(underlyingKey, expiries);
        }
        if (expiries.isEmpty()) return null;

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
                    .sorted().findFirst()
                    .orElse(expiries.get(expiries.size() - 1));
        }

        return expiries.stream().filter(expiry -> !expiry.isBefore(tradeDate)).findFirst()
                .orElse(expiries.get(expiries.size() - 1));
    }

    private Optional<UpstoxClient.ExpiredDerivativeContractView> loadFutureContract(
            RunContext context, String tenantId, String underlyingKey, LocalDate expiryDate
    ) {
        String cacheKey = underlyingKey + "|" + expiryDate + "|FUT";
        List<UpstoxClient.ExpiredDerivativeContractView> contracts = context.futureContractsByKey.computeIfAbsent(
                cacheKey, ignored -> expiredInstrumentCatalogService.getFutureContracts(tenantId, underlyingKey, expiryDate));
        return contracts.stream()
                .filter(contract -> contract.instrumentKey() != null && !contract.instrumentKey().isBlank())
                .findFirst();
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
        if (target < 0) return 0;
        if (target >= strikeCount) return strikeCount - 1;
        return target;
    }

    String normalizeOptionType(String optionType) {
        if (optionType == null) return "CALL";
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

    /**
     * Functional interface for loading/syncing candle series without a circular dependency.
     */
    interface LegSeriesLoader {
        void ensureAvailable(RunContext context, String tenantId, String instrumentKey,
                             LocalDate fromDate, LocalDate toDate, boolean expiredContract);
        List<CandleEntity> load(String tenantId, String instrumentKey, Instant from, Instant toExclusive);
    }
}
