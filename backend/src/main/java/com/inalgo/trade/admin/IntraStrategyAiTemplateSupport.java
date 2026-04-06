package com.inalgo.trade.admin;

import com.inalgo.trade.entity.TradingDayParamEntity;
import com.inalgo.trade.entity.TradingSignalEntity;
import com.inalgo.trade.service.OpenAiIntraStrategyClient;
import jakarta.validation.ValidationException;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

final class IntraStrategyAiTemplateSupport {

    private IntraStrategyAiTemplateSupport() {
    }

    static AdminDtos.BacktestStrategyPayload buildStrategyPayload(
            OpenAiIntraStrategyClient.GeneratedPlan plan,
            String instrumentKey,
            LocalDate startDate,
            LocalDate endDate,
            int serial
    ) {
        String direction = normalizeUpper(plan.direction());
        String template = normalizeUpper(plan.template());
        String name = requireText(plan.name(), "plan.name") + " #" + serial;

        LocalTime entryTime = LocalTime.of(
                clamp(plan.entryHour(), 9, 14),
                clamp(plan.entryMinute(), 15, 59)
        );
        LocalTime exitTime = LocalTime.of(
                clamp(plan.exitHour(), 10, 15),
                clamp(plan.exitMinute(), 0, 30)
        );
        if (!exitTime.isAfter(entryTime)) {
            exitTime = entryTime.plusMinutes(30);
        }

        boolean bullish = "BULLISH".equals(direction);
        AdminDtos.BacktestLegPayload primaryLeg = new AdminDtos.BacktestLegPayload(
                "leg-1",
                "OPTIONS",
                clamp(plan.lots(), 1, 5),
                "BUY",
                bullish ? "CALL" : "PUT",
                "WEEKLY",
                "ATM",
                clamp(plan.strikeSteps(), 0, 2),
                null
        );
        AdminDtos.BacktestLegPayload hedgeLeg = new AdminDtos.BacktestLegPayload(
                "leg-2",
                "OPTIONS",
                1,
                "SELL",
                bullish ? "PUT" : "CALL",
                "WEEKLY",
                "OTM",
                2,
                null
        );

        return new AdminDtos.BacktestStrategyPayload(
                name,
                instrumentKey,
                "FUTURES",
                "INTRADAY",
                entryTime,
                exitTime,
                startDate,
                endDate,
                List.of(primaryLeg, hedgeLeg),
                new AdminDtos.BacktestLegwiseSettingsPayload(
                        "PARTIAL",
                        false,
                        "ALL_LEGS",
                        true,
                        exitTime.minusMinutes(20),
                        false,
                        null,
                        BigDecimal.ZERO
                ),
                new AdminDtos.BacktestOverallSettingsPayload(
                        true,
                        "POINTS",
                        boundedPositive(plan.stopLossPoints(), "40"),
                        true,
                        "POINTS",
                        boundedPositive(plan.targetPoints(), "85"),
                        true,
                        "TRAILING_SL",
                        boundedPositive(plan.trailingTriggerPoints(), "45"),
                        boundedPositive(plan.trailingLockPoints(), "20")
                ),
                buildAdvancedConditions(template, bullish)
        );
    }

    static String buildAnalyticsSummary(
            String instrumentKey,
            String timeframeUnit,
            Integer timeframeInterval,
            LocalDate lookbackFrom,
            LocalDate lookbackTo,
            String latestTrendSignal,
            List<TradingSignalEntity> signals,
            List<TradingDayParamEntity> dayParams,
            int candidateCount
    ) {
        long buyCount = signals.stream().filter(s -> "BUY".equalsIgnoreCase(s.getSignal())).count();
        long sellCount = signals.stream().filter(s -> "SELL".equalsIgnoreCase(s.getSignal())).count();
        long holdCount = signals.stream().filter(s -> "HOLD".equalsIgnoreCase(s.getSignal())).count();
        long breakoutYes = dayParams.stream().filter(s -> "Yes".equalsIgnoreCase(s.getOrbBreakout())).count();
        long breakdownYes = dayParams.stream().filter(s -> "Yes".equalsIgnoreCase(s.getOrbBreakdown())).count();

        BigDecimal avgGapPct = average(dayParams.stream().map(TradingDayParamEntity::getGapPct).filter(Objects::nonNull).toList());
        BigDecimal avgOrbRangePct = average(dayParams.stream().map(IntraStrategyAiTemplateSupport::orbRangePct).filter(Objects::nonNull).toList());

        return """
                Generate %d intraday strategy plans for BANKNIFTY options.
                Instrument: %s
                Timeframe: %s %d
                Lookback window: %s to %s
                Latest trend signal: %s

                trading_signal summary:
                - rows: %d
                - BUY: %d
                - SELL: %d
                - HOLD: %d

                trading_day_param summary:
                - rows: %d
                - ORB breakout Yes count: %d
                - ORB breakdown Yes count: %d
                - avg gap pct: %s
                - avg ORB range pct (orb_high - orb_low vs prev_close): %s

                Strategy requirements:
                - Use complex intraday options structures with risk controls.
                - Keep entry time between 09:15 and 14:59 IST.
                - Keep exit time at or before 15:30 IST.
                - Prefer realistic stop loss/target/trailing values for BANKNIFTY.
                - Return only JSON matching the schema.
                """.formatted(
                candidateCount,
                instrumentKey,
                timeframeUnit,
                timeframeInterval,
                lookbackFrom,
                lookbackTo,
                latestTrendSignal,
                signals.size(),
                buyCount,
                sellCount,
                holdCount,
                dayParams.size(),
                breakoutYes,
                breakdownYes,
                valueOrZero(avgGapPct),
                valueOrZero(avgOrbRangePct)
        );
    }

