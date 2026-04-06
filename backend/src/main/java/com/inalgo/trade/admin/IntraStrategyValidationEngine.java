package com.inalgo.trade.admin;

import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

@Component
public class IntraStrategyValidationEngine {

    private static final Set<Integer> LIVE_MINUTE_INTERVALS = Set.of(1, 5, 15, 30, 60);

    public IntraStrategyDtos.IntraStrategyValidationResult validate(IntraStrategyDtos.IntraStrategyBuilderPayload builder) {
        List<IntraStrategyDtos.IntraStrategyValidationIssue> fieldErrors = new ArrayList<>();
        List<String> summaryErrors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        AdminDtos.BacktestStrategyPayload strategy = builder.strategy();
        boolean advancedMode = Boolean.TRUE.equals(builder.advancedMode());
        String timeframeUnit = normalizedLower(builder.timeframeUnit());
        Integer timeframeInterval = builder.timeframeInterval();

        // Step 1: Basic setup
        if (!StringUtils.hasText(strategy.strategyName())) {
            fieldErrors.add(new IntraStrategyDtos.IntraStrategyValidationIssue(1, "strategy.strategyName", "Strategy name is required"));
        }
        if (!StringUtils.hasText(strategy.underlyingKey())) {
            fieldErrors.add(new IntraStrategyDtos.IntraStrategyValidationIssue(1, "strategy.underlyingKey", "Instrument is required"));
        }
        if (!StringUtils.hasText(strategy.strategyType())) {
            fieldErrors.add(new IntraStrategyDtos.IntraStrategyValidationIssue(1, "strategy.strategyType", "Strategy type is required"));
        }
        if (!StringUtils.hasText(strategy.underlyingSource())) {
            fieldErrors.add(new IntraStrategyDtos.IntraStrategyValidationIssue(1, "strategy.underlyingSource", "Underlying source is required"));
        }
        if (!StringUtils.hasText(timeframeUnit) || timeframeInterval == null) {
            fieldErrors.add(new IntraStrategyDtos.IntraStrategyValidationIssue(1, "timeframe", "Timeframe is required"));
        }

        // Step 2: Entry conditions
        if (advancedMode && (strategy.advancedConditions() == null || !Boolean.TRUE.equals(strategy.advancedConditions().enabled()))) {
            warnings.add("Advanced mode is enabled but advanced entry/exit conditions are not configured.");
        }

        // Step 3: Exit and risk
        if (Boolean.TRUE.equals(strategy.overallSettings().stopLossEnabled())
                && (strategy.overallSettings().stopLossValue() == null || strategy.overallSettings().stopLossValue().signum() <= 0)) {
            fieldErrors.add(new IntraStrategyDtos.IntraStrategyValidationIssue(3, "strategy.overallSettings.stopLossValue", "Stop loss must be greater than zero"));
        }
        if (Boolean.TRUE.equals(strategy.overallSettings().targetEnabled())
                && (strategy.overallSettings().targetValue() == null || strategy.overallSettings().targetValue().signum() <= 0)) {
            fieldErrors.add(new IntraStrategyDtos.IntraStrategyValidationIssue(3, "strategy.overallSettings.targetValue", "Target must be greater than zero"));
        }
        if (Boolean.TRUE.equals(strategy.overallSettings().trailingEnabled())
                && (strategy.overallSettings().trailingTrigger() == null || strategy.overallSettings().trailingTrigger().signum() <= 0)) {
            fieldErrors.add(new IntraStrategyDtos.IntraStrategyValidationIssue(3, "strategy.overallSettings.trailingTrigger", "Trailing stop trigger must be greater than zero"));
        }

        // Step 4: Position setup
        if (strategy.legs() == null || strategy.legs().isEmpty()) {
            fieldErrors.add(new IntraStrategyDtos.IntraStrategyValidationIssue(4, "strategy.legs", "At least one leg is required"));
        } else {
            for (int i = 0; i < strategy.legs().size(); i++) {
                AdminDtos.BacktestLegPayload leg = strategy.legs().get(i);
                if (!StringUtils.hasText(leg.segment())) {
                    fieldErrors.add(new IntraStrategyDtos.IntraStrategyValidationIssue(4, "strategy.legs[" + i + "].segment", "Segment is required"));
                }
                if (!StringUtils.hasText(leg.position())) {
                    fieldErrors.add(new IntraStrategyDtos.IntraStrategyValidationIssue(4, "strategy.legs[" + i + "].position", "Buy/Sell is required"));
                }
            }
        }

        if (!fieldErrors.isEmpty()) {
            summaryErrors.add("Resolve required fields before publishing this strategy.");
        }

        boolean valid = fieldErrors.isEmpty();
        boolean paperEligible = valid;
        boolean liveEligible = valid
                && "INTRADAY".equalsIgnoreCase(strategy.strategyType())
                && "minutes".equals(timeframeUnit)
                && timeframeInterval != null
                && LIVE_MINUTE_INTERVALS.contains(timeframeInterval);

        if (paperEligible && !liveEligible) {
            warnings.add("Strategy is paper-ready but not live-ready. Live requires INTRADAY with 1/5/15/30/60 minute timeframe.");
        }

        return new IntraStrategyDtos.IntraStrategyValidationResult(
                valid,
                paperEligible,
                liveEligible,
                List.copyOf(fieldErrors),
                List.copyOf(summaryErrors),
                List.copyOf(warnings)
        );
    }

    private String normalizedLower(String value) {
        return value == null ? "" : value.trim().toLowerCase();
    }
}
