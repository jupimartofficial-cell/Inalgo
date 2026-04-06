package com.inalgo.trade.admin;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.inalgo.trade.entity.CandleEntity;
import com.inalgo.trade.entity.MarketSentimentSnapshotEntity;
import com.inalgo.trade.entity.MarketWatchConfigEntity;
import com.inalgo.trade.entity.TradingDayParamEntity;
import com.inalgo.trade.entity.TradingSignalEntity;
import com.inalgo.trade.repository.CandleRepository;
import com.inalgo.trade.repository.MarketSentimentSnapshotRepository;
import com.inalgo.trade.repository.MarketWatchConfigRepository;
import com.inalgo.trade.repository.TradingDayParamRepository;
import com.inalgo.trade.repository.TradingSignalRepository;
import jakarta.validation.ValidationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;

@Service
public class MarketWatchService {

    private static final int MAX_TILES = 20;
    private static final Sort SIGNAL_SORT = Sort.by(Sort.Order.desc("signalDate"), Sort.Order.desc("updatedAt"));
    private static final Sort PARAM_SORT = Sort.by(Sort.Order.desc("tradeDate"), Sort.Order.desc("updatedAt"));
    private static final Sort SENTIMENT_SORT = Sort.by(Sort.Order.desc("snapshotAt"));
    private static final ZoneId MARKET_ZONE = ZoneId.of("Asia/Kolkata");
    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("dd MMM yyyy, HH:mm");

    private final MarketWatchConfigRepository configRepository;
    private final TradingSignalRepository signalRepository;
    private final TradingDayParamRepository paramRepository;
    private final MarketSentimentSnapshotRepository sentimentRepository;
    private final CandleRepository candleRepository;
    private final ObjectMapper objectMapper;

    public MarketWatchService(
            MarketWatchConfigRepository configRepository,
            TradingSignalRepository signalRepository,
            TradingDayParamRepository paramRepository,
            MarketSentimentSnapshotRepository sentimentRepository,
            CandleRepository candleRepository,
            ObjectMapper objectMapper
    ) {
        this.configRepository = configRepository;
        this.signalRepository = signalRepository;
        this.paramRepository = paramRepository;
        this.sentimentRepository = sentimentRepository;
        this.candleRepository = candleRepository;
        this.objectMapper = objectMapper;
    }

    public MarketWatchDtos.MarketWatchConfigResponse getConfig(String tenantId, String username) {
        String user = requireUsername(username);
        return configRepository.findByTenantIdAndUsername(tenantId, user)
                .map(entity -> new MarketWatchDtos.MarketWatchConfigResponse(
                        user,
                        normalizeLayout(parseLayout(entity.getConfigJson())),
                        entity.getUpdatedAt()))
                .orElse(new MarketWatchDtos.MarketWatchConfigResponse(user, null, null));
    }

    public MarketWatchDtos.MarketWatchConfigResponse saveConfig(
            String tenantId,
            MarketWatchDtos.MarketWatchConfigSaveRequest request
    ) {
        String user = requireUsername(request.username());
        MarketWatchDtos.MarketWatchLayoutConfig normalized = normalizeLayout(request.config());
        String json = serialize(normalized);
        MarketWatchConfigEntity entity = configRepository.findByTenantIdAndUsername(tenantId, user)
                .orElse(new MarketWatchConfigEntity(tenantId, user, json));
        entity.setConfigJson(json);
        MarketWatchConfigEntity saved = configRepository.save(entity);
        return new MarketWatchDtos.MarketWatchConfigResponse(user, normalized, saved.getUpdatedAt());
    }

    public MarketWatchDtos.MarketWatchDataResponse getData(String tenantId, String username) {
        String user = requireUsername(username);
        MarketWatchDtos.MarketWatchLayoutConfig layout = configRepository.findByTenantIdAndUsername(tenantId, user)
                .map(entity -> normalizeLayout(parseLayout(entity.getConfigJson())))
                .orElse(null);
        if (layout == null || layout.tiles() == null || layout.tiles().isEmpty()) {
            return new MarketWatchDtos.MarketWatchDataResponse(List.of(), Instant.now());
        }

        List<MarketWatchDtos.MarketWatchTileResult> results = new ArrayList<>();
        for (MarketWatchDtos.MarketWatchTileConfig tile : layout.tiles()) {
            results.add(fetchTileData(tenantId, tile));
        }
        return new MarketWatchDtos.MarketWatchDataResponse(results, Instant.now());
    }

