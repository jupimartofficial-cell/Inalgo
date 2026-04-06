package com.inalgo.trade.service;

import com.inalgo.trade.entity.CandleEntity;
import com.inalgo.trade.entity.TradingDayParamEntity;
import com.inalgo.trade.entity.TradingSignalEntity;
import com.inalgo.trade.repository.CandleRepository;
import com.inalgo.trade.repository.TradingDayParamRepository;
import com.inalgo.trade.repository.TradingSignalRepository;
import com.inalgo.trade.upstox.SupportedTimeframe;
import jakarta.validation.ValidationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.Date;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
public class TradingAnalyticsService {
    static final ZoneId MARKET_ZONE = TradingSessionMetricsHelper.MARKET_ZONE;
    static final String SIGNAL_BUY = "BUY";
    static final String SIGNAL_SELL = "SELL";
    static final String SIGNAL_HOLD = "HOLD";
    static final String FIRST_CANDLE_GREEN = "GREEN";
    static final String FIRST_CANDLE_RED = "RED";
    static final String YES = "Yes";
    static final String NO = "No";
    static final String GAP_UP = TradingSessionMetricsHelper.GAP_UP;
    static final String GAP_DOWN = TradingSessionMetricsHelper.GAP_DOWN;
    static final String GAP_NORMAL = TradingSessionMetricsHelper.GAP_NORMAL;

    private static final String MINUTES = "minutes";
    private static final int ORB_TIMEFRAME_INTERVAL = 15;
    private static final int EMA_PAGE_SIZE = 2_000;

    private final CandleRepository candleRepository;
    private final TradingSignalRepository tradingSignalRepository;
    private final TradingDayParamRepository tradingDayParamRepository;
    private final TradingSessionMetricsHelper sessionMetricsHelper;

    public TradingAnalyticsService(
            CandleRepository candleRepository,
            TradingSignalRepository tradingSignalRepository,
            TradingDayParamRepository tradingDayParamRepository,
            TradingSessionMetricsHelper sessionMetricsHelper
    ) {
        this.candleRepository = candleRepository;
        this.tradingSignalRepository = tradingSignalRepository;
        this.tradingDayParamRepository = tradingDayParamRepository;
        this.sessionMetricsHelper = sessionMetricsHelper;
    }

    @Transactional
    public TradingSignalEntity refreshTradingSignal(
            String tenantId,
            String instrumentKey,
            String timeframeUnit,
            Integer timeframeInterval
    ) {
        String normalizedInstrumentKey = requireText(instrumentKey, "instrumentKey");
        SupportedTimeframe.ParsedInterval parsedTimeframe = SupportedTimeframe.requireSupported(timeframeUnit, timeframeInterval);
        String normalizedTimeframeUnit = parsedTimeframe.unit();
        Integer normalizedTimeframeInterval = parsedTimeframe.value();

        List<CandleEntity> latestCandles = candleRepository
                .findByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeIntervalOrderByCandleTsDesc(
                        tenantId,
                        normalizedInstrumentKey,
                        normalizedTimeframeUnit,
                        normalizedTimeframeInterval,
                        PageRequest.of(0, 2)
                )
                .getContent();

        if (latestCandles.isEmpty()) {
            throw new ValidationException("No candles available for trading signal calculation");
        }

        BigDecimal currentClose = latestCandles.getFirst().getClosePrice();
        BigDecimal previousClose = latestCandles.size() > 1 ? latestCandles.get(1).getClosePrice() : null;
        EmaCalculator.EmaResult emaResult = computeExponentialAverages(
                tenantId,
                normalizedInstrumentKey,
                normalizedTimeframeUnit,
                normalizedTimeframeInterval
        );
        BigDecimal dma9 = emaResult.dma9();
        BigDecimal dma26 = emaResult.dma26();
        BigDecimal dma110 = emaResult.dma110();
        String signal = resolveSignal(dma9, dma26, dma110);
        // Anchor the signal row to the latest candle's market-trade date to avoid
        // creating duplicate rows on weekends/holidays with stale close values.
        LocalDate signalDate = latestCandles.getFirst().getCandleTs()
                .atZone(TradingSessionMetricsHelper.MARKET_ZONE).toLocalDate();

        Instant dayStart = signalDate.atStartOfDay(TradingSessionMetricsHelper.MARKET_ZONE).toInstant();
        Instant dayEnd = signalDate.plusDays(1).atStartOfDay(TradingSessionMetricsHelper.MARKET_ZONE).toInstant();
        String firstCandleColor = candleRepository
                .findFirstByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeIntervalAndCandleTsGreaterThanEqualAndCandleTsLessThanOrderByCandleTsAsc(
                        tenantId,
                        normalizedInstrumentKey,
                        normalizedTimeframeUnit,
                        normalizedTimeframeInterval,
                        dayStart,
                        dayEnd
                )
                .map(c -> resolveFirstCandleColor(c.getOpenPrice(), c.getClosePrice()))
                .orElse(null);

        tradingSignalRepository.upsert(
                tenantId,
                normalizedInstrumentKey,
                normalizedTimeframeUnit,
                normalizedTimeframeInterval,
                signalDate,
                previousClose,
                currentClose,
                dma9,
                dma26,
                dma110,
                signal,
                firstCandleColor
        );

        return tradingSignalRepository
                .findByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeIntervalAndSignalDate(
                        tenantId,
                        normalizedInstrumentKey,
                        normalizedTimeframeUnit,
                        normalizedTimeframeInterval,
                        signalDate
                )
                .orElseThrow(() -> new ValidationException("Trading signal was not persisted"));
    }

