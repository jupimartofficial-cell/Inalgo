package com.inalgo.trade.admin;

import com.inalgo.trade.entity.IntraPositionSnapshotEntity;
import com.inalgo.trade.entity.IntraRuntimeStrategyEntity;
import com.inalgo.trade.entity.IntraTradeOrderEntity;
import com.inalgo.trade.repository.IntraPositionSnapshotRepository;
import com.inalgo.trade.repository.IntraTradeOrderRepository;
import com.inalgo.trade.upstox.UpstoxOrderDtos;
import com.inalgo.trade.upstox.UpstoxOrderException;
import com.inalgo.trade.upstox.UpstoxOrderService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class IntraLiveOrderService {

    private static final Logger log = LoggerFactory.getLogger(IntraLiveOrderService.class);
    private static final String ENTRY_PHASE = "ENTRY";
    private static final String EXIT_PHASE = "EXIT";
    private static final String PARTIAL_EXIT_PHASE = "PARTIAL_EXIT";

    private final UpstoxOrderService upstoxOrderService;
    private final IntraPositionSnapshotRepository positionRepository;
    private final IntraTradeOrderRepository orderRepository;
    private final IntraMonitorAuditService auditService;

    public IntraLiveOrderService(
            UpstoxOrderService upstoxOrderService,
            IntraPositionSnapshotRepository positionRepository,
            IntraTradeOrderRepository orderRepository,
            IntraMonitorAuditService auditService
    ) {
        this.upstoxOrderService = upstoxOrderService;
        this.positionRepository = positionRepository;
        this.orderRepository = orderRepository;
        this.auditService = auditService;
    }

    public void syncOrdersForExecution(
            String tenantId,
            IntraTradeDtos.IntraTradeExecutionResponse execution,
            IntraRuntimeStrategyEntity runtime,
            String actor
    ) {
        if (!"LIVE".equalsIgnoreCase(execution.mode())) {
            return;
        }
        List<IntraPositionSnapshotEntity> positions = positionRepository.findAllByTenantIdAndRuntime(tenantId, runtime);
        if (positions.isEmpty()) {
            return;
        }
        String status = execution.status() == null ? "" : execution.status().trim().toUpperCase(Locale.ROOT);
        if (List.of("ENTERED", "PAUSED", "PARTIAL_EXIT").contains(status)) {
            placeEntryOrders(tenantId, execution, runtime, positions, "Live entry", actor);
        }
        if ("EXITED".equals(status)) {
            placeExitOrders(tenantId, execution, runtime, positions, EXIT_PHASE, "Live exit", actor);
        }
    }

    public void placeExitOrdersForRuntime(
            String tenantId,
            IntraRuntimeStrategyEntity runtime,
            String reason,
            String actor
    ) {
        if (!"LIVE".equalsIgnoreCase(runtime.getMode())) {
            return;
        }
        List<IntraPositionSnapshotEntity> positions = positionRepository.findAllByTenantIdAndRuntime(tenantId, runtime);
        if (positions.isEmpty()) {
            return;
        }
        placeExitOrders(tenantId, null, runtime, positions, EXIT_PHASE, reason, actor);
    }

    public void placeExitOrderForPosition(
            String tenantId,
            IntraPositionSnapshotEntity position,
            String reason,
            String actor,
            boolean partial
    ) {
        if (!"LIVE".equalsIgnoreCase(position.getMode())) {
            return;
        }
        String phase = partial ? PARTIAL_EXIT_PHASE : EXIT_PHASE;
        placeExitOrders(tenantId, null, position.getRuntime(), List.of(position), phase, reason, actor);
    }

    private void placeEntryOrders(
            String tenantId,
            IntraTradeDtos.IntraTradeExecutionResponse execution,
            IntraRuntimeStrategyEntity runtime,
            List<IntraPositionSnapshotEntity> positions,
            String reason,
            String actor
    ) {
        for (IntraPositionSnapshotEntity position : positions) {
            String legId = position.getLegId();
            if (orderRepository.existsByTenantIdAndExecutionIdAndLegIdAndPhase(tenantId, runtime.getExecutionId(), legId, ENTRY_PHASE)) {
                continue;
            }
            int quantity = resolveQuantity(position, false);
            if (quantity <= 0) {
                appendOrderAudit(runtime, position, "ORDER_FAILED", "ERROR", "Invalid quantity for entry", reason, actor);
                continue;
            }
            String instrument = resolveInstrument(position);
            String side = resolveSide(position.getEntrySide(), "BUY");
            String tag = buildTag(runtime.getExecutionId(), legId, ENTRY_PHASE);

            try {
                UpstoxOrderDtos.IntraOrderResult result = upstoxOrderService.placeOrder(
                        new UpstoxOrderDtos.IntraOrderRequest(
                                instrument,
                                side,
                                quantity,
                                "MARKET",
                                BigDecimal.ZERO,
                                tag
                        ),
                        String.valueOf(runtime.getExecutionId())
                );
                IntraTradeOrderEntity order = buildOrderEntity(tenantId, runtime, position, ENTRY_PHASE, instrument, side, quantity, tag, result);
                orderRepository.save(order);
                appendOrderAudit(runtime, position, "ORDER_PLACED", "INFO", "Entry order placed", reason, actor);
            } catch (UpstoxOrderException ex) {
                String failureReason = buildFailureReason(ex);
                log.warn("Live entry order rejected for runtime {} leg={} reason={} code={}",
                        runtime.getId(), legId, ex.reason(), ex.errorCode());
                IntraTradeOrderEntity order = buildOrderEntity(tenantId, runtime, position, ENTRY_PHASE, instrument, side, quantity, tag, failedResult(ex));
                orderRepository.save(order);
                appendOrderAudit(runtime, position, "ORDER_FAILED", "ERROR", "Entry order failed", failureReason, actor);
            } catch (Exception ex) {
                log.error("Failed to place live entry order for runtime {}", runtime.getId(), ex);
                IntraTradeOrderEntity order = buildOrderEntity(tenantId, runtime, position, ENTRY_PHASE, instrument, side, quantity, tag, failedResult(ex));
                orderRepository.save(order);
                appendOrderAudit(runtime, position, "ORDER_FAILED", "ERROR", "Entry order failed", ex.getMessage(), actor);
            }
        }
    }

    private void placeExitOrders(
            String tenantId,
            IntraTradeDtos.IntraTradeExecutionResponse execution,
            IntraRuntimeStrategyEntity runtime,
            List<IntraPositionSnapshotEntity> positions,
            String phase,
            String reason,
            String actor
    ) {
        for (IntraPositionSnapshotEntity position : positions) {
            String legId = position.getLegId();
            if (orderRepository.existsByTenantIdAndExecutionIdAndLegIdAndPhase(tenantId, runtime.getExecutionId(), legId, phase)) {
                continue;
            }
            int quantity = resolveQuantity(position, PARTIAL_EXIT_PHASE.equals(phase));
            if (quantity <= 0) {
                appendOrderAudit(runtime, position, "ORDER_FAILED", "ERROR", "Invalid quantity for exit", reason, actor);
                continue;
            }
            String instrument = resolveInstrument(position);
            String side = resolveSide(position.getExitSide(), "SELL");
            String tag = buildTag(runtime.getExecutionId(), legId, phase);

            try {
                UpstoxOrderDtos.IntraOrderResult result = upstoxOrderService.placeOrder(
                        new UpstoxOrderDtos.IntraOrderRequest(
                                instrument,
                                side,
                                quantity,
                                "MARKET",
                                BigDecimal.ZERO,
                                tag
                        ),
                        String.valueOf(runtime.getExecutionId())
                );
                IntraTradeOrderEntity order = buildOrderEntity(tenantId, runtime, position, phase, instrument, side, quantity, tag, result);
                orderRepository.save(order);
                String message = PARTIAL_EXIT_PHASE.equals(phase) ? "Partial exit order placed" : "Exit order placed";
                appendOrderAudit(runtime, position, "ORDER_PLACED", "INFO", message, reason, actor);
            } catch (UpstoxOrderException ex) {
                String failureReason = buildFailureReason(ex);
                log.warn("Live exit order rejected for runtime {} leg={} reason={} code={}",
                        runtime.getId(), legId, ex.reason(), ex.errorCode());
                IntraTradeOrderEntity order = buildOrderEntity(tenantId, runtime, position, phase, instrument, side, quantity, tag, failedResult(ex));
                orderRepository.save(order);
                appendOrderAudit(runtime, position, "ORDER_FAILED", "ERROR", "Exit order failed", failureReason, actor);
            } catch (Exception ex) {
                log.error("Failed to place live exit order for runtime {}", runtime.getId(), ex);
                IntraTradeOrderEntity order = buildOrderEntity(tenantId, runtime, position, phase, instrument, side, quantity, tag, failedResult(ex));
                orderRepository.save(order);
                appendOrderAudit(runtime, position, "ORDER_FAILED", "ERROR", "Exit order failed", ex.getMessage(), actor);
            }
        }
    }

    private IntraTradeOrderEntity buildOrderEntity(
            String tenantId,
            IntraRuntimeStrategyEntity runtime,
            IntraPositionSnapshotEntity position,
            String phase,
            String instrument,
            String side,
            int quantity,
            String tag,
            UpstoxOrderDtos.IntraOrderResult result
    ) {
        IntraTradeOrderEntity order = new IntraTradeOrderEntity();
        order.setTenantId(tenantId);
        order.setUsername(runtime.getUsername());
        order.setExecutionId(runtime.getExecutionId());
        order.setRuntimeId(runtime.getId());
        order.setPositionId(position.getId());
        order.setLegId(position.getLegId());
        order.setLegLabel(position.getLegLabel());
        order.setPhase(phase);
        order.setInstrumentKey(instrument);
        order.setTransactionType(side);
        order.setQuantity(quantity);
        order.setOrderType("MARKET");
        order.setLimitPrice(BigDecimal.ZERO);
        order.setOrderId(result.orderId());
        order.setStatus(result.status());
        order.setTag(tag);
        order.setMessage(result.message());
        return order;
    }

    private UpstoxOrderDtos.IntraOrderResult failedResult(Exception ex) {
        return new UpstoxOrderDtos.IntraOrderResult(
                null,
                null,
                null,
                null,
                null,
                null,
                "MARKET",
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                null,
                "FAILED",
                ex == null ? "Unknown error" : ex.getMessage()
        );
    }

    private String buildFailureReason(UpstoxOrderException ex) {
        if (ex.reason() == UpstoxOrderException.Reason.STATIC_IP_RESTRICTION) {
            return "Upstox static IP restriction blocked this request (UDAPI1154). "
                    + "Whitelist the runtime egress IP for this Upstox app and retry.";
        }
        return ex.getMessage();
    }

    private int resolveQuantity(IntraPositionSnapshotEntity position, boolean partial) {
        Integer units = position.getQuantityUnits();
        if (units == null || units <= 0) {
            Integer lotSize = position.getLotSize();
            Integer lots = position.getLots();
            if (lotSize != null && lots != null) {
                units = lotSize * lots;
            }
        }
        if (units == null || units <= 0) {
            return 0;
        }
        if (partial) {
            return Math.max(1, units / 2);
        }
        return units;
    }

    private String resolveInstrument(IntraPositionSnapshotEntity position) {
        if (StringUtils.hasText(position.getTradeInstrumentKey())) {
            return position.getTradeInstrumentKey().trim();
        }
        return position.getInstrumentKey();
    }

    private String resolveSide(String candidate, String fallback) {
        return StringUtils.hasText(candidate) ? candidate.trim().toUpperCase(Locale.ROOT) : fallback;
    }

    private String buildTag(Long executionId, String legId, String phase) {
        String base = "INTRA-" + executionId + "-" + (legId == null ? "LEG" : legId) + "-" + phase;
        if (base.length() <= 32) {
            return base;
        }
        return base.substring(0, 32);
    }

    private void appendOrderAudit(
            IntraRuntimeStrategyEntity runtime,
            IntraPositionSnapshotEntity position,
            String eventType,
            String severity,
            String message,
            String reason,
            String actor
    ) {
        auditService.appendEvent(
                runtime.getTenantId(),
                runtime.getUsername(),
                runtime,
                position,
                eventType,
                severity,
                runtime.getMode(),
                message,
                StringUtils.hasText(reason) ? reason : "Live order",
                Map.of(),
                Map.of(),
                actor
        );
    }
}
