package com.inalgo.trade.admin;

import com.inalgo.trade.repository.CandleRepository;
import com.inalgo.trade.upstox.UpstoxCandleResponse;
import com.inalgo.trade.upstox.UpstoxClient;
import jakarta.validation.ValidationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

@Service
public class BacktestCandleSyncService {
    private static final ZoneId MARKET_ZONE = ZoneId.of("Asia/Kolkata");
    private static final int DEFAULT_EXECUTION_INTERVAL_MINUTES = 5;

    private final CandleRepository candleRepository;
    private final UpstoxClient upstoxClient;
    private final TransactionTemplate transactionTemplate;

    public BacktestCandleSyncService(
            CandleRepository candleRepository,
            UpstoxClient upstoxClient,
            PlatformTransactionManager transactionManager
    ) {
        this.candleRepository = candleRepository;
        this.upstoxClient = upstoxClient;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    public int syncRange(
            String tenantId,
            String instrumentKey,
            LocalDate fromDate,
            LocalDate toDate,
            boolean expiredContract
    ) {
        return syncRange(tenantId, instrumentKey, fromDate, toDate, expiredContract, DEFAULT_EXECUTION_INTERVAL_MINUTES);
    }

    public int syncRange(
            String tenantId,
            String instrumentKey,
            LocalDate fromDate,
            LocalDate toDate,
            boolean expiredContract,
            int timeframeIntervalMinutes
    ) {
        return expiredContract
                ? syncExpiredInstrument(tenantId, instrumentKey, fromDate, toDate, timeframeIntervalMinutes)
                : syncActiveInstrument(tenantId, instrumentKey, fromDate, toDate, timeframeIntervalMinutes);
    }

    private int syncActiveInstrument(
            String tenantId,
            String instrumentKey,
            LocalDate fromDate,
            LocalDate toDate,
            int timeframeIntervalMinutes
    ) {
        LocalDate today = LocalDate.now(MARKET_ZONE);
        if (fromDate.isAfter(today)) {
            return 0;
        }

        LocalDate boundedToDate = toDate.isAfter(today) ? today : toDate;
        int persisted = 0;
        LocalDate cursor = fromDate;
        int windowDays = 30;
        while (!cursor.isAfter(boundedToDate)) {
            LocalDate chunkTo = cursor.plusDays(windowDays - 1L);
            if (chunkTo.isAfter(boundedToDate)) {
                chunkTo = boundedToDate;
            }
            try {
                persisted += persistCandles(
                        tenantId,
                        instrumentKey,
                        "minutes",
                        timeframeIntervalMinutes,
                        fetchActiveChunkCandles(instrumentKey, cursor, chunkTo, today, timeframeIntervalMinutes)
                );
                cursor = chunkTo.plusDays(1);
            } catch (ValidationException ex) {
                if (shouldShrinkWindow(ex) && windowDays > 2) {
                    windowDays = Math.max(windowDays / 2, 2);
                    continue;
                }
                throw ex;
            }
        }
        return persisted;
    }

    private List<List<Object>> fetchActiveChunkCandles(
            String instrumentKey,
            LocalDate chunkFrom,
            LocalDate chunkTo,
            LocalDate today,
            int timeframeIntervalMinutes
    ) {
        if (!chunkTo.equals(today)) {
            return upstoxClient.fetchHistoricalCandles(
                    instrumentKey,
                    "minutes",
                    timeframeIntervalMinutes,
                    chunkTo,
                    chunkFrom
            ).candles();
        }

        List<List<Object>> mergedCandles = new ArrayList<>();
        LocalDate historicalTo = today.minusDays(1);
        if (!chunkFrom.isAfter(historicalTo)) {
            mergedCandles.addAll(upstoxClient.fetchHistoricalCandles(
                    instrumentKey,
                    "minutes",
                    timeframeIntervalMinutes,
                    historicalTo,
                    chunkFrom
            ).candles());
        }
        mergedCandles.addAll(upstoxClient.fetchIntradayCandles(
                instrumentKey,
                "minutes",
                timeframeIntervalMinutes
        ).candles());
        return mergedCandles;
    }

    private int syncExpiredInstrument(
            String tenantId,
            String instrumentKey,
            LocalDate fromDate,
            LocalDate toDate,
            int timeframeIntervalMinutes
    ) {
        int persisted = 0;
        LocalDate cursor = fromDate;
        while (!cursor.isAfter(toDate)) {
            LocalDate chunkTo = cursor.plusDays(28);
            if (chunkTo.isAfter(toDate)) {
                chunkTo = toDate;
            }
            UpstoxCandleResponse response = upstoxClient.fetchExpiredHistoricalCandles(
                    instrumentKey,
                    toExpiredTimeframe(timeframeIntervalMinutes),
                    chunkTo,
                    cursor
            );
            persisted += persistCandles(tenantId, instrumentKey, "minutes", timeframeIntervalMinutes, response.candles());
            cursor = chunkTo.plusDays(1);
        }
        return persisted;
    }

    private String toExpiredTimeframe(int timeframeIntervalMinutes) {
        return switch (timeframeIntervalMinutes) {
            case 1 -> "1minute";
            case 5 -> "5minute";
            case 15 -> "15minute";
            case 30 -> "30minute";
            case 60 -> "60minute";
            default -> throw new ValidationException("Unsupported execution timeframe interval for expired candles: " + timeframeIntervalMinutes);
        };
    }

    private int persistCandles(
            String tenantId,
            String instrumentKey,
            String timeframeUnit,
            int timeframeInterval,
            List<List<Object>> candles
    ) {
        if (candles == null || candles.isEmpty()) {
            return 0;
        }
        Integer writes = transactionTemplate.execute(status -> {
            int localWrites = 0;
            for (List<Object> row : candles) {
                if (row == null || row.size() < 5) {
                    continue;
                }
                Instant ts = parseInstant(row.getFirst());
                if (ts == null) {
                    continue;
                }
                BigDecimal open = toBigDecimal(row.get(1));
                BigDecimal high = toBigDecimal(row.get(2));
                BigDecimal low = toBigDecimal(row.get(3));
                BigDecimal close = toBigDecimal(row.get(4));
                Long volume = row.size() > 5 ? toLong(row.get(5)) : null;
                if (open == null || high == null || low == null || close == null) {
                    continue;
                }
                candleRepository.upsert(
                        tenantId,
                        instrumentKey,
                        timeframeUnit,
                        timeframeInterval,
                        ts,
                        open,
                        high,
                        low,
                        close,
                        volume
                );
                localWrites += 1;
            }
            return localWrites;
        });
        return writes == null ? 0 : writes;
    }

    private Instant parseInstant(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return java.time.OffsetDateTime.parse(value.toString()).toInstant();
        } catch (Exception ignored) {
            try {
                return Instant.parse(value.toString());
            } catch (Exception ignoredAgain) {
                return null;
            }
        }
    }

    private Long toLong(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return Long.parseLong(value.toString());
        } catch (Exception ex) {
            return null;
        }
    }

    private BigDecimal toBigDecimal(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return new BigDecimal(value.toString());
        } catch (Exception ex) {
            return null;
        }
    }

    private boolean shouldShrinkWindow(ValidationException ex) {
        String message = ex.getMessage();
        return message != null && message.contains("UDAPI1148");
    }
}
