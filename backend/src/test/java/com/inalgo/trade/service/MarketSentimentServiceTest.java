package com.inalgo.trade.service;

import com.inalgo.trade.repository.MarketSentimentSnapshotRepository;
import com.inalgo.trade.repository.CandleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;

@ExtendWith(MockitoExtension.class)
class MarketSentimentServiceTest {

    @Mock
    private MarketSentimentSnapshotRepository repository;

    @Mock
    private CandleRepository candleRepository;

    @Mock
    private MarketSentimentClient client;

    @Mock
    private MarketSentimentAiService marketSentimentAiService;

    @Mock
    private OpenAiWebSearchNewsClient webSearchNewsClient;

    private MarketSentimentService service;

    @BeforeEach
    void setUp() {
        service = new MarketSentimentService(
                repository,
                candleRepository,
                client,
                new MarketSentimentProperties(true, "local-desktop", "0 */5 * * * *", 20, 48, 8),
                marketSentimentAiService,
                webSearchNewsClient
        );
        lenient().when(marketSentimentAiService.analyzeNews(anyString(), anyBoolean(), anyString(), anyString(), anyString(), anyString(), anySet(), anyList()))
                .thenReturn(new MarketSentimentAiService.AiAnalysis(null, null, null, null, null));
        lenient().when(marketSentimentAiService.analyzeTechnical(anyString(), anyBoolean(), org.mockito.ArgumentMatchers.any(), anyString(), anyString(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()))
                .thenReturn(new MarketSentimentAiService.AiAnalysis(null, null, null, null, null));
    }

    @Test
    void classifyArticle_marksWarHeadlineAsBearish() {
        MarketSentimentClient.NewsArticle article = new MarketSentimentClient.NewsArticle(
                "Google News",
                "Global markets slide as war fears escalate",
                "Investors react to military conflict and sanctions",
                "https://example.test/war",
                Instant.parse("2026-03-21T10:00:00Z")
        );

        MarketSentimentService.NewsSignal signal = service.classifyArticle(article, false);

        assertEquals(-3, signal.score());
        assertEquals(List.of("war/conflict"), signal.tags());
    }

    @Test
    void classifyArticle_filtersNonIndianStoryFromIndiaScope() {
        MarketSentimentClient.NewsArticle article = new MarketSentimentClient.NewsArticle(
                "CNBC World",
                "Fed officials debate next rate move",
                "US inflation and treasury yields stay in focus",
                "https://example.test/fed",
                Instant.parse("2026-03-21T10:00:00Z")
        );

        MarketSentimentService.NewsSignal signal = service.classifyArticle(article, true);

        assertEquals(null, signal);
    }

    @Test
    void evaluateTechnicalTrend_returnsBullWhenPriceAndEmasAreStackedUpward() {
        Instant snapshotAt = Instant.parse("2026-03-21T10:00:00Z");
        List<MarketSentimentClient.PricePoint> points = java.util.stream.IntStream.rangeClosed(1, 130)
                .mapToObj(index -> new MarketSentimentClient.PricePoint(
                        LocalDate.of(2025, 8, 1).plusDays(index).atStartOfDay().toInstant(ZoneOffset.UTC),
                        BigDecimal.valueOf(100 + index)
                ))
                .toList();
        MarketSentimentClient.TechnicalSeries series = new MarketSentimentClient.TechnicalSeries(
                "Gift Nifty",
                BigDecimal.valueOf(245),
                snapshotAt,
                points
        );

        MarketSentimentService.SnapshotWriteRequest result = service.evaluateTechnicalTrend(
                "tenant-a",
                snapshotAt,
                MarketSentimentService.SCOPE_GIFT_NIFTY,
                series,
                false
        );

        assertEquals(MarketSentimentService.STATUS_BULL, result.trendStatus());
        assertEquals(BigDecimal.valueOf(245), result.currentValue());
    }

    @Test
    void evaluateNewsSentiment_returnsNeutralWhenNoRelevantArticlesMatch() {
        MarketSentimentClient.NewsArticle unrelatedArticle = new MarketSentimentClient.NewsArticle(
                "NDTV Profit",
                "Weekend lifestyle roundup",
                "Travel and food highlights from around the world",
                "https://example.test/lifestyle",
                Instant.parse("2026-03-21T10:00:00Z")
        );
        org.mockito.Mockito.when(client.fetchRssFeed("feed-1", "Feed One")).thenReturn(List.of(unrelatedArticle));

        MarketSentimentService.SnapshotWriteRequest result = service.evaluateNewsSentiment(
                "tenant-a",
                Instant.parse("2026-03-21T12:00:00Z"),
                MarketSentimentService.SCOPE_GLOBAL_NEWS,
                "Global Market Trend",
                List.of(new MarketSentimentService.FeedSource("Feed One", "feed-1")),
                false,
                false
        );

        assertEquals(MarketSentimentService.STATUS_NEUTRAL, result.trendStatus());
        assertEquals(0, result.evidenceCount());
    }

    @Test
    void evaluateNewsSentiment_populatesAiAnalysisWhenConfigured() {
        MarketSentimentClient.NewsArticle article = new MarketSentimentClient.NewsArticle(
                "Google News",
                "Global equities rally after ceasefire talks advance",
                "Markets react to de-escalation signals",
                "https://example.test/ceasefire",
                Instant.parse("2026-03-21T10:00:00Z")
        );
        org.mockito.Mockito.when(client.fetchRssFeed("feed-1", "Feed One")).thenReturn(List.of(article));
        org.mockito.Mockito.when(marketSentimentAiService.analyzeNews(
                        org.mockito.ArgumentMatchers.eq("tenant-a"),
                        org.mockito.ArgumentMatchers.eq(true),
                        org.mockito.ArgumentMatchers.eq("Global Market Trend"),
                        org.mockito.ArgumentMatchers.eq(MarketSentimentService.SCOPE_GLOBAL_NEWS),
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anySet(),
                        org.mockito.ArgumentMatchers.anyList()))
                .thenReturn(new MarketSentimentAiService.AiAnalysis("BULL", "De-escalation headlines outweigh risk.", 78, "gpt-5-mini", Instant.parse("2026-03-21T12:00:00Z")));

        MarketSentimentService.SnapshotWriteRequest result = service.evaluateNewsSentiment(
                "tenant-a",
                Instant.parse("2026-03-21T12:00:00Z"),
                MarketSentimentService.SCOPE_GLOBAL_NEWS,
                "Global Market Trend",
                List.of(new MarketSentimentService.FeedSource("Feed One", "feed-1")),
                false,
                true
        );

        assertEquals("BULL", result.aiAnalysis());
        assertEquals("De-escalation headlines outweigh risk.", result.aiReason());
        assertEquals(78, result.aiConfidence());
        assertEquals("gpt-5-mini", result.aiModel());
    }

    @Test
    void classifyArticle_marksIndianRallyHeadlineAsBullishMomentum() {
        MarketSentimentClient.NewsArticle article = new MarketSentimentClient.NewsArticle(
                "Economic Times",
                "Nifty gains as banking stocks rally; Sensex hits record high",
                "FII buying supports Indian equities",
                "https://example.test/nifty-rally",
                Instant.parse("2026-03-21T10:00:00Z")
        );

        MarketSentimentService.NewsSignal signal = service.classifyArticle(article, true);

        assertTrue(signal.score() > 0);
        assertTrue(signal.tags().contains("market support") || signal.tags().contains("market momentum up"));
    }

    @Test
    void evaluateWebSearchNewsSentiment_calibratesIndiaNeutralToBullFromRealCandleMove() {
        Instant snapshotAt = Instant.parse("2026-03-21T06:00:00Z"); // 11:30 IST
        org.mockito.Mockito.when(webSearchNewsClient.searchAndAnalyze("tenant-a", MarketSentimentService.SCOPE_INDIA_NEWS, "Indian Market Trend"))
                .thenReturn(new OpenAiWebSearchNewsClient.WebSearchNewsResult(
                        "NEUTRAL",
                        "Mixed macro cues from morning headlines.",
                        62,
                        List.of("Nifty edges higher in volatile trade"),
                        "gpt-4o-mini"
                ));
        org.mockito.Mockito.when(candleRepository
                        .findFirstByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeIntervalAndCandleTsGreaterThanEqualAndCandleTsLessThanOrderByCandleTsAsc(
                                org.mockito.ArgumentMatchers.eq("tenant-a"),
                                org.mockito.ArgumentMatchers.eq("NSE_INDEX|Nifty 50"),
                                org.mockito.ArgumentMatchers.eq("minutes"),
                                org.mockito.ArgumentMatchers.eq(5),
                                org.mockito.ArgumentMatchers.any(),
                                org.mockito.ArgumentMatchers.any()))
                .thenReturn(java.util.Optional.of(new com.inalgo.trade.entity.CandleEntity(
                        "tenant-a",
                        "NSE_INDEX|Nifty 50",
                        "minutes",
                        5,
                        snapshotAt.minus(2, java.time.temporal.ChronoUnit.HOURS),
                        BigDecimal.valueOf(22000),
                        BigDecimal.valueOf(22000),
                        BigDecimal.valueOf(22000),
                        BigDecimal.valueOf(22000),
                        1000L
                )));
        org.mockito.Mockito.when(candleRepository
                        .findFirstByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeIntervalAndCandleTsLessThanOrderByCandleTsDesc(
                                org.mockito.ArgumentMatchers.eq("tenant-a"),
                                org.mockito.ArgumentMatchers.eq("NSE_INDEX|Nifty 50"),
                                org.mockito.ArgumentMatchers.eq("minutes"),
                                org.mockito.ArgumentMatchers.eq(5),
                                org.mockito.ArgumentMatchers.any()))
                .thenReturn(java.util.Optional.of(new com.inalgo.trade.entity.CandleEntity(
                        "tenant-a",
                        "NSE_INDEX|Nifty 50",
                        "minutes",
                        5,
                        snapshotAt.minus(5, java.time.temporal.ChronoUnit.MINUTES),
                        BigDecimal.valueOf(22080),
                        BigDecimal.valueOf(22080),
                        BigDecimal.valueOf(22080),
                        BigDecimal.valueOf(22080),
                        900L
                )));

        MarketSentimentService.SnapshotWriteRequest result = service.evaluateWebSearchNewsSentiment(
                "tenant-a",
                snapshotAt,
                MarketSentimentService.SCOPE_INDIA_NEWS,
                "Indian Market Trend"
        );

        assertEquals("BULL", result.trendStatus());
        assertEquals("BULL", result.aiAnalysis());
    }
}
