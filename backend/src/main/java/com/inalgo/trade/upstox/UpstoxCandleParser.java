package com.inalgo.trade.upstox;

import jakarta.validation.ValidationException;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * Parses and validates raw Upstox candle row payloads into typed objects.
 * Extracted from UpstoxHistoricalMigrationService to keep the main service under the line-budget.
 */
class UpstoxCandleParser {

    private UpstoxCandleParser() {}

    static ParsedCandle parseCandleRow(List<Object> row) {
        if (row == null || row.size() < 5) {
            throw new ValidationException("Upstox candle row does not have minimum OHLC fields");
        }
        Instant candleTs = OffsetDateTime.parse(asRequiredString(row.getFirst(), "timestamp")).toInstant();
        BigDecimal open = asDecimal(row.get(1), "open");
        BigDecimal high = asDecimal(row.get(2), "high");
        BigDecimal low = asDecimal(row.get(3), "low");
        BigDecimal close = asDecimal(row.get(4), "close");
        Long volume = row.size() > 5 && row.get(5) != null ? Long.parseLong(row.get(5).toString()) : null;
        if (low.compareTo(high) > 0) {
            throw new ValidationException("Invalid candle range received from Upstox");
        }
        return new ParsedCandle(candleTs, open, high, low, close, volume);
    }

    static List<List<Object>> safeCandles(UpstoxCandleResponse response) {
        if (response == null || response.candles() == null) {
            return List.of();
        }
        return response.candles();
    }

    static boolean shouldShrinkWindow(ValidationException ex) {
        String msg = ex.getMessage();
        return msg != null && msg.contains("UDAPI1148");
    }

    static boolean isRetriableProviderError(RuntimeException ex) {
        String message = ex.getMessage();
        if (message == null) {
            return false;
        }
        String normalized = message.toLowerCase();
        return normalized.contains("status: 429")
                || normalized.contains("too_many_requests")
                || normalized.contains("temporarily unavailable")
                || normalized.contains("connection reset")
                || normalized.contains("read timed out");
    }

    private static String asRequiredString(Object value, String fieldName) {
        if (value == null) {
            throw new ValidationException("Missing Upstox candle field: " + fieldName);
        }
        return value.toString();
    }

    private static BigDecimal asDecimal(Object value, String fieldName) {
        if (value == null) {
            throw new ValidationException("Missing Upstox candle field: " + fieldName);
        }
        return new BigDecimal(value.toString());
    }

    record ParsedCandle(
            Instant candleTs,
            BigDecimal openPrice,
            BigDecimal highPrice,
            BigDecimal lowPrice,
            BigDecimal closePrice,
            Long volume
    ) {}
}
