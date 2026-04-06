package com.inalgo.trade.service;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "openai")
public record OpenAiProperties(
        boolean enabled,
        String baseUrl,
        String marketAnalysisModel,
        int requestTimeoutSeconds,
        String reasoningEffort,
        int maxEvidenceItems,
        String webSearchModel,
        int webSearchTimeoutSeconds
) {
}