    static List<OpenAiIntraStrategyClient.GeneratedPlan> fallbackPlans(int candidateCount, String latestTrendSignal) {
        boolean bullish = "BUY".equalsIgnoreCase(latestTrendSignal);
        String primaryDirection = bullish ? "BULLISH" : "BEARISH";
        String secondaryDirection = bullish ? "BEARISH" : "BULLISH";
        List<OpenAiIntraStrategyClient.GeneratedPlan> plans = new ArrayList<>();
        plans.add(new OpenAiIntraStrategyClient.GeneratedPlan(
                "EMA Pullback Continuation",
                "EMA_PULLBACK",
                primaryDirection,
                9,
                35,
                15,
                15,
                2,
                0,
                new BigDecimal("40"),
                new BigDecimal("90"),
                new BigDecimal("45"),
                new BigDecimal("20"),
                "Follows trend continuation when close stays on the momentum side of short and medium EMAs."
        ));
        plans.add(new OpenAiIntraStrategyClient.GeneratedPlan(
                "ORB Expansion Drive",
                "ORB_BREAKOUT",
                primaryDirection,
                9,
                45,
                15,
                10,
                1,
                1,
                new BigDecimal("35"),
                new BigDecimal("80"),
                new BigDecimal("35"),
                new BigDecimal("15"),
                "Targets directional expansion after confirmed ORB breakout or breakdown in early session."
        ));
        plans.add(new OpenAiIntraStrategyClient.GeneratedPlan(
                "Gap Continuation Fade Guarded",
                "GAP_CONTINUATION",
                secondaryDirection,
                10,
                0,
                15,
                0,
                1,
                0,
                new BigDecimal("45"),
                new BigDecimal("70"),
                new BigDecimal("40"),
                new BigDecimal("18"),
                "Exploits strong opening gap continuation with tight trailing controls and opposite-direction hedge."
        ));
        return plans.subList(0, Math.min(candidateCount, plans.size()));
    }

    static BigDecimal scoreCandidate(AdminDtos.BacktestRunResponse run) {
        BigDecimal totalPnl = run.totalPnl() == null ? BigDecimal.ZERO : run.totalPnl();
        int executed = run.executedTrades() == null ? 0 : run.executedTrades();
        int wins = run.winTrades() == null ? 0 : run.winTrades();
        BigDecimal winRate = executed <= 0
                ? BigDecimal.ZERO
                : BigDecimal.valueOf(wins).multiply(BigDecimal.valueOf(100)).divide(BigDecimal.valueOf(executed), 2, RoundingMode.HALF_UP);
        BigDecimal realWorldAccuracy = run.realWorldAccuracyPct() == null ? BigDecimal.ZERO : run.realWorldAccuracyPct();
        return totalPnl
                .add(winRate.multiply(BigDecimal.valueOf(100)))
                .add(realWorldAccuracy.multiply(BigDecimal.valueOf(0.5)));
    }

