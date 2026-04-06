package com.inalgo.trade.admin;

import com.inalgo.trade.entity.IntraPositionSnapshotEntity;
import com.inalgo.trade.entity.IntraRuntimeStrategyEntity;
import com.inalgo.trade.entity.IntraTradeExecutionEntity;
import com.inalgo.trade.repository.IntraPositionSnapshotRepository;
import com.inalgo.trade.repository.IntraRuntimeStrategyRepository;
import com.inalgo.trade.repository.IntraTradeExecutionRepository;
import jakarta.validation.ValidationException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class IntraMonitorActionServiceTest {

    @Mock IntraRuntimeStrategyRepository runtimeRepository;
    @Mock IntraPositionSnapshotRepository positionRepository;
    @Mock IntraTradeExecutionRepository   executionRepository;
    @Mock IntraMonitorMapper              mapper;
    @Mock IntraMonitorAuditService        auditService;
    @Mock IntraLiveOrderService           liveOrderService;

    private IntraMonitorActionService service;

    private static final String TENANT = "local-desktop";
    private static final String USER   = "admin";

    @BeforeEach
    void setUp() {
        service = new IntraMonitorActionService(
                runtimeRepository, positionRepository, executionRepository, mapper, auditService, liveOrderService);

        // safe() returns zero for null, or the input scaled
        lenient().when(mapper.safe(any())).thenAnswer(inv -> {
            BigDecimal v = inv.getArgument(0);
            return v == null ? BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP)
                    : v.setScale(2, RoundingMode.HALF_UP);
        });
        lenient().when(mapper.safeQty(any())).thenAnswer(inv -> {
            BigDecimal v = inv.getArgument(0);
            return v == null ? BigDecimal.ZERO : v;
        });
        lenient().when(mapper.safeReason(any(), any())).thenAnswer(inv -> {
            String r = inv.getArgument(0);
            return (r != null && !r.isBlank()) ? r : inv.getArgument(1);
        });
        lenient().doNothing().when(auditService).appendEvent(any(), any(), any(), any(),
                any(), any(), any(), any(), any(), any(), any(), any());
    }

    // ─── pauseRuntime ─────────────────────────────────────────────────────────

    @Test
    void pauseRuntime_paperMode_succeedsWithoutLiveGuard() {
        IntraRuntimeStrategyEntity runtime = runtime(1L, "PAPER", "ENTERED");
        when(runtimeRepository.findById(1L)).thenReturn(Optional.of(runtime));
        when(runtimeRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(positionRepository.findAllByTenantIdAndRuntime(TENANT, runtime))
                .thenReturn(List.of(openPosition(runtime, "PAPER", new BigDecimal("200"))));
        when(positionRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

        var response = service.pauseRuntime(TENANT, USER, 1L, paperRequest("Protecting profit"));

        assertThat(response.status()).isEqualTo("PAUSED");
        assertThat(response.message()).contains("paused");
    }

    @Test
    void pauseRuntime_setsOpenPositionsToPaused() {
        IntraRuntimeStrategyEntity runtime = runtime(2L, "PAPER", "ENTERED");
        IntraPositionSnapshotEntity openPos   = openPosition(runtime, "PAPER", new BigDecimal("100"));
        IntraPositionSnapshotEntity closedPos = closedPosition(runtime, "PAPER", new BigDecimal("300"));

        when(runtimeRepository.findById(2L)).thenReturn(Optional.of(runtime));
        when(runtimeRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(positionRepository.findAllByTenantIdAndRuntime(TENANT, runtime)).thenReturn(List.of(openPos, closedPos));
        when(positionRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

        service.pauseRuntime(TENANT, USER, 2L, paperRequest("Risk pause"));

        assertThat(openPos.getStatus()).isEqualTo("PAUSED");
        assertThat(closedPos.getStatus()).isEqualTo("CLOSED"); // closed positions unchanged
    }

    @Test
    void pauseRuntime_liveMode_throwsWithoutConfirmation() {
        IntraRuntimeStrategyEntity runtime = runtime(3L, "LIVE", "ENTERED");
        when(runtimeRepository.findById(3L)).thenReturn(Optional.of(runtime));

        assertThatThrownBy(() -> service.pauseRuntime(TENANT, USER, 3L,
                new IntraMonitorDtos.LiveActionRequest(false, "CONFIRM LIVE", "risk")))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("confirmLiveAction must be true");
    }

    @Test
    void pauseRuntime_liveMode_throwsWithWrongAcknowledgement() {
        IntraRuntimeStrategyEntity runtime = runtime(4L, "LIVE", "ENTERED");
        when(runtimeRepository.findById(4L)).thenReturn(Optional.of(runtime));

        assertThatThrownBy(() -> service.pauseRuntime(TENANT, USER, 4L,
                new IntraMonitorDtos.LiveActionRequest(true, "WRONG TEXT", "risk")))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("liveAcknowledgement must be 'CONFIRM LIVE'");
    }

    @Test
    void pauseRuntime_liveMode_throwsWithoutReason() {
        IntraRuntimeStrategyEntity runtime = runtime(5L, "LIVE", "ENTERED");
        when(runtimeRepository.findById(5L)).thenReturn(Optional.of(runtime));

        assertThatThrownBy(() -> service.pauseRuntime(TENANT, USER, 5L,
                new IntraMonitorDtos.LiveActionRequest(true, "CONFIRM LIVE", "")))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("reason is required");
    }

    @Test
    void pauseRuntime_liveMode_succeedsWithCorrectLiveGuard() {
        IntraRuntimeStrategyEntity runtime = runtime(6L, "LIVE", "ENTERED");
        when(runtimeRepository.findById(6L)).thenReturn(Optional.of(runtime));
        when(runtimeRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(positionRepository.findAllByTenantIdAndRuntime(TENANT, runtime)).thenReturn(List.of());
        when(positionRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

        var response = service.pauseRuntime(TENANT, USER, 6L, liveRequest("Emergency pause"));

        assertThat(response.status()).isEqualTo("PAUSED");
    }

    // ─── resumeRuntime ────────────────────────────────────────────────────────

    @Test
    void resumeRuntime_withOpenPositions_setsStatusToEntered() {
        IntraRuntimeStrategyEntity runtime = runtime(10L, "PAPER", "PAUSED");
        IntraPositionSnapshotEntity paused = pausedPosition(runtime, "PAPER", new BigDecimal("150"));

        when(runtimeRepository.findById(10L)).thenReturn(Optional.of(runtime));
        when(runtimeRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(positionRepository.findAllByTenantIdAndRuntime(TENANT, runtime)).thenReturn(List.of(paused));
        when(positionRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

        var response = service.resumeRuntime(TENANT, USER, 10L, "Resuming after review");

        assertThat(response.status()).isEqualTo("ENTERED");
        assertThat(paused.getStatus()).isEqualTo("OPEN");
    }

    @Test
    void resumeRuntime_withNoOpenPositions_setsStatusToWaiting() {
        IntraRuntimeStrategyEntity runtime = runtime(11L, "PAPER", "PAUSED");
        IntraPositionSnapshotEntity closed = closedPosition(runtime, "PAPER", new BigDecimal("200"));

        when(runtimeRepository.findById(11L)).thenReturn(Optional.of(runtime));
        when(runtimeRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(positionRepository.findAllByTenantIdAndRuntime(TENANT, runtime)).thenReturn(List.of(closed));
        when(positionRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

        var response = service.resumeRuntime(TENANT, USER, 11L, "Resumed");

        assertThat(response.status()).isEqualTo("WAITING");
    }

    // ─── exitRuntime ──────────────────────────────────────────────────────────

    @Test
    void exitRuntime_movesUnrealizedPnlToRealized_andSetsExited() {
        IntraRuntimeStrategyEntity runtime = runtime(20L, "PAPER", "ENTERED");
        runtime.setExecutionId(100L);
        IntraPositionSnapshotEntity pos = openPosition(runtime, "PAPER", new BigDecimal("400"));
        pos.setRealizedPnl(BigDecimal.ZERO);
        pos.setUnrealizedPnl(new BigDecimal("400"));

        when(runtimeRepository.findById(20L)).thenReturn(Optional.of(runtime));
        when(runtimeRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(positionRepository.findAllByTenantIdAndRuntime(TENANT, runtime)).thenReturn(List.of(pos));
        when(positionRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));
        when(executionRepository.findByIdAndTenantId(100L, TENANT)).thenReturn(Optional.empty());

        var response = service.exitRuntime(TENANT, USER, 20L, paperRequest("End of day exit"));

        assertThat(response.status()).isEqualTo("EXITED");
        assertThat(pos.getStatus()).isEqualTo("CLOSED");
        assertThat(pos.getUnrealizedPnl()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(pos.getRealizedPnl()).isEqualByComparingTo(new BigDecimal("400"));
    }

    @Test
    void exitRuntime_updatesExecutionRecord_whenFound() {
        IntraRuntimeStrategyEntity runtime = runtime(21L, "PAPER", "ENTERED");
        runtime.setExecutionId(101L);
        IntraPositionSnapshotEntity pos = closedPosition(runtime, "PAPER", new BigDecimal("250"));
        pos.setRealizedPnl(new BigDecimal("250"));

        IntraTradeExecutionEntity execution = mock(IntraTradeExecutionEntity.class);

        when(runtimeRepository.findById(21L)).thenReturn(Optional.of(runtime));
        when(runtimeRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(positionRepository.findAllByTenantIdAndRuntime(TENANT, runtime)).thenReturn(List.of(pos));
        when(positionRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));
        when(executionRepository.findByIdAndTenantId(101L, TENANT)).thenReturn(Optional.of(execution));
        when(executionRepository.save(execution)).thenReturn(execution);

        service.exitRuntime(TENANT, USER, 21L, paperRequest("manual"));

        verify(execution).setStatus("EXITED");
        verify(execution).setExitReason("manual exit");
    }

    @Test
    void exitRuntime_liveMode_throwsWithoutLiveGuard() {
        IntraRuntimeStrategyEntity runtime = runtime(22L, "LIVE", "ENTERED");
        when(runtimeRepository.findById(22L)).thenReturn(Optional.of(runtime));

        assertThatThrownBy(() -> service.exitRuntime(TENANT, USER, 22L,
                new IntraMonitorDtos.LiveActionRequest(false, "CONFIRM LIVE", "reason")))
                .isInstanceOf(ValidationException.class);
    }

    // ─── partialExitRuntime ───────────────────────────────────────────────────

    @Test
    void partialExitRuntime_splits50_50_onPosition() {
        IntraRuntimeStrategyEntity runtime = runtime(30L, "PAPER", "ENTERED");
        runtime.setExecutionId(200L);
        IntraPositionSnapshotEntity pos = openPosition(runtime, "PAPER", BigDecimal.ZERO);
        pos.setRealizedPnl(BigDecimal.ZERO);
        pos.setUnrealizedPnl(new BigDecimal("500.00"));
        pos.setQuantityLots(new BigDecimal("2.0000"));

        when(runtimeRepository.findById(30L)).thenReturn(Optional.of(runtime));
        when(runtimeRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(positionRepository.findAllByTenantIdAndRuntime(TENANT, runtime)).thenReturn(List.of(pos));
        when(positionRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));
        when(executionRepository.findByIdAndTenantId(200L, TENANT)).thenReturn(Optional.empty());

        var response = service.partialExitRuntime(TENANT, USER, 30L, paperRequest("Partial"));

        assertThat(response.status()).isEqualTo("PARTIAL_EXIT");
        assertThat(pos.getRealizedPnl()).isEqualByComparingTo("250.00");
        assertThat(pos.getUnrealizedPnl()).isEqualByComparingTo("250.00");
        assertThat(pos.getQuantityLots()).isEqualByComparingTo("1.0000");
        assertThat(pos.getStatus()).isEqualTo("PARTIAL_EXIT");
    }

    // ─── exitPosition ─────────────────────────────────────────────────────────

    @Test
    void exitPosition_closesPositionAndRecalcsRuntime() {
        IntraRuntimeStrategyEntity runtime = runtime(40L, "PAPER", "ENTERED");
        setId(runtime, 40L);
        runtime.setExecutionId(300L);

        IntraPositionSnapshotEntity pos = openPosition(runtime, "PAPER", BigDecimal.ZERO);
        setId(pos, 400L);
        pos.setRealizedPnl(BigDecimal.ZERO);
        pos.setUnrealizedPnl(new BigDecimal("600.00"));

        when(positionRepository.findById(400L)).thenReturn(Optional.of(pos));
        when(positionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(positionRepository.findAllByTenantIdAndRuntime(TENANT, runtime)).thenReturn(List.of(pos));
        when(runtimeRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(executionRepository.findByIdAndTenantId(300L, TENANT)).thenReturn(Optional.empty());

        var response = service.exitPosition(TENANT, USER, 400L, paperRequest("Individual exit"));

        assertThat(response.status()).isEqualTo("CLOSED");
        assertThat(pos.getRealizedPnl()).isEqualByComparingTo("600.00");
        assertThat(pos.getUnrealizedPnl()).isEqualByComparingTo("0.00");
    }

    @Test
    void exitPosition_liveMode_requiresLiveGuard() {
        IntraRuntimeStrategyEntity runtime = runtime(41L, "LIVE", "ENTERED");
        IntraPositionSnapshotEntity pos = openPosition(runtime, "LIVE", BigDecimal.ZERO);
        setId(pos, 410L);

        when(positionRepository.findById(410L)).thenReturn(Optional.of(pos));

        assertThatThrownBy(() -> service.exitPosition(TENANT, USER, 410L,
                new IntraMonitorDtos.LiveActionRequest(false, "CONFIRM LIVE", "reason")))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("confirmLiveAction");
    }

    // ─── partialExitPosition ─────────────────────────────────────────────────

    @Test
    void partialExitPosition_halvesQuantityAndBooksPnl() {
        IntraRuntimeStrategyEntity runtime = runtime(50L, "PAPER", "ENTERED");
        setId(runtime, 50L);
        runtime.setExecutionId(400L);

        IntraPositionSnapshotEntity pos = openPosition(runtime, "PAPER", BigDecimal.ZERO);
        setId(pos, 500L);
        pos.setRealizedPnl(BigDecimal.ZERO);
        pos.setUnrealizedPnl(new BigDecimal("800.00"));
        pos.setQuantityLots(new BigDecimal("4.0000"));

        when(positionRepository.findById(500L)).thenReturn(Optional.of(pos));
        when(positionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(positionRepository.findAllByTenantIdAndRuntime(TENANT, runtime)).thenReturn(List.of(pos));
        when(runtimeRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(executionRepository.findByIdAndTenantId(400L, TENANT)).thenReturn(Optional.empty());

        var response = service.partialExitPosition(TENANT, USER, 500L, paperRequest("Partial"));

        assertThat(response.status()).isEqualTo("PARTIAL_EXIT");
        assertThat(pos.getRealizedPnl()).isEqualByComparingTo("400.00");
        assertThat(pos.getUnrealizedPnl()).isEqualByComparingTo("400.00");
        assertThat(pos.getQuantityLots()).isEqualByComparingTo("2.0000");
    }

    // ─── convertToManualWatch ─────────────────────────────────────────────────

    @Test
    void convertToManualWatch_setsManualWatchFlagAndStatus() {
        IntraRuntimeStrategyEntity runtime = runtime(60L, "PAPER", "ENTERED");
        setId(runtime, 60L);

        IntraPositionSnapshotEntity pos = openPosition(runtime, "PAPER", BigDecimal.ZERO);
        setId(pos, 600L);

        when(positionRepository.findById(600L)).thenReturn(Optional.of(pos));
        when(positionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var response = service.convertToManualWatch(TENANT, USER, 600L, "Watching manually");

        assertThat(response.status()).isEqualTo("MANUAL_WATCH");
        assertThat(pos.isManualWatch()).isTrue();
    }

    // ─── tenant / ownership guard ─────────────────────────────────────────────

    @Test
    void pauseRuntime_throwsWhenRuntimeBelongsToAnotherTenant() {
        IntraRuntimeStrategyEntity runtime = runtime(70L, "PAPER", "ENTERED");
        runtime.setTenantId("other-tenant");
        when(runtimeRepository.findById(70L)).thenReturn(Optional.of(runtime));

        assertThatThrownBy(() -> service.pauseRuntime(TENANT, USER, 70L, paperRequest("x")))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("belongs to another user");
    }

    @Test
    void pauseRuntime_throwsWhenRuntimeBelongsToAnotherUser() {
        IntraRuntimeStrategyEntity runtime = runtime(71L, "PAPER", "ENTERED");
        runtime.setUsername("other-user");
        when(runtimeRepository.findById(71L)).thenReturn(Optional.of(runtime));

        assertThatThrownBy(() -> service.pauseRuntime(TENANT, USER, 71L, paperRequest("x")))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("belongs to another user");
    }

    @Test
    void loadRuntime_throwsWhenNotFound() {
        when(runtimeRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.pauseRuntime(TENANT, USER, 99L, paperRequest("x")))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("not found");
    }

    @Test
    void loadPosition_throwsWhenNotFound() {
        when(positionRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.exitPosition(TENANT, USER, 99L, paperRequest("x")))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("not found");
    }

    @Test
    void loadPosition_throwsForWrongUser() {
        IntraRuntimeStrategyEntity runtime = runtime(80L, "PAPER", "ENTERED");
        IntraPositionSnapshotEntity pos = openPosition(runtime, "PAPER", BigDecimal.ZERO);
        setId(pos, 800L);
        pos.setUsername("other-user");
        when(positionRepository.findById(800L)).thenReturn(Optional.of(pos));

        assertThatThrownBy(() -> service.exitPosition(TENANT, USER, 800L, paperRequest("x")))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("belongs to another user");
    }

    // ─── helpers ──────────────────────────────────────────────────────────────

    private IntraRuntimeStrategyEntity runtime(Long executionId, String mode, String status) {
        IntraRuntimeStrategyEntity r = new IntraRuntimeStrategyEntity();
        r.setTenantId(TENANT);
        r.setUsername(USER);
        r.setExecutionId(executionId);
        r.setStrategyId(1L);
        r.setStrategyName("Test Strategy");
        r.setInstrumentKey("NSE_INDEX|Nifty 50");
        r.setMode(mode);
        r.setStatus(status);
        r.setCurrentMtm(BigDecimal.ZERO);
        r.setDataRefreshedAt(Instant.now());
        r.setFreshnessSeconds(0);
        return r;
    }

    private IntraPositionSnapshotEntity openPosition(IntraRuntimeStrategyEntity runtime, String mode, BigDecimal pnl) {
        var p = new IntraPositionSnapshotEntity();
        p.setTenantId(TENANT);
        p.setUsername(USER);
        p.setRuntime(runtime);
        p.setExecutionId(runtime.getExecutionId() == null ? 1L : runtime.getExecutionId());
        p.setMode(mode);
        p.setInstrumentKey("NSE_INDEX|Nifty 50");
        p.setQuantityLots(new BigDecimal("1.0000"));
        p.setRealizedPnl(BigDecimal.ZERO);
        p.setUnrealizedPnl(pnl == null ? BigDecimal.ZERO : pnl);
        p.setStatus("OPEN");
        p.setStrategyName("Test Strategy");
        return p;
    }

    private IntraPositionSnapshotEntity closedPosition(IntraRuntimeStrategyEntity runtime, String mode, BigDecimal realized) {
        var p = openPosition(runtime, mode, BigDecimal.ZERO);
        p.setRealizedPnl(realized == null ? BigDecimal.ZERO : realized);
        p.setStatus("CLOSED");
        return p;
    }

    private IntraPositionSnapshotEntity pausedPosition(IntraRuntimeStrategyEntity runtime, String mode, BigDecimal unrealized) {
        var p = openPosition(runtime, mode, unrealized);
        p.setStatus("PAUSED");
        return p;
    }

    private IntraMonitorDtos.LiveActionRequest paperRequest(String reason) {
        return new IntraMonitorDtos.LiveActionRequest(true, "N/A", reason);
    }

    private IntraMonitorDtos.LiveActionRequest liveRequest(String reason) {
        return new IntraMonitorDtos.LiveActionRequest(true, "CONFIRM LIVE", reason);
    }

    private void setId(Object entity, Long id) {
        try {
            Field f = entity.getClass().getDeclaredField("id");
            f.setAccessible(true);
            f.set(entity, id);
        } catch (Exception e) {
            throw new RuntimeException("Could not set entity id", e);
        }
    }
}