    @Transactional
    public TradingDayParamEntity refreshTradingDayParam(String tenantId, String instrumentKey) {
        return refreshTradingDayParam(tenantId, instrumentKey, LocalDate.now(TradingSessionMetricsHelper.MARKET_ZONE));
    }

    @Transactional
    public TradingDayParamEntity refreshTradingDayParam(String tenantId, String instrumentKey, LocalDate tradeDate) {
        Instant openingRangeStart = tradeDate.atTime(LocalTime.of(9, 15))
                .atZone(TradingSessionMetricsHelper.MARKET_ZONE).toInstant();
        Instant openingRangeEnd = tradeDate.atTime(LocalTime.of(9, 30))
                .atZone(TradingSessionMetricsHelper.MARKET_ZONE).toInstant();
        Instant firstFiveMinuteStart = openingRangeStart;
        Instant firstFiveMinuteEnd = tradeDate.atTime(LocalTime.of(9, 20))
                .atZone(TradingSessionMetricsHelper.MARKET_ZONE).toInstant();
        Instant dayStart = tradeDate.atStartOfDay(TradingSessionMetricsHelper.MARKET_ZONE).toInstant();
        Instant dayEnd = tradeDate.plusDays(1).atStartOfDay(TradingSessionMetricsHelper.MARKET_ZONE).toInstant();

        List<CandleEntity> openingRangeCandles = candleRepository
                .findByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeIntervalAndCandleTsGreaterThanEqualAndCandleTsLessThanOrderByCandleTsAsc(
                        tenantId,
                        instrumentKey,
                        MINUTES,
                        ORB_TIMEFRAME_INTERVAL,
                        openingRangeStart,
                        openingRangeEnd
                );

        BigDecimal orbHigh = openingRangeCandles.stream()
                .map(CandleEntity::getHighPrice)
                .max(Comparator.naturalOrder())
                .orElse(null);
        BigDecimal orbLow = openingRangeCandles.stream()
                .map(CandleEntity::getLowPrice)
                .min(Comparator.naturalOrder())
                .orElse(null);

        BigDecimal lastTradedPrice = candleRepository
                .findFirstByTenantIdAndInstrumentKeyAndTimeframeUnitAndCandleTsGreaterThanEqualAndCandleTsLessThanOrderByCandleTsDescTimeframeIntervalAsc(
                        tenantId,
                        instrumentKey,
                        MINUTES,
                        dayStart,
                        dayEnd
                )
                .map(CandleEntity::getClosePrice)
                .orElse(null);

        String orbBreakout = lastTradedPrice != null && orbHigh != null && lastTradedPrice.compareTo(orbHigh) > 0 ? YES : NO;
        String orbBreakdown = lastTradedPrice != null && orbLow != null && lastTradedPrice.compareTo(orbLow) < 0 ? YES : NO;

        TradingSessionMetricsHelper.CurrentSessionMetrics currentSessionMetrics =
                sessionMetricsHelper.resolveCurrentSessionMetrics(
                        tenantId,
                        instrumentKey,
                        firstFiveMinuteStart,
                        firstFiveMinuteEnd
                );
        TradingSessionMetricsHelper.PreviousSessionMetrics previousSessionMetrics =
                sessionMetricsHelper.resolvePreviousSessionMetrics(tenantId, instrumentKey, dayStart);
        TradingSessionMetricsHelper.GapMetrics gapMetrics =
                sessionMetricsHelper.resolveGapMetrics(currentSessionMetrics, previousSessionMetrics);

        tradingDayParamRepository.upsert(
                tenantId,
                tradeDate,
                instrumentKey,
                orbHigh,
                orbLow,
                orbBreakout,
                orbBreakdown,
                currentSessionMetrics.todayOpen(),
                currentSessionMetrics.todayClose(),
                previousSessionMetrics.prevHigh(),
                previousSessionMetrics.prevLow(),
                previousSessionMetrics.prevClose(),
                gapMetrics.gapPct(),
                gapMetrics.gapType(),
                gapMetrics.gapUpPct(),
                gapMetrics.gapDownPct()
        );

        return tradingDayParamRepository
                .findByTenantIdAndInstrumentKeyAndTradeDate(tenantId, instrumentKey, tradeDate)
                .orElseThrow(() -> new ValidationException("Trading day parameters were not persisted"));
    }

