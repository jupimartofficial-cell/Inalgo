package com.inalgo.trade.service;

import com.inalgo.trade.entity.TradingDayParamEntity;
import com.inalgo.trade.entity.TradingSignalEntity;
import com.inalgo.trade.repository.CandleRepository;
import com.inalgo.trade.support.TestDatabaseSupport;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

@SpringBootTest
@TestPropertySource(properties = {
        "upstox.migration.enabled=false",
        "upstox.option-chain.enabled=false",
        "spring.task.scheduling.enabled=false"
})
@Transactional
class TradingAnalyticsServicePostgresIntegrationTest {
    private static final String TEST_SCHEMA = TestDatabaseSupport.createIsolatedSchema("trading_analytics");

    @DynamicPropertySource
    static void registerDatasource(DynamicPropertyRegistry registry) {
        TestDatabaseSupport.registerIsolatedSchemaProperties(registry, TEST_SCHEMA);
    }

    @AfterAll
    static void dropSchema() {
        TestDatabaseSupport.dropSchema(TEST_SCHEMA);
    }

    private static final int SCALE = 6;
    private static final MathContext MATH_CONTEXT = new MathContext(16, RoundingMode.HALF_UP);


    @Autowired
    private TradingAnalyticsService tradingAnalyticsService;

    @Autowired
    private CandleRepository candleRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void refreshTradingSignal_persistsBuySignalAndUpsertsOneRowPerDay() {
        String tenantId = "tenant-signal-buy";
        String instrumentKey = "NSE_INDEX|Nifty 50";
        List<BigDecimal> closes = seedSeries(tenantId, instrumentKey, "minutes", 5, 120, new BigDecimal("100"), BigDecimal.ONE);

        TradingSignalEntity firstPass = tradingAnalyticsService.refreshTradingSignal(tenantId, instrumentKey, "minutes", 5);

        assertEquals(TradingAnalyticsService.SIGNAL_BUY, firstPass.getSignal());
        assertEquals(closes.getLast().setScale(6), firstPass.getCurrentClose().setScale(6));
        assertEquals(closes.get(closes.size() - 2).setScale(6), firstPass.getPreviousClose().setScale(6));
        assertEquals(emaOfSeries(closes, 9), firstPass.getDma9());
        assertEquals(emaOfSeries(closes, 26), firstPass.getDma26());
        assertEquals(emaOfSeries(closes, 110), firstPass.getDma110());
        assertEquals(1L, tableCount("trading_signal"));

        upsertCandle(
                tenantId,
                instrumentKey,
                "minutes",
                5,
                Instant.now(),
                new BigDecimal("1000"),
                new BigDecimal("1002"),
                new BigDecimal("999"),
                new BigDecimal("1001"),
                2000L
        );

        TradingSignalEntity secondPass = tradingAnalyticsService.refreshTradingSignal(tenantId, instrumentKey, "minutes", 5);
        assertEquals(1L, tableCount("trading_signal"));
        assertEquals(new BigDecimal("1001.000000"), secondPass.getCurrentClose().setScale(6));
    }

    @Test
    void refreshTradingSignal_persistsSellSignal() {
        String tenantId = "tenant-signal-sell";
        String instrumentKey = "NSE_INDEX|Nifty Bank";
        List<BigDecimal> closes = seedSeries(tenantId, instrumentKey, "minutes", 15, 120, new BigDecimal("220"), new BigDecimal("-1"));

        TradingSignalEntity signal = tradingAnalyticsService.refreshTradingSignal(tenantId, instrumentKey, "minutes", 15);

        assertEquals(TradingAnalyticsService.SIGNAL_SELL, signal.getSignal());
        assertEquals(emaOfSeries(closes, 9), signal.getDma9());
        assertEquals(emaOfSeries(closes, 26), signal.getDma26());
        assertEquals(emaOfSeries(closes, 110), signal.getDma110());
    }

