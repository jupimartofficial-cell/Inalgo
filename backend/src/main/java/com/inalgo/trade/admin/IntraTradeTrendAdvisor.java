package com.inalgo.trade.admin;

import com.inalgo.trade.entity.TradingSignalEntity;
import com.inalgo.trade.repository.TradingSignalRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Optional;

@Service
class IntraTradeTrendAdvisor {

    private static final ZoneId MARKET_ZONE = ZoneId.of("Asia/Kolkata");

    private final TradingSignalRepository tradingSignalRepository;
    private final Clock clock;

    @Autowired
    public IntraTradeTrendAdvisor(TradingSignalRepository tradingSignalRepository) {
        this(tradingSignalRepository, Clock.system(MARKET_ZONE));
    }

    IntraTradeTrendAdvisor(TradingSignalRepository tradingSignalRepository, Clock clock) {
        this.tradingSignalRepository = tradingSignalRepository;
        this.clock = clock;
    }

    IntraTradeDtos.IntraTradeTrendCheckResponse checkTrend(
            String tenantId,
            String instrumentKey,
            String timeframeUnit,
            Integer timeframeInterval,
            AdminDtos.BacktestStrategyPayload strategy
    ) {
        StrategyBias bias = inferBias(strategy);
        if (bias == StrategyBias.NEUTRAL) {
            return new IntraTradeDtos.IntraTradeTrendCheckResponse(false, bias.name(), "UNAVAILABLE", "");
        }
        Optional<TradingSignalEntity> latestSignal = tradingSignalRepository
                .findTopByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeIntervalAndSignalDateLessThanEqualOrderBySignalDateDescUpdatedAtDesc(
                        tenantId,
                        instrumentKey,
                        timeframeUnit,
                        timeframeInterval,
                        LocalDate.now(clock)
                );
        if (latestSignal.isEmpty()) {
            return new IntraTradeDtos.IntraTradeTrendCheckResponse(false, bias.name(), "UNAVAILABLE", "");
        }

        String currentTrend = latestSignal.get().getSignal();
        boolean hasConflict = (bias == StrategyBias.BULL && "SELL".equals(currentTrend))
                || (bias == StrategyBias.BEAR && "BUY".equals(currentTrend));
        if (!hasConflict) {
            return new IntraTradeDtos.IntraTradeTrendCheckResponse(false, bias.name(), currentTrend, "");
        }
        return new IntraTradeDtos.IntraTradeTrendCheckResponse(
                true,
                bias.name(),
                currentTrend,
                "Current " + timeframeInterval + " " + timeframeUnit + " trend for "
                        + instrumentLabel(instrumentKey)
                        + " is " + currentTrend
                        + ", but this strategy has a " + bias.label + " entry bias."
        );
    }

    private StrategyBias inferBias(AdminDtos.BacktestStrategyPayload strategy) {
        int score = strategy.legs().stream()
                .mapToInt(leg -> {
                    if (!"OPTIONS".equals(leg.segment()) || leg.optionType() == null) {
                        return 0;
                    }
                    boolean bullish = ("CALL".equals(leg.optionType()) && "BUY".equals(leg.position()))
                            || ("PUT".equals(leg.optionType()) && "SELL".equals(leg.position()));
                    boolean bearish = ("PUT".equals(leg.optionType()) && "BUY".equals(leg.position()))
                            || ("CALL".equals(leg.optionType()) && "SELL".equals(leg.position()));
                    if (bullish) {
                        return Math.max(leg.lots(), 1);
                    }
                    if (bearish) {
                        return -Math.max(leg.lots(), 1);
                    }
                    return 0;
                })
                .sum();
        if (score > 0) {
            return StrategyBias.BULL;
        }
        if (score < 0) {
            return StrategyBias.BEAR;
        }
        return StrategyBias.NEUTRAL;
    }

    private String instrumentLabel(String instrumentKey) {
        int separator = instrumentKey.indexOf('|');
        if (separator < 0 || separator == instrumentKey.length() - 1) {
            return instrumentKey;
        }
        return instrumentKey.substring(separator + 1);
    }

    private enum StrategyBias {
        BULL("bullish"),
        BEAR("bearish"),
        NEUTRAL("neutral");

        private final String label;

        StrategyBias(String label) {
            this.label = label;
        }
    }
}