    @Transactional
    public TradingDayParamRefreshResult refreshTradingDayParams(
            String tenantId,
            String instrumentKey,
            LocalDate fromDate,
            LocalDate toDate
    ) {
        if (fromDate == null || toDate == null) {
            throw new ValidationException("fromDate and toDate are required");
        }
        if (fromDate.isAfter(toDate)) {
            throw new ValidationException("fromDate must be on or before toDate");
        }

        List<LocalDate> tradeDates = candleRepository.findDistinctTradeDatesInMarketZone(
                tenantId,
                instrumentKey,
                MINUTES,
                fromDate,
                toDate
        ).stream()
                .map(Date::toLocalDate)
                .toList();

        for (LocalDate tradeDate : tradeDates) {
            refreshTradingDayParam(tenantId, instrumentKey, tradeDate);
        }

        return new TradingDayParamRefreshResult(instrumentKey, fromDate, toDate, tradeDates);
    }

    @Transactional
    public TradingAnalyticsBackfillResult backfillTradingAnalytics(
            String tenantId,
            String instrumentKey,
            String timeframeUnit,
            Integer timeframeInterval,
            LocalDate fromDate,
            LocalDate toDate
    ) {
        if (fromDate == null || toDate == null) {
            throw new ValidationException("fromDate and toDate are required");
        }
        if (fromDate.isAfter(toDate)) {
            throw new ValidationException("fromDate must be on or before toDate");
        }

        String normalizedInstrumentKey = requireText(instrumentKey, "instrumentKey");
        SupportedTimeframe.ParsedInterval parsedTimeframe = SupportedTimeframe.requireSupported(timeframeUnit, timeframeInterval);
        String normalizedTimeframeUnit = parsedTimeframe.unit();
        Integer normalizedTimeframeInterval = parsedTimeframe.value();

        List<LocalDate> targetTradeDates = candleRepository
                .findDistinctTradeDatesInMarketZoneByTimeframe(
                        tenantId,
                        normalizedInstrumentKey,
                        normalizedTimeframeUnit,
                        normalizedTimeframeInterval,
                        fromDate,
                        toDate
                ).stream()
                .map(Date::toLocalDate)
                .toList();

        if (targetTradeDates.isEmpty()) {
            return new TradingAnalyticsBackfillResult(
                    normalizedInstrumentKey,
                    normalizedTimeframeUnit,
                    normalizedTimeframeInterval,
                    fromDate,
                    toDate,
                    List.of(),
                    0,
                    0
            );
        }

        Set<LocalDate> targetTradeDateSet = new LinkedHashSet<>(targetTradeDates);
        EmaCalculator.EmaAccumulator ema9 = EmaCalculator.accumulator(EmaCalculator.EMA_9_PERIOD);
        EmaCalculator.EmaAccumulator ema26 = EmaCalculator.accumulator(EmaCalculator.EMA_26_PERIOD);
        EmaCalculator.EmaAccumulator ema110 = EmaCalculator.accumulator(EmaCalculator.EMA_110_PERIOD);

        CandleEntity previousCandle = null;
        SignalBackfillDay activeDay = null;
        int signalRowsUpserted = 0;
        boolean reachedRangeEnd = false;
        Instant rangeEndExclusive = toDate.plusDays(1).atStartOfDay(TradingSessionMetricsHelper.MARKET_ZONE).toInstant();

        int pageNumber = 0;
        while (true) {
            List<CandleEntity> candlesAscending = candleRepository
                    .findByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeIntervalOrderByCandleTsAsc(
                            tenantId,
                            normalizedInstrumentKey,
                            normalizedTimeframeUnit,
                            normalizedTimeframeInterval,
                            PageRequest.of(pageNumber, EMA_PAGE_SIZE)
                    )
                    .getContent();
            if (candlesAscending.isEmpty()) {
                break;
            }

            for (CandleEntity candle : candlesAscending) {
                if (!candle.getCandleTs().isBefore(rangeEndExclusive)) {
                    reachedRangeEnd = true;
                    break;
                }

                LocalDate tradeDate = candle.getCandleTs().atZone(TradingSessionMetricsHelper.MARKET_ZONE).toLocalDate();
                BigDecimal close = candle.getClosePrice();
                ema9.accept(close);
                ema26.accept(close);
                ema110.accept(close);

                if (activeDay == null || !activeDay.tradeDate().equals(tradeDate)) {
                    if (activeDay != null) {
                        signalRowsUpserted += persistSignalBackfillDay(
                                tenantId,
                                normalizedInstrumentKey,
                                normalizedTimeframeUnit,
                                normalizedTimeframeInterval,
                                activeDay,
                                targetTradeDateSet
                        );
                    }
                    BigDecimal previousClose = previousCandle == null ? null : previousCandle.getClosePrice();
                    activeDay = new SignalBackfillDay(
                            tradeDate,
                            previousClose,
                            close,
                            ema9.value(),
                            ema26.value(),
                            ema110.value(),
                            candle.getOpenPrice(),
                            close
                    );
                } else {
                    activeDay = activeDay.withLatest(close, ema9.value(), ema26.value(), ema110.value());
                }
                previousCandle = candle;
            }

            if (reachedRangeEnd || candlesAscending.size() < EMA_PAGE_SIZE) {
                break;
            }
            pageNumber++;
        }

        if (activeDay != null) {
            signalRowsUpserted += persistSignalBackfillDay(
                    tenantId,
                    normalizedInstrumentKey,
                    normalizedTimeframeUnit,
                    normalizedTimeframeInterval,
                    activeDay,
                    targetTradeDateSet
            );
        }

        int dayParamRowsUpserted = 0;
        for (LocalDate tradeDate : targetTradeDates) {
            refreshTradingDayParam(tenantId, normalizedInstrumentKey, tradeDate);
            dayParamRowsUpserted++;
        }

        return new TradingAnalyticsBackfillResult(
                normalizedInstrumentKey,
                normalizedTimeframeUnit,
                normalizedTimeframeInterval,
                fromDate,
                toDate,
                targetTradeDates,
                signalRowsUpserted,
                dayParamRowsUpserted
        );
    }

