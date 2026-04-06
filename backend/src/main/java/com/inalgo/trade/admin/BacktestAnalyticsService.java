package com.inalgo.trade.admin;

import com.inalgo.trade.entity.MarketSentimentSnapshotEntity;
import com.inalgo.trade.entity.TradingDayParamEntity;
import com.inalgo.trade.entity.TradingSignalEntity;
import com.inalgo.trade.repository.MarketSentimentSnapshotRepository;
import com.inalgo.trade.repository.TradingDayParamRepository;
import com.inalgo.trade.repository.TradingSignalRepository;
import jakarta.validation.ValidationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.time.LocalDate;

@Service
public class BacktestAnalyticsService {
    private static final Sort TRADING_SIGNAL_SORT = Sort.by(
            Sort.Order.desc("signalDate"),
            Sort.Order.desc("updatedAt"),
            Sort.Order.asc("instrumentKey"),
            Sort.Order.asc("timeframeUnit"),
            Sort.Order.asc("timeframeInterval")
    );
    private static final Sort TRADING_DAY_PARAM_SORT = Sort.by(
            Sort.Order.desc("tradeDate"),
            Sort.Order.desc("updatedAt"),
            Sort.Order.asc("instrumentKey")
    );
    private static final Sort MARKET_SENTIMENT_SORT = Sort.by(
            Sort.Order.desc("snapshotAt"),
            Sort.Order.asc("marketScope"),
            Sort.Order.asc("marketName")
    );

    private final TradingSignalRepository tradingSignalRepository;
    private final TradingDayParamRepository tradingDayParamRepository;
    private final MarketSentimentSnapshotRepository marketSentimentSnapshotRepository;

    public BacktestAnalyticsService(
            TradingSignalRepository tradingSignalRepository,
            TradingDayParamRepository tradingDayParamRepository,
            MarketSentimentSnapshotRepository marketSentimentSnapshotRepository
    ) {
        this.tradingSignalRepository = tradingSignalRepository;
        this.tradingDayParamRepository = tradingDayParamRepository;
        this.marketSentimentSnapshotRepository = marketSentimentSnapshotRepository;
    }

    public Page<AdminDtos.TradingSignalResponse> listTradingSignals(
            String tenantId,
            String instrumentKey,
            String timeframeUnit,
            Integer timeframeInterval,
            String signal,
            LocalDate fromDate,
            LocalDate toDate,
            Integer page,
            Integer size
    ) {
        validateDateRange(fromDate, toDate);
        PageRequest pageable = PageRequest.of(normalizePage(page), normalizeSize(size), TRADING_SIGNAL_SORT);
        String normalizedTimeframeUnit = normalizeLower(timeframeUnit);
        String normalizedSignal = normalizeSignal(signal);
        return tradingSignalRepository.search(
                        requireTenant(tenantId),
                        normalizeText(instrumentKey),
                        normalizedTimeframeUnit,
                        timeframeInterval,
                        normalizedSignal,
                        fromDate,
                        toDate,
                        pageable
                )
                .map(this::toTradingSignalResponse);
    }

    public Page<AdminDtos.TradingDayParamResponse> listTradingDayParams(
            String tenantId,
            String instrumentKey,
            LocalDate fromDate,
            LocalDate toDate,
            Integer page,
            Integer size
    ) {
        validateDateRange(fromDate, toDate);
        PageRequest pageable = PageRequest.of(normalizePage(page), normalizeSize(size), TRADING_DAY_PARAM_SORT);
        return tradingDayParamRepository.search(
                        requireTenant(tenantId),
                        normalizeText(instrumentKey),
                        fromDate,
                        toDate,
                        pageable
                )
                .map(this::toTradingDayParamResponse);
    }

    public Page<AdminDtos.MarketSentimentResponse> listMarketSentiments(
            String tenantId,
            String marketScope,
            String trendStatus,
            Instant fromSnapshotAt,
            Instant toSnapshotAt,
            Integer page,
            Integer size
    ) {
        validateInstantRange(fromSnapshotAt, toSnapshotAt);
        PageRequest pageable = PageRequest.of(normalizePage(page), normalizeSize(size), MARKET_SENTIMENT_SORT);
        return marketSentimentSnapshotRepository.search(
                        requireTenant(tenantId),
                        normalizeUpper(marketScope),
                        normalizeUpper(trendStatus),
                        fromSnapshotAt,
                        toSnapshotAt,
                        pageable
                )
                .map(this::toMarketSentimentResponse);
    }

