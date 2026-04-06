package com.inalgo.trade.service;

import com.inalgo.trade.entity.CandleEntity;
import com.inalgo.trade.entity.MarketSentimentSnapshotEntity;
import com.inalgo.trade.repository.CandleRepository;
import com.inalgo.trade.repository.MarketSentimentSnapshotRepository;
import jakarta.validation.ValidationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
public class MarketSentimentService {
    private static final Logger log = LoggerFactory.getLogger(MarketSentimentService.class);

    static final String STATUS_BULL = "BULL";
    static final String STATUS_BEAR = "BEAR";
    static final String STATUS_NEUTRAL = "NEUTRAL";
    static final String STATUS_HOLD = "HOLD";
    static final String TYPE_NEWS = "NEWS";
    static final String TYPE_WEB_SEARCH = "WEB_SEARCH";
    static final String TYPE_TECHNICAL = "TECHNICAL";
    static final String SCOPE_GLOBAL_NEWS = "GLOBAL_NEWS";
    static final String SCOPE_INDIA_NEWS = "INDIA_NEWS";
    static final String SCOPE_GIFT_NIFTY = "GIFT_NIFTY";
    static final String SCOPE_SP500 = "SP500";
    private static final String NIFTY_50_INSTRUMENT_KEY = "NSE_INDEX|Nifty 50";
    private static final ZoneId INDIA_ZONE = ZoneId.of("Asia/Kolkata");
    private static final LocalTime INDIA_MARKET_OPEN = LocalTime.of(9, 15);
    private static final BigDecimal INTRADAY_DIRECTION_THRESHOLD_PCT = new BigDecimal("0.15");

    private static final List<FeedSource> GLOBAL_FEEDS = List.of(
            new FeedSource("Google News", "https://news.google.com/rss/search?q=when:1d+stock+market+OR+fed+OR+war+OR+election&hl=en-US&gl=US&ceid=US:en"),
            new FeedSource("CNBC World", "https://www.cnbc.com/id/100727362/device/rss/rss.html"),
            new FeedSource("CNBC Finance", "https://www.cnbc.com/id/100003114/device/rss/rss.html"),
            new FeedSource("MarketWatch Markets", "https://feeds.content.dowjones.io/public/rss/RSSMarketsMain"),
            new FeedSource("Federal Reserve", "https://www.federalreserve.gov/feeds/press_all.xml")
    );
    private static final List<FeedSource> INDIA_FEEDS = List.of(
            new FeedSource("Google News India", "https://news.google.com/rss/search?q=when:1d+india+stock+market+OR+rbi+OR+policy+OR+election&hl=en-IN&gl=IN&ceid=IN:en"),
            new FeedSource("Economic Times Markets", "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms"),
            new FeedSource("LiveMint Markets", "https://www.livemint.com/rss/markets"),
            new FeedSource("The Hindu BusinessLine Markets", "https://www.thehindubusinessline.com/markets/?service=rss"),
            new FeedSource("Business Standard Markets", "https://www.business-standard.com/rss/markets-106.rss")
    );

    private final MarketSentimentSnapshotRepository repository;
    private final CandleRepository candleRepository;
    private final MarketSentimentClient client;
    private final MarketSentimentProperties properties;
    private final MarketSentimentAiService marketSentimentAiService;
    private final OpenAiWebSearchNewsClient webSearchNewsClient;

    public MarketSentimentService(
            MarketSentimentSnapshotRepository repository,
            CandleRepository candleRepository,
            MarketSentimentClient client,
            MarketSentimentProperties properties,
            MarketSentimentAiService marketSentimentAiService,
            OpenAiWebSearchNewsClient webSearchNewsClient
    ) {
        this.repository = repository;
        this.candleRepository = candleRepository;
        this.client = client;
        this.properties = properties;
        this.marketSentimentAiService = marketSentimentAiService;
        this.webSearchNewsClient = webSearchNewsClient;
    }

    @Transactional
    public List<MarketSentimentSnapshotEntity> refreshConfiguredTenant() {
        return refreshTenant(properties.tenantId());
    }