    private EmaCalculator.EmaResult computeExponentialAverages(
            String tenantId,
            String instrumentKey,
            String timeframeUnit,
            Integer timeframeInterval
    ) {
        EmaCalculator.EmaAccumulator ema9 = EmaCalculator.accumulator(EmaCalculator.EMA_9_PERIOD);
        EmaCalculator.EmaAccumulator ema26 = EmaCalculator.accumulator(EmaCalculator.EMA_26_PERIOD);
        EmaCalculator.EmaAccumulator ema110 = EmaCalculator.accumulator(EmaCalculator.EMA_110_PERIOD);

        int pageNumber = 0;
        while (true) {
            List<CandleEntity> candlesAscending = candleRepository
                    .findByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeIntervalOrderByCandleTsAsc(
                            tenantId,
                            instrumentKey,
                            timeframeUnit,
                            timeframeInterval,
                            PageRequest.of(pageNumber, EMA_PAGE_SIZE)
                    )
                    .getContent();
            if (candlesAscending.isEmpty()) {
                break;
            }
            for (CandleEntity candle : candlesAscending) {
                BigDecimal close = candle.getClosePrice();
                ema9.accept(close);
                ema26.accept(close);
                ema110.accept(close);
            }
            if (candlesAscending.size() < EMA_PAGE_SIZE) {
                break;
            }
            pageNumber++;
        }

        return new EmaCalculator.EmaResult(ema9.value(), ema26.value(), ema110.value());
    }