    @Test
    void refreshTradingSignal_persistsHoldSignalWhenDmasAreFlat() {
        String tenantId = "tenant-signal-hold";
        String instrumentKey = "BSE_INDEX|SENSEX";
        seedSeries(tenantId, instrumentKey, "days", 1, 120, new BigDecimal("500"), BigDecimal.ZERO);

        TradingSignalEntity signal = tradingAnalyticsService.refreshTradingSignal(tenantId, instrumentKey, "days", 1);

        assertEquals(TradingAnalyticsService.SIGNAL_HOLD, signal.getSignal());
        assertEquals(new BigDecimal("500.000000"), signal.getDma9());
        assertEquals(new BigDecimal("500.000000"), signal.getDma26());
        assertEquals(new BigDecimal("500.000000"), signal.getDma110());
    }

    @Test
    void refreshTradingSignal_usesLatestCandleTradeDateForSignalDate() {
        String tenantId = "tenant-signal-date";
        String instrumentKey = "NSE_INDEX|Nifty 50";
        LocalDate expectedSignalDate = LocalDate.of(2026, 3, 13);
        Instant latestCandleTs = expectedSignalDate
                .atTime(LocalTime.of(15, 15))
                .atZone(TradingAnalyticsService.MARKET_ZONE)
                .toInstant();

        BigDecimal close = new BigDecimal("23000");
        for (int index = 0; index < 120; index++) {
            Instant candleTs = latestCandleTs.minusSeconds((long) (119 - index) * 15 * 60);
            upsertCandle(
                    tenantId,
                    instrumentKey,
                    "minutes",
                    15,
                    candleTs,
                    close,
                    close.add(BigDecimal.ONE),
                    close.subtract(BigDecimal.ONE),
                    close,
                    1_000L + index
            );
            close = close.add(BigDecimal.ONE);
        }

        TradingSignalEntity signal = tradingAnalyticsService.refreshTradingSignal(tenantId, instrumentKey, "minutes", 15);

        assertEquals(expectedSignalDate, signal.getSignalDate());
    }

    @Test
    void refreshTradingSignal_normalizesTimeframeUnitBeforeUpsert() {
        String tenantId = "tenant-signal-timeframe-normalized";
        String instrumentKey = "NSE_INDEX|Nifty 50";
        seedSeries(tenantId, instrumentKey, "minutes", 15, 120, new BigDecimal("23000"), BigDecimal.ONE);

        TradingSignalEntity firstPass = tradingAnalyticsService.refreshTradingSignal(
                tenantId,
                instrumentKey,
                " MINUTES ",
                15
        );
        TradingSignalEntity secondPass = tradingAnalyticsService.refreshTradingSignal(
                tenantId,
                instrumentKey,
                "minutes",
                15
        );

        assertEquals(1L, tableCount("trading_signal"));
        assertEquals("minutes", firstPass.getTimeframeUnit());
        assertEquals("minutes", secondPass.getTimeframeUnit());
    }

    @Test
    void refreshTradingSignal_dma110UsesHistoricalSeriesBeyondLatestWindow() {
        String tenantId = "tenant-signal-historical-ema";
        String instrumentKey = "NSE_INDEX|Nifty Bank";

        List<BigDecimal> historicalCloses = seedSeries(
                tenantId,
                instrumentKey,
                "minutes",
                15,
                240,
                new BigDecimal("58000"),
                new BigDecimal("-20")
        );

        TradingSignalEntity signal = tradingAnalyticsService.refreshTradingSignal(tenantId, instrumentKey, "minutes", 15);

        BigDecimal expectedSeriesEma = emaOfSeries(historicalCloses, 110);
        BigDecimal truncatedTailEma = emaOfTailWithFirstValueSeed(historicalCloses, 110);
        assertEquals(expectedSeriesEma, signal.getDma110());
        assertNotEquals(truncatedTailEma, signal.getDma110());
    }

