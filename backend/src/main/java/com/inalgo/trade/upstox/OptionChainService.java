package com.inalgo.trade.upstox;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.inalgo.trade.entity.OptionChainMigrationStateEntity;
import com.inalgo.trade.entity.OptionChainSnapshotEntity;
import com.inalgo.trade.repository.OptionChainMigrationStateRepository;
import com.inalgo.trade.repository.OptionChainSnapshotRepository;
import com.inalgo.trade.security.TenantContext;
import jakarta.validation.ValidationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.TreeSet;
import java.util.function.Supplier;

@Service
public class OptionChainService {
    private static final Logger log = LoggerFactory.getLogger(OptionChainService.class);
    private static final List<String> DEFAULT_UNDERLYINGS = List.of(
            "NSE_INDEX|Nifty 50",
            "NSE_INDEX|Nifty Bank",
            "BSE_INDEX|SENSEX"
    );

    private final UpstoxClient upstoxClient;
    private final OptionChainSnapshotRepository snapshotRepository;
    private final OptionChainMigrationStateRepository stateRepository;
    private final UpstoxOptionChainProperties optionChainProperties;
    private final ObjectMapper objectMapper;
    private final TransactionTemplate transactionTemplate;

    public OptionChainService(
            UpstoxClient upstoxClient,
            OptionChainSnapshotRepository snapshotRepository,
            OptionChainMigrationStateRepository stateRepository,
            UpstoxOptionChainProperties optionChainProperties,
            ObjectMapper objectMapper,
            PlatformTransactionManager transactionManager
    ) {
        this.upstoxClient = upstoxClient;
        this.snapshotRepository = snapshotRepository;
        this.stateRepository = stateRepository;
        this.optionChainProperties = optionChainProperties;
        this.objectMapper = objectMapper;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    public List<OptionChainRefreshResult> refreshConfiguredUnderlyings(String tenantId, boolean includeAllExpiries) {
        String normalizedTenant = requireTenant(tenantId);
        List<String> configured = optionChainProperties.underlyings();
        List<String> underlyings = (configured == null || configured.isEmpty()) ? DEFAULT_UNDERLYINGS : configured;

        List<OptionChainRefreshResult> output = new ArrayList<>();
        for (String underlyingKey : underlyings) {
            if (!StringUtils.hasText(underlyingKey)) {
                continue;
            }
            output.add(refreshUnderlying(normalizedTenant, underlyingKey.trim(), includeAllExpiries));
        }
        return output;
    }

    public OptionChainRefreshResult refreshUnderlying(String tenantId, String underlyingKey, boolean includeAllExpiries) {
        String normalizedTenant = requireTenant(tenantId);
        String normalizedUnderlying = requireUnderlying(underlyingKey);
        List<LocalDate> expiries = loadExpiriesFromProvider(normalizedTenant, normalizedUnderlying, includeAllExpiries);

        int persistedRows = 0;
        int failedExpiries = 0;
        List<String> errors = new ArrayList<>();

        for (LocalDate expiryDate : expiries) {
            try {
                persistedRows += refreshExpirySnapshot(normalizedTenant, normalizedUnderlying, expiryDate);
            } catch (RuntimeException ex) {
                failedExpiries += 1;
                String message = "expiry=" + expiryDate + " error=" + ex.getMessage();
                errors.add(message);
                log.error("Option-chain refresh failed tenant={} underlying={} {}", normalizedTenant, normalizedUnderlying, message, ex);
            }
        }

        return new OptionChainRefreshResult(normalizedUnderlying, expiries.size(), persistedRows, failedExpiries, errors);
    }

    public List<LocalDate> listAvailableExpiries(String tenantId, String underlyingKey, boolean refreshFromProvider) {
        String normalizedTenant = requireTenant(tenantId);
        String normalizedUnderlying = requireUnderlying(underlyingKey);

        List<LocalDate> dbExpiries = snapshotRepository.findDistinctExpiriesByTenantAndUnderlying(normalizedTenant, normalizedUnderlying);
        if (!refreshFromProvider && !dbExpiries.isEmpty()) {
            return dbExpiries;
        }

        List<LocalDate> providerExpiries = loadExpiriesFromProvider(normalizedTenant, normalizedUnderlying, true);
        if (!providerExpiries.isEmpty()) {
            return providerExpiries;
        }
        return dbExpiries;
    }

    public OptionChainSnapshotView fetchLatestSnapshot(
            String tenantId,
            String underlyingKey,
            LocalDate expiryDate,
            boolean refreshIfMissing
    ) {
        String normalizedTenant = requireTenant(tenantId);
        String normalizedUnderlying = requireUnderlying(underlyingKey);
        if (expiryDate == null) {
            throw new ValidationException("expiryDate is required");
        }

        List<OptionChainSnapshotEntity> rows = snapshotRepository.findLatestSnapshotRows(normalizedTenant, normalizedUnderlying, expiryDate);
        if (rows.isEmpty() && refreshIfMissing) {
            refreshExpirySnapshot(normalizedTenant, normalizedUnderlying, expiryDate);
            rows = snapshotRepository.findLatestSnapshotRows(normalizedTenant, normalizedUnderlying, expiryDate);
        }

        Instant snapshotTs = rows.isEmpty() ? null : rows.getFirst().getSnapshotTs();
        BigDecimal spotPrice = rows.stream().map(OptionChainSnapshotEntity::getUnderlyingSpotPrice).filter(Objects::nonNull).findFirst().orElse(null);
        BigDecimal pcr = rows.stream().map(OptionChainSnapshotEntity::getPcr).filter(Objects::nonNull).findFirst().orElse(null);
        BigDecimal syntheticFuturePrice = calculateSyntheticFuturePrice(rows, spotPrice);

        List<OptionChainRowView> rowViews = rows.stream()
                .map(row -> new OptionChainRowView(
                        row.getStrikePrice(),
                        row.getCallInstrumentKey(),
                        row.getCallLtp(),
                        row.getCallOi(),
                        row.getCallPrevOi(),
                        row.getCallVolume(),
                        row.getCallIv(),
                        calculateOiChangePercent(row.getCallOi(), row.getCallPrevOi()),
                        row.getPutInstrumentKey(),
                        row.getPutLtp(),
                        row.getPutOi(),
                        row.getPutPrevOi(),
                        row.getPutVolume(),
                        row.getPutIv(),
                        calculateOiChangePercent(row.getPutOi(), row.getPutPrevOi())
                ))
                .toList();

        return new OptionChainSnapshotView(
                normalizedUnderlying,
                expiryDate,
                snapshotTs,
                spotPrice,
                pcr,
                syntheticFuturePrice,
                rowViews
        );
    }

    @Transactional(readOnly = true)
    public Page<OptionChainHistoryRow> fetchHistory(
            String tenantId,
            String underlyingKey,
            LocalDate expiryDate,
            Instant from,
            Instant to,
            Integer page,
            Integer size
    ) {
        String normalizedTenant = requireTenant(tenantId);
        String normalizedUnderlying = requireUnderlying(underlyingKey);
        if (expiryDate == null) {
            throw new ValidationException("expiryDate is required");
        }

        Instant normalizedTo = to == null ? Instant.now() : to;
        Instant normalizedFrom = from == null ? normalizedTo.minus(30, ChronoUnit.DAYS) : from;
        if (!normalizedFrom.isBefore(normalizedTo)) {
            throw new ValidationException("from must be earlier than to");
        }

        int boundedSize = Math.min(Math.max(size == null ? 100 : size, 1), 500);
        int normalizedPage = Math.max(page == null ? 0 : page, 0);

        PageRequest pageable = PageRequest.of(normalizedPage, boundedSize, Sort.by(Sort.Order.desc("snapshotTs"), Sort.Order.asc("strikePrice")));
        return snapshotRepository
                .findByTenantIdAndUnderlyingKeyAndExpiryDateAndSnapshotTsBetween(
                        normalizedTenant,
                        normalizedUnderlying,
                        expiryDate,
                        normalizedFrom,
                        normalizedTo,
                        pageable
                )
                .map(entity -> new OptionChainHistoryRow(
                        entity.getUnderlyingKey(),
                        entity.getExpiryDate(),
                        entity.getSnapshotTs(),
                        entity.getStrikePrice(),
                        entity.getCallLtp(),
                        entity.getCallOi(),
                        entity.getCallPrevOi(),
                        entity.getCallIv(),
                        entity.getPutLtp(),
                        entity.getPutOi(),
                        entity.getPutPrevOi(),
                        entity.getPutIv(),
                        entity.getUnderlyingSpotPrice(),
                        entity.getPcr()
                ));
    }

    private int refreshExpirySnapshot(String tenantId, String underlyingKey, LocalDate expiryDate) {
        OptionChainMigrationStateEntity state = stateRepository
                .findByTenantIdAndUnderlyingKeyAndExpiryDate(tenantId, underlyingKey, expiryDate)
                .orElseGet(() -> new OptionChainMigrationStateEntity(tenantId, underlyingKey, expiryDate));

        state.markRunning();
        stateRepository.save(state);

        try {
            UpstoxOptionChainResponse response = withTenantContext(
                    tenantId,
                    () -> upstoxClient.fetchOptionChain(underlyingKey, expiryDate)
            );
            Instant snapshotTs = Instant.now().truncatedTo(ChronoUnit.MINUTES);
            int persistedRows = upsertSnapshotRows(tenantId, underlyingKey, expiryDate, snapshotTs, response.rows());
            state.markSuccess(snapshotTs, true);
            stateRepository.save(state);
            return persistedRows;
        } catch (RuntimeException ex) {
            state.markFailed(ex.getMessage() == null ? "unknown option-chain migration failure" : ex.getMessage());
            stateRepository.save(state);
            throw ex;
        }
    }

    private int upsertSnapshotRows(
            String tenantId,
            String underlyingKey,
            LocalDate requestedExpiryDate,
            Instant snapshotTs,
            List<UpstoxOptionChainRow> rows
    ) {
        Integer persisted = transactionTemplate.execute(status -> {
            int count = 0;
            List<UpstoxOptionChainRow> safeRows = rows == null ? List.of() : rows;
            for (UpstoxOptionChainRow row : safeRows) {
                if (row == null || row.strikePrice() == null) {
                    continue;
                }
                LocalDate expiryDate = row.expiryDate() == null ? requestedExpiryDate : row.expiryDate();
                UpstoxOptionSide call = row.callOptions();
                UpstoxOptionSide put = row.putOptions();
                UpstoxOptionMarketData callMd = call == null ? null : call.marketData();
                UpstoxOptionMarketData putMd = put == null ? null : put.marketData();
                UpstoxOptionGreeks callGreeks = call == null ? null : call.optionGreeks();
                UpstoxOptionGreeks putGreeks = put == null ? null : put.optionGreeks();

                snapshotRepository.upsert(
                        tenantId,
                        underlyingKey,
                        expiryDate,
                        row.strikePrice(),
                        snapshotTs,
                        row.underlyingSpotPrice(),
                        row.pcr(),
                        call == null ? null : call.instrumentKey(),
                        callMd == null ? null : callMd.ltp(),
                        callMd == null ? null : callMd.volume(),
                        callMd == null ? null : callMd.oi(),
                        callMd == null ? null : callMd.prevOi(),
                        callMd == null ? null : callMd.bidPrice(),
                        callMd == null ? null : callMd.bidQty(),
                        callMd == null ? null : callMd.askPrice(),
                        callMd == null ? null : callMd.askQty(),
                        callGreeks == null ? null : callGreeks.iv(),
                        callGreeks == null ? null : callGreeks.delta(),
                        callGreeks == null ? null : callGreeks.gamma(),
                        callGreeks == null ? null : callGreeks.theta(),
                        callGreeks == null ? null : callGreeks.vega(),
                        callGreeks == null ? null : callGreeks.pop(),
                        put == null ? null : put.instrumentKey(),
                        putMd == null ? null : putMd.ltp(),
                        putMd == null ? null : putMd.volume(),
                        putMd == null ? null : putMd.oi(),
                        putMd == null ? null : putMd.prevOi(),
                        putMd == null ? null : putMd.bidPrice(),
                        putMd == null ? null : putMd.bidQty(),
                        putMd == null ? null : putMd.askPrice(),
                        putMd == null ? null : putMd.askQty(),
                        putGreeks == null ? null : putGreeks.iv(),
                        putGreeks == null ? null : putGreeks.delta(),
                        putGreeks == null ? null : putGreeks.gamma(),
                        putGreeks == null ? null : putGreeks.theta(),
                        putGreeks == null ? null : putGreeks.vega(),
                        putGreeks == null ? null : putGreeks.pop(),
                        serialize(row),
                        serializeNullable(call),
                        serializeNullable(put)
                );
                count += 1;
            }
            return count;
        });
        return persisted == null ? 0 : persisted;
    }

    private List<LocalDate> loadExpiriesFromProvider(String tenantId, String underlyingKey, boolean includeAllExpiries) {
        UpstoxOptionContractResponse contractsResponse = withTenantContext(
                tenantId,
                () -> upstoxClient.fetchOptionContracts(underlyingKey)
        );
        List<UpstoxOptionContract> contracts = contractsResponse == null || contractsResponse.contracts() == null
                ? List.of()
                : contractsResponse.contracts();
        TreeSet<LocalDate> sortedExpiries = contracts
                .stream()
                .map(UpstoxOptionContract::expiry)
                .filter(Objects::nonNull)
                .collect(TreeSet::new, TreeSet::add, TreeSet::addAll);

        if (sortedExpiries.isEmpty()) {
            return List.of();
        }

        List<LocalDate> output = new ArrayList<>(sortedExpiries);
        if (includeAllExpiries) {
            return output;
        }

        int maxExpiries = Math.max(1, optionChainProperties.maxExpiriesPerUnderlying());
        return output.stream().limit(maxExpiries).toList();
    }

    private <T> T withTenantContext(String tenantId, Supplier<T> action) {
        String previousTenantId = TenantContext.getTenantId();
        TenantContext.setTenantId(tenantId);
        try {
            return action.get();
        } finally {
            if (StringUtils.hasText(previousTenantId)) {
                TenantContext.setTenantId(previousTenantId);
            } else {
                TenantContext.clear();
            }
        }
    }

    private BigDecimal calculateSyntheticFuturePrice(List<OptionChainSnapshotEntity> rows, BigDecimal spotPrice) {
        if (rows == null || rows.isEmpty() || spotPrice == null) {
            return null;
        }

        return rows.stream()
                .filter(row -> row.getCallLtp() != null && row.getPutLtp() != null)
                .min(Comparator.comparing(row -> row.getStrikePrice().subtract(spotPrice).abs()))
                .map(row -> row.getStrikePrice().add(row.getCallLtp()).subtract(row.getPutLtp()).setScale(2, RoundingMode.HALF_UP))
                .orElse(null);
    }

    private BigDecimal calculateOiChangePercent(Long currentOi, Long previousOi) {
        if (currentOi == null || previousOi == null || previousOi == 0L) {
            return null;
        }
        BigDecimal delta = BigDecimal.valueOf(currentOi - previousOi);
        return delta.multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(previousOi), 2, RoundingMode.HALF_UP);
    }

