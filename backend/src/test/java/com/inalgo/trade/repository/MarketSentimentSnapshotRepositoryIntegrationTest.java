package com.inalgo.trade.repository;

import com.inalgo.trade.support.TestDatabaseSupport;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

@SpringBootTest
@TestPropertySource(properties = {
        "upstox.migration.enabled=false",
        "upstox.option-chain.enabled=false",
        "spring.task.scheduling.enabled=false"
})
@Transactional
class MarketSentimentSnapshotRepositoryIntegrationTest {
    private static final String TEST_SCHEMA = TestDatabaseSupport.createIsolatedSchema("market_sentiment_accuracy");
    private static final ZoneId MARKET_ZONE = ZoneId.of("Asia/Kolkata");

    @DynamicPropertySource
    static void registerDatasource(DynamicPropertyRegistry registry) {
        TestDatabaseSupport.registerIsolatedSchemaProperties(registry, TEST_SCHEMA);
    }

    @AfterAll
    static void dropSchema() {
        TestDatabaseSupport.dropSchema(TEST_SCHEMA);
    }

    @Autowired
    private MarketSentimentSnapshotRepository repository;

    @Autowired
    private CandleRepository candleRepository;

    @Test
    void computeDailyAccuracy_fallsBackToMinuteCloseWhenDailyCandleIsMissing() {
        String tenantId = "tenant-accuracy";
        String instrumentKey = "NSE_INDEX|Nifty 50";
        LocalDate day1 = LocalDate.now(MARKET_ZONE).minusDays(4);
        LocalDate day2 = day1.plusDays(1);
        LocalDate day3 = day2.plusDays(1);

        upsertDailyCandle(tenantId, instrumentKey, day1, new BigDecimal("100"));
        upsertMinuteClose(tenantId, instrumentKey, day2, new BigDecimal("110"));
        upsertMinuteClose(tenantId, instrumentKey, day3, new BigDecimal("90"));

        upsertSnapshot(tenantId, "INDIA_NEWS", day2, "BULL", "BULL", 70);
        upsertSnapshot(tenantId, "INDIA_NEWS", day3, "BEAR", "BEAR", 75);

        Instant fromDate = day1.minusDays(1).atStartOfDay(MARKET_ZONE).toInstant();
        List<Object[]> rows = repository.computeDailyAccuracy(
                tenantId,
                "INDIA_NEWS",
                fromDate,
                fromDate,
                instrumentKey
        );

        assertEquals(2, rows.size());
        assertEquals(day3.toString(), rows.get(0)[0]);
        assertEquals("BEAR", rows.get(0)[8]);
        assertEquals(day2.toString(), rows.get(1)[0]);
        assertEquals("BULL", rows.get(1)[8]);
    }

    @Test
    void computeWindowAccuracy_usesRequestedWindowAndCandleInterval() {
        String tenantId = "tenant-window-accuracy";
        String instrumentKey = "NSE_INDEX|Nifty 50";
        LocalDate day = LocalDate.now(MARKET_ZONE).minusDays(3);

        upsertMinuteCandleAtTime(tenantId, instrumentKey, day, LocalTime.of(9, 15), new BigDecimal("100"));
        upsertMinuteCandleAtTime(tenantId, instrumentKey, day, LocalTime.of(9, 30), new BigDecimal("110"));
        upsertMinuteCandleAtTime(tenantId, instrumentKey, day, LocalTime.of(11, 30), new BigDecimal("111"));
        upsertMinuteCandleAtTime(tenantId, instrumentKey, day, LocalTime.of(14, 30), new BigDecimal("105"));

        upsertSnapshotAtTime(tenantId, "GLOBAL_NEWS", day, LocalTime.of(9, 20), "BULL", "BULL", 70);
        upsertSnapshotAtTime(tenantId, "GLOBAL_NEWS", day, LocalTime.of(12, 0), "BEAR", "BEAR", 75);

        Instant fromDate = day.minusDays(1).atStartOfDay(MARKET_ZONE).toInstant();

        int openSnapshotDays = repository.countDistinctSnapshotDaysInWindow(
                tenantId,
                "GLOBAL_NEWS",
                fromDate,
                "09:15",
                "09:30"
        );
        int middleSnapshotDays = repository.countDistinctSnapshotDaysInWindow(
                tenantId,
                "GLOBAL_NEWS",
                fromDate,
                "11:30",
                "14:30"
        );

        List<Object[]> openRows = repository.computeWindowAccuracy(
                tenantId,
                "GLOBAL_NEWS",
                fromDate,
                fromDate,
                instrumentKey,
                15,
                "09:15",
                "09:30"
        );
        List<Object[]> middleRows = repository.computeWindowAccuracy(
                tenantId,
                "GLOBAL_NEWS",
                fromDate,
                fromDate,
                instrumentKey,
                15,
                "11:30",
                "14:30"
        );

        assertEquals(1, openSnapshotDays);
        assertEquals(1, middleSnapshotDays);
        assertEquals(1, openRows.size());
        assertEquals(1, middleRows.size());
        assertEquals("BULL", openRows.get(0)[8]);
        assertEquals("BEAR", middleRows.get(0)[8]);
    }