    private AdminDtos.TradingSignalResponse toTradingSignalResponse(TradingSignalEntity entity) {
        return new AdminDtos.TradingSignalResponse(
                entity.getId(),
                entity.getInstrumentKey(),
                entity.getTimeframeUnit(),
                entity.getTimeframeInterval(),
                entity.getSignalDate(),
                entity.getPreviousClose(),
                entity.getCurrentClose(),
                entity.getDma9(),
                entity.getDma26(),
                entity.getDma110(),
                entity.getSignal(),
                entity.getFirstCandleColor(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    private AdminDtos.TradingDayParamResponse toTradingDayParamResponse(TradingDayParamEntity entity) {
        return new AdminDtos.TradingDayParamResponse(
                entity.getId(),
                entity.getTradeDate(),
                entity.getInstrumentKey(),
                entity.getOrbHigh(),
                entity.getOrbLow(),
                entity.getOrbBreakout(),
                entity.getOrbBreakdown(),
                entity.getTodayOpen(),
                entity.getTodayClose(),
                entity.getPrevHigh(),
                entity.getPrevLow(),
                entity.getPrevClose(),
                entity.getGapPct(),
                entity.getGapType(),
                entity.getGapUpPct(),
                entity.getGapDownPct(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    private AdminDtos.MarketSentimentResponse toMarketSentimentResponse(MarketSentimentSnapshotEntity entity) {
        return new AdminDtos.MarketSentimentResponse(
                entity.getId(),
                entity.getMarketScope(),
                entity.getMarketName(),
                entity.getEvaluationType(),
                entity.getTrendStatus(),
                entity.getReason(),
                entity.getCurrentValue(),
                entity.getEma9(),
                entity.getEma21(),
                entity.getEma110(),
                entity.getSourceCount(),
                entity.getEvidenceCount(),
                entity.getSourceNames(),
                entity.getDataAsOf(),
                entity.getAiAnalysis(),
                entity.getAiReason(),
                entity.getAiConfidence(),
                entity.getAiModel(),
                entity.getAiUpdatedAt(),
                entity.getSnapshotAt(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    private int normalizeSize(Integer size) {
        return Math.min(Math.max(size == null ? 25 : size, 1), 500);
    }

    private int normalizePage(Integer page) {
        return Math.max(page == null ? 0 : page, 0);
    }

    private void validateDateRange(LocalDate fromDate, LocalDate toDate) {
        if (fromDate != null && toDate != null && fromDate.isAfter(toDate)) {
            throw new ValidationException("fromDate must be on or before toDate");
        }
    }

    private void validateInstantRange(Instant fromSnapshotAt, Instant toSnapshotAt) {
        if (fromSnapshotAt != null && toSnapshotAt != null && fromSnapshotAt.isAfter(toSnapshotAt)) {
            throw new ValidationException("fromSnapshotAt must be on or before toSnapshotAt");
        }
    }

    private String normalizeText(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.trim();
    }

    private String normalizeLower(String value) {
        String normalized = normalizeText(value);
        return normalized == null ? null : normalized.toLowerCase();
    }

    private String normalizeUpper(String value) {
        String normalized = normalizeText(value);
        return normalized == null ? null : normalized.toUpperCase();
    }

    private String normalizeSignal(String value) {
        String normalized = normalizeText(value);
        if (normalized == null) {
            return null;
        }
        String upper = normalized.toUpperCase();
        if (!"BUY".equals(upper) && !"SELL".equals(upper) && !"HOLD".equals(upper)) {
            throw new ValidationException("signal must be one of BUY, SELL, HOLD");
        }
        return upper;
    }

    private String requireTenant(String tenantId) {
        if (!StringUtils.hasText(tenantId)) {
            throw new ValidationException("Missing tenant context");
        }
        return tenantId.trim();
    }
}
