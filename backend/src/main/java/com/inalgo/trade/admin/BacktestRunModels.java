package com.inalgo.trade.admin;

import com.inalgo.trade.entity.CandleEntity;
import com.inalgo.trade.upstox.UpstoxClient;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

record PriceResolution(
        BigDecimal price,
        boolean fromMarket
) {
}

record PreparedLeg(
        AdminDtos.BacktestLegPayload leg,
        String legLabel,
        String instrumentKey,
        LocalDate expiryDate,
        BigDecimal strikePrice,
        Integer lotSize,
        BigDecimal entryPrice,
        boolean entryFromMarket,
        BigDecimal sign,
        BigDecimal multiplier,
        String optionType,
        boolean optionLeg,
        List<CandleEntity> series
) {
}

record PreparedLegExit(
        PreparedLeg leg,
        Instant exitTs,
        ExitReason reason
) {
}

record ExitDecision(
        Instant exitTs,
        ExitReason reason
) {
}

enum ExitReason {
    SCHEDULED("Scheduled exit"),
    STOP_LOSS("Stop loss"),
    TARGET("Target"),
    TRAILING_STOP_LOSS("Trailing stop loss"),
    EXIT_CONDITION("Advance exit condition"),
    LEG_EXIT_CONDITION("Leg exit condition");

    private final String label;

    ExitReason(String label) {
        this.label = label;
    }

    String label() {
        return label;
    }
}

record TradeContext(
        Instant seriesFrom,
        Instant seriesToExclusive
) {
}

final class AccuracyStats {
    int totalPricingPoints = 0;
    int marketPricingPoints = 0;
    int marketOnlyTrades = 0;
    int fallbackPricedTrades = 0;

    void capturePoint(boolean marketPrice) {
        totalPricingPoints += 1;
        if (marketPrice) {
            marketPricingPoints += 1;
        }
    }
}

final class RunContext {
    final Set<String> syncKeys = new HashSet<>();
    final Set<String> syncedInstruments = new HashSet<>();
    final List<String> notes = new ArrayList<>();
    final Map<String, List<LocalDate>> optionExpiriesByUnderlying = new HashMap<>();
    final Map<String, List<LocalDate>> futureExpiriesByUnderlying = new HashMap<>();
    final Map<String, List<UpstoxClient.ExpiredDerivativeContractView>> futureContractsByKey = new HashMap<>();
    final Map<String, List<UpstoxClient.ExpiredDerivativeContractView>> optionContractsByKey = new HashMap<>();
    int syncedCandles = 0;
}