    @Transactional
    public List<MarketSentimentSnapshotEntity> refreshTenant(String tenantId) {
        String normalizedTenantId = requireTenant(tenantId);
        Instant snapshotAt = Instant.now().truncatedTo(ChronoUnit.MINUTES);
        boolean aiEnabled = marketSentimentAiService.isEnabledForTenant(normalizedTenantId);
        List<SnapshotWriteRequest> requests = new ArrayList<>();
        if (aiEnabled) {
            collectRequest(requests, () -> evaluateWebSearchNewsSentiment(normalizedTenantId, snapshotAt, SCOPE_GLOBAL_NEWS, "Global Market Trend"), SCOPE_GLOBAL_NEWS);
            collectRequest(requests, () -> evaluateWebSearchNewsSentiment(normalizedTenantId, snapshotAt, SCOPE_INDIA_NEWS, "Indian Market Trend"), SCOPE_INDIA_NEWS);
        } else {
            collectRequest(requests, () -> evaluateNewsSentiment(normalizedTenantId, snapshotAt, SCOPE_GLOBAL_NEWS, "Global Market Trend", GLOBAL_FEEDS, false, false), SCOPE_GLOBAL_NEWS);
            collectRequest(requests, () -> evaluateNewsSentiment(normalizedTenantId, snapshotAt, SCOPE_INDIA_NEWS, "Indian Market Trend", INDIA_FEEDS, true, false), SCOPE_INDIA_NEWS);
        }
        if (requests.isEmpty()) {
            throw new ValidationException("No market sentiment sources returned usable data");
        }
        return persistRequests(normalizedTenantId, requests);
    }

    @Transactional
    public List<MarketSentimentSnapshotEntity> refreshTechnicalTenant(String tenantId) {
        String normalizedTenantId = requireTenant(tenantId);
        Instant snapshotAt = Instant.now().truncatedTo(ChronoUnit.MINUTES);
        boolean aiEnabled = marketSentimentAiService.isEnabledForTenant(normalizedTenantId);
        List<SnapshotWriteRequest> requests = new ArrayList<>();
        collectRequest(requests, () -> evaluateTechnicalTrend(normalizedTenantId, snapshotAt, SCOPE_GIFT_NIFTY, client.fetchGiftNifty(), aiEnabled), SCOPE_GIFT_NIFTY);
        collectRequest(requests, () -> evaluateTechnicalTrend(normalizedTenantId, snapshotAt, SCOPE_SP500, fetchSp500WithFallback(), aiEnabled), SCOPE_SP500);
        if (requests.isEmpty()) {
            throw new ValidationException("No global index sources returned usable data");
        }
        return persistRequests(normalizedTenantId, requests);
    }

    private List<MarketSentimentSnapshotEntity> persistRequests(String tenantId, List<SnapshotWriteRequest> requests) {
        List<MarketSentimentSnapshotEntity> persisted = new ArrayList<>();
        for (SnapshotWriteRequest request : requests) {
            repository.upsert(
                    tenantId,
                    request.marketScope(),
                    request.marketName(),
                    request.evaluationType(),
                    request.trendStatus(),
                    request.reason(),
                    request.currentValue(),
                    request.ema9(),
                    request.ema21(),
                    request.ema110(),
                    request.sourceCount(),
                    request.evidenceCount(),
                    request.sourceNames(),
                    request.dataAsOf(),
                    request.aiAnalysis(),
                    request.aiReason(),
                    request.aiConfidence(),
                    request.aiModel(),
                    request.aiUpdatedAt(),
                    request.snapshotAt()
            );
            persisted.add(repository.findByTenantIdAndMarketScopeAndSnapshotAt(tenantId, request.marketScope(), request.snapshotAt())
                    .orElseThrow(() -> new ValidationException("Market sentiment snapshot was not persisted for " + request.marketScope())));
        }
        return persisted;
    }