    private String serialize(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            throw new ValidationException("Failed to serialize option-chain payload", ex);
        }
    }

    private String serializeNullable(Object value) {
        if (value == null) {
            return null;
        }
        return serialize(value);
    }

    private String requireTenant(String tenantId) {
        if (!StringUtils.hasText(tenantId)) {
            throw new ValidationException("Missing tenant context");
        }
        return tenantId.trim();
    }

    private String requireUnderlying(String underlyingKey) {
        if (!StringUtils.hasText(underlyingKey)) {
            throw new ValidationException("underlyingKey is required");
        }
        return underlyingKey.trim();
    }

    public record OptionChainRefreshResult(
            String underlyingKey,
            int processedExpiries,
            int persistedRows,
            int failedExpiries,
            List<String> errors
    ) {
    }

    public record OptionChainSnapshotView(
            String underlyingKey,
            LocalDate expiryDate,
            Instant snapshotTs,
            BigDecimal underlyingSpotPrice,
            BigDecimal pcr,
            BigDecimal syntheticFuturePrice,
            List<OptionChainRowView> rows
    ) {
    }

    public record OptionChainRowView(
            BigDecimal strikePrice,
            String callInstrumentKey,
            BigDecimal callLtp,
            Long callOi,
            Long callPrevOi,
            Long callVolume,
            BigDecimal callIv,
            BigDecimal callOiChangePercent,
            String putInstrumentKey,
            BigDecimal putLtp,
            Long putOi,
            Long putPrevOi,
            Long putVolume,
            BigDecimal putIv,
            BigDecimal putOiChangePercent
    ) {
    }

    public record OptionChainHistoryRow(
            String underlyingKey,
            LocalDate expiryDate,
            Instant snapshotTs,
            BigDecimal strikePrice,
            BigDecimal callLtp,
            Long callOi,
            Long callPrevOi,
            BigDecimal callIv,
            BigDecimal putLtp,
            Long putOi,
            Long putPrevOi,
            BigDecimal putIv,
            BigDecimal underlyingSpotPrice,
            BigDecimal pcr
    ) {
    }
}
