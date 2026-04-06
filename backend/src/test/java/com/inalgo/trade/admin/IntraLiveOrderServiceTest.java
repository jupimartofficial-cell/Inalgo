package com.inalgo.trade.admin;

import com.inalgo.trade.entity.IntraPositionSnapshotEntity;
import com.inalgo.trade.entity.IntraRuntimeStrategyEntity;
import com.inalgo.trade.entity.IntraTradeOrderEntity;
import com.inalgo.trade.repository.IntraPositionSnapshotRepository;
import com.inalgo.trade.repository.IntraTradeOrderRepository;
import com.inalgo.trade.upstox.UpstoxOrderDtos;
import com.inalgo.trade.upstox.UpstoxOrderException;
import com.inalgo.trade.upstox.UpstoxOrderService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class IntraLiveOrderServiceTest {

    @Mock UpstoxOrderService upstoxOrderService;
    @Mock IntraPositionSnapshotRepository positionRepository;
    @Mock IntraTradeOrderRepository orderRepository;
    @Mock IntraMonitorAuditService auditService;

    private IntraLiveOrderService service;

    @BeforeEach
    void setUp() {
        service = new IntraLiveOrderService(upstoxOrderService, positionRepository, orderRepository, auditService);
    }

    @Test
    void syncOrdersForExecution_placesEntryOrdersForLiveEntered() {
        IntraRuntimeStrategyEntity runtime = runtime(11L, "LIVE", 91L);
        IntraPositionSnapshotEntity position = position(runtime, "leg-1", "BUY", "SELL", 30, 1);

        IntraTradeDtos.IntraTradeExecutionResponse execution = new IntraTradeDtos.IntraTradeExecutionResponse(
                91L,
                "admin",
                11L,
                "LIVE",
                "ENTERED",
                "Strategy",
                "NSE_INDEX|Nifty Bank",
                "minutes",
                5,
                null,
                null,
                null,
                null,
                null,
                null
        );

        when(positionRepository.findAllByTenantIdAndRuntime("local-desktop", runtime)).thenReturn(List.of(position));
        when(orderRepository.existsByTenantIdAndExecutionIdAndLegIdAndPhase("local-desktop", 91L, "leg-1", "ENTRY"))
                .thenReturn(false);
        when(upstoxOrderService.placeOrder(any(), eq("91"))).thenReturn(new UpstoxOrderDtos.IntraOrderResult(
                "order-1",
                position.getTradeInstrumentKey(),
                null,
                "BUY",
                30,
                0,
                "MARKET",
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                "TAG",
                "complete",
                ""
        ));

        service.syncOrdersForExecution("local-desktop", execution, runtime, "admin");

        ArgumentCaptor<UpstoxOrderDtos.IntraOrderRequest> captor = ArgumentCaptor.forClass(UpstoxOrderDtos.IntraOrderRequest.class);
        verify(upstoxOrderService).placeOrder(captor.capture(), eq("91"));
        UpstoxOrderDtos.IntraOrderRequest request = captor.getValue();
        assertThat(request.instrumentToken()).isEqualTo(position.getTradeInstrumentKey());
        assertThat(request.transactionType()).isEqualTo("BUY");
        assertThat(request.quantity()).isEqualTo(30);

        ArgumentCaptor<IntraTradeOrderEntity> orderCaptor = ArgumentCaptor.forClass(IntraTradeOrderEntity.class);
        verify(orderRepository).save(orderCaptor.capture());
        assertThat(orderCaptor.getValue().getPhase()).isEqualTo("ENTRY");
    }

    @Test
    void placeExitOrderForPosition_usesExitSideAndQuantity() {
        IntraRuntimeStrategyEntity runtime = runtime(15L, "LIVE", 101L);
        IntraPositionSnapshotEntity position = position(runtime, "leg-2", "SELL", "BUY", 50, 2);

        when(orderRepository.existsByTenantIdAndExecutionIdAndLegIdAndPhase("local-desktop", 101L, "leg-2", "EXIT"))
                .thenReturn(false);
        when(upstoxOrderService.placeOrder(any(), eq("101"))).thenReturn(new UpstoxOrderDtos.IntraOrderResult(
                "order-2",
                position.getTradeInstrumentKey(),
                null,
                "BUY",
                100,
                0,
                "MARKET",
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                "TAG",
                "complete",
                ""
        ));

        service.placeExitOrderForPosition("local-desktop", position, "manual exit", "admin", false);

        ArgumentCaptor<UpstoxOrderDtos.IntraOrderRequest> captor = ArgumentCaptor.forClass(UpstoxOrderDtos.IntraOrderRequest.class);
        verify(upstoxOrderService).placeOrder(captor.capture(), eq("101"));
        UpstoxOrderDtos.IntraOrderRequest request = captor.getValue();
        assertThat(request.transactionType()).isEqualTo("BUY");
        assertThat(request.quantity()).isEqualTo(100);
    }

    @Test
    void syncOrdersForExecution_recordsActionableAuditForStaticIpRestriction() {
        IntraRuntimeStrategyEntity runtime = runtime(21L, "LIVE", 191L);
        IntraPositionSnapshotEntity position = position(runtime, "leg-1", "BUY", "SELL", 30, 1);
        IntraTradeDtos.IntraTradeExecutionResponse execution = new IntraTradeDtos.IntraTradeExecutionResponse(
                191L,
                "admin",
                21L,
                "LIVE",
                "ENTERED",
                "Strategy",
                "NSE_INDEX|Nifty Bank",
                "minutes",
                5,
                null,
                null,
                null,
                null,
                null,
                null
        );

        when(positionRepository.findAllByTenantIdAndRuntime("local-desktop", runtime)).thenReturn(List.of(position));
        when(orderRepository.existsByTenantIdAndExecutionIdAndLegIdAndPhase("local-desktop", 191L, "leg-1", "ENTRY"))
                .thenReturn(false);
        when(upstoxOrderService.placeOrder(any(), eq("191")))
                .thenThrow(new UpstoxOrderException(
                        "Order placement failed: 403 FORBIDDEN — Access blocked [UDAPI1154]",
                        UpstoxOrderException.Reason.STATIC_IP_RESTRICTION,
                        "UDAPI1154",
                        403
                ));

        service.syncOrdersForExecution("local-desktop", execution, runtime, "admin");

        ArgumentCaptor<IntraTradeOrderEntity> orderCaptor = ArgumentCaptor.forClass(IntraTradeOrderEntity.class);
        verify(orderRepository).save(orderCaptor.capture());
        assertThat(orderCaptor.getValue().getStatus()).isEqualTo("FAILED");
        assertThat(orderCaptor.getValue().getMessage()).contains("UDAPI1154");
        verify(auditService).appendEvent(
                eq("local-desktop"),
                eq("admin"),
                eq(runtime),
                eq(position),
                eq("ORDER_FAILED"),
                eq("ERROR"),
                eq("LIVE"),
                eq("Entry order failed"),
                org.mockito.ArgumentMatchers.contains("Whitelist the runtime egress IP"),
                eq(java.util.Map.of()),
                eq(java.util.Map.of()),
                eq("admin")
        );
        verify(auditService, never()).appendEvent(
                eq("local-desktop"),
                eq("admin"),
                eq(runtime),
                eq(position),
                eq("ORDER_PLACED"),
                eq("INFO"),
                eq("LIVE"),
                eq("Entry order placed"),
                any(),
                eq(java.util.Map.of()),
                eq(java.util.Map.of()),
                eq("admin")
        );
    }

    private IntraRuntimeStrategyEntity runtime(Long id, String mode, Long executionId) {
        IntraRuntimeStrategyEntity runtime = new IntraRuntimeStrategyEntity();
        runtime.setTenantId("local-desktop");
        runtime.setUsername("admin");
        runtime.setMode(mode);
        runtime.setExecutionId(executionId);
        runtime.setStatus("ENTERED");
        setId(runtime, id);
        return runtime;
    }

    private IntraPositionSnapshotEntity position(
            IntraRuntimeStrategyEntity runtime,
            String legId,
            String entrySide,
            String exitSide,
            int lotSize,
            int lots
    ) {
        IntraPositionSnapshotEntity position = new IntraPositionSnapshotEntity();
        position.setRuntime(runtime);
        position.setExecutionId(runtime.getExecutionId());
        position.setTenantId("local-desktop");
        position.setUsername("admin");
        position.setMode("LIVE");
        position.setLegId(legId);
        position.setTradeInstrumentKey("NSE_FO|99999");
        position.setEntrySide(entrySide);
        position.setExitSide(exitSide);
        position.setLotSize(lotSize);
        position.setLots(lots);
        position.setQuantityUnits(lotSize * lots);
        setId(position, 200L);
        return position;
    }

    private void setId(Object target, Long value) {
        try {
            java.lang.reflect.Field field = target.getClass().getDeclaredField("id");
            field.setAccessible(true);
            field.set(target, value);
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }
}