    private MarketWatchDtos.MarketWatchTileResult fetchTileData(String tenantId, MarketWatchDtos.MarketWatchTileConfig tile) {
        return switch (tile.source()) {
            case "TRADING_SIGNAL" -> fetchSignalTile(tenantId, tile);
            case "TRADING_PARAM" -> fetchParamTile(tenantId, tile);
            case "MARKET_SENTIMENT" -> fetchSentimentTile(tenantId, tile);
            case "CANDLE" -> fetchCandleTile(tenantId, tile);
            default -> emptyTile(tile, "No data");
        };
    }

    private MarketWatchDtos.MarketWatchTileResult fetchSignalTile(String tenantId, MarketWatchDtos.MarketWatchTileConfig tile) {
        var page = signalRepository.search(
                tenantId, tile.instrumentKey(), tile.timeframeUnit(), tile.timeframeInterval(),
                null, null, null, PageRequest.of(0, 1, SIGNAL_SORT));
        if (page.isEmpty()) {
            return emptyTile(tile, "No trading signal data");
        }

        TradingSignalEntity entity = page.getContent().get(0);
        String primaryField = tile.primaryField();
        LinkedHashMap<String, MarketWatchDtos.MarketWatchTileField> fields = new LinkedHashMap<>();
        addField(fields, "signal", "Signal", entity.getSignal(), toneForSignal(entity.getSignal()));
        addField(fields, "currentClose", "Current Close", formatDecimal(entity.getCurrentClose()), null);
        addField(fields, "previousClose", "Previous Close", formatDecimal(entity.getPreviousClose()), null);
        addField(fields, "dma9", "DMA 9", formatDecimal(entity.getDma9()), null);
        addField(fields, "dma26", "DMA 26", formatDecimal(entity.getDma26()), null);
        addField(fields, "dma110", "DMA 110", formatDecimal(entity.getDma110()), null);
        addField(fields, "signalDate", "Signal Date", formatDate(entity.getSignalDate()), null);
        return buildTileResult(tile, primaryField, fields, entity.getSignal(), toneForSignal(entity.getSignal()), entity.getUpdatedAt());
    }

    private MarketWatchDtos.MarketWatchTileResult fetchParamTile(String tenantId, MarketWatchDtos.MarketWatchTileConfig tile) {
        var page = paramRepository.search(
                tenantId, tile.instrumentKey(), null, null, PageRequest.of(0, 1, PARAM_SORT));
        if (page.isEmpty()) {
            return emptyTile(tile, "No trading param data");
        }

        TradingDayParamEntity entity = page.getContent().get(0);
        String status = deriveParamStatus(entity);
        String tone = toneForParam(entity);
        String primaryField = tile.primaryField();
        LinkedHashMap<String, MarketWatchDtos.MarketWatchTileField> fields = new LinkedHashMap<>();
        addField(fields, "gapType", "Gap Type", valueOrDash(entity.getGapType()), tone);
        addField(fields, "gapPct", "Gap %", formatPercent(entity.getGapPct()), tone);
        addField(fields, "orbHigh", "ORB High", formatDecimal(entity.getOrbHigh()), null);
        addField(fields, "orbLow", "ORB Low", formatDecimal(entity.getOrbLow()), null);
        addField(fields, "orbBreakout", "Breakout", valueOrDash(entity.getOrbBreakout()), toneYesNo(entity.getOrbBreakout()));
        addField(fields, "orbBreakdown", "Breakdown", valueOrDash(entity.getOrbBreakdown()), toneYesNo(entity.getOrbBreakdown()));
        addField(fields, "todayOpen", "Today Open", formatDecimal(entity.getTodayOpen()), null);
        addField(fields, "todayClose", "Today Close", formatDecimal(entity.getTodayClose()), null);
        addField(fields, "prevHigh", "Prev High", formatDecimal(entity.getPrevHigh()), null);
        addField(fields, "prevLow", "Prev Low", formatDecimal(entity.getPrevLow()), null);
        addField(fields, "prevClose", "Prev Close", formatDecimal(entity.getPrevClose()), null);
        addField(fields, "gapUpPct", "Gap Up %", formatPercent(entity.getGapUpPct()), "positive");
        addField(fields, "gapDownPct", "Gap Down %", formatPercent(entity.getGapDownPct()), "negative");
        addField(fields, "tradeDate", "Trade Date", formatDate(entity.getTradeDate()), null);
        return buildTileResult(tile, primaryField, fields, status, tone, entity.getUpdatedAt());
    }