    @Test
    void refreshTradingDayParam_marksOrbBreakoutAndUpsertsOneRowPerDay() {
        String tenantId = "tenant-orb-breakout";
        String instrumentKey = "NSE_FO|51714";
        LocalDate tradeDate = LocalDate.now(TradingAnalyticsService.MARKET_ZONE);
        LocalDate previousTradeDate = previousWeekday(tradeDate, 1);

        seedTradingSession5MinuteCandle(
                tenantId,
                instrumentKey,
                previousTradeDate,
                LocalTime.of(9, 15),
                new BigDecimal("100"),
                new BigDecimal("110"),
                new BigDecimal("98"),
                new BigDecimal("108")
        );
        seedTradingSession5MinuteCandle(
                tenantId,
                instrumentKey,
                previousTradeDate,
                LocalTime.of(15, 25),
                new BigDecimal("107"),
                new BigDecimal("109"),
                new BigDecimal("106"),
                new BigDecimal("107")
        );
        seedTradingSession5MinuteCandle(
                tenantId,
                instrumentKey,
                tradeDate,
                LocalTime.of(9, 15),
                new BigDecimal("112"),
                new BigDecimal("114"),
                new BigDecimal("111"),
                new BigDecimal("113")
        );
        seedOpeningRange(tenantId, instrumentKey, tradeDate, new BigDecimal("105"), new BigDecimal("111"), new BigDecimal("99"), new BigDecimal("108"));
        seedMinuteClose(tenantId, instrumentKey, tradeDate, LocalTime.of(9, 32), new BigDecimal("112"));

        TradingDayParamEntity firstPass = tradingAnalyticsService.refreshTradingDayParam(tenantId, instrumentKey);

        assertEquals(new BigDecimal("111.000000"), firstPass.getOrbHigh().setScale(6));
        assertEquals(new BigDecimal("99.000000"), firstPass.getOrbLow().setScale(6));
        assertEquals(TradingAnalyticsService.YES, firstPass.getOrbBreakout());
        assertEquals(TradingAnalyticsService.NO, firstPass.getOrbBreakdown());
        assertEquals(new BigDecimal("112.000000"), firstPass.getTodayOpen().setScale(6));
        assertEquals(new BigDecimal("113.000000"), firstPass.getTodayClose().setScale(6));
        assertEquals(new BigDecimal("110.000000"), firstPass.getPrevHigh().setScale(6));
        assertEquals(new BigDecimal("98.000000"), firstPass.getPrevLow().setScale(6));
        assertEquals(new BigDecimal("107.000000"), firstPass.getPrevClose().setScale(6));
        assertEquals(new BigDecimal("4.672897"), firstPass.getGapPct().setScale(6));
        assertEquals(TradingAnalyticsService.GAP_UP, firstPass.getGapType());
        assertEquals(new BigDecimal("4.672897"), firstPass.getGapUpPct().setScale(6));
        assertNull(firstPass.getGapDownPct());
        assertEquals(1L, tableCount("trading_day_param"));

        seedMinuteClose(tenantId, instrumentKey, tradeDate, LocalTime.of(10, 1), new BigDecimal("109"));
        seedTradingSession5MinuteCandle(
                tenantId,
                instrumentKey,
                tradeDate,
                LocalTime.of(9, 15),
                new BigDecimal("105"),
                new BigDecimal("106"),
                new BigDecimal("104"),
                new BigDecimal("105")
        );

        TradingDayParamEntity secondPass = tradingAnalyticsService.refreshTradingDayParam(tenantId, instrumentKey);
        assertEquals(1L, tableCount("trading_day_param"));
        assertEquals(TradingAnalyticsService.NO, secondPass.getOrbBreakout());
        assertEquals(TradingAnalyticsService.NO, secondPass.getOrbBreakdown());
        assertEquals(new BigDecimal("-1.869159"), secondPass.getGapPct().setScale(6));
        assertEquals(TradingAnalyticsService.GAP_NORMAL, secondPass.getGapType());
        assertNull(secondPass.getGapUpPct());
        assertNull(secondPass.getGapDownPct());
    }

