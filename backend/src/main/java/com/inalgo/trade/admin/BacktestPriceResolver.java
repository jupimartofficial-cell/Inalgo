package com.inalgo.trade.admin;

import com.inalgo.trade.entity.CandleEntity;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Resolves market prices from local candle data.
 * Entry pricing prefers the first candle at or after the target time;
 * exit pricing prefers the last candle at or before it.
 * Falls back to the opposite-side candle (flagged as non-market) when the preferred side is absent.
 */
@Component
class BacktestPriceResolver {

    private static final long EXECUTION_LOOKUP_WINDOW_SECONDS = 60L * 60L;
    private static final BigDecimal SYNTHETIC_TIME_VALUE = new BigDecimal("10");

    /**
     * Resolves the best available price near a target timestamp from a candle series.
     *
     * @param entrySide {@code true} for entry (prefer at-or-after), {@code false} for exit (prefer at-or-before)
     */
    PriceResolution resolveTradePriceNearTimestamp(List<CandleEntity> series, Instant targetTs, boolean entrySide) {
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
     * Uses nearby derivative candles for mark-to-market first, then falls back to synthetic or underlying prices.
     */
    PriceResolution resolveLegMarkPrice(PreparedLeg leg, Instant markTs, BigDecimal underlyingPrice) {
        BigDecimal market = findPriceAtOrBefore(
                leg.series(), markTs, markTs.minusSeconds(EXECUTION_LOOKUP_WINDOW_SECONDS));
        if (market == null) {
            market = findPriceAtOrAfter(
                    leg.series(), markTs, markTs.plusSeconds(EXECUTION_LOOKUP_WINDOW_SECONDS));
        }
        if (market != null) {
            return new PriceResolution(market, true);
        }
        if (leg.optionLeg()) {
            return new PriceResolution(syntheticOptionPrice(leg.optionType(), leg.strikePrice(), underlyingPrice), false);
        }
        return new PriceResolution(underlyingPrice, false);
    }

    PriceResolution resolveLegExitPrice(PreparedLeg leg, Instant exitTs, BigDecimal underlyingExitPrice) {
        return resolveLegMarkPrice(leg, exitTs, underlyingExitPrice);
    }

    BigDecimal findPriceAtOrAfter(List<CandleEntity> series, Instant fromTs, Instant maxTs) {
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

    BigDecimal findPriceAtOrBefore(List<CandleEntity> series, Instant toTs, Instant minTs) {
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

    BigDecimal syntheticOptionPrice(String optionType, BigDecimal strikePrice, BigDecimal underlyingPrice) {
        BigDecimal intrinsic = "CALL".equals(optionType)
                ? underlyingPrice.subtract(strikePrice).max(BigDecimal.ZERO)
                : strikePrice.subtract(underlyingPrice).max(BigDecimal.ZERO);
        return intrinsic.add(SYNTHETIC_TIME_VALUE);
    }
}