    SnapshotWriteRequest evaluateNewsSentiment(
            String tenantId,
            Instant snapshotAt,
            String marketScope,
            String marketName,
            List<FeedSource> feeds,
            boolean indiaFocused,
            boolean aiEnabled
    ) {
        Instant cutoff = snapshotAt.minus(Duration.ofHours(Math.max(properties.newsLookbackHours(), 1)));
        List<NewsSignal> evidence = new ArrayList<>();
        Set<String> sourceNames = new LinkedHashSet<>();
        Set<String> seenTitles = new LinkedHashSet<>();

        for (FeedSource feed : feeds) {
            sourceNames.add(feed.name());
            List<MarketSentimentClient.NewsArticle> articles;
            try {
                articles = client.fetchRssFeed(feed.url(), feed.name());
            } catch (RuntimeException ex) {
                log.warn("Skipping feed {} for {}: {}", feed.name(), marketScope, ex.getMessage());
                continue;
            }
            int remaining = Math.max(properties.maxFeedItemsPerSource(), 1);
            for (MarketSentimentClient.NewsArticle article : articles) {
                if (remaining <= 0) {
                    break;
                }
                if (article.publishedAt() == null || article.publishedAt().isBefore(cutoff)) {
                    continue;
                }
                String dedupeKey = normalizeTitle(article.title());
                if (!seenTitles.add(dedupeKey)) {
                    continue;
                }
                NewsSignal signal = classifyArticle(article, indiaFocused);
                if (signal == null) {
                    continue;
                }
                evidence.add(signal);
                remaining--;
            }
        }

        evidence.sort(Comparator.comparingInt((NewsSignal signal) -> Math.abs(signal.score())).reversed()
                .thenComparing(signal -> signal.article().publishedAt(), Comparator.nullsLast(Comparator.reverseOrder())));
        int totalScore = evidence.stream().mapToInt(NewsSignal::score).sum();
        String rawTrendStatus = totalScore >= 2 ? STATUS_BULL : totalScore <= -2 ? STATUS_BEAR : STATUS_NEUTRAL;
        String rawReason = buildNewsReason(rawTrendStatus, evidence, sourceNames);
        CalibratedTrend calibrated = calibrateIndiaNewsTrend(
                tenantId,
                snapshotAt,
                marketScope,
                rawTrendStatus,
                rawReason,
                Math.abs(totalScore) < 4
        );
        MarketSentimentAiService.AiAnalysis aiAnalysis = marketSentimentAiService.analyzeNews(
                tenantId,
                aiEnabled,
                marketName,
                marketScope,
                calibrated.trendStatus(),
                calibrated.reason(),
                sourceNames,
                evidence
        );
        return new SnapshotWriteRequest(
                tenantId,
                marketScope,
                marketName,
                TYPE_NEWS,
                calibrated.trendStatus(),
                calibrated.reason(),
                null,
                null,
                null,
                null,
                sourceNames.size(),
                evidence.size(),
                String.join(", ", sourceNames),
                evidence.stream().map(signal -> signal.article().publishedAt()).filter(java.util.Objects::nonNull).max(Comparator.naturalOrder()).orElse(snapshotAt),
                aiAnalysis.trendStatus(),
                aiAnalysis.reason(),
                aiAnalysis.confidence(),
                aiAnalysis.model(),
                aiAnalysis.updatedAt(),
                snapshotAt
        );
    }

    SnapshotWriteRequest evaluateWebSearchNewsSentiment(
            String tenantId,
            Instant snapshotAt,
            String marketScope,
            String marketName
    ) {
        OpenAiWebSearchNewsClient.WebSearchNewsResult result = webSearchNewsClient.searchAndAnalyze(tenantId, marketScope, marketName);
        CalibratedTrend calibrated = calibrateIndiaNewsTrend(
                tenantId,
                snapshotAt,
                marketScope,
                result.trendStatus(),
                result.reason(),
                result.confidence() < 70
        );
        String headlinesJoined = String.join(" | ", result.headlines());
        return new SnapshotWriteRequest(
                tenantId,
                marketScope,
                marketName,
                TYPE_WEB_SEARCH,
                calibrated.trendStatus(),
                calibrated.reason(),
                null, null, null, null,
                1,
                result.headlines().size(),
                headlinesJoined,
                snapshotAt,
                calibrated.trendStatus(),
                calibrated.reason(),
                result.confidence(),
                result.model(),
                snapshotAt,
                snapshotAt
        );
    }

