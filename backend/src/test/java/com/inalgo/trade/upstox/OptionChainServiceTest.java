package com.inalgo.trade.upstox;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.inalgo.trade.entity.OptionChainMigrationStateEntity;
import com.inalgo.trade.entity.OptionChainSnapshotEntity;
import com.inalgo.trade.repository.OptionChainMigrationStateRepository;
import com.inalgo.trade.repository.OptionChainSnapshotRepository;
import com.inalgo.trade.security.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OptionChainServiceTest {

    @Mock
    private UpstoxClient upstoxClient;

    @Mock
    private OptionChainSnapshotRepository snapshotRepository;

    @Mock
    private OptionChainMigrationStateRepository stateRepository;

    @Mock
    private PlatformTransactionManager transactionManager;

    private OptionChainService service;

    private static class SimpleTransactionStatus implements TransactionStatus {
        @Override public boolean hasSavepoint() { return false; }
        @Override public void flush() { }
        @Override public boolean isNewTransaction() { return true; }
        @Override public boolean isRollbackOnly() { return false; }
        @Override public void setRollbackOnly() { }
        @Override public boolean isCompleted() { return false; }
        @Override public Object createSavepoint() { return null; }
        @Override public void rollbackToSavepoint(Object savepoint) { }
        @Override public void releaseSavepoint(Object savepoint) { }
    }

    @BeforeEach
    void setUp() {
        UpstoxOptionChainProperties properties = new UpstoxOptionChainProperties(
                true,
                "local-desktop",
                30,
                2,
                List.of("NSE_INDEX|Nifty 50", "NSE_INDEX|Nifty Bank", "BSE_INDEX|SENSEX")
        );
        lenient().when(transactionManager.getTransaction(any(TransactionDefinition.class))).thenReturn(new SimpleTransactionStatus());
        ObjectMapper objectMapper = new ObjectMapper();
        objectMapper.findAndRegisterModules();
        service = new OptionChainService(
                upstoxClient,
                snapshotRepository,
                stateRepository,
                properties,
                objectMapper,
                transactionManager
        );
    }

    @Test
    void refreshUnderlying_persistsOptionRowsAndMarksSuccess() {
        LocalDate expiry = LocalDate.of(2026, 3, 26);
        when(upstoxClient.fetchOptionContracts("NSE_INDEX|Nifty 50"))
                .thenReturn(new UpstoxOptionContractResponse("success", 1,
                        List.of(new UpstoxOptionContract("NSE_FO|111", "NSE_INDEX|Nifty 50", "INDEX", "NSE", "NSE_FO", "NIFTY", expiry, new BigDecimal("22500"), 75, "OPTIDX", null))));

        UpstoxOptionChainRow row = new UpstoxOptionChainRow(
                expiry,
                new BigDecimal("22500"),
                new BigDecimal("22472.60"),
                new BigDecimal("1.02"),
                new UpstoxOptionSide(
                        "NSE_FO|111",
                        new UpstoxOptionMarketData(new BigDecimal("115.5"), null, 1400L, 11000L, 10000L, null, null, null, null),
                        new UpstoxOptionGreeks(new BigDecimal("8.2"), new BigDecimal("-13.8"), new BigDecimal("0.0031"), new BigDecimal("0.43"), new BigDecimal("14.2"), null)
                ),
                new UpstoxOptionSide(
                        "NSE_FO|222",
                        new UpstoxOptionMarketData(new BigDecimal("104.8"), null, 1200L, 9800L, 9300L, null, null, null, null),
                        new UpstoxOptionGreeks(new BigDecimal("8.4"), new BigDecimal("-12.5"), new BigDecimal("0.0030"), new BigDecimal("-0.55"), new BigDecimal("15.1"), null)
                )
        );

        when(upstoxClient.fetchOptionChain("NSE_INDEX|Nifty 50", expiry))
                .thenReturn(new UpstoxOptionChainResponse("success", 1, List.of(row)));
        when(stateRepository.findByTenantIdAndUnderlyingKeyAndExpiryDate("tenant-a", "NSE_INDEX|Nifty 50", expiry))
                .thenReturn(Optional.empty());
        when(stateRepository.save(any(OptionChainMigrationStateEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        OptionChainService.OptionChainRefreshResult result = service.refreshUnderlying("tenant-a", "NSE_INDEX|Nifty 50", true);

        assertEquals(1, result.processedExpiries());
        assertEquals(1, result.persistedRows());
        assertEquals(0, result.failedExpiries());
        verify(snapshotRepository).upsert(eq("tenant-a"), eq("NSE_INDEX|Nifty 50"), eq(expiry), eq(new BigDecimal("22500")), any(Instant.class), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void fetchLatestSnapshot_computesSyntheticFutureAndOiChanges() {
        OptionChainSnapshotEntity row1 = mock(OptionChainSnapshotEntity.class);
        when(row1.getSnapshotTs()).thenReturn(Instant.parse("2026-03-08T10:15:00Z"));
        when(row1.getStrikePrice()).thenReturn(new BigDecimal("22450"));
        when(row1.getUnderlyingSpotPrice()).thenReturn(new BigDecimal("22460"));
        when(row1.getPcr()).thenReturn(new BigDecimal("1.10"));
        when(row1.getCallLtp()).thenReturn(new BigDecimal("145"));
        when(row1.getCallOi()).thenReturn(15000L);
        when(row1.getCallPrevOi()).thenReturn(12000L);
        when(row1.getCallInstrumentKey()).thenReturn("NSE_FO|CALL123");
        when(row1.getPutLtp()).thenReturn(new BigDecimal("131"));
        when(row1.getPutOi()).thenReturn(19000L);
        when(row1.getPutPrevOi()).thenReturn(15000L);
        when(row1.getPutInstrumentKey()).thenReturn("NSE_FO|PUT123");
        when(row1.getCallIv()).thenReturn(new BigDecimal("19.8"));
        when(row1.getPutIv()).thenReturn(new BigDecimal("20.1"));

        when(snapshotRepository.findLatestSnapshotRows("tenant-a", "NSE_INDEX|Nifty 50", LocalDate.of(2026, 3, 26)))
                .thenReturn(List.of(row1));

        OptionChainService.OptionChainSnapshotView view = service.fetchLatestSnapshot(
                "tenant-a",
                "NSE_INDEX|Nifty 50",
                LocalDate.of(2026, 3, 26),
                false
        );

        assertEquals(new BigDecimal("22464.00"), view.syntheticFuturePrice());
        assertEquals(1, view.rows().size());
        assertEquals(new BigDecimal("25.00"), view.rows().getFirst().callOiChangePercent());
        assertEquals(new BigDecimal("26.67"), view.rows().getFirst().putOiChangePercent());
        assertEquals("NSE_FO|CALL123", view.rows().getFirst().callInstrumentKey());
        assertEquals("NSE_FO|PUT123", view.rows().getFirst().putInstrumentKey());
    }

    @Test
    void refreshUnderlying_setsTenantContextForProviderCalls() {
        LocalDate expiry = LocalDate.of(2026, 3, 26);
        AtomicReference<String> tenantSeenDuringContractsCall = new AtomicReference<>();
        AtomicReference<String> tenantSeenDuringChainCall = new AtomicReference<>();

        doAnswer(invocation -> {
            tenantSeenDuringContractsCall.set(TenantContext.getTenantId());
            return new UpstoxOptionContractResponse(
                    "success",
                    1,
                    List.of(new UpstoxOptionContract(
                            "NSE_FO|111",
                            "NSE_INDEX|Nifty 50",
                            "INDEX",
                            "NSE",
                            "NSE_FO",
                            "NIFTY",
                            expiry,
                            new BigDecimal("22500"),
                            75,
                            "OPTIDX",
                            null
                    ))
            );
        }).when(upstoxClient).fetchOptionContracts("NSE_INDEX|Nifty 50");

        doAnswer(invocation -> {
            tenantSeenDuringChainCall.set(TenantContext.getTenantId());
            return new UpstoxOptionChainResponse(
                    "success",
                    1,
                    List.of(new UpstoxOptionChainRow(
                            expiry,
                            new BigDecimal("22500"),
                            new BigDecimal("22472.60"),
                            new BigDecimal("1.02"),
                            new UpstoxOptionSide(
                                    "NSE_FO|111",
                                    new UpstoxOptionMarketData(new BigDecimal("115.5"), null, 1400L, 11000L, 10000L, null, null, null, null),
                                    new UpstoxOptionGreeks(new BigDecimal("8.2"), new BigDecimal("-13.8"), new BigDecimal("0.0031"), new BigDecimal("0.43"), new BigDecimal("14.2"), null)
                            ),
                            new UpstoxOptionSide(
                                    "NSE_FO|222",
                                    new UpstoxOptionMarketData(new BigDecimal("104.8"), null, 1200L, 9800L, 9300L, null, null, null, null),
                                    new UpstoxOptionGreeks(new BigDecimal("8.4"), new BigDecimal("-12.5"), new BigDecimal("0.0030"), new BigDecimal("-0.55"), new BigDecimal("15.1"), null)
                            )
                    ))
            );
        }).when(upstoxClient).fetchOptionChain("NSE_INDEX|Nifty 50", expiry);

        when(stateRepository.findByTenantIdAndUnderlyingKeyAndExpiryDate("tenant-a", "NSE_INDEX|Nifty 50", expiry))
                .thenReturn(Optional.empty());
        when(stateRepository.save(any(OptionChainMigrationStateEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        assertNull(TenantContext.getTenantId());
        service.refreshUnderlying("tenant-a", "NSE_INDEX|Nifty 50", true);

        assertEquals("tenant-a", tenantSeenDuringContractsCall.get());
        assertEquals("tenant-a", tenantSeenDuringChainCall.get());
        assertNull(TenantContext.getTenantId());
    }

    @Test
    void listAvailableExpiries_handlesNullProviderPayloadGracefully() {
        when(snapshotRepository.findDistinctExpiriesByTenantAndUnderlying("tenant-a", "NSE_INDEX|Nifty 50"))
                .thenReturn(List.of());
        when(upstoxClient.fetchOptionContracts("NSE_INDEX|Nifty 50")).thenReturn(null);

        List<LocalDate> expiries = service.listAvailableExpiries("tenant-a", "NSE_INDEX|Nifty 50", true);

        assertEquals(List.of(), expiries);
    }
}
