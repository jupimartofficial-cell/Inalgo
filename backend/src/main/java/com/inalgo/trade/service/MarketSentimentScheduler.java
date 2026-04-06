package com.inalgo.trade.service;

import com.inalgo.trade.admin.AdminTriggerService;
import com.inalgo.trade.repository.AdminTriggerRepository;
import jakarta.validation.ValidationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(prefix = "market.sentiment", name = "enabled", havingValue = "true")
public class MarketSentimentScheduler {
    private static final Logger log = LoggerFactory.getLogger(MarketSentimentScheduler.class);
    private static final java.util.Set<String> ACTIVE_TRIGGER_STATUSES = java.util.Set.of("RUNNING", "PAUSED");

    private final MarketSentimentService marketSentimentService;
    private final AdminTriggerRepository adminTriggerRepository;
    private final MarketSentimentProperties properties;
    private final IndiaMarketHoursService marketHoursService;

    public MarketSentimentScheduler(
            MarketSentimentService marketSentimentService,
            AdminTriggerRepository adminTriggerRepository,
            MarketSentimentProperties properties,
            IndiaMarketHoursService marketHoursService
    ) {
        this.marketSentimentService = marketSentimentService;
        this.adminTriggerRepository = adminTriggerRepository;
        this.properties = properties;
        this.marketHoursService = marketHoursService;
    }

    @Scheduled(cron = "${market.sentiment.cron:0 */5 * * * *}")
    public void refreshSnapshotTick() {
        if (!marketHoursService.isWithinBusinessWindow(java.time.Instant.now())) {
            return;
        }
        if (adminTriggerRepository.existsByTenantIdAndJobKeyAndStatusIn(
                properties.tenantId(),
                AdminTriggerService.JOB_KEY_MARKET_SENTIMENT_REFRESH,
                ACTIVE_TRIGGER_STATUSES
        )) {
            return;
        }
        try {
            marketSentimentService.refreshConfiguredTenant();
        } catch (ValidationException ex) {
            log.warn("Skipping market sentiment refresh: {}", ex.getMessage());
        }
    }
}