    SnapshotWriteRequest evaluateTechnicalTrend(
            String tenantId,
            Instant snapshotAt,
            String marketScope,
            MarketSentimentClient.TechnicalSeries series,
            boolean aiEnabled
    ) {
        if (series.points().size() < EmaCalculator.EMA_110_PERIOD) {
            throw new ValidationException("Insufficient historical data for " + series.marketName());
        }
        EmaCalculator.EmaAccumulator ema9 = EmaCalculator.accumulator(9);
        EmaCalculator.EmaAccumulator ema21 = EmaCalculator.accumulator(21);
        EmaCalculator.EmaAccumulator ema110 = EmaCalculator.accumulator(110);
        for (MarketSentimentClient.PricePoint point : series.points()) {
            ema9.accept(point.closeValue());
            ema21.accept(point.closeValue());
            ema110.accept(point.closeValue());
        }
        BigDecimal ema9Value = ema9.value();
        BigDecimal ema21Value = ema21.value();
        BigDecimal ema110Value = ema110.value();
        BigDecimal currentValue = series.currentValue();
        String trendStatus;
        if (currentValue.compareTo(ema9Value) > 0 && ema9Value.compareTo(ema21Value) > 0 && ema21Value.compareTo(ema110Value) > 0) {
            trendStatus = STATUS_BULL;
        } else if (currentValue.compareTo(ema9Value) < 0 && ema9Value.compareTo(ema21Value) < 0 && ema21Value.compareTo(ema110Value) < 0) {
            trendStatus = STATUS_BEAR;
        } else {
            trendStatus = STATUS_HOLD;
        }
        String reason = String.format(Locale.ENGLISH,
                "%s current %.2f vs EMA9 %.2f, EMA21 %.2f, EMA110 %.2f. Rule: price > EMA9 > EMA21 > EMA110 = BULL, price < EMA9 < EMA21 < EMA110 = BEAR, else HOLD.",
                series.marketName(),
                currentValue,
                ema9Value,
                ema21Value,
                ema110Value
        );
        MarketSentimentAiService.AiAnalysis aiAnalysis = marketSentimentAiService.analyzeTechnical(
                tenantId,
                aiEnabled,
                series,
                trendStatus,
                reason,
                ema9Value,
                ema21Value,
                ema110Value
        );
        return new SnapshotWriteRequest(
                tenantId,
                marketScope,
                series.marketName(),
                TYPE_TECHNICAL,
                trendStatus,
                reason,
                currentValue,
                ema9Value,
                ema21Value,
                ema110Value,
                1,
                series.points().size(),
                series.marketName(),
                series.dataAsOf(),
                aiAnalysis.trendStatus(),
                aiAnalysis.reason(),
                aiAnalysis.confidence(),
                aiAnalysis.model(),
                aiAnalysis.updatedAt(),
                snapshotAt
        );
    }

