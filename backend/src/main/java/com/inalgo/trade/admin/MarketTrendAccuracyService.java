package com.inalgo.trade.admin;

import com.inalgo.trade.repository.MarketSentimentSnapshotRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

@Service
public class MarketTrendAccuracyService {

    /** Benchmark used for both INDIA_NEWS and GLOBAL_NEWS (best candle proxy available). */
    private static final String BENCHMARK = "NSE_INDEX|Nifty 50";
    private static final List<AccuracyWindow> WINDOWS = List.of(
            new AccuracyWindow("OPEN", "Market Open", "09:15", "09:30"),
            new AccuracyWindow("MIDDLE", "Market Middle", "11:30", "14:30"),
            new AccuracyWindow("CLOSE", "Market Close", "14:30", "15:30")
    );

    private final MarketSentimentSnapshotRepository repository;

    public MarketTrendAccuracyService(MarketSentimentSnapshotRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public MarketWatchDtos.TrendAccuracyReport compute(String tenantId, int lookbackDays, int candleIntervalMinutes) {
        Instant fromDate = Instant.now().minus(lookbackDays, ChronoUnit.DAYS);
        Instant candleFromDate = fromDate.minus(3, ChronoUnit.DAYS);
        MarketWatchDtos.ScopeAccuracy india  = computeScope(tenantId, "INDIA_NEWS",  fromDate, candleFromDate, candleIntervalMinutes);
        MarketWatchDtos.ScopeAccuracy global = computeScope(tenantId, "GLOBAL_NEWS", fromDate, candleFromDate, candleIntervalMinutes);
        return new MarketWatchDtos.TrendAccuracyReport(Instant.now(), lookbackDays, candleIntervalMinutes, india, global);
    }

    private MarketWatchDtos.ScopeAccuracy computeScope(
            String tenantId, String scope, Instant fromDate, Instant candleFromDate, int candleIntervalMinutes) {

        List<MarketWatchDtos.WindowAccuracy> windows = new ArrayList<>(WINDOWS.size());
        int snapshotDays = 0;
        int totalDays = 0;
        int trendCorrect = 0;
        int aiCorrect = 0;
        int trendBullOk = 0;
        int trendBullTotal = 0;
        int trendBearOk = 0;
        int trendBearTotal = 0;
        int aiBullOk = 0;
        int aiBullTotal = 0;
        int aiBearOk = 0;
        int aiBearTotal = 0;
        List<MarketWatchDtos.DailyAccuracyRow> aggregateRows = new ArrayList<>();

        for (AccuracyWindow window : WINDOWS) {
            WindowStats windowStats = computeWindowStats(
                    tenantId,
                    scope,
                    fromDate,
                    candleFromDate,
                    candleIntervalMinutes,
                    window
            );
            windows.add(windowStats.window());

            snapshotDays += windowStats.snapshotDays();
            totalDays += windowStats.totalDays();
            trendCorrect += windowStats.trendCorrect();
            aiCorrect += windowStats.aiCorrect();
            trendBullOk += windowStats.trendBullOk();
            trendBullTotal += windowStats.trendBullTotal();
            trendBearOk += windowStats.trendBearOk();
            trendBearTotal += windowStats.trendBearTotal();
            aiBullOk += windowStats.aiBullOk();
            aiBullTotal += windowStats.aiBullTotal();
            aiBearOk += windowStats.aiBearOk();
            aiBearTotal += windowStats.aiBearTotal();
            aggregateRows.addAll(windowStats.rows());
        }

        return new MarketWatchDtos.ScopeAccuracy(
                scope, BENCHMARK, snapshotDays, totalDays,
                trendCorrect, pct(trendCorrect, totalDays),
                aiCorrect, pct(aiCorrect, totalDays),
                precision(trendBullOk, trendBullTotal),
                precision(trendBearOk, trendBearTotal),
                precision(aiBullOk, aiBullTotal),
                precision(aiBearOk, aiBearTotal),
                aggregateRows,
                windows
        );
    }

    private WindowStats computeWindowStats(
            String tenantId,
            String scope,
            Instant fromDate,
            Instant candleFromDate,
            int candleIntervalMinutes,
            AccuracyWindow window
    ) {
        int snapshotDays = repository.countDistinctSnapshotDaysInWindow(
                tenantId,
                scope,
                fromDate,
                window.startTime(),
                window.endTime()
        );
        List<Object[]> rows = repository.computeWindowAccuracy(
                tenantId,
                scope,
                fromDate,
                candleFromDate,
                BENCHMARK,
                candleIntervalMinutes,
                window.startTime(),
                window.endTime()
        );

        int totalDays = rows.size();
        int trendCorrect = 0, aiCorrect = 0;
        int trendBullOk = 0, trendBullTotal = 0;
        int trendBearOk = 0, trendBearTotal = 0;
        int aiBullOk = 0, aiBullTotal = 0;
        int aiBearOk = 0, aiBearTotal = 0;
        List<MarketWatchDtos.DailyAccuracyRow> details = new ArrayList<>(rows.size());

        for (Object[] row : rows) {
            String tradeDate = (String) row[0];
            String predicted = (String) row[1];
            String aiPrediction = (String) row[2];
            int avgConf = row[3] != null ? ((Number) row[3]).intValue() : 50;
            int snapCount = ((Number) row[4]).intValue();
            BigDecimal startPrice = (BigDecimal) row[5];
            BigDecimal endPrice = (BigDecimal) row[6];
            BigDecimal changePct = (BigDecimal) row[7];
            String actual = (String) row[8];

            boolean trendRight = predicted != null && predicted.equals(actual);
            boolean aiRight    = aiPrediction != null && aiPrediction.equals(actual);

            if (trendRight) trendCorrect++;
            if (aiRight)    aiCorrect++;

            if ("BULL".equals(predicted))   { trendBullTotal++; if (trendRight) trendBullOk++; }
            if ("BEAR".equals(predicted))   { trendBearTotal++; if (trendRight) trendBearOk++; }
            if ("BULL".equals(aiPrediction)){ aiBullTotal++;    if (aiRight)    aiBullOk++; }
            if ("BEAR".equals(aiPrediction)){ aiBearTotal++;    if (aiRight)    aiBearOk++; }

            details.add(new MarketWatchDtos.DailyAccuracyRow(
                    tradeDate, predicted, aiPrediction, avgConf, snapCount,
                    startPrice, endPrice, changePct, actual, trendRight, aiRight));
        }

        return new WindowStats(
                snapshotDays,
                totalDays,
                trendCorrect,
                aiCorrect,
                trendBullOk,
                trendBullTotal,
                trendBearOk,
                trendBearTotal,
                aiBullOk,
                aiBullTotal,
                aiBearOk,
                aiBearTotal,
                details,
                new MarketWatchDtos.WindowAccuracy(
                        window.windowKey(),
                        window.windowLabel(),
                        window.startTime() + "-" + window.endTime(),
                        snapshotDays,
                        totalDays,
                        trendCorrect,
                        pct(trendCorrect, totalDays),
                        aiCorrect,
                        pct(aiCorrect, totalDays),
                        precision(trendBullOk, trendBullTotal),
                        precision(trendBearOk, trendBearTotal),
                        precision(aiBullOk, aiBullTotal),
                        precision(aiBearOk, aiBearTotal),
                        details
                )
        );
    }

    private record AccuracyWindow(String windowKey, String windowLabel, String startTime, String endTime) {}

    private record WindowStats(
            int snapshotDays,
            int totalDays,
            int trendCorrect,
            int aiCorrect,
            int trendBullOk,
            int trendBullTotal,
            int trendBearOk,
            int trendBearTotal,
            int aiBullOk,
            int aiBullTotal,
            int aiBearOk,
            int aiBearTotal,
            List<MarketWatchDtos.DailyAccuracyRow> rows,
            MarketWatchDtos.WindowAccuracy window
    ) {}

    private double pct(int correct, int total) {
        return total == 0 ? 0.0 : round1(100.0 * correct / total);
    }

    private Double precision(int correct, int total) {
        return total == 0 ? null : round1(100.0 * correct / total);
    }

    private double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }
}
