package com.inalgo.trade.admin;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class IntraStrategyValidationEngineTest {

    private final IntraStrategyValidationEngine engine = new IntraStrategyValidationEngine();

    // ─── eligibility ──────────────────────────────────────────────────────────

    @Test
    void validate_marksPaperAndLiveEligible_forIntradayMinuteCadence() {
        var result = engine.validate(payload(validStrategy("INTRADAY"), "minutes", 5, false));
        assertThat(result.valid()).isTrue();
        assertThat(result.paperEligible()).isTrue();
        assertThat(result.liveEligible()).isTrue();
    }

    @ParameterizedTest
    @ValueSource(ints = {1, 5, 15, 30, 60})
    void validate_marksLiveEligible_forAllAllowedMinuteIntervals(int interval) {
        var result = engine.validate(payload(validStrategy("INTRADAY"), "minutes", interval, false));
        assertThat(result.valid()).isTrue();
        assertThat(result.liveEligible()).isTrue();
    }

    @ParameterizedTest
    @ValueSource(ints = {2, 3, 10, 45, 120, 240})
    void validate_doesNotMarkLiveEligible_forNonAllowedMinuteIntervals(int interval) {
        var result = engine.validate(payload(validStrategy("INTRADAY"), "minutes", interval, false));
        assertThat(result.valid()).isTrue();
        assertThat(result.paperEligible()).isTrue();
        assertThat(result.liveEligible()).isFalse();
    }

    @Test
    void validate_marksOnlyPaperEligible_forNonLiveCadence() {
        var result = engine.validate(payload(validStrategy("POSITIONAL"), "days", 1, false));
        assertThat(result.valid()).isTrue();
        assertThat(result.paperEligible()).isTrue();
        assertThat(result.liveEligible()).isFalse();
    }

    @Test
    void validate_doesNotMarkLiveEligible_whenStrategyTypeNotIntraday() {
        // POSITIONAL with minutes interval — live requires INTRADAY strategy type
        var result = engine.validate(payload(validStrategy("POSITIONAL"), "minutes", 5, false));
        assertThat(result.paperEligible()).isTrue();
        assertThat(result.liveEligible()).isFalse();
    }

    @Test
    void validate_doesNotMarkLiveEligible_forDaysTimeframe() {
        var result = engine.validate(payload(validStrategy("INTRADAY"), "days", 1, false));
        assertThat(result.paperEligible()).isTrue();
        assertThat(result.liveEligible()).isFalse();
    }

    // ─── required fields ──────────────────────────────────────────────────────

    @Test
    void validate_fieldError_whenStrategyNameMissing() {
        var result = engine.validate(payload(strategyWithName(null), "minutes", 5, false));
        assertThat(result.valid()).isFalse();
        assertFieldError(result, 1, "strategy.strategyName");
    }

    @Test
    void validate_fieldError_whenStrategyNameBlank() {
        var result = engine.validate(payload(strategyWithName("   "), "minutes", 5, false));
        assertThat(result.valid()).isFalse();
        assertFieldError(result, 1, "strategy.strategyName");
    }

    @Test
    void validate_fieldError_whenInstrumentKeyMissing() {
        var result = engine.validate(payload(strategyWithInstrument(null), "minutes", 5, false));
        assertFieldError(result, 1, "strategy.underlyingKey");
    }

    @Test
    void validate_fieldError_whenStrategyTypeMissing() {
        var result = engine.validate(payload(strategyWithType(null), "minutes", 5, false));
        assertFieldError(result, 1, "strategy.strategyType");
    }

    @Test
    void validate_fieldError_whenUnderlyingSourceMissing() {
        var result = engine.validate(payload(strategyWithSource(null), "minutes", 5, false));
        assertFieldError(result, 1, "strategy.underlyingSource");
    }

    @Test
    void validate_multipleFieldErrors_whenManyRequiredFieldsMissing() {
        var strategy = buildStrategy(null, null, null, null,
                defaultOverallSettings(), defaultLegwiseSettings(),
                List.of(defaultLeg()), defaultAdvancedConditions());
        var result = engine.validate(payload(strategy, "minutes", 5, false));
        assertThat(result.valid()).isFalse();
        assertThat(result.fieldErrors().stream().filter(e -> e.step() == 1).count())
                .isGreaterThanOrEqualTo(3);
    }

    // ─── exit / risk validation ───────────────────────────────────────────────

    @Test
    void validate_fieldError_whenStopLossEnabledButZeroValue() {
        var settings = new AdminDtos.BacktestOverallSettingsPayload(
                true, null, BigDecimal.ZERO, false, null, BigDecimal.ZERO,
                false, null, BigDecimal.ZERO, BigDecimal.ZERO);
        var result = engine.validate(payload(strategyWithSettings(settings), "minutes", 5, false));
        assertFieldError(result, 3, "strategy.overallSettings.stopLossValue");
    }

    @Test
    void validate_fieldError_whenStopLossEnabledButNegativeValue() {
        var settings = new AdminDtos.BacktestOverallSettingsPayload(
                true, null, new BigDecimal("-50"), false, null, BigDecimal.ZERO,
                false, null, BigDecimal.ZERO, BigDecimal.ZERO);
        var result = engine.validate(payload(strategyWithSettings(settings), "minutes", 5, false));
        assertFieldError(result, 3, "strategy.overallSettings.stopLossValue");
    }

    @Test
    void validate_noError_whenStopLossDisabled() {
        var settings = new AdminDtos.BacktestOverallSettingsPayload(
                false, null, BigDecimal.ZERO, false, null, BigDecimal.ZERO,
                false, null, BigDecimal.ZERO, BigDecimal.ZERO);
        var result = engine.validate(payload(strategyWithSettings(settings), "minutes", 5, false));
        assertThat(result.fieldErrors()).noneMatch(e -> e.field().contains("stopLoss"));
    }

    @Test
    void validate_fieldError_whenTargetEnabledButZeroValue() {
        var settings = new AdminDtos.BacktestOverallSettingsPayload(
                false, null, BigDecimal.ZERO, true, null, BigDecimal.ZERO,
                false, null, BigDecimal.ZERO, BigDecimal.ZERO);
        var result = engine.validate(payload(strategyWithSettings(settings), "minutes", 5, false));
        assertFieldError(result, 3, "strategy.overallSettings.targetValue");
    }

    @Test
    void validate_fieldError_whenTrailingEnabledButZeroTrigger() {
        var settings = new AdminDtos.BacktestOverallSettingsPayload(
                false, null, BigDecimal.ZERO, false, null, BigDecimal.ZERO,
                true, null, BigDecimal.ZERO, BigDecimal.ZERO);
        var result = engine.validate(payload(strategyWithSettings(settings), "minutes", 5, false));
        assertFieldError(result, 3, "strategy.overallSettings.trailingTrigger");
    }

    @Test
    void validate_noError_whenAllRiskSettingsDisabled() {
        var result = engine.validate(payload(validStrategy("INTRADAY"), "minutes", 5, false));
        assertThat(result.fieldErrors()).noneMatch(e -> e.step() == 3);
    }

    @Test
    void validate_valid_whenSlAndTargetBothEnabledWithPositiveValues() {
        var settings = new AdminDtos.BacktestOverallSettingsPayload(
                true, null, new BigDecimal("50"), true, null, new BigDecimal("100"),
                false, null, BigDecimal.ZERO, BigDecimal.ZERO);
        var result = engine.validate(payload(strategyWithSettings(settings), "minutes", 5, false));
        assertThat(result.fieldErrors()).noneMatch(e -> e.step() == 3);
    }

    // ─── position / leg validation ────────────────────────────────────────────

    @Test
    void validate_fieldError_whenLegsListIsEmpty() {
        var result = engine.validate(payload(strategyWithLegs(List.of()), "minutes", 5, false));
        assertFieldError(result, 4, "strategy.legs");
    }

    @Test
    void validate_fieldError_whenLegsListIsNull() {
        var result = engine.validate(payload(strategyWithLegs(null), "minutes", 5, false));
        assertFieldError(result, 4, "strategy.legs");
    }

    @Test
    void validate_fieldError_whenLegMissingSegment() {
        var leg = new AdminDtos.BacktestLegPayload("leg-1", null, 1, "BUY", "CALL", "WEEKLY", "ATM", 0, null);
        var result = engine.validate(payload(strategyWithLegs(List.of(leg)), "minutes", 5, false));
        assertFieldError(result, 4, "strategy.legs[0].segment");
    }

    @Test
    void validate_fieldError_whenLegMissingPosition() {
        var leg = new AdminDtos.BacktestLegPayload("leg-1", "OPTIONS", 1, null, "CALL", "WEEKLY", "ATM", 0, null);
        var result = engine.validate(payload(strategyWithLegs(List.of(leg)), "minutes", 5, false));
        assertFieldError(result, 4, "strategy.legs[0].position");
    }

    @Test
    void validate_fieldErrors_forMultipleLegsWithIssues() {
        var leg1 = new AdminDtos.BacktestLegPayload("leg-1", null, 1, null, "CALL", "WEEKLY", "ATM", 0, null);
        var leg2 = new AdminDtos.BacktestLegPayload("leg-2", "OPTIONS", 1, null, "PUT", "MONTHLY", "ATM", 0, null);
        var result = engine.validate(payload(strategyWithLegs(List.of(leg1, leg2)), "minutes", 5, false));
        assertThat(result.fieldErrors())
                .anyMatch(e -> e.field().equals("strategy.legs[0].segment"))
                .anyMatch(e -> e.field().equals("strategy.legs[0].position"))
                .anyMatch(e -> e.field().equals("strategy.legs[1].position"));
    }

    @Test
    void validate_valid_whenMultipleLegsAllCorrect() {
        var leg1 = new AdminDtos.BacktestLegPayload("leg-1", "OPTIONS", 1, "BUY", "CALL", "WEEKLY", "ATM", 0, null);
        var leg2 = new AdminDtos.BacktestLegPayload("leg-2", "OPTIONS", 1, "SELL", "PUT", "WEEKLY", "ATM", 0, null);
        var result = engine.validate(payload(strategyWithLegs(List.of(leg1, leg2)), "minutes", 5, false));
        assertThat(result.fieldErrors()).noneMatch(e -> e.step() == 4);
    }

    // ─── advanced mode warnings ───────────────────────────────────────────────

    @Test
    void validate_warning_whenAdvancedModeEnabledButConditionsNull() {
        var result = engine.validate(payload(strategyWithAdvancedConditions(null), "minutes", 5, true));
        assertThat(result.warnings()).anyMatch(w -> w.toLowerCase().contains("advanced"));
    }

    @Test
    void validate_warning_whenAdvancedModeEnabledButConditionsDisabled() {
        var cond = new AdminDtos.BacktestAdvancedConditionsPayload(false, null, null);
        var result = engine.validate(payload(strategyWithAdvancedConditions(cond), "minutes", 5, true));
        assertThat(result.warnings()).anyMatch(w -> w.toLowerCase().contains("advanced"));
    }

    @Test
    void validate_noAdvancedModeWarning_whenAdvancedModeDisabled() {
        var result = engine.validate(payload(validStrategy("INTRADAY"), "minutes", 5, false));
        assertThat(result.warnings()).noneMatch(w -> w.contains("Advanced mode"));
    }

    @Test
    void validate_warning_whenPaperEligibleButNotLiveEligible() {
        var result = engine.validate(payload(validStrategy("POSITIONAL"), "days", 1, false));
        assertThat(result.warnings()).anyMatch(w -> w.contains("paper-ready but not live-ready"));
    }

    @Test
    void validate_noLiveWarning_whenLiveEligible() {
        var result = engine.validate(payload(validStrategy("INTRADAY"), "minutes", 5, false));
        assertThat(result.warnings()).noneMatch(w -> w.contains("paper-ready but not live-ready"));
    }

    // ─── summary errors ───────────────────────────────────────────────────────

    @Test
    void validate_summaryError_whenFieldErrorsExist() {
        var result = engine.validate(payload(strategyWithName(null), "minutes", 5, false));
        assertThat(result.summaryErrors()).isNotEmpty();
        assertThat(result.summaryErrors().get(0)).contains("Resolve required fields");
    }

    @Test
    void validate_noSummaryError_whenAllFieldsValid() {
        var result = engine.validate(payload(validStrategy("INTRADAY"), "minutes", 5, false));
        assertThat(result.summaryErrors()).isEmpty();
    }

    @Test
    void validate_notEligible_whenFieldErrorsPresent() {
        var result = engine.validate(payload(strategyWithName(null), "minutes", 5, false));
        assertThat(result.valid()).isFalse();
        assertThat(result.paperEligible()).isFalse();
        assertThat(result.liveEligible()).isFalse();
    }

    // ─── helpers ──────────────────────────────────────────────────────────────

    private void assertFieldError(IntraStrategyDtos.IntraStrategyValidationResult result, int step, String field) {
        assertThat(result.fieldErrors())
                .as("Expected field error for step=%d field=%s", step, field)
                .anyMatch(e -> e.step() == step && e.field().equals(field));
    }

    private IntraStrategyDtos.IntraStrategyBuilderPayload payload(
            AdminDtos.BacktestStrategyPayload strategy, String unit, Integer interval, boolean advanced) {
        return new IntraStrategyDtos.IntraStrategyBuilderPayload(strategy, unit, interval, advanced, "REGULAR_MARKET");
    }

    private AdminDtos.BacktestStrategyPayload validStrategy(String type) {
        return buildStrategy("My Strategy", "NSE_INDEX|Nifty 50", "FUTURES", type,
                defaultOverallSettings(), defaultLegwiseSettings(),
                List.of(defaultLeg()), defaultAdvancedConditions());
    }

    private AdminDtos.BacktestStrategyPayload strategyWithName(String name) {
        return buildStrategy(name, "NSE_INDEX|Nifty 50", "FUTURES", "INTRADAY",
                defaultOverallSettings(), defaultLegwiseSettings(),
                List.of(defaultLeg()), defaultAdvancedConditions());
    }

    private AdminDtos.BacktestStrategyPayload strategyWithInstrument(String instrument) {
        return buildStrategy("My Strategy", instrument, "FUTURES", "INTRADAY",
                defaultOverallSettings(), defaultLegwiseSettings(),
                List.of(defaultLeg()), defaultAdvancedConditions());
    }

    private AdminDtos.BacktestStrategyPayload strategyWithType(String type) {
        return buildStrategy("My Strategy", "NSE_INDEX|Nifty 50", "FUTURES", type,
                defaultOverallSettings(), defaultLegwiseSettings(),
                List.of(defaultLeg()), defaultAdvancedConditions());
    }

    private AdminDtos.BacktestStrategyPayload strategyWithSource(String source) {
        return buildStrategy("My Strategy", "NSE_INDEX|Nifty 50", source, "INTRADAY",
                defaultOverallSettings(), defaultLegwiseSettings(),
                List.of(defaultLeg()), defaultAdvancedConditions());
    }

    private AdminDtos.BacktestStrategyPayload strategyWithSettings(AdminDtos.BacktestOverallSettingsPayload settings) {
        return buildStrategy("My Strategy", "NSE_INDEX|Nifty 50", "FUTURES", "INTRADAY",
                settings, defaultLegwiseSettings(),
                List.of(defaultLeg()), defaultAdvancedConditions());
    }

    private AdminDtos.BacktestStrategyPayload strategyWithLegs(List<AdminDtos.BacktestLegPayload> legs) {
        return buildStrategy("My Strategy", "NSE_INDEX|Nifty 50", "FUTURES", "INTRADAY",
                defaultOverallSettings(), defaultLegwiseSettings(),
                legs, defaultAdvancedConditions());
    }

    private AdminDtos.BacktestStrategyPayload strategyWithAdvancedConditions(
            AdminDtos.BacktestAdvancedConditionsPayload cond) {
        return buildStrategy("My Strategy", "NSE_INDEX|Nifty 50", "FUTURES", "INTRADAY",
                defaultOverallSettings(), defaultLegwiseSettings(),
                List.of(defaultLeg()), cond);
    }

    private AdminDtos.BacktestStrategyPayload buildStrategy(
            String name, String instrument, String source, String type,
            AdminDtos.BacktestOverallSettingsPayload overall,
            AdminDtos.BacktestLegwiseSettingsPayload legwise,
            List<AdminDtos.BacktestLegPayload> legs,
            AdminDtos.BacktestAdvancedConditionsPayload advanced) {
        return new AdminDtos.BacktestStrategyPayload(
                name, instrument, source, type,
                LocalTime.of(9, 35), LocalTime.of(15, 15),
                LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 23),
                legs, legwise, overall, advanced);
    }

    private AdminDtos.BacktestLegPayload defaultLeg() {
        return new AdminDtos.BacktestLegPayload("leg-1", "OPTIONS", 1, "BUY", "CALL", "WEEKLY", "ATM", 0, null);
    }

    private AdminDtos.BacktestOverallSettingsPayload defaultOverallSettings() {
        return new AdminDtos.BacktestOverallSettingsPayload(
                false, null, BigDecimal.ZERO, false, null, BigDecimal.ZERO,
                false, null, BigDecimal.ZERO, BigDecimal.ZERO);
    }

    private AdminDtos.BacktestLegwiseSettingsPayload defaultLegwiseSettings() {
        return new AdminDtos.BacktestLegwiseSettingsPayload(
                "PARTIAL", false, "ALL_LEGS", false, null, false, null, BigDecimal.ZERO);
    }

    private AdminDtos.BacktestAdvancedConditionsPayload defaultAdvancedConditions() {
        return new AdminDtos.BacktestAdvancedConditionsPayload(false, null, null);
    }
}
