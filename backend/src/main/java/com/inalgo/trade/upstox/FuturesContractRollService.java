package com.inalgo.trade.upstox;

import com.inalgo.trade.entity.FuturesContractRegistryEntity;
import com.inalgo.trade.repository.FuturesContractRegistryRepository;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * Detects expired futures contracts and automatically rolls them to the next
 * active monthly contract by querying the Upstox option/contract API.
 *
 * <p>Runs once daily at 09:20 IST (market open + 5 min buffer) so that on
 * expiry-day morning the system switches to the new front-month contract
 * before any candle-sync jobs fire.
 */
@Service
public class FuturesContractRollService {

    private static final Logger log = LoggerFactory.getLogger(FuturesContractRollService.class);

    /** Spot-index underlying keys that have tracked monthly futures. */
    private static final List<String> TRACKED_UNDERLYINGS = List.of(
            "NSE_INDEX|Nifty 50",
            "NSE_INDEX|Nifty Bank",
            "BSE_INDEX|SENSEX"
    );

    private final FuturesContractRegistryRepository registry;
    private final UpstoxClient upstoxClient;

    public FuturesContractRollService(
            FuturesContractRegistryRepository registry,
            UpstoxClient upstoxClient
    ) {
        this.registry = registry;
        this.upstoxClient = upstoxClient;
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Returns all instruments the application tracks: spot indices + current
     * monthly futures from the registry.
     */
    public List<FuturesContractRegistryEntity> getActiveFuturesContracts() {
        return registry.findAll();
    }

    /**
     * Returns all active futures instrument keys (used by MigrationCatalogSeeder).
     */
    public List<String> getActiveFuturesInstrumentKeys() {
        return registry.findAll().stream()
                .map(FuturesContractRegistryEntity::getInstrumentKey)
                .filter(key -> key != null && !key.isBlank())
                .distinct()
                .toList();
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    /**
     * On startup: immediately roll any contracts that expired since the last run.
     * This ensures the registry is current before the first migration tick fires.
     */
    @PostConstruct
    public void init() {
        log.info("FuturesContractRollService: startup expiry check");
        checkAndRollExpiredContracts();
    }

    // ── Scheduler ─────────────────────────────────────────────────────────────

    /**
     * Runs daily at 09:20 IST.  Checks every registry entry; if the contract's
     * expiry date is before today, attempts to roll forward using the Upstox API.
     */
    @Scheduled(cron = "0 20 9 * * MON-FRI", zone = "Asia/Kolkata")
    public void scheduledRollCheck() {
        log.info("FuturesContractRollService: running scheduled expiry check");
        checkAndRollExpiredContracts();
    }

    // ── Core roll logic ───────────────────────────────────────────────────────

    /**
     * Inspects every registry row and rolls any contract whose expiry is in the
     * past (strictly before today).  Safe to call multiple times; already-current
     * contracts are skipped.
     */
    @Transactional
    public void checkAndRollExpiredContracts() {
        LocalDate today = LocalDate.now();
        List<FuturesContractRegistryEntity> entries = registry.findAll();

        for (FuturesContractRegistryEntity entry : entries) {
            if (entry.getExpiryDate() == null || !entry.getExpiryDate().isBefore(today)) {
                continue; // not yet expired
            }
            log.info("FuturesContractRollService: {} (key={}) expired on {}; rolling forward",
                    entry.getUnderlyingKey(), entry.getInstrumentKey(), entry.getExpiryDate());
            rollToNextContract(entry, today);
        }
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    private void rollToNextContract(FuturesContractRegistryEntity entry, LocalDate today) {
        String underlyingKey = entry.getUnderlyingKey();
        try {
            List<UpstoxOptionContract> futures = upstoxClient.fetchActiveFuturesContracts(underlyingKey);
            UpstoxOptionContract next = futures.stream()
                    .filter(c -> c.expiry() != null && !c.expiry().isBefore(today))
                    .min((a, b) -> a.expiry().compareTo(b.expiry()))
                    .orElse(null);

            if (next == null) {
                log.warn("FuturesContractRollService: no active futures found for {} via Upstox API; skipping roll",
                        underlyingKey);
                return;
            }

            registry.updateContract(
                    underlyingKey,
                    next.instrumentKey(),
                    next.name(),
                    next.expiry(),
                    next.lotSize()
            );
            log.info("FuturesContractRollService: rolled {} → {} (expiry={})",
                    underlyingKey, next.instrumentKey(), next.expiry());

        } catch (Exception ex) {
            log.error("FuturesContractRollService: failed to roll {} - {}", underlyingKey, ex.getMessage());
        }
    }
}
