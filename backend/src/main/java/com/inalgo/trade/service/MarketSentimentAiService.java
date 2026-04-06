package com.inalgo.trade.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
public class MarketSentimentAiService {
    private static final Logger log = LoggerFactory.getLogger(MarketSentimentAiService.class);

    private final OpenAiProperties openAiProperties;
    private final OpenAiTokenService openAiTokenService;
    private final OpenAiMarketAnalysisClient openAiMarketAnalysisClient;

    public MarketSentimentAiService(
            OpenAiProperties openAiProperties,
            OpenAiTokenService openAiTokenService,
            OpenAiMarketAnalysisClient openAiMarketAnalysisClient
    ) {
        this.openAiProperties = openAiProperties;
        this.openAiTokenService = openAiTokenService;
        this.openAiMarketAnalysisClient = openAiMarketAnalysisClient;
    }

    public boolean isEnabledForTenant(String tenantId) {
        return openAiProperties.enabled() && openAiTokenService.findTokenForTenant(tenantId).isPresent();
    }

    public AiAnalysis analyzeNews(
            String tenantId,
            boolean enabled,
            String marketName,
            String marketScope,
            String heuristicTrend,
            String heuristicReason,
            Set<String> sourceNames,
            List<MarketSentimentService.NewsSignal> evidence
    ) {
        StringBuilder prompt = new StringBuilder();
        prompt.append("Market: ").append(marketName).append('\n');
        prompt.append("Scope: ").append(marketScope).append('\n');
        prompt.append("Type: NEWS\n");
        prompt.append("Heuristic trend: ").append(heuristicTrend).append('\n');
        prompt.append("Heuristic reason: ").append(heuristicReason).append('\n');
        prompt.append("Sources: ").append(String.join(", ", sourceNames)).append('\n');
        if (evidence.isEmpty()) {
            prompt.append("Evidence: none\n");
            return analyze(tenantId, enabled, prompt.toString());
        }
        prompt.append("Evidence:\n");
        evidence.stream()
                .limit(Math.max(openAiProperties.maxEvidenceItems(), 1))
                .forEach(signal -> prompt.append("- ")
                        .append(signal.article().sourceName())
                        .append(" | score ").append(signal.score())
                        .append(" | tags ").append(String.join(", ", signal.tags()))
                        .append(" | headline ").append(cleanTitle(signal.article().title()))
                        .append('\n'));
        return analyze(tenantId, enabled, prompt.toString());
    }

    public AiAnalysis analyzeTechnical(
            String tenantId,
            boolean enabled,
            MarketSentimentClient.TechnicalSeries series,
            String heuristicTrend,
            String heuristicReason,
            BigDecimal ema9Value,
            BigDecimal ema21Value,
            BigDecimal ema110Value
    ) {
        String prompt = String.format(Locale.ENGLISH,
                "Market: %s%nScope: %s%nType: TECHNICAL%nPrice: %.2f%nEMA9: %.2f%nEMA21: %.2f%nEMA110: %.2f%nHeuristic trend: %s%nHeuristic reason: %s%nUse only this technical evidence.",
                series.marketName(),
                series.marketName(),
                series.currentValue(),
                ema9Value,
                ema21Value,
                ema110Value,
                heuristicTrend,
                heuristicReason
        );
        return analyze(tenantId, enabled, prompt);
    }

    private AiAnalysis analyze(String tenantId, boolean enabled, String input) {
        if (!enabled) {
            return AiAnalysis.empty();
        }
        try {
            OpenAiMarketAnalysisClient.MarketAiAnalysis response = openAiMarketAnalysisClient.analyze(tenantId, input);
            return new AiAnalysis(response.trendStatus(), response.reason(), response.confidence(), response.model(), Instant.now());
        } catch (Exception ex) {
            log.warn("OpenAI market analysis failed for tenant {}: {}", tenantId, ex.getMessage());
            return AiAnalysis.empty();
        }
    }

    private String cleanTitle(String title) {
        int separator = title.lastIndexOf(" - ");
        return separator > 0 ? title.substring(0, separator).trim() : title.trim();
    }

    public record AiAnalysis(String trendStatus, String reason, Integer confidence, String model, Instant updatedAt) {
        static AiAnalysis empty() {
            return new AiAnalysis(null, null, null, null, null);
        }
    }
}