    @Test
    void refreshTradingDayParam_marksOrbBreakdown() {
        String tenantId = "tenant-orb-breakdown";
        String instrumentKey = "NSE_FO|51701";
        LocalDate tradeDate = LocalDate.now(TradingAnalyticsService.MARKET_ZONE);
        LocalDate previousTradeDate = previousWeekday(tradeDate, 2);

        seedTradingSession5MinuteCandle(
                tenantId,
                instrumentKey,
                previousTradeDate,
                LocalTime.of(9, 15),
                new BigDecimal("200"),
                new BigDecimal("212"),
                new BigDecimal("197"),
                new BigDecimal("208")
        );
        seedTradingSession5MinuteCandle(
                tenantId,
                instrumentKey,
                previousTradeDate,
                LocalTime.of(15, 25),
                new BigDecimal("198"),
                new BigDecimal("201"),
                new BigDecimal("196"),
                new BigDecimal("200")
        );
        seedTradingSession5MinuteCandle(
                tenantId,
                instrumentKey,
                tradeDate,
                LocalTime.of(9, 15),
                new BigDecimal("194"),
                new BigDecimal("196"),
                new BigDecimal("193"),
                new BigDecimal("195")
        );
        seedOpeningRange(tenantId, instrumentKey, tradeDate, new BigDecimal("200"), new BigDecimal("210"), new BigDecimal("195"), new BigDecimal("205"));
        seedMinuteClose(tenantId, instrumentKey, tradeDate, LocalTime.of(9, 45), new BigDecimal("194"));

        TradingDayParamEntity params = tradingAnalyticsService.refreshTradingDayParam(tenantId, instrumentKey);

        assertEquals(TradingAnalyticsService.NO, params.getOrbBreakout());
        assertEquals(TradingAnalyticsService.YES, params.getOrbBreakdown());
        assertEquals(new BigDecimal("194.000000"), params.getTodayOpen().setScale(6));
        assertEquals(new BigDecimal("195.000000"), params.getTodayClose().setScale(6));
        assertEquals(new BigDecimal("212.000000"), params.getPrevHigh().setScale(6));
        assertEquals(new BigDecimal("196.000000"), params.getPrevLow().setScale(6));
        assertEquals(new BigDecimal("200.000000"), params.getPrevClose().setScale(6));
        assertEquals(new BigDecimal("-3.000000"), params.getGapPct().setScale(6));
        assertEquals(TradingAnalyticsService.GAP_DOWN, params.getGapType());
        assertNull(params.getGapUpPct());
        assertEquals(new BigDecimal("3.000000"), params.getGapDownPct().setScale(6));
    }

    @Test
    void refreshTradingDayParam_marksNormalWhenOpenStaysInsidePreviousRange() {
        String tenantId = "tenant-gap-normal";
        String instrumentKey = "BSE_INDEX|SENSEX";
        LocalDate tradeDate = LocalDate.now(TradingAnalyticsService.MARKET_ZONE);
        LocalDate previousTradeDate = previousWeekday(tradeDate, 1);

        seedTradingSession5MinuteCandle(
                tenantId,
                instrumentKey,
                previousTradeDate,
                LocalTime.of(9, 15),
                new BigDecimal("500"),
                new BigDecimal("510"),
                new BigDecimal("495"),
                new BigDecimal("507")
        );
        seedTradingSession5MinuteCandle(
                tenantId,
                instrumentKey,
                previousTradeDate,
                LocalTime.of(15, 25),
                new BigDecimal("506"),
                new BigDecimal("508"),
                new BigDecimal("504"),
                new BigDecimal("505")
        );
        seedTradingSession5MinuteCandle(
                tenantId,
                instrumentKey,
                tradeDate,
                LocalTime.of(9, 15),
                new BigDecimal("506"),
                new BigDecimal("507"),
                new BigDecimal("503"),
                new BigDecimal("504")
        );
        seedOpeningRange(tenantId, instrumentKey, tradeDate, new BigDecimal("503"), new BigDecimal("507"), new BigDecimal("500"), new BigDecimal("504"));
        seedMinuteClose(tenantId, instrumentKey, tradeDate, LocalTime.of(10, 0), new BigDecimal("506"));

        TradingDayParamEntity params = tradingAnalyticsService.refreshTradingDayParam(tenantId, instrumentKey);

        assertEquals(new BigDecimal("0.198020"), params.getGapPct().setScale(6));
        assertEquals(TradingAnalyticsService.GAP_NORMAL, params.getGapType());
        assertNull(params.getGapUpPct());
        assertNull(params.getGapDownPct());
    }

