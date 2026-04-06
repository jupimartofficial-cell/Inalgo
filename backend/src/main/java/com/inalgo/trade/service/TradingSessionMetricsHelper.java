package com.inalgo.trade.service;

import com.inalgo.trade.entity.CandleEntity;
import com.inalgo.trade.repository.CandleRepository;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.List;

/**
 * Stateless helper for session metrics and gap resolution used by TradingAnalyticsService.
 * Extracted from TradingAnalyticsService to keep the main service under the line-budget.
 */
@Component
class TradingSessionMetricsHelper {

    private static final String MINUTES = "minutes";
    private static final int GAP_TIMEFRAME_INTERVAL = 5;
    static final ZoneId MARKET_ZONE = ZoneId.of("Asia/Kolkata");

    private static final BigDecimal GAP_THRESHOLD_PERCENT = new BigDecimal("0.10");
    private static final BigDecimal ONE_HUNDRED = new BigDecimal("100");
    private static final MathContext MATH_CONTEXT = new MathContext(16, RoundingMode.HALF_UP);
    private static final int CALCULATION_SCALE = EmaCalculator.SCALE + 6;

    static final String GAP_UP = "Gap Up";
    static final String GAP_DOWN = "Gap Down";
    static final String GAP_NORMAL = "Normal";

    private final CandleRepository candleRepository;

    TradingSessionMetricsHelper(CandleRepository candleRepository) {
        this.candleRepository = candleRepository;
    }

    CurrentSessionMetrics resolveCurrentSessionMetrics(
            String tenantId,
            String instrumentKey,
            Instant firstFiveMinuteStart,
            Instant firstFiveMinuteEnd
    ) {
        return candleRepository
                .findFirstByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeIntervalAndCandleTsGreaterThanEqualAndCandleTsLessThanOrderByCandleTsAsc(
                        tenantId,
                        instrumentKey,
                        MINUTES,
                        GAP_TIMEFRAME_INTERVAL,
                        firstFiveMinuteStart,
                        firstFiveMinuteEnd
                )
                .map(candle -> new CurrentSessionMetrics(candle.getOpenPrice(), candle.getClosePrice()))
                .orElse(CurrentSessionMetrics.empty());
    }

    PreviousSessionMetrics resolvePreviousSessionMetrics(
            String tenantId,
            String instrumentKey,
            Instant currentDayStart
    ) {
        return candleRepository
                .findFirstByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeIntervalAndCandleTsLessThanOrderByCandleTsDesc(
                        tenantId,
                        instrumentKey,
                        MINUTES,
                        GAP_TIMEFRAME_INTERVAL,
                        currentDayStart
                )
                .map(previousCandle -> buildPreviousSessionMetrics(tenantId, instrumentKey, previousCandle))
                .orElse(PreviousSessionMetrics.empty());
    }

    GapMetrics resolveGapMetrics(
            CurrentSessionMetrics currentSessionMetrics,
            PreviousSessionMetrics previousSessionMetrics
    ) {
        if (currentSessionMetrics.todayOpen() == null
                || previousSessionMetrics.prevHigh() == null
                || previousSessionMetrics.prevLow() == null
                || previousSessionMetrics.prevClose() == null
                || previousSessionMetrics.prevClose().signum() == 0) {
            return GapMetrics.empty();
        }

        BigDecimal rawGapPct = currentSessionMetrics.todayOpen()
                .subtract(previousSessionMetrics.prevClose(), MATH_CONTEXT)
                .multiply(ONE_HUNDRED, MATH_CONTEXT)
                .divide(previousSessionMetrics.prevClose(), CALCULATION_SCALE, RoundingMode.HALF_UP);
        BigDecimal storedGapPct = rawGapPct.setScale(EmaCalculator.SCALE, RoundingMode.HALF_UP);

        if (currentSessionMetrics.todayOpen().compareTo(previousSessionMetrics.prevHigh()) > 0
                && rawGapPct.compareTo(GAP_THRESHOLD_PERCENT) >= 0) {
            return new GapMetrics(storedGapPct, GAP_UP, storedGapPct, null);
        }

        if (currentSessionMetrics.todayOpen().compareTo(previousSessionMetrics.prevLow()) < 0
                && rawGapPct.compareTo(GAP_THRESHOLD_PERCENT.negate()) <= 0) {
            return new GapMetrics(storedGapPct, GAP_DOWN, null, storedGapPct.abs());
        }

        return new GapMetrics(storedGapPct, GAP_NORMAL, null, null);
    }

    private PreviousSessionMetrics buildPreviousSessionMetrics(
            String tenantId,
            String instrumentKey,
            CandleEntity previousCandle
    ) {
        LocalDate previousTradeDate = previousCandle.getCandleTs().atZone(MARKET_ZONE).toLocalDate();
        Instant previousDayStart = previousTradeDate.atStartOfDay(MARKET_ZONE).toInstant();
        Instant previousDayEnd = previousTradeDate.plusDays(1).atStartOfDay(MARKET_ZONE).toInstant();

        List<CandleEntity> previousSessionCandles = candleRepository
                .findByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeIntervalAndCandleTsGreaterThanEqualAndCandleTsLessThanOrderByCandleTsAsc(
                        tenantId,
                        instrumentKey,
                        MINUTES,
                        GAP_TIMEFRAME_INTERVAL,
                        previousDayStart,
                        previousDayEnd
                );

        if (previousSessionCandles.isEmpty()) {
            return PreviousSessionMetrics.empty();
        }

        BigDecimal prevHigh = previousSessionCandles.stream()
                .map(CandleEntity::getHighPrice)
                .max(Comparator.naturalOrder())
                .orElse(null);
        BigDecimal prevLow = previousSessionCandles.stream()
                .map(CandleEntity::getLowPrice)
                .min(Comparator.naturalOrder())
                .orElse(null);
        BigDecimal prevClose = previousSessionCandles.getLast().getClosePrice();

        return new PreviousSessionMetrics(prevHigh, prevLow, prevClose);
    }

    record CurrentSessionMetrics(BigDecimal todayOpen, BigDecimal todayClose) {
        static CurrentSessionMetrics empty() {
            return new CurrentSessionMetrics(null, null);
        }
    }

    record PreviousSessionMetrics(BigDecimal prevHigh, BigDecimal prevLow, BigDecimal prevClose) {
        static PreviousSessionMetrics empty() {
            return new PreviousSessionMetrics(null, null, null);
        }
    }

    record GapMetrics(BigDecimal gapPct, String gapType, BigDecimal gapUpPct, BigDecimal gapDownPct) {
        static GapMetrics empty() {
            return new GapMetrics(null, null, null, null);
        }
    }
}