    NewsSignal classifyArticle(MarketSentimentClient.NewsArticle article, boolean indiaFocused) {
        String text = (article.title() + " " + article.description()).toLowerCase(Locale.ENGLISH);
        List<String> tags = new ArrayList<>();
        int score = 0;
        if (containsAny(text, "war", "missile", "attack", "conflict", "sanction", "military", "tariff escalation")) {
            score -= 3;
            tags.add("war/conflict");
        }
        if (containsAny(text, "ceasefire", "peace deal", "truce", "de-escalation")) {
            score += 2;
            tags.add("de-escalation");
        }
        if (containsAny(text, "fed", "federal reserve", "interest rate", "rate cut", "rate hike", "rbi", "repo rate", "monetary policy", "cbi policy")) {
            if (containsAny(text, "rate cut", "cuts rates", "eases policy", "stimulus")) {
                score += 3;
                tags.add("rate cut/easing");
            } else if (containsAny(text, "rate hike", "raises rates", "hawkish", "tightening")) {
                score -= 3;
                tags.add("rate hike/tightening");
            } else {
                tags.add("policy/rates");
            }
        }
        if (containsAny(text, "policy", "budget", "tax", "regulation", "reform", "approval", "ban", "tariff")) {
            if (containsAny(text, "reform", "approval", "tax cut", "incentive", "stimulus", "boost")) {
                score += 2;
                tags.add("pro-growth policy");
            } else if (containsAny(text, "ban", "tax hike", "crackdown", "tariff", "restriction")) {
                score -= 2;
                tags.add("restrictive policy");
            }
        }
        if (containsAny(text, "election", "coalition", "parliament", "government", "prime minister", "president")) {
            if (containsAny(text, "stable", "wins majority", "mandate", "reform agenda")) {
                score += 2;
                tags.add("political stability");
            } else if (containsAny(text, "hung", "uncertainty", "crisis", "protest", "resigns")) {
                score -= 2;
                tags.add("political risk");
            } else {
                tags.add("politics/election");
            }
        }
        if (containsAny(text, "cyberattack", "outage", "hack", "chip shortage", "supply shock", "selloff", "fraud", "bankruptcy")) {
            score -= 2;
            tags.add("market disruption");
        }
        if (containsAny(text,
                "nifty rises", "sensex rises", "nifty gains", "sensex gains", "rallies", "rally", "surges", "record high",
                "all-time high", "buying spree", "fii buying", "dii buying", "strong close", "upbeat guidance")) {
            score += 2;
            tags.add("market momentum up");
        }
        if (containsAny(text,
                "nifty falls", "sensex falls", "nifty declines", "sensex declines", "slides", "slumps", "tumbles", "profit booking",
                "fii selling", "weak close", "downgrade", "misses estimates")) {
            score -= 2;
            tags.add("market momentum down");
        }
        if (containsAny(text, "ai breakthrough", "new chip", "record profit", "upgrade", "rally", "surge")) {
            score += 1;
            tags.add("market support");
        }
        if (indiaFocused && !containsAny(text, "india", "indian", "rbi", "nifty", "sensex", "gift city", "sebi", "delhi", "mumbai")) {
            return null;
        }
        if (!indiaFocused && containsAny(text, "india", "rbi", "sensex", "nifty") && !containsAny(text, "global", "world", "fed", "us", "europe", "china")) {
            return null;
        }
        if (score == 0 && tags.isEmpty()) {
            return null;
        }
        return new NewsSignal(score, tags, article);
    }

    private boolean containsAny(String text, String... needles) {
        for (String needle : needles) {
            if (text.contains(needle)) {
                return true;
            }
        }
        return false;
    }

    private String buildNewsReason(String trendStatus, List<NewsSignal> evidence, Set<String> sources) {
        if (evidence.isEmpty()) {
            return "No recent high-impact articles matched across " + sources.size() + " sources. Defaulting to NEUTRAL.";
        }
        List<String> topReasons = evidence.stream()
                .limit(3)
                .map(signal -> signal.article().sourceName() + ": " + cleanTitle(signal.article().title()) + " [" + String.join(", ", signal.tags()) + "]")
                .toList();
        return trendStatus + " from " + evidence.size() + " matched articles across " + sources.size() + " sources. Top reasons: " + String.join(" | ", topReasons);
    }

    private String cleanTitle(String title) {
        int separator = title.lastIndexOf(" - ");
        return separator > 0 ? title.substring(0, separator).trim() : title.trim();
    }

    private String normalizeTitle(String title) {
        return cleanTitle(title).toLowerCase(Locale.ENGLISH).replaceAll("[^a-z0-9]+", " ").trim();
    }

    private String requireTenant(String tenantId) {
        if (!StringUtils.hasText(tenantId)) {
            throw new ValidationException("Missing tenant context");
        }
        return tenantId.trim();
    }

    /**
     * Fetches S&P 500 technical data, preferring Stooq and falling back to Yahoo Finance.
     * Stooq occasionally rate-limits or blocks automated requests; Yahoo Finance is the resilience backstop.
     */
    private MarketSentimentClient.TechnicalSeries fetchSp500WithFallback() {
        try {
            return client.fetchStooqIndex("%5Espx", "S&P 500");
        } catch (RuntimeException ex) {
            log.warn("Stooq S&P 500 fetch failed ({}), falling back to Yahoo Finance", ex.getMessage());
            return client.fetchYahooIndex("%5EGSPC", "S&P 500");
        }
    }

