package com.inalgo.trade.upstox;

import com.inalgo.trade.service.IndiaMarketHoursService;
import jakarta.validation.ValidationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(prefix = "upstox.migration", name = "enabled", havingValue = "true")
public class UpstoxMigrationScheduler {
    private static final Logger log = LoggerFactory.getLogger(UpstoxMigrationScheduler.class);

    private final UpstoxHistoricalMigrationService migrationService;
    private final IndiaMarketHoursService marketHoursService;

    public UpstoxMigrationScheduler(
            UpstoxHistoricalMigrationService migrationService,
            IndiaMarketHoursService marketHoursService
    ) {
        this.migrationService = migrationService;
        this.marketHoursService = marketHoursService;
    }

    @Scheduled(cron = "${upstox.migration.cron:0 */5 * * * *}")
    public void runMigrationTick() {
        if (!marketHoursService.isWithinBusinessWindow(java.time.Instant.now())) {
            return;
        }
        try {
            migrationService.migrateTick();
        } catch (ValidationException ex) {
            log.warn("Skipping migration scheduler tick: {}", ex.getMessage());
        }
    }
}
