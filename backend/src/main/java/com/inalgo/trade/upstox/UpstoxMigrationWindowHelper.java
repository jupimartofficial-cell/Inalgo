package com.inalgo.trade.upstox;

import com.inalgo.trade.entity.UpstoxMigrationStateEntity;
import com.inalgo.trade.repository.CandleRepository;
import com.inalgo.trade.repository.UpstoxMigrationStateRepository;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDate;
import java.time.ZoneId;

/**
 * Window calculation, date inference, and state reopen helpers for the migration service.
 * Extracted from UpstoxHistoricalMigrationService to keep the main service under the line-budget.
 * CRITICAL: preserves adaptive windowing/halving logic used as primary rate-limit defense.
 */
@Component
@ConditionalOnProperty(prefix = "upstox.migration", name = "enabled", havingValue = "true")
class UpstoxMigrationWindowHelper {

    private final CandleRepository candleRepository;
    private final UpstoxMigrationStateRepository stateRepository;
    private final UpstoxMigrationProperties migrationProperties;
    private final TransactionTemplate transactionTemplate;
    private final ZoneId tradingZone = ZoneId.systemDefault();

    UpstoxMigrationWindowHelper(
            CandleRepository candleRepository,
            UpstoxMigrationStateRepository stateRepository,
            UpstoxMigrationProperties migrationProperties,
            PlatformTransactionManager transactionManager
    ) {
        this.candleRepository = candleRepository;
        this.stateRepository = stateRepository;
        this.migrationProperties = migrationProperties;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    int initialWindowDays(String unit) {
        return isIntraday(unit) ? migrationProperties.intradayWindowDays() : migrationProperties.longWindowDays();
    }

    int minWindowDays(String unit) {
        return isIntraday(unit) ? migrationProperties.intradayMinWindowDays() : 1;
    }

    boolean isIntraday(String unit) {
        return "minutes".equals(unit) || "hours".equals(unit);
    }

    boolean supportsIntradayTodaySync(String unit) {
        return "minutes".equals(unit) || "hours".equals(unit) || "days".equals(unit);
    }

    LocalDate minDate(LocalDate d1, LocalDate d2) {
        return d1.isBefore(d2) ? d1 : d2;
    }

    UpstoxMigrationStateEntity reopenCompletedStateIfDue(UpstoxMigrationStateEntity state, LocalDate today) {
        if (!state.isCompleted() || state.getNextFromDate().isAfter(today)) {
            return state;
        }
        return transactionTemplate.execute(status -> {
            state.resumeFromCheckpoint();
            return stateRepository.save(state);
        });
    }

    LocalDate inferResumeDateFromExistingData(
            String tenantId,
            String instrumentKey,
            String timeframeUnit,
            Integer timeframeInterval,
            LocalDate bootstrapFromDate
    ) {
        return candleRepository
                .findTopByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeIntervalOrderByCandleTsDesc(
                        tenantId,
                        instrumentKey,
                        timeframeUnit,
                        timeframeInterval
                )
                .map(candle -> candle.getCandleTs().atZone(tradingZone).toLocalDate().plusDays(1))
                .filter(resumeDate -> !resumeDate.isBefore(bootstrapFromDate))
                .orElse(bootstrapFromDate);
    }

    LocalDate inferRestartDateFromExistingData(
            String tenantId,
            String instrumentKey,
            String timeframeUnit,
            Integer timeframeInterval,
            LocalDate bootstrapFromDate
    ) {
        LocalDate today = LocalDate.now(tradingZone);
        return candleRepository
                .findTopByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeIntervalOrderByCandleTsDesc(
                        tenantId,
                        instrumentKey,
                        timeframeUnit,
                        timeframeInterval
                )
                .map(candle -> candle.getCandleTs().atZone(tradingZone).toLocalDate())
                .map(lastCandleDate -> minDate(lastCandleDate, today))
                .filter(restartDate -> !restartDate.isBefore(bootstrapFromDate))
                .orElse(minDate(bootstrapFromDate, today));
    }
}