    private static AdminDtos.BacktestAdvancedConditionsPayload buildAdvancedConditions(String template, boolean bullish) {
        List<AdminDtos.BacktestConditionNodePayload> entryRules = new ArrayList<>();
        List<AdminDtos.BacktestConditionNodePayload> exitRules = new ArrayList<>();

        entryRules.add(rule(
                "minutes",
                5,
                field("TRADING_SIGNAL", "signal"),
                "EQUAL_TO",
                literal("STRING", bullish ? "BUY" : "SELL")
        ));
        entryRules.add(rule(
                "minutes",
                5,
                field("TRADING_SIGNAL", "currentClose"),
                bullish ? "HIGHER_THAN" : "LOWER_THAN",
                field("TRADING_SIGNAL", "dma26")
        ));

        if ("ORB_BREAKOUT".equals(template)) {
            entryRules.add(rule(
                    "minutes",
                    5,
                    field("TRADING_DAY_PARAM", bullish ? "orbBreakout" : "orbBreakdown"),
                    "EQUAL_TO",
                    literal("BOOLEAN", "true")
            ));
        } else if ("GAP_CONTINUATION".equals(template)) {
            entryRules.add(rule(
                    "minutes",
                    5,
                    field("TRADING_DAY_PARAM", "gapPct"),
                    bullish ? "HIGHER_THAN_EQUAL_TO" : "LOWER_THAN_EQUAL_TO",
                    literal("NUMBER", bullish ? "0.20" : "-0.20")
            ));
        } else {
            entryRules.add(rule(
                    "minutes",
                    5,
                    field("TRADING_SIGNAL", "dma9"),
                    bullish ? "HIGHER_THAN" : "LOWER_THAN",
                    field("TRADING_SIGNAL", "dma26")
            ));
        }

        exitRules.add(rule(
                "minutes",
                5,
                field("TRADING_SIGNAL", "signal"),
                "EQUAL_TO",
                literal("STRING", bullish ? "SELL" : "BUY")
        ));
        exitRules.add(rule(
                "minutes",
                5,
                field("TRADING_SIGNAL", "currentClose"),
                bullish ? "LOWER_THAN" : "HIGHER_THAN",
                field("TRADING_SIGNAL", "dma9")
        ));

        return new AdminDtos.BacktestAdvancedConditionsPayload(
                true,
                new AdminDtos.BacktestConditionGroupPayload("AND", List.copyOf(entryRules)),
                new AdminDtos.BacktestConditionGroupPayload("OR", List.copyOf(exitRules))
        );
    }

    private static AdminDtos.BacktestConditionNodePayload rule(
            String timeframeUnit,
            Integer timeframeInterval,
            AdminDtos.BacktestConditionOperandPayload left,
            String comparator,
            AdminDtos.BacktestConditionOperandPayload right
    ) {
        return new AdminDtos.BacktestConditionNodePayload(
                new AdminDtos.BacktestConditionRulePayload(timeframeUnit, timeframeInterval, left, comparator, right),
                null
        );
    }

    private static AdminDtos.BacktestConditionOperandPayload field(String source, String field) {
        return new AdminDtos.BacktestConditionOperandPayload("FIELD", source, field, null, null);
    }

    private static AdminDtos.BacktestConditionOperandPayload literal(String valueType, String value) {
        return new AdminDtos.BacktestConditionOperandPayload("VALUE", null, null, value, valueType);
    }

    private static BigDecimal orbRangePct(TradingDayParamEntity param) {
        if (param.getOrbHigh() == null || param.getOrbLow() == null || param.getPrevClose() == null || param.getPrevClose().signum() == 0) {
            return null;
        }
        return param.getOrbHigh()
                .subtract(param.getOrbLow())
                .multiply(BigDecimal.valueOf(100))
                .divide(param.getPrevClose(), 4, RoundingMode.HALF_UP);
    }

    private static BigDecimal average(List<BigDecimal> values) {
        if (values == null || values.isEmpty()) {
            return null;
        }
        BigDecimal sum = values.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        return sum.divide(BigDecimal.valueOf(values.size()), 4, RoundingMode.HALF_UP);
    }

    private static String valueOrZero(BigDecimal value) {
        return value == null ? "0.0000" : value.toPlainString();
    }

    private static BigDecimal boundedPositive(BigDecimal value, String fallback) {
        BigDecimal normalized = value == null ? new BigDecimal(fallback) : value;
        if (normalized.compareTo(BigDecimal.ZERO) <= 0) {
            return new BigDecimal(fallback);
        }
        return normalized.setScale(2, RoundingMode.HALF_UP);
    }

    private static String requireText(String value, String field) {
        if (!StringUtils.hasText(value)) {
            throw new ValidationException(field + " is required");
        }
        return value.trim();
    }

    private static String normalizeUpper(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ENGLISH);
    }

    private static int clamp(Integer value, int min, int max) {
        if (value == null) {
            return min;
        }
        return Math.min(Math.max(value, min), max);
    }
}