    @Test
    void refreshTradingDayParams_backfillsOnlyTradingDatesInRequestedRange() {
        String tenantId = "tenant-backfill-range";
        String instrumentKey = "NSE_INDEX|Nifty 50";
        LocalDate firstTradeDate = LocalDate.of(2026, 3, 10);
        LocalDate secondTradeDate = LocalDate.of(2026, 3, 12);
        LocalDate previousTradeDate = LocalDate.of(2026, 3, 9);

        seedTradingSession5MinuteCandle(
                tenantId,
                instrumentKey,
                previousTradeDate,
                LocalTime.of(9, 15),
                new BigDecimal("24000"),
                new BigDecimal("24100"),
                new BigDecimal("23950"),
                new BigDecimal("24050")
        );
        seedTradingSession5MinuteCandle(
                tenantId,
                instrumentKey,
                previousTradeDate,
                LocalTime.of(15, 25),
                new BigDecimal("24060"),
                new BigDecimal("24080"),
                new BigDecimal("24020"),
                new BigDecimal("24040")
        );
        seedTradingSession5MinuteCandle(
                tenantId,
                instrumentKey,
                firstTradeDate,
                LocalTime.of(9, 15),
                new BigDecimal("24150"),
                new BigDecimal("24200"),
                new BigDecimal("24100"),
                new BigDecimal("24180")
        );
        seedTradingSession5MinuteCandle(
                tenantId,
                instrumentKey,
                secondTradeDate,
                LocalTime.of(9, 15),
                new BigDecimal("24300"),
                new BigDecimal("24320"),
                new BigDecimal("24250"),
                new BigDecimal("24280")
        );
        seedOpeningRange(tenantId, instrumentKey, firstTradeDate, new BigDecimal("24150"), new BigDecimal("24220"), new BigDecimal("24100"), new BigDecimal("24180"));
        seedOpeningRange(tenantId, instrumentKey, secondTradeDate, new BigDecimal("24300"), new BigDecimal("24350"), new BigDecimal("24240"), new BigDecimal("24280"));
        seedMinuteClose(tenantId, instrumentKey, firstTradeDate, LocalTime.of(15, 29), new BigDecimal("24140"));
        seedMinuteClose(tenantId, instrumentKey, secondTradeDate, LocalTime.of(15, 29), new BigDecimal("24360"));

        TradingAnalyticsService.TradingDayParamRefreshResult result = tradingAnalyticsService.refreshTradingDayParams(
                tenantId,
                instrumentKey,
                LocalDate.of(2026, 3, 10),
                LocalDate.of(2026, 3, 13)
        );

        assertEquals(Arrays.asList(firstTradeDate, secondTradeDate), result.refreshedTradeDates());
        assertEquals(2, result.processedTradingDays());
        assertEquals(2L, tableCount("trading_day_param"));
    }

    private List<BigDecimal> seedSeries(
            String tenantId,
            String instrumentKey,
            String timeframeUnit,
            int timeframeInterval,
            int count,
            BigDecimal startClose,
            BigDecimal step
    ) {
        List<BigDecimal> closes = new ArrayList<>();
        Instant baseTs = Instant.now().minusSeconds((long) count * Math.max(1, timeframeInterval) * 60L);
        BigDecimal close = startClose;
        for (int index = 0; index < count; index++) {
            closes.add(close);
            BigDecimal open = close;
            upsertCandle(
                    tenantId,
                    instrumentKey,
                    timeframeUnit,
                    timeframeInterval,
                    baseTs.plusSeconds((long) index * Math.max(1, timeframeInterval) * 60L),
                    open,
                    close.add(BigDecimal.ONE),
                    close.subtract(BigDecimal.ONE),
                    close,
                    1_000L + index
            );
            close = close.add(step);
        }
        return closes;
    }

    private void seedOpeningRange(
            String tenantId,
            String instrumentKey,
            LocalDate tradeDate,
            BigDecimal open,
            BigDecimal high,
            BigDecimal low,
            BigDecimal close
    ) {
        Instant ts = tradeDate.atTime(LocalTime.of(9, 15)).atZone(TradingAnalyticsService.MARKET_ZONE).toInstant();
        upsertCandle(tenantId, instrumentKey, "minutes", 15, ts, open, high, low, close, 5_000L);
    }

