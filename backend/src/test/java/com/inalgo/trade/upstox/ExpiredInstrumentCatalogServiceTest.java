package com.inalgo.trade.upstox;

import com.inalgo.trade.entity.ExpiredDerivativeContractEntity;
import com.inalgo.trade.entity.ExpiredInstrumentExpiryEntity;
import com.inalgo.trade.repository.ExpiredDerivativeContractRepository;
import com.inalgo.trade.repository.ExpiredInstrumentExpiryRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.SimpleTransactionStatus;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ExpiredInstrumentCatalogServiceTest {

    @Mock
    private UpstoxClient upstoxClient;

    @Mock
    private ExpiredInstrumentExpiryRepository expiryRepository;

    @Mock
    private ExpiredDerivativeContractRepository contractRepository;

    @Test
    void getExpiries_fetchesOnCacheMissAndUsesCacheAfterPersist() {
        ExpiredInstrumentCatalogService service = new ExpiredInstrumentCatalogService(
                upstoxClient,
                expiryRepository,
                contractRepository,
                new TestTransactionManager()
        );

        String tenantId = "tenant-a";
        String underlyingKey = "NSE_INDEX|Nifty 50";
        LocalDate e1 = LocalDate.of(2026, 1, 8);
        LocalDate e2 = LocalDate.of(2026, 1, 15);

        Set<LocalDate> persisted = new HashSet<>();
        when(expiryRepository.findAllByTenantIdAndUnderlyingKeyOrderByExpiryDateAsc(tenantId, underlyingKey))
                .thenAnswer(invocation -> toExpiryEntities(persisted.stream().sorted().toList()));
        when(expiryRepository.upsert(eq(tenantId), eq(underlyingKey), any(LocalDate.class)))
                .thenAnswer(invocation -> {
                    persisted.add(invocation.getArgument(2));
                    return 1;
                });
        when(upstoxClient.fetchExpiredExpiries(underlyingKey)).thenReturn(List.of(e1, e2));

        List<LocalDate> first = service.getExpiries(tenantId, underlyingKey, e2);
        List<LocalDate> second = service.getExpiries(tenantId, underlyingKey, e2);

        assertEquals(List.of(e1, e2), first);
        assertEquals(List.of(e1, e2), second);
        verify(upstoxClient).fetchExpiredExpiries(underlyingKey);
        verify(expiryRepository).upsert(tenantId, underlyingKey, e1);
        verify(expiryRepository).upsert(tenantId, underlyingKey, e2);
    }

    @Test
    void getOptionContracts_readsCachedRowsWithoutProviderCall() {
        ExpiredInstrumentCatalogService service = new ExpiredInstrumentCatalogService(
                upstoxClient,
                expiryRepository,
                contractRepository,
                new TestTransactionManager()
        );

        String tenantId = "tenant-a";
        String underlyingKey = "NSE_INDEX|Nifty 50";
        LocalDate expiryDate = LocalDate.of(2026, 1, 8);
        ExpiredDerivativeContractEntity cachedContract = cachedOptionContract(
                underlyingKey,
                expiryDate,
                "NSE_FO|40477"
        );

        when(contractRepository.findAllByTenantIdAndContractKindAndUnderlyingKeyAndExpiryDateOrderByStrikePriceAscInstrumentKeyAsc(
                tenantId,
                ExpiredInstrumentCatalogService.CONTRACT_KIND_OPTION,
                underlyingKey,
                expiryDate
        )).thenReturn(List.of(cachedContract));

        List<UpstoxClient.ExpiredDerivativeContractView> contracts = service.getOptionContracts(tenantId, underlyingKey, expiryDate);

        assertEquals(1, contracts.size());
        assertEquals("NSE_FO|40477", contracts.getFirst().instrumentKey());
        verify(upstoxClient, never()).fetchExpiredOptionContracts(anyString(), any(LocalDate.class));
    }

    @Test
    void getFutureContracts_persistsProviderRowsOnCacheMiss() {
        ExpiredInstrumentCatalogService service = new ExpiredInstrumentCatalogService(
                upstoxClient,
                expiryRepository,
                contractRepository,
                new TestTransactionManager()
        );

        String tenantId = "tenant-a";
        String underlyingKey = "NSE_INDEX|Nifty 50";
        LocalDate expiryDate = LocalDate.of(2026, 1, 8);

        when(contractRepository.findAllByTenantIdAndContractKindAndUnderlyingKeyAndExpiryDateOrderByStrikePriceAscInstrumentKeyAsc(
                tenantId,
                ExpiredInstrumentCatalogService.CONTRACT_KIND_FUTURE,
                underlyingKey,
                expiryDate
        )).thenReturn(List.of());

        when(upstoxClient.fetchExpiredFutureContracts(underlyingKey, expiryDate))
                .thenReturn(List.of(new UpstoxClient.ExpiredDerivativeContractView(
                        "NIFTY FUT",
                        "NSE_FO",
                        "NSE",
                        expiryDate,
                        "NSE_FO|51714",
                        "51714",
                        "NIFTY26JANFUT",
                        50,
                        "FUTIDX",
                        underlyingKey,
                        null,
                        false,
                        null
                )));

        List<UpstoxClient.ExpiredDerivativeContractView> contracts = service.getFutureContracts(tenantId, underlyingKey, expiryDate);

        assertFalse(contracts.isEmpty());
        verify(contractRepository).upsert(
                eq(tenantId),
                eq(ExpiredInstrumentCatalogService.CONTRACT_KIND_FUTURE),
                eq(underlyingKey),
                eq(expiryDate),
                eq("NSE_FO|51714"),
                eq("NIFTY FUT"),
                eq("NSE_FO"),
                eq("NSE"),
                eq("51714"),
                eq("NIFTY26JANFUT"),
                eq(50),
                eq("FUTIDX"),
                eq((BigDecimal) null),
                eq(false),
                eq((String) null)
        );
    }

    @Test
    void getOptionExpiries_mergesExpiredAndActiveExpiryCatalogs() {
        ExpiredInstrumentCatalogService service = new ExpiredInstrumentCatalogService(
                upstoxClient,
                expiryRepository,
                contractRepository,
                new TestTransactionManager()
        );

        String tenantId = "tenant-a";
        String underlyingKey = "NSE_INDEX|Nifty 50";
        LocalDate expired = LocalDate.of(2026, 3, 10);
        LocalDate activeWeekly = LocalDate.of(2026, 3, 17);
        LocalDate activeMonthly = LocalDate.of(2026, 3, 31);

        Set<LocalDate> persisted = new HashSet<>();
        when(expiryRepository.findAllByTenantIdAndUnderlyingKeyOrderByExpiryDateAsc(tenantId, underlyingKey))
                .thenAnswer(invocation -> toExpiryEntities(persisted.stream().sorted().toList()));
        when(expiryRepository.upsert(eq(tenantId), eq(underlyingKey), any(LocalDate.class)))
                .thenAnswer(invocation -> {
                    persisted.add(invocation.getArgument(2));
                    return 1;
                });
        when(upstoxClient.fetchExpiredExpiries(underlyingKey)).thenReturn(List.of(expired));
        when(upstoxClient.fetchOptionContracts(underlyingKey))
                .thenReturn(new UpstoxOptionContractResponse(
                        "success",
                        2,
                        List.of(
                                activeOptionContract("NSE_FO|7001", underlyingKey, activeWeekly, "22500"),
                                activeOptionContract("NSE_FO|7002", underlyingKey, activeMonthly, "22600")
                        )
                ));

        List<LocalDate> expiries = service.getOptionExpiries(tenantId, underlyingKey, LocalDate.of(2026, 3, 12));

        assertEquals(List.of(expired, activeWeekly, activeMonthly), expiries);
        verify(expiryRepository).upsert(tenantId, underlyingKey, expired);
        verify(expiryRepository).upsert(tenantId, underlyingKey, activeWeekly);
        verify(expiryRepository).upsert(tenantId, underlyingKey, activeMonthly);
    }

    @Test
    void getOptionContracts_fallsBackToActiveContractsWhenExpiredCatalogIsEmpty() {
        ExpiredInstrumentCatalogService service = new ExpiredInstrumentCatalogService(
                upstoxClient,
                expiryRepository,
                contractRepository,
                new TestTransactionManager()
        );

        String tenantId = "tenant-a";
        String underlyingKey = "NSE_INDEX|Nifty 50";
        LocalDate expiryDate = LocalDate.of(2026, 3, 31);

        when(contractRepository.findAllByTenantIdAndContractKindAndUnderlyingKeyAndExpiryDateOrderByStrikePriceAscInstrumentKeyAsc(
                tenantId,
                ExpiredInstrumentCatalogService.CONTRACT_KIND_OPTION,
                underlyingKey,
                expiryDate
        )).thenReturn(List.of());
        when(upstoxClient.fetchExpiredOptionContracts(underlyingKey, expiryDate)).thenReturn(List.of());
        when(upstoxClient.fetchOptionContracts(underlyingKey, expiryDate))
                .thenReturn(new UpstoxOptionContractResponse(
                        "success",
                        2,
                        List.of(
                                activeOptionContract("NSE_FO|7101", underlyingKey, expiryDate, "22500"),
                                activeOptionContract("NSE_FO|7102", underlyingKey, expiryDate, "22500")
                        )
                ));
        when(upstoxClient.fetchOptionChain(underlyingKey, expiryDate))
                .thenReturn(new UpstoxOptionChainResponse(
                        "success",
                        1,
                        List.of(new UpstoxOptionChainRow(
                                expiryDate,
                                new BigDecimal("22500"),
                                new BigDecimal("22490"),
                                new BigDecimal("1.05"),
                                new UpstoxOptionSide("NSE_FO|7101", null, null),
                                new UpstoxOptionSide("NSE_FO|7102", null, null)
                        ))
                ));

        List<UpstoxClient.ExpiredDerivativeContractView> contracts =
                service.getOptionContracts(tenantId, underlyingKey, expiryDate);

        assertEquals(2, contracts.size());
        assertTrue(contracts.stream().anyMatch(contract ->
                "NSE_FO|7101".equals(contract.instrumentKey()) && "CE".equals(contract.optionType())));
        assertTrue(contracts.stream().anyMatch(contract ->
                "NSE_FO|7102".equals(contract.instrumentKey()) && "PE".equals(contract.optionType())));
        verify(upstoxClient).fetchOptionChain(underlyingKey, expiryDate);
    }

    @Test
    void getExpiries_returnsCachedValuesWhenProviderCallFails() {
        ExpiredInstrumentCatalogService service = new ExpiredInstrumentCatalogService(
                upstoxClient,
                expiryRepository,
                contractRepository,
                new TestTransactionManager()
        );

        String tenantId = "tenant-a";
        String underlyingKey = "NSE_INDEX|Nifty 50";
        LocalDate cachedExpiry = LocalDate.of(2026, 1, 30);
        LocalDate requiredDate = LocalDate.of(2026, 2, 5);

        when(expiryRepository.findAllByTenantIdAndUnderlyingKeyOrderByExpiryDateAsc(tenantId, underlyingKey))
                .thenAnswer(invocation -> toExpiryEntities(List.of(cachedExpiry)));
        when(upstoxClient.fetchExpiredExpiries(underlyingKey)).thenThrow(new RuntimeException("provider auth failed"));

        List<LocalDate> expiries = service.getExpiries(tenantId, underlyingKey, requiredDate);

        assertEquals(List.of(cachedExpiry), expiries);
        verify(expiryRepository, never()).upsert(eq(tenantId), eq(underlyingKey), any(LocalDate.class));
    }

    @Test
    void getFutureContracts_returnsEmptyWhenProviderCallFailsAndCacheIsEmpty() {
        ExpiredInstrumentCatalogService service = new ExpiredInstrumentCatalogService(
                upstoxClient,
                expiryRepository,
                contractRepository,
                new TestTransactionManager()
        );

        String tenantId = "tenant-a";
        String underlyingKey = "NSE_INDEX|Nifty 50";
        LocalDate expiryDate = LocalDate.of(2026, 1, 30);

        when(contractRepository.findAllByTenantIdAndContractKindAndUnderlyingKeyAndExpiryDateOrderByStrikePriceAscInstrumentKeyAsc(
                tenantId,
                ExpiredInstrumentCatalogService.CONTRACT_KIND_FUTURE,
                underlyingKey,
                expiryDate
        )).thenReturn(List.of());
        when(upstoxClient.fetchExpiredFutureContracts(underlyingKey, expiryDate))
                .thenThrow(new RuntimeException("provider auth failed"));

        List<UpstoxClient.ExpiredDerivativeContractView> contracts =
                service.getFutureContracts(tenantId, underlyingKey, expiryDate);

        assertTrue(contracts.isEmpty());
        verify(contractRepository, never()).upsert(
                anyString(),
                anyString(),
                anyString(),
                any(LocalDate.class),
                anyString(),
                anyString(),
                anyString(),
                anyString(),
                anyString(),
                anyString(),
                anyInt(),
                anyString(),
                any(BigDecimal.class),
                any(Boolean.class),
                any()
        );
    }

    private List<ExpiredInstrumentExpiryEntity> toExpiryEntities(List<LocalDate> expiries) {
        List<ExpiredInstrumentExpiryEntity> entities = new ArrayList<>();
        for (LocalDate expiry : expiries) {
            ExpiredInstrumentExpiryEntity entity = mock(ExpiredInstrumentExpiryEntity.class);
            when(entity.getExpiryDate()).thenReturn(expiry);
            entities.add(entity);
        }
        return entities;
    }

    private ExpiredDerivativeContractEntity cachedOptionContract(
            String underlyingKey,
            LocalDate expiryDate,
            String instrumentKey
    ) {
        ExpiredDerivativeContractEntity entity = mock(ExpiredDerivativeContractEntity.class);
        when(entity.getName()).thenReturn("NIFTY CALL");
        when(entity.getSegment()).thenReturn("NSE_FO");
        when(entity.getExchange()).thenReturn("NSE");
        when(entity.getExpiryDate()).thenReturn(expiryDate);
        when(entity.getInstrumentKey()).thenReturn(instrumentKey);
        when(entity.getExchangeToken()).thenReturn("40477");
        when(entity.getTradingSymbol()).thenReturn("NIFTY26JAN100CE");
        when(entity.getLotSize()).thenReturn(50);
        when(entity.getInstrumentType()).thenReturn("OPTIDX");
        when(entity.getUnderlyingKey()).thenReturn(underlyingKey);
        when(entity.getStrikePrice()).thenReturn(new BigDecimal("100"));
        when(entity.getWeekly()).thenReturn(true);
        when(entity.getOptionType()).thenReturn("CE");
        return entity;
    }

    private UpstoxOptionContract activeOptionContract(
            String instrumentKey,
            String underlyingKey,
            LocalDate expiryDate,
            String strike
    ) {
        return new UpstoxOptionContract(
                instrumentKey,
                underlyingKey,
                "INDEX",
                "NSE",
                "NSE_FO",
                "NIFTY",
                expiryDate,
                new BigDecimal(strike),
                75,
                "OPTIDX",
                null
        );
    }

    private static final class TestTransactionManager implements PlatformTransactionManager {
        @Override
        public TransactionStatus getTransaction(TransactionDefinition definition) {
            if (!TransactionSynchronizationManager.isSynchronizationActive()) {
                TransactionSynchronizationManager.initSynchronization();
            }
            TransactionSynchronizationManager.setActualTransactionActive(true);
            return new SimpleTransactionStatus();
        }

        @Override
        public void commit(TransactionStatus status) {
            clearContext();
        }

        @Override
        public void rollback(TransactionStatus status) {
            clearContext();
        }

        private void clearContext() {
            TransactionSynchronizationManager.setActualTransactionActive(false);
            if (TransactionSynchronizationManager.isSynchronizationActive()) {
                TransactionSynchronizationManager.clearSynchronization();
            }
        }
    }
}