    private MarketWatchDtos.MarketWatchTileResult fetchSentimentTile(String tenantId, MarketWatchDtos.MarketWatchTileConfig tile) {
        var page = sentimentRepository.search(
                tenantId, tile.marketScope(), null, null, null, PageRequest.of(0, 1, SENTIMENT_SORT));
        if (page.isEmpty()) {
            return emptyTile(tile, "No market sentiment data");
        }

        MarketSentimentSnapshotEntity entity = page.getContent().get(0);
        String primaryField = tile.primaryField();
        String tone = toneForSignal(entity.getTrendStatus());
        LinkedHashMap<String, MarketWatchDtos.MarketWatchTileField> fields = new LinkedHashMap<>();
        addField(fields, "trendStatus", "Trend", valueOrDash(entity.getTrendStatus()), tone);
        // Price and EMA fields are only populated for TECHNICAL (S&P 500, Gift Nifty) snapshots.
        // NEWS and WEB_SEARCH snapshots always have null here — omit them to keep the tile clean.
        if (entity.getCurrentValue() != null) {
            addField(fields, "currentValue", "Current Value", formatDecimal(entity.getCurrentValue()), null);
            addField(fields, "ema9", "EMA 9", formatDecimal(entity.getEma9()), null);
            addField(fields, "ema21", "EMA 21", formatDecimal(entity.getEma21()), null);
            addField(fields, "ema110", "EMA 110", formatDecimal(entity.getEma110()), null);
        }
        addField(fields, "sourceCount", "Sources", formatInteger(entity.getSourceCount()), null);
        addField(fields, "evidenceCount", "Evidence", formatInteger(entity.getEvidenceCount()), null);
        addField(fields, "reason", "Reason", valueOrDash(entity.getReason()), null);
        addField(fields, "sourceNames", "Source Names", valueOrDash(entity.getSourceNames()), null);
        addField(fields, "dataAsOf", "Data As Of", formatInstant(entity.getDataAsOf()), null);
        addField(fields, "aiAnalysis", "AI Analyse", valueOrDash(entity.getAiAnalysis()), toneForSignal(entity.getAiAnalysis()));
        addField(fields, "aiConfidence", "AI Confidence", entity.getAiConfidence() == null ? "—" : entity.getAiConfidence() + "%", null);
        addField(fields, "aiReason", "AI Reason", valueOrDash(entity.getAiReason()), null);
        // snapshotAt is already shown in the tile footer (updatedAt) — omit from secondary fields
        return buildTileResult(tile, primaryField, fields, entity.getTrendStatus(), tone, entity.getSnapshotAt());
    }

    private MarketWatchDtos.MarketWatchTileResult fetchCandleTile(String tenantId, MarketWatchDtos.MarketWatchTileConfig tile) {
        if (!StringUtils.hasText(tile.instrumentKey()) || !StringUtils.hasText(tile.timeframeUnit()) || tile.timeframeInterval() == null) {
            return emptyTile(tile, "Incomplete candle tile");
        }

        var page = candleRepository.findByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeIntervalOrderByCandleTsDesc(
                tenantId, tile.instrumentKey(), tile.timeframeUnit(), tile.timeframeInterval(), PageRequest.of(0, 1));
        if (page.isEmpty()) {
            return emptyTile(tile, "No candle data");
        }

        CandleEntity entity = page.getContent().get(0);
        String tone = entity.getClosePrice().compareTo(entity.getOpenPrice()) >= 0 ? "positive" : "negative";
        String status = entity.getClosePrice().compareTo(entity.getOpenPrice()) >= 0 ? "Bullish" : "Bearish";
        String primaryField = tile.primaryField();
        LinkedHashMap<String, MarketWatchDtos.MarketWatchTileField> fields = new LinkedHashMap<>();
        addField(fields, "closePrice", "Close", formatDecimal(entity.getClosePrice()), tone);
        addField(fields, "openPrice", "Open", formatDecimal(entity.getOpenPrice()), null);
        addField(fields, "highPrice", "High", formatDecimal(entity.getHighPrice()), null);
        addField(fields, "lowPrice", "Low", formatDecimal(entity.getLowPrice()), null);
        addField(fields, "volume", "Volume", formatInteger(entity.getVolume()), null);
        // candleTs is already shown in the tile footer (updatedAt) — omit from secondary fields
        return buildTileResult(tile, primaryField, fields, status, tone, entity.getCandleTs());
    }