    private void seedTradingSession5MinuteCandle(
            String tenantId,
            String instrumentKey,
            LocalDate tradeDate,
            LocalTime time,
            BigDecimal open,
            BigDecimal high,
            BigDecimal low,
            BigDecimal close
    ) {
        Instant ts = tradeDate.atTime(time).atZone(TradingAnalyticsService.MARKET_ZONE).toInstant();
        upsertCandle(tenantId, instrumentKey, "minutes", 5, ts, open, high, low, close, 4_000L);
    }

    private void seedMinuteClose(
            String tenantId,
            String instrumentKey,
            LocalDate tradeDate,
            LocalTime time,
            BigDecimal close
    ) {
        Instant ts = tradeDate.atTime(time).atZone(TradingAnalyticsService.MARKET_ZONE).toInstant();
        upsertCandle(
                tenantId,
                instrumentKey,
                "minutes",
                1,
                ts,
                close,
                close.add(BigDecimal.ONE),
                close.subtract(BigDecimal.ONE),
                close,
                3_000L
        );
    }

    private void upsertCandle(
            String tenantId,
            String instrumentKey,
            String timeframeUnit,
            Integer timeframeInterval,
            Instant candleTs,
            BigDecimal openPrice,
            BigDecimal highPrice,
            BigDecimal lowPrice,
            BigDecimal closePrice,
            Long volume
    ) {
        candleRepository.upsert(
                tenantId,
                instrumentKey,
                timeframeUnit,
                timeframeInterval,
                candleTs.truncatedTo(ChronoUnit.MILLIS),
                openPrice,
                highPrice,
                lowPrice,
                closePrice,
                volume
        );
    }

    private BigDecimal emaOfSeries(List<BigDecimal> values, int period) {
        if (values.size() < period) {
            return null;
        }
        BigDecimal multiplier = BigDecimal.valueOf(2)
                .divide(BigDecimal.valueOf(period + 1L), SCALE + 6, RoundingMode.HALF_UP);
        BigDecimal seedSum = BigDecimal.ZERO;
        for (int index = 0; index < period; index++) {
            seedSum = seedSum.add(values.get(index), MATH_CONTEXT);
        }
        BigDecimal ema = seedSum.divide(BigDecimal.valueOf(period), SCALE + 6, RoundingMode.HALF_UP);
        for (int index = period; index < values.size(); index++) {
            BigDecimal close = values.get(index);
            ema = close.subtract(ema, MATH_CONTEXT)
                    .multiply(multiplier, MATH_CONTEXT)
                    .add(ema, MATH_CONTEXT);
        }
        return ema.setScale(SCALE, RoundingMode.HALF_UP);
    }

    private BigDecimal emaOfTailWithFirstValueSeed(List<BigDecimal> values, int period) {
        List<BigDecimal> tail = values.subList(values.size() - period, values.size());
        BigDecimal multiplier = BigDecimal.valueOf(2)
                .divide(BigDecimal.valueOf(period + 1L), SCALE + 6, RoundingMode.HALF_UP);
        BigDecimal ema = tail.getFirst();
        for (int index = 1; index < tail.size(); index++) {
            BigDecimal close = tail.get(index);
            ema = close.subtract(ema, MATH_CONTEXT)
                    .multiply(multiplier, MATH_CONTEXT)
                    .add(ema, MATH_CONTEXT);
        }
        return ema.setScale(SCALE, RoundingMode.HALF_UP);
    }

    private long tableCount(String tableName) {
        Long count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM " + tableName, Long.class);
        return count == null ? 0L : count;
    }

    private LocalDate previousWeekday(LocalDate anchorDate, int weekdayCount) {
        LocalDate candidate = anchorDate;
        int remaining = weekdayCount;
        while (remaining > 0) {
            candidate = candidate.minusDays(1);
            DayOfWeek dayOfWeek = candidate.getDayOfWeek();
            if (dayOfWeek != DayOfWeek.SATURDAY && dayOfWeek != DayOfWeek.SUNDAY) {
                remaining--;
            }
        }
        return candidate;
    }
}
