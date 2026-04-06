package com.inalgo.trade.service;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;

/**
 * Stateless EMA (Exponential Moving Average) computation utilities.
 * Extracted from TradingAnalyticsService to keep the main service under the line-budget.
 */
class EmaCalculator {

    static final int EMA_9_PERIOD = 9;
    static final int EMA_26_PERIOD = 26;
    static final int EMA_110_PERIOD = 110;
    static final int SCALE = 6;
    static final int CALCULATION_SCALE = SCALE + 6;
    static final MathContext MATH_CONTEXT = new MathContext(16, RoundingMode.HALF_UP);

    private EmaCalculator() {}

    static EmaAccumulator accumulator(int period) {
        return new EmaAccumulator(period);
    }

    record EmaResult(BigDecimal dma9, BigDecimal dma26, BigDecimal dma110) {}

    static final class EmaAccumulator {
        private final int period;
        private final BigDecimal multiplier;
        private BigDecimal seedSum = BigDecimal.ZERO;
        private BigDecimal ema;
        private int count;

        private EmaAccumulator(int period) {
            this.period = period;
            this.multiplier = BigDecimal.valueOf(2)
                    .divide(BigDecimal.valueOf(period + 1L), CALCULATION_SCALE, RoundingMode.HALF_UP);
        }

        void accept(BigDecimal close) {
            count++;
            if (count <= period) {
                seedSum = seedSum.add(close, MATH_CONTEXT);
                if (count == period) {
                    ema = seedSum.divide(BigDecimal.valueOf(period), CALCULATION_SCALE, RoundingMode.HALF_UP);
                }
                return;
            }

            ema = close.subtract(ema, MATH_CONTEXT)
                    .multiply(multiplier, MATH_CONTEXT)
                    .add(ema, MATH_CONTEXT);
        }

        BigDecimal value() {
            return ema == null ? null : ema.setScale(SCALE, RoundingMode.HALF_UP);
        }
    }
}
