package com.inalgo.trade.service;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "market.sentiment")
public record MarketSentimentProperties(
        boolean enabled,
        String tenantId,
        String cron,
        int requestTimeoutSeconds,
        int newsLookbackHours,
        int maxFeedItemsPerSource
) {
}