    private String requireText(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new ValidationException(fieldName + " is required");
        }
        return value.trim();
    }

    private String resolveFirstCandleColor(BigDecimal open, BigDecimal close) {
        if (open == null || close == null) {
            return null;
        }
        return close.compareTo(open) >= 0 ? FIRST_CANDLE_GREEN : FIRST_CANDLE_RED;
    }

    private String resolveSignal(BigDecimal dma9, BigDecimal dma26, BigDecimal dma110) {
        if (dma9 == null || dma26 == null || dma110 == null) {
            return SIGNAL_HOLD;
        }
        if (dma9.compareTo(dma26) > 0 && dma9.compareTo(dma110) > 0 && dma26.compareTo(dma110) > 0) {
            return SIGNAL_BUY;
        }
        if (dma9.compareTo(dma26) < 0 && dma9.compareTo(dma110) < 0 && dma26.compareTo(dma110) < 0) {
            return SIGNAL_SELL;
        }
        return SIGNAL_HOLD;
    }

    private int persistSignalBackfillDay(
            String tenantId,
            String instrumentKey,
            String timeframeUnit,
            Integer timeframeInterval,
            SignalBackfillDay day,
            Set<LocalDate> targetTradeDates
    ) {
        if (!targetTradeDates.contains(day.tradeDate())) {
            return 0;
        }
        tradingSignalRepository.upsert(
                tenantId,
                instrumentKey,
                timeframeUnit,
                timeframeInterval,
                day.tradeDate(),
                day.previousClose(),
                day.currentClose(),
                day.dma9(),
                day.dma26(),
                day.dma110(),
                resolveSignal(day.dma9(), day.dma26(), day.dma110()),
                resolveFirstCandleColor(day.firstCandleOpen(), day.firstCandleClose())
        );
        return 1;
    }

    private record SignalBackfillDay(
            LocalDate tradeDate,
            BigDecimal previousClose,
            BigDecimal currentClose,
            BigDecimal dma9,
            BigDecimal dma26,
            BigDecimal dma110,
            BigDecimal firstCandleOpen,
            BigDecimal firstCandleClose
    ) {
        private SignalBackfillDay withLatest(
                BigDecimal nextClose,
                BigDecimal nextDma9,
                BigDecimal nextDma26,
                BigDecimal nextDma110
        ) {
            return new SignalBackfillDay(tradeDate, previousClose, nextClose, nextDma9, nextDma26, nextDma110, firstCandleOpen, firstCandleClose);
        }
    }

    public record TradingDayParamRefreshResult(
            String instrumentKey,
            LocalDate fromDate,
            LocalDate toDate,
            List<LocalDate> refreshedTradeDates
    ) {
        public int processedTradingDays() {
            return refreshedTradeDates.size();
        }
    }

    public record TradingAnalyticsBackfillResult(
            String instrumentKey,
            String timeframeUnit,
            Integer timeframeInterval,
            LocalDate fromDate,
            LocalDate toDate,
            List<LocalDate> processedTradeDates,
            int signalRowsUpserted,
            int dayParamRowsUpserted
    ) {
        public int processedTradingDays() {
            return processedTradeDates.size();
        }
    }
}