    private void collectRequest(List<SnapshotWriteRequest> requests, java.util.function.Supplier<SnapshotWriteRequest> supplier, String scope) {
        try {
            requests.add(supplier.get());
        } catch (RuntimeException ex) {
            log.warn("Skipping market sentiment scope {}: {}", scope, ex.getMessage());
        }
    }

    private CalibratedTrend calibrateIndiaNewsTrend(
            String tenantId,
            Instant snapshotAt,
            String marketScope,
            String predictedTrend,
            String reason,
            boolean weakPrediction
    ) {
        if (!SCOPE_INDIA_NEWS.equals(marketScope)) {
            return new CalibratedTrend(predictedTrend, reason);
        }
        IntradayDirection intradayDirection = detectIndiaBenchmarkIntradayDirection(tenantId, snapshotAt);
        if (intradayDirection == null || STATUS_NEUTRAL.equals(intradayDirection.trendStatus())) {
            return new CalibratedTrend(predictedTrend, reason);
        }
        String normalizedPrediction = predictedTrend == null ? STATUS_NEUTRAL : predictedTrend;
        boolean shouldCalibrate = STATUS_NEUTRAL.equals(normalizedPrediction)
                || (weakPrediction && !normalizedPrediction.equals(intradayDirection.trendStatus()));
        if (!shouldCalibrate) {
            return new CalibratedTrend(predictedTrend, reason);
        }
        String calibratedReason = reason + " | Real-data calibration: Nifty 50 intraday moved "
                + intradayDirection.changePct() + "% (" + intradayDirection.startClose() + " -> " + intradayDirection.latestClose() + ").";
        return new CalibratedTrend(intradayDirection.trendStatus(), calibratedReason);
    }

    private IntradayDirection detectIndiaBenchmarkIntradayDirection(String tenantId, Instant snapshotAt) {
        LocalDate tradeDate = snapshotAt.atZone(INDIA_ZONE).toLocalDate();
        Instant marketOpenInstant = tradeDate.atTime(INDIA_MARKET_OPEN).atZone(INDIA_ZONE).toInstant();
        Instant upperBoundExclusive = snapshotAt.plusSeconds(1);

        CandleEntity startCandle = candleRepository
                .findFirstByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeIntervalAndCandleTsGreaterThanEqualAndCandleTsLessThanOrderByCandleTsAsc(
                        tenantId,
                        NIFTY_50_INSTRUMENT_KEY,
                        "minutes",
                        5,
                        marketOpenInstant,
                        upperBoundExclusive
                )
                .orElse(null);
        if (startCandle == null) {
            return null;
        }

        CandleEntity latestCandle = candleRepository
                .findFirstByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeIntervalAndCandleTsLessThanOrderByCandleTsDesc(
                        tenantId,
                        NIFTY_50_INSTRUMENT_KEY,
                        "minutes",
                        5,
                        upperBoundExclusive
                )
                .filter(candle -> !candle.getCandleTs().isBefore(marketOpenInstant))
                .orElse(null);
        if (latestCandle == null) {
            return null;
        }
        if (startCandle.getClosePrice() == null || latestCandle.getClosePrice() == null
                || BigDecimal.ZERO.compareTo(startCandle.getClosePrice()) == 0) {
            return null;
        }
        BigDecimal changePct = latestCandle.getClosePrice()
                .subtract(startCandle.getClosePrice())
                .multiply(BigDecimal.valueOf(100))
                .divide(startCandle.getClosePrice(), 2, java.math.RoundingMode.HALF_UP);
        String trendStatus = STATUS_NEUTRAL;
        if (changePct.compareTo(INTRADAY_DIRECTION_THRESHOLD_PCT) >= 0) {
            trendStatus = STATUS_BULL;
        } else if (changePct.compareTo(INTRADAY_DIRECTION_THRESHOLD_PCT.negate()) <= 0) {
            trendStatus = STATUS_BEAR;
        }
        return new IntradayDirection(trendStatus, changePct, startCandle.getClosePrice(), latestCandle.getClosePrice());
    }