    private void upsertDailyCandle(String tenantId, String instrumentKey, LocalDate date, BigDecimal closePrice) {
        Instant candleTs = date.atTime(LocalTime.of(15, 30)).atZone(MARKET_ZONE).toInstant();
        candleRepository.upsert(
                tenantId,
                instrumentKey,
                "days",
                1,
                candleTs,
                closePrice,
                closePrice,
                closePrice,
                closePrice,
                1000L
        );
    }

    private void upsertMinuteClose(String tenantId, String instrumentKey, LocalDate date, BigDecimal closePrice) {
        Instant candleTs = date.atTime(LocalTime.of(15, 29)).atZone(MARKET_ZONE).toInstant();
        candleRepository.upsert(
                tenantId,
                instrumentKey,
                "minutes",
                1,
                candleTs,
                closePrice,
                closePrice,
                closePrice,
                closePrice,
                1000L
        );
    }

    private void upsertMinuteCandleAtTime(
            String tenantId,
            String instrumentKey,
            LocalDate date,
            LocalTime localTime,
            BigDecimal closePrice
    ) {
        Instant candleTs = date.atTime(localTime).atZone(MARKET_ZONE).toInstant();
        candleRepository.upsert(
                tenantId,
                instrumentKey,
                "minutes",
                15,
                candleTs,
                closePrice,
                closePrice,
                closePrice,
                closePrice,
                1000L
        );
    }

    private void upsertSnapshot(
            String tenantId,
            String scope,
            LocalDate date,
            String trendStatus,
            String aiAnalysis,
            int confidence
    ) {
        Instant snapshotAt = date.atTime(LocalTime.of(12, 0)).atZone(MARKET_ZONE).toInstant();
        repository.upsert(
                tenantId,
                scope,
                scope.equals("INDIA_NEWS") ? "India News" : "Global News",
                "NEWS_SENTIMENT",
                trendStatus,
                "test reason",
                null,
                null,
                null,
                null,
                1,
                1,
                "source",
                snapshotAt,
                aiAnalysis,
                "ai reason",
                confidence,
                "gpt-5-mini",
                snapshotAt,
                snapshotAt
        );
    }

    private void upsertSnapshotAtTime(
            String tenantId,
            String scope,
            LocalDate date,
            LocalTime localTime,
            String trendStatus,
            String aiAnalysis,
            int confidence
    ) {
        Instant snapshotAt = date.atTime(localTime).atZone(MARKET_ZONE).toInstant();
        repository.upsert(
                tenantId,
                scope,
                scope.equals("INDIA_NEWS") ? "India News" : "Global News",
                "NEWS_SENTIMENT",
                trendStatus,
                "test reason",
                null,
                null,
                null,
                null,
                1,
                1,
                "source",
                snapshotAt,
                aiAnalysis,
                "ai reason",
                confidence,
                "gpt-5-mini",
                snapshotAt,
                snapshotAt
        );
    }
}
