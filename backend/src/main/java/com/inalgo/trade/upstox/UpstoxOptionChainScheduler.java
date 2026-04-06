package com.inalgo.trade.upstox;

import com.inalgo.trade.service.IndiaMarketHoursService;
import jakarta.validation.ValidationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(prefix = "upstox.option-chain", name = "enabled", havingValue = "true")
public class UpstoxOptionChainScheduler {
    private static final Logger log = LoggerFactory.getLogger(UpstoxOptionChainScheduler.class);

    private final OptionChainService optionChainService;
    private final UpstoxOptionChainProperties optionChainProperties;
    private final IndiaMarketHoursService marketHoursService;

    public UpstoxOptionChainScheduler(
            OptionChainService optionChainService,
            UpstoxOptionChainProperties optionChainProperties,
            IndiaMarketHoursService marketHoursService
    ) {
        this.optionChainService = optionChainService;
        this.optionChainProperties = optionChainProperties;
        this.marketHoursService = marketHoursService;
    }

    @Scheduled(fixedDelayString = "#{${upstox.option-chain.refresh-seconds:30} * 1000}")
    public void runScheduledSnapshotTick() {
        if (!marketHoursService.isWithinBusinessWindow(java.time.Instant.now())) {
            return;
        }
        try {
            optionChainService.refreshConfiguredUnderlyings(optionChainProperties.tenantId(), false);
        } catch (ValidationException ex) {
            log.warn("Skipping option-chain scheduled refresh: {}", ex.getMessage());
        }
    }
}