    private MarketWatchDtos.MarketWatchTileResult buildTileResult(
            MarketWatchDtos.MarketWatchTileConfig tile,
            String requestedPrimaryField,
            LinkedHashMap<String, MarketWatchDtos.MarketWatchTileField> fields,
            String statusLabel,
            String statusTone,
            Instant updatedAt
    ) {
        String primaryField = fields.containsKey(requestedPrimaryField) ? requestedPrimaryField : fields.keySet().iterator().next();
        MarketWatchDtos.MarketWatchTileField primary = fields.get(primaryField);
        List<MarketWatchDtos.MarketWatchTileField> secondaryFields = fields.entrySet().stream()
                .filter(entry -> !entry.getKey().equals(primaryField))
                .map(Map.Entry::getValue)
                .toList();
        return new MarketWatchDtos.MarketWatchTileResult(
                tile.id(),
                tile.source(),
                primaryField,
                primary.label(),
                primary.value(),
                valueOrDash(statusLabel),
                statusTone,
                formatInstant(updatedAt),
                secondaryFields);
    }

    private MarketWatchDtos.MarketWatchTileResult emptyTile(MarketWatchDtos.MarketWatchTileConfig tile, String message) {
        return new MarketWatchDtos.MarketWatchTileResult(
                tile.id(),
                tile.source(),
                tile.primaryField(),
                "Status",
                message,
                "No Data",
                "neutral",
                null,
                List.of());
    }

    private MarketWatchDtos.MarketWatchLayoutConfig parseLayout(String json) {
        try {
            return objectMapper.readValue(json, MarketWatchDtos.MarketWatchLayoutConfig.class);
        } catch (JsonProcessingException ex) {
            throw new ValidationException("Stored market-watch config is invalid");
        }
    }

    private MarketWatchDtos.MarketWatchLayoutConfig normalizeLayout(MarketWatchDtos.MarketWatchLayoutConfig layout) {
        if (layout == null) {
            throw new ValidationException("config is required");
        }

        int refreshSeconds = layout.refreshIntervalSeconds() == null || layout.refreshIntervalSeconds() < 5
                ? 30
                : Math.min(layout.refreshIntervalSeconds(), 3600);
        int gridColumns = layout.gridColumns() == null ? 3 : Math.max(1, Math.min(layout.gridColumns(), 4));
        List<MarketWatchDtos.MarketWatchTileConfig> inputTiles = layout.tiles() == null ? List.of() : layout.tiles();
        if (inputTiles.size() > MAX_TILES) {
            throw new ValidationException("Maximum " + MAX_TILES + " tiles allowed");
        }

        List<MarketWatchDtos.MarketWatchTileConfig> normalizedTiles = inputTiles.stream()
                .map(this::normalizeTile)
                .toList();
        List<MarketWatchDtos.MarketWatchGroupConfig> groups = layout.groups() == null ? List.of()
                : layout.groups().stream()
                        .filter(g -> g != null && StringUtils.hasText(g.id()) && StringUtils.hasText(g.name()))
                        .map(g -> new MarketWatchDtos.MarketWatchGroupConfig(g.id().trim(), g.name().trim()))
                        .toList();
        return new MarketWatchDtos.MarketWatchLayoutConfig(refreshSeconds, gridColumns, normalizedTiles, groups);
    }

    private MarketWatchDtos.MarketWatchTileConfig normalizeTile(MarketWatchDtos.MarketWatchTileConfig tile) {
        if (tile == null) {
            throw new ValidationException("tile is required");
        }

        String id = requireText(tile.id(), "tile id");
        String source = requireText(tile.source(), "tile source").toUpperCase();
        String title = safeTrim(tile.title());
        String instrumentKey = safeTrim(tile.instrumentKey());
        String timeframeUnit = safeTrim(tile.timeframeUnit());
        Integer timeframeInterval = tile.timeframeInterval();
        String marketScope = safeTrim(tile.marketScope());
        String primaryField = normalizePrimaryField(source, tile.primaryField());

        if (("TRADING_SIGNAL".equals(source) || "TRADING_PARAM".equals(source) || "CANDLE".equals(source)) && !StringUtils.hasText(instrumentKey)) {
            throw new ValidationException("instrumentKey is required for " + source);
        }
        if (("TRADING_SIGNAL".equals(source) || "CANDLE".equals(source)) && (!StringUtils.hasText(timeframeUnit) || timeframeInterval == null)) {
            throw new ValidationException("timeframe is required for " + source);
        }
        if ("MARKET_SENTIMENT".equals(source) && !StringUtils.hasText(marketScope)) {
            throw new ValidationException("marketScope is required for MARKET_SENTIMENT");
        }

        String groupId = safeTrim(tile.groupId());
        return new MarketWatchDtos.MarketWatchTileConfig(
                id,
                title,
                source,
                instrumentKey,
                StringUtils.hasText(timeframeUnit) ? timeframeUnit.toLowerCase() : null,
                timeframeInterval,
                marketScope,
                primaryField,
                StringUtils.hasText(groupId) ? groupId : null);
    }