    private record IntradayDirection(String trendStatus, BigDecimal changePct, BigDecimal startClose, BigDecimal latestClose) {}
    private record CalibratedTrend(String trendStatus, String reason) {}

    public record NewsFeedArticlePreview(
            String sourceName,
            String title,
            String publishedAt,
            boolean included,
            String excludeReason,
            int score,
            List<String> tags,
            String link
    ) {}

    public record NewsFeedSourcePreview(
            String name,
            String url,
            String status,
            String error,
            int totalFetched,
            int includedCount,
            List<NewsFeedArticlePreview> articles
    ) {}

    public record NewsFeedPreviewResponse(
            String scope,
            String fetchedAt,
            String cutoff,
            int newsLookbackHours,
            boolean webSearchMode,
            List<NewsFeedSourcePreview> feeds
    ) {}

    public NewsFeedPreviewResponse previewNewsFeed(String tenantId, String scope) {
        requireTenant(tenantId);
        Instant snapshotAt = Instant.now().truncatedTo(ChronoUnit.MINUTES);
        Instant cutoff = snapshotAt.minus(Duration.ofHours(Math.max(properties.newsLookbackHours(), 1)));
        boolean indiaFocused = SCOPE_INDIA_NEWS.equals(scope);
        List<FeedSource> feeds = indiaFocused ? INDIA_FEEDS : GLOBAL_FEEDS;
        List<NewsFeedSourcePreview> feedPreviews = new ArrayList<>();
        for (FeedSource feed : feeds) {
            try {
                List<MarketSentimentClient.NewsArticle> articles = client.fetchRssFeed(feed.url(), feed.name());
                List<NewsFeedArticlePreview> previews = new ArrayList<>();
                for (MarketSentimentClient.NewsArticle article : articles) {
                    String pubAtStr = article.publishedAt() != null ? article.publishedAt().toString() : null;
                    if (article.publishedAt() == null) {
                        previews.add(new NewsFeedArticlePreview(article.sourceName(), article.title(), null, false, "no-date", 0, List.of(), article.link()));
                        continue;
                    }
                    if (article.publishedAt().isBefore(cutoff)) {
                        previews.add(new NewsFeedArticlePreview(article.sourceName(), article.title(), pubAtStr, false, "too-old", 0, List.of(), article.link()));
                        continue;
                    }
                    NewsSignal signal = classifyArticle(article, indiaFocused);
                    if (signal == null) {
                        previews.add(new NewsFeedArticlePreview(article.sourceName(), article.title(), pubAtStr, false, "no-signal", 0, List.of(), article.link()));
                    } else {
                        previews.add(new NewsFeedArticlePreview(article.sourceName(), article.title(), pubAtStr, true, null, signal.score(), signal.tags(), article.link()));
                    }
                }
                long includedCount = previews.stream().filter(NewsFeedArticlePreview::included).count();
                feedPreviews.add(new NewsFeedSourcePreview(feed.name(), feed.url(), "OK", null, articles.size(), (int) includedCount, previews));
            } catch (RuntimeException ex) {
                feedPreviews.add(new NewsFeedSourcePreview(feed.name(), feed.url(), "ERROR", ex.getMessage(), 0, 0, List.of()));
            }
        }
        boolean webSearchMode = marketSentimentAiService.isEnabledForTenant(tenantId);
        return new NewsFeedPreviewResponse(scope, snapshotAt.toString(), cutoff.toString(), properties.newsLookbackHours(), webSearchMode, feedPreviews);
    }

    record FeedSource(String name, String url) {
    }

    record NewsSignal(int score, List<String> tags, MarketSentimentClient.NewsArticle article) {
    }

    public record SnapshotWriteRequest(
            String tenantId,
            String marketScope,
            String marketName,
            String evaluationType,
            String trendStatus,
            String reason,
            BigDecimal currentValue,
            BigDecimal ema9,
            BigDecimal ema21,
            BigDecimal ema110,
            Integer sourceCount,
            Integer evidenceCount,
            String sourceNames,
            Instant dataAsOf,
            String aiAnalysis,
            String aiReason,
            Integer aiConfidence,
            String aiModel,
            Instant aiUpdatedAt,
            Instant snapshotAt
    ) {
    }
}
