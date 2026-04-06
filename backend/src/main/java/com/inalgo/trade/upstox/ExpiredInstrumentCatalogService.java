package com.inalgo.trade.upstox;

import com.inalgo.trade.entity.ExpiredDerivativeContractEntity;
import com.inalgo.trade.entity.ExpiredInstrumentExpiryEntity;
import com.inalgo.trade.repository.ExpiredDerivativeContractRepository;
import com.inalgo.trade.repository.ExpiredInstrumentExpiryRepository;
import jakarta.validation.ValidationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
public class ExpiredInstrumentCatalogService {
    static final String CONTRACT_KIND_FUTURE = "FUTURE";
    static final String CONTRACT_KIND_OPTION = "OPTION";

    private final UpstoxClient upstoxClient;
    private final ExpiredInstrumentExpiryRepository expiryRepository;
    private final ExpiredDerivativeContractRepository contractRepository;
    private final TransactionTemplate transactionTemplate;

    public ExpiredInstrumentCatalogService(
            UpstoxClient upstoxClient,
            ExpiredInstrumentExpiryRepository expiryRepository,
            ExpiredDerivativeContractRepository contractRepository,
            PlatformTransactionManager transactionManager
    ) {
        this.upstoxClient = upstoxClient;
        this.expiryRepository = expiryRepository;
        this.contractRepository = contractRepository;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    public List<LocalDate> getExpiries(String tenantId, String underlyingKey, LocalDate requiredDate) {
        validateTenantAndUnderlying(tenantId, underlyingKey);
        List<LocalDate> cached = loadCachedExpiries(tenantId, underlyingKey);
        if (!cached.isEmpty() && !shouldRefreshExpiries(cached, requiredDate)) {
            return cached;
        }

        List<LocalDate> fetched;
        try {
            fetched = upstoxClient.fetchExpiredExpiries(underlyingKey).stream()
                    .filter(java.util.Objects::nonNull)
                    .distinct()
                    .sorted()
                    .toList();
        } catch (RuntimeException ex) {
            return cached;
        }
        if (fetched.isEmpty()) {
            return cached;
        }

        persistExpiries(tenantId, underlyingKey, fetched);
        return fetched;
    }

    /**
     * Option backtests need both expired and currently-active expiries so late-month trade dates can still resolve
     * to the correct upcoming weekly/monthly contract instead of forcing an already expired fallback.
     */
    public List<LocalDate> getOptionExpiries(String tenantId, String underlyingKey, LocalDate requiredDate) {
        validateTenantAndUnderlying(tenantId, underlyingKey);

        List<LocalDate> cached = loadCachedExpiries(tenantId, underlyingKey);
        List<LocalDate> expired = cached;
        if (cached.isEmpty() || shouldRefreshExpiries(cached, requiredDate)) {
            try {
                expired = upstoxClient.fetchExpiredExpiries(underlyingKey).stream()
                        .filter(Objects::nonNull)
                        .distinct()
                        .sorted()
                        .toList();
            } catch (RuntimeException ex) {
                expired = cached;
            }
        }
        List<LocalDate> active = fetchActiveOptionExpiries(underlyingKey);
        List<LocalDate> merged = mergeExpiries(cached, expired, active);

        if (!merged.isEmpty() && !merged.equals(cached)) {
            persistExpiries(tenantId, underlyingKey, merged);
        }
        return merged.isEmpty() ? cached : merged;
    }

    public List<UpstoxClient.ExpiredDerivativeContractView> getFutureContracts(
            String tenantId,
            String underlyingKey,
            LocalDate expiryDate
    ) {
        return getContracts(tenantId, underlyingKey, expiryDate, CONTRACT_KIND_FUTURE);
    }

    public List<UpstoxClient.ExpiredDerivativeContractView> getOptionContracts(
            String tenantId,
            String underlyingKey,
            LocalDate expiryDate
    ) {
        return getContracts(tenantId, underlyingKey, expiryDate, CONTRACT_KIND_OPTION);
    }

    private List<UpstoxClient.ExpiredDerivativeContractView> getContracts(
            String tenantId,
            String underlyingKey,
            LocalDate expiryDate,
            String contractKind
    ) {
        validateContractInputs(tenantId, underlyingKey, expiryDate);

        List<UpstoxClient.ExpiredDerivativeContractView> cached = loadCachedContracts(
                tenantId,
                underlyingKey,
                expiryDate,
                contractKind
        );
        if (!cached.isEmpty()) {
            return cached;
        }

        List<UpstoxClient.ExpiredDerivativeContractView> fetched;
        try {
            fetched = CONTRACT_KIND_FUTURE.equals(contractKind)
                    ? upstoxClient.fetchExpiredFutureContracts(underlyingKey, expiryDate)
                    : upstoxClient.fetchExpiredOptionContracts(underlyingKey, expiryDate);
        } catch (RuntimeException ex) {
            return cached;
        }
        if (fetched.isEmpty() && CONTRACT_KIND_OPTION.equals(contractKind)) {
            fetched = fetchActiveOptionContracts(underlyingKey, expiryDate);
        }
        if (fetched.isEmpty()) {
            return fetched;
        }

        persistContracts(tenantId, underlyingKey, expiryDate, contractKind, fetched);
        return fetched;
    }

    private List<LocalDate> loadCachedExpiries(String tenantId, String underlyingKey) {
        return expiryRepository
                .findAllByTenantIdAndUnderlyingKeyOrderByExpiryDateAsc(tenantId, underlyingKey)
                .stream()
                .map(ExpiredInstrumentExpiryEntity::getExpiryDate)
                .toList();
    }

    private boolean shouldRefreshExpiries(List<LocalDate> cached, LocalDate requiredDate) {
        if (requiredDate == null) {
            return false;
        }
        return cached.getLast().isBefore(requiredDate);
    }

    private void persistExpiries(String tenantId, String underlyingKey, List<LocalDate> expiries) {
        transactionTemplate.executeWithoutResult(status -> {
            for (LocalDate expiry : expiries) {
                if (expiry == null) {
                    continue;
                }
                expiryRepository.upsert(tenantId, underlyingKey, expiry);
            }
        });
    }

    private List<UpstoxClient.ExpiredDerivativeContractView> loadCachedContracts(
            String tenantId,
            String underlyingKey,
            LocalDate expiryDate,
            String contractKind
    ) {
        return contractRepository
                .findAllByTenantIdAndContractKindAndUnderlyingKeyAndExpiryDateOrderByStrikePriceAscInstrumentKeyAsc(
                        tenantId,
                        contractKind,
                        underlyingKey,
                        expiryDate
                )
                .stream()
                .map(entity -> new UpstoxClient.ExpiredDerivativeContractView(
                        entity.getName(),
                        entity.getSegment(),
                        entity.getExchange(),
                        entity.getExpiryDate(),
                        entity.getInstrumentKey(),
                        entity.getExchangeToken(),
                        entity.getTradingSymbol(),
                        entity.getLotSize(),
                        entity.getInstrumentType(),
                        entity.getUnderlyingKey(),
                        entity.getStrikePrice(),
                        entity.getWeekly(),
                        entity.getOptionType()
                ))
                .toList();
    }

    private void persistContracts(
            String tenantId,
            String underlyingKey,
            LocalDate expiryDate,
            String contractKind,
            List<UpstoxClient.ExpiredDerivativeContractView> contracts
    ) {
        transactionTemplate.executeWithoutResult(status -> {
            for (UpstoxClient.ExpiredDerivativeContractView contract : contracts) {
                if (contract == null || contract.instrumentKey() == null || contract.instrumentKey().isBlank()) {
                    continue;
                }
                contractRepository.upsert(
                        tenantId,
                        contractKind,
                        underlyingKey,
                        expiryDate,
                        contract.instrumentKey(),
                        contract.name(),
                        contract.segment(),
                        contract.exchange(),
                        contract.exchangeToken(),
                        contract.tradingSymbol(),
                        contract.lotSize(),
                        contract.instrumentType(),
                        contract.strikePrice(),
                        contract.weekly(),
                        contract.optionType()
                );
            }
        });
    }

    private void validateTenantAndUnderlying(String tenantId, String underlyingKey) {
        if (tenantId == null || tenantId.isBlank()) {
            throw new ValidationException("tenantId is required");
        }
        if (underlyingKey == null || underlyingKey.isBlank()) {
            throw new ValidationException("underlyingKey is required");
        }
    }

    private void validateContractInputs(String tenantId, String underlyingKey, LocalDate expiryDate) {
        validateTenantAndUnderlying(tenantId, underlyingKey);
        if (expiryDate == null) {
            throw new ValidationException("expiryDate is required");
        }
    }

    private List<LocalDate> fetchActiveOptionExpiries(String underlyingKey) {
        try {
            return upstoxClient.fetchOptionContracts(underlyingKey).contracts().stream()
                    .map(UpstoxOptionContract::expiry)
                    .filter(Objects::nonNull)
                    .distinct()
                    .sorted()
                    .toList();
        } catch (RuntimeException ex) {
            return List.of();
        }
    }

    private List<LocalDate> mergeExpiries(List<LocalDate> cached, List<LocalDate> expired, List<LocalDate> active) {
        List<LocalDate> merged = new ArrayList<>(cached.size() + expired.size() + active.size());
        merged.addAll(cached);
        merged.addAll(expired);
        merged.addAll(active);
        return merged.stream()
                .filter(Objects::nonNull)
                .distinct()
                .sorted()
                .toList();
    }

    private List<UpstoxClient.ExpiredDerivativeContractView> fetchActiveOptionContracts(String underlyingKey, LocalDate expiryDate) {
        try {
            Map<String, UpstoxOptionContract> contractByInstrumentKey = new HashMap<>();
            for (UpstoxOptionContract contract : upstoxClient.fetchOptionContracts(underlyingKey, expiryDate).contracts()) {
                if (contract == null || contract.instrumentKey() == null || contract.instrumentKey().isBlank()) {
                    continue;
                }
                contractByInstrumentKey.put(contract.instrumentKey(), contract);
            }

            List<UpstoxClient.ExpiredDerivativeContractView> views = new ArrayList<>();
            for (UpstoxOptionChainRow row : upstoxClient.fetchOptionChain(underlyingKey, expiryDate).rows()) {
                if (row == null || row.expiryDate() == null || row.strikePrice() == null) {
                    continue;
                }
                addActiveOptionView(
                        views,
                        contractByInstrumentKey.get(row.callOptions() == null ? null : row.callOptions().instrumentKey()),
                        row.callOptions(),
                        row,
                        underlyingKey,
                        "CE"
                );
                addActiveOptionView(
                        views,
                        contractByInstrumentKey.get(row.putOptions() == null ? null : row.putOptions().instrumentKey()),
                        row.putOptions(),
                        row,
                        underlyingKey,
                        "PE"
                );
            }
            return views.stream()
                    .filter(contract -> contract.instrumentKey() != null && !contract.instrumentKey().isBlank())
                    .distinct()
                    .toList();
        } catch (RuntimeException ex) {
            return List.of();
        }
    }

    private void addActiveOptionView(
            List<UpstoxClient.ExpiredDerivativeContractView> target,
            UpstoxOptionContract contract,
            UpstoxOptionSide side,
            UpstoxOptionChainRow row,
            String defaultUnderlyingKey,
            String optionType
    ) {
        if (side == null || side.instrumentKey() == null || side.instrumentKey().isBlank()) {
            return;
        }
        BigDecimal strike = contract != null && contract.strikePrice() != null ? contract.strikePrice() : row.strikePrice();
        Integer lotSize = contract != null && contract.lotSize() != null ? contract.lotSize() : 1;
        String segment = contract != null ? contract.segment() : null;
        String exchange = contract != null ? contract.exchange() : null;
        String name = contract != null ? contract.name() : "OPTION " + optionType;
        String underlyingKey = contract != null && contract.underlyingKey() != null ? contract.underlyingKey() : defaultUnderlyingKey;
        target.add(new UpstoxClient.ExpiredDerivativeContractView(
                name,
                segment,
                exchange,
                row.expiryDate(),
                side.instrumentKey(),
                null,
                contract != null ? contract.name() : null,
                lotSize,
                "OPTIDX",
                underlyingKey,
                strike,
                null,
                optionType
        ));
    }
}