    private String normalizePrimaryField(String source, String primaryField) {
        String normalized = safeTrim(primaryField);
        List<String> allowed = switch (source) {
            case "TRADING_SIGNAL" -> List.of("signal", "currentClose", "previousClose", "dma9", "dma26", "dma110", "signalDate");
            case "TRADING_PARAM" -> List.of("gapType", "gapPct", "orbHigh", "orbLow", "orbBreakout", "orbBreakdown", "todayOpen", "todayClose", "prevHigh", "prevLow", "prevClose", "gapUpPct", "gapDownPct", "tradeDate");
            case "MARKET_SENTIMENT" -> List.of("trendStatus", "currentValue", "ema9", "ema21", "ema110", "aiAnalysis", "aiConfidence", "sourceCount", "evidenceCount", "dataAsOf", "reason", "aiReason", "sourceNames");
            case "CANDLE" -> List.of("closePrice", "openPrice", "highPrice", "lowPrice", "volume");
            default -> throw new ValidationException("Unsupported market-watch source: " + source);
        };
        return normalized != null && allowed.contains(normalized) ? normalized : allowed.get(0);
    }

    private String serialize(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            throw new ValidationException("Unable to serialize market-watch config");
        }
    }

    private void addField(
            Map<String, MarketWatchDtos.MarketWatchTileField> fields,
            String key,
            String label,
            String value,
            String tone
    ) {
        fields.put(key, new MarketWatchDtos.MarketWatchTileField(key, label, valueOrDash(value), tone));
    }

    private String deriveParamStatus(TradingDayParamEntity entity) {
        if ("Yes".equalsIgnoreCase(entity.getOrbBreakout())) {
            return "Breakout";
        }
        if ("Yes".equalsIgnoreCase(entity.getOrbBreakdown())) {
            return "Breakdown";
        }
        return valueOrDash(entity.getGapType());
    }

    private String toneForParam(TradingDayParamEntity entity) {
        if ("Yes".equalsIgnoreCase(entity.getOrbBreakout())) {
            return "positive";
        }
        if ("Yes".equalsIgnoreCase(entity.getOrbBreakdown())) {
            return "negative";
        }
        String gapType = valueOrDash(entity.getGapType()).toLowerCase();
        if (gapType.contains("up")) {
            return "positive";
        }
        if (gapType.contains("down")) {
            return "negative";
        }
        return "neutral";
    }

    private String toneForSignal(String value) {
        if (value == null) return "neutral";
        String normalized = value.trim().toUpperCase();
        return switch (normalized) {
            case "BUY", "BULL", "BULLISH" -> "positive";
            case "SELL", "BEAR", "BEARISH" -> "negative";
            case "HOLD", "NEUTRAL" -> "warning";
            default -> "neutral";
        };
    }

    private String toneYesNo(String value) {
        return "Yes".equalsIgnoreCase(value) ? "positive" : "neutral";
    }

    private String formatDecimal(BigDecimal value) {
        return value == null ? "—" : value.stripTrailingZeros().toPlainString();
    }

    private String formatInteger(Number value) {
        return value == null ? "—" : String.valueOf(value.longValue());
    }

    private String formatPercent(BigDecimal value) {
        return value == null ? "—" : formatDecimal(value) + "%";
    }

    private String formatDate(LocalDate value) {
        return value == null ? "—" : value.toString();
    }

    private String formatInstant(Instant value) {
        return value == null ? null : DATE_TIME_FORMATTER.format(value.atZone(MARKET_ZONE));
    }

    private String valueOrDash(String value) {
        return StringUtils.hasText(value) ? value.trim() : "—";
    }

    private String safeTrim(String value) {
        return value == null ? null : value.trim();
    }

    private String requireText(String value, String fieldName) {
        if (!StringUtils.hasText(value)) {
            throw new ValidationException(fieldName + " is required");
        }
        return value.trim();
    }

    private String requireUsername(String username) {
        return requireText(username, "username");
    }
}
