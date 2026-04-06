package com.inalgo.trade.admin;

import com.inalgo.trade.entity.IntraPositionSnapshotEntity;
import com.inalgo.trade.entity.IntraRuntimeStrategyEntity;
import com.inalgo.trade.repository.IntraPositionSnapshotRepository;
import com.inalgo.trade.repository.IntraRuntimeStrategyRepository;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class IntraMonitorEmergencyServiceTest {

    @Mock IntraRuntimeStrategyRepository runtimeRepository;
    @Mock IntraPositionSnapshotRepository positionRepository;
    @Mock IntraMonitorMapper              mapper;
    @Mock IntraMonitorAuditService        auditService;
    @Mock IntraLiveOrderService           liveOrderService;

    private IntraMonitorEmergencyService service;

    private static final String TENANT = "local-desktop";
    private static final String USER   = "admin";

    @BeforeEach
    void setUp() {
        service = new IntraMonitorEmergencyService(runtimeRepository, positionRepository, mapper, auditService, liveOrderService);

        lenient().when(mapper.safe(any())).thenAnswer(inv -> {
            BigDecimal v = inv.getArgument(0);
            return v == null ? BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP)
                    : v.setScale(2, RoundingMode.HALF_UP);
        });
        lenient().when(mapper.safeReason(any(), any())).thenAnswer(inv -> {
            String r = inv.getArgument(0);
            return (r != null && !r.isBlank()) ? r : inv.getArgument(1);
        });
        lenient().doNothing().when(auditService).appendEvent(any(), any(), any(), any(),
                any(), any(), any(), any(), any(), any(), any(), any());
    }

    // ─── SQUARE_OFF_ALL ───────────────────────────────────────────────────────

    @Test
    void squareOffAll_closesAllOpenRuntimes_andReturnsAffectedCount() {
        IntraRuntimeStrategyEntity r1 = runtime(1L, "LIVE",  "ENTERED");
        IntraRuntimeStrategyEntity r2 = runtime(2L, "PAPER", "WAITING");
        IntraPositionSnapshotEntity p1 = openPosition(r1, new BigDecimal("400"));
        IntraPositionSnapshotEntity p2 = openPosition(r2, new BigDecimal("200"));

        when(runtimeRepository.findAllByTenantIdAndUsername(TENANT, USER)).thenReturn(List.of(r1, r2));
        when(positionRepository.findAllByTenantIdAndRuntime(TENANT, r1)).thenReturn(List.of(p1));
        when(positionRepository.findAllByTenantIdAndRuntime(TENANT, r2)).thenReturn(List.of(p2));
        when(runtimeRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(positionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var response = service.emergencyAction(TENANT, USER, squareOffRequest());

        assertThat(response.action()).isEqualTo("SQUARE_OFF_ALL");
        assertThat(response.affectedRuntimes()).isEqualTo(2);
        assertThat(response.affectedPositions()).isEqualTo(2);
        assertThat(r1.getStatus()).isEqualTo("EXITED");
        assertThat(r2.getStatus()).isEqualTo("EXITED");
        assertThat(p1.getStatus()).isEqualTo("CLOSED");
        assertThat(p2.getStatus()).isEqualTo("CLOSED");
    }

    @Test
    void squareOffAll_transfersUnrealizedToRealized_onClose() {
        IntraRuntimeStrategyEntity runtime = runtime(3L, "PAPER", "ENTERED");
        IntraPositionSnapshotEntity pos = openPosition(runtime, BigDecimal.ZERO);
        pos.setUnrealizedPnl(new BigDecimal("350.00"));
        pos.setRealizedPnl(BigDecimal.ZERO);

        when(runtimeRepository.findAllByTenantIdAndUsername(TENANT, USER)).thenReturn(List.of(runtime));
        when(positionRepository.findAllByTenantIdAndRuntime(TENANT, runtime)).thenReturn(List.of(pos));
        when(runtimeRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(positionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.emergencyAction(TENANT, USER, squareOffRequest());

        assertThat(pos.getRealizedPnl()).isEqualByComparingTo("350.00");
        assertThat(pos.getUnrealizedPnl()).isEqualByComparingTo("0.00");
    }

    @Test
    void squareOffAll_skipsAlreadyExitedRuntimes() {
        IntraRuntimeStrategyEntity active  = runtime(4L, "PAPER", "ENTERED");
        IntraRuntimeStrategyEntity exited  = runtime(5L, "PAPER", "EXITED");
        IntraPositionSnapshotEntity p = openPosition(active, new BigDecimal("100"));

        when(runtimeRepository.findAllByTenantIdAndUsername(TENANT, USER)).thenReturn(List.of(active, exited));
        when(positionRepository.findAllByTenantIdAndRuntime(TENANT, active)).thenReturn(List.of(p));
        when(runtimeRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(positionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var response = service.emergencyAction(TENANT, USER, squareOffRequest());

        assertThat(response.affectedRuntimes()).isEqualTo(1); // exited runtime not counted
    }

    @Test
    void squareOffAll_throwsWithoutLiveGuardConfirmation() {
        assertThatThrownBy(() -> service.emergencyAction(TENANT, USER,
                new IntraMonitorDtos.EmergencyActionRequest("SQUARE_OFF_ALL", null, false, "CONFIRM LIVE", "reason")))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("confirmLiveAction must be true");
    }

    @Test
    void squareOffAll_throwsWithWrongAcknowledgement() {
        assertThatThrownBy(() -> service.emergencyAction(TENANT, USER,
                new IntraMonitorDtos.EmergencyActionRequest("SQUARE_OFF_ALL", null, true, "WRONG TEXT", "reason")))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("liveAcknowledgement must be 'CONFIRM LIVE'");
    }

    // ─── EXIT_ALL_LIVE ────────────────────────────────────────────────────────

    @Test
    void exitAllLive_onlyClosesLiveRuntimes() {
        IntraRuntimeStrategyEntity live  = runtime(10L, "LIVE",  "ENTERED");
        IntraRuntimeStrategyEntity paper = runtime(11L, "PAPER", "ENTERED");
        IntraPositionSnapshotEntity lp = openPosition(live, new BigDecimal("300"));

        when(runtimeRepository.findAllByTenantIdAndUsername(TENANT, USER)).thenReturn(List.of(live, paper));
        when(positionRepository.findAllByTenantIdAndRuntime(TENANT, live)).thenReturn(List.of(lp));
        when(runtimeRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(positionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var response = service.emergencyAction(TENANT, USER,
                new IntraMonitorDtos.EmergencyActionRequest("EXIT_ALL_LIVE", null, true, "CONFIRM LIVE", "EOD"));

        assertThat(response.affectedRuntimes()).isEqualTo(1);
        assertThat(live.getStatus()).isEqualTo("EXITED");
        assertThat(paper.getStatus()).isEqualTo("ENTERED"); // unchanged
    }

    // ─── EXIT_ALL_PAPER ───────────────────────────────────────────────────────

    @Test
    void exitAllPaper_closesWithoutLiveGuardRequired() {
        IntraRuntimeStrategyEntity paper = runtime(20L, "PAPER", "ENTERED");
        IntraPositionSnapshotEntity pp = openPosition(paper, new BigDecimal("150"));

        when(runtimeRepository.findAllByTenantIdAndUsername(TENANT, USER)).thenReturn(List.of(paper));
        when(positionRepository.findAllByTenantIdAndRuntime(TENANT, paper)).thenReturn(List.of(pp));
        when(runtimeRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(positionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        // No liveGuard required for PAPER
        var response = service.emergencyAction(TENANT, USER,
                new IntraMonitorDtos.EmergencyActionRequest("EXIT_ALL_PAPER", null, null, null, "Cleanup"));

        assertThat(response.action()).isEqualTo("EXIT_ALL_PAPER");
        assertThat(response.affectedRuntimes()).isEqualTo(1);
        assertThat(paper.getStatus()).isEqualTo("EXITED");
    }

    // ─── PAUSE_ALL ────────────────────────────────────────────────────────────

    @Test
    void pauseAll_pausesAllActiveRuntimes() {
        IntraRuntimeStrategyEntity r1 = runtime(30L, "PAPER", "ENTERED");
        IntraRuntimeStrategyEntity r2 = runtime(31L, "LIVE",  "WAITING");
        IntraPositionSnapshotEntity p1 = openPosition(r1, new BigDecimal("100"));
        IntraPositionSnapshotEntity p2 = openPosition(r2, new BigDecimal("200"));

        when(runtimeRepository.findAllByTenantIdAndUsername(TENANT, USER)).thenReturn(List.of(r1, r2));
        when(positionRepository.findAllByTenantIdAndRuntime(TENANT, r1)).thenReturn(List.of(p1));
        when(positionRepository.findAllByTenantIdAndRuntime(TENANT, r2)).thenReturn(List.of(p2));
        when(runtimeRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(positionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var response = service.emergencyAction(TENANT, USER,
                new IntraMonitorDtos.EmergencyActionRequest("PAUSE_ALL", null, null, null, "Risk off"));

        assertThat(response.affectedRuntimes()).isEqualTo(2);
        assertThat(r1.getStatus()).isEqualTo("PAUSED");
        assertThat(r2.getStatus()).isEqualTo("PAUSED");
        assertThat(p1.getStatus()).isEqualTo("PAUSED");
    }

    @Test
    void pauseAll_skipsAlreadyPausedRuntimes() {
        IntraRuntimeStrategyEntity active = runtime(32L, "PAPER", "ENTERED");
        IntraRuntimeStrategyEntity paused = runtime(33L, "PAPER", "PAUSED");

        when(runtimeRepository.findAllByTenantIdAndUsername(TENANT, USER)).thenReturn(List.of(active, paused));
        when(positionRepository.findAllByTenantIdAndRuntime(TENANT, active)).thenReturn(List.of());
        when(runtimeRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var response = service.emergencyAction(TENANT, USER,
                new IntraMonitorDtos.EmergencyActionRequest("PAUSE_ALL", null, null, null, null));

        assertThat(response.affectedRuntimes()).isEqualTo(1); // only active counted
    }

    // ─── RESUME_SELECTED ─────────────────────────────────────────────────────

    @Test
    void resumeSelected_resumesSpecificRuntime() {
        IntraRuntimeStrategyEntity paused = runtime(40L, "PAPER", "PAUSED");
        setId(paused, 40L);

        when(runtimeRepository.findAllByTenantIdAndUsername(TENANT, USER)).thenReturn(List.of(paused));
        when(runtimeRepository.findById(40L)).thenReturn(java.util.Optional.of(paused));
        when(runtimeRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var response = service.emergencyAction(TENANT, USER,
                new IntraMonitorDtos.EmergencyActionRequest("RESUME_SELECTED", 40L, null, null, "Back to trading"));

        assertThat(response.affectedRuntimes()).isEqualTo(1);
        assertThat(paused.getStatus()).isEqualTo("ENTERED");
    }

    @Test
    void resumeSelected_throwsWithoutSelectedRuntimeId() {
        assertThatThrownBy(() -> service.emergencyAction(TENANT, USER,
                new IntraMonitorDtos.EmergencyActionRequest("RESUME_SELECTED", null, null, null, "reason")))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("selectedRuntimeId is required");
    }

    // ─── unknown action ───────────────────────────────────────────────────────

    @Test
    void unknownAction_throwsValidationException() {
        assertThatThrownBy(() -> service.emergencyAction(TENANT, USER,
                new IntraMonitorDtos.EmergencyActionRequest("NUKE_ALL", null, null, null, null)))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("Unsupported emergency action");
    }

    // ─── helpers ──────────────────────────────────────────────────────────────

    private IntraRuntimeStrategyEntity runtime(Long executionId, String mode, String status) {
        IntraRuntimeStrategyEntity r = new IntraRuntimeStrategyEntity();
        r.setTenantId(TENANT);
        r.setUsername(USER);
        r.setExecutionId(executionId);
        r.setStrategyId(1L);
        r.setStrategyName("Test");
        r.setInstrumentKey("NSE_INDEX|Nifty 50");
        r.setMode(mode);
        r.setStatus(status);
        r.setCurrentMtm(BigDecimal.ZERO);
        r.setDataRefreshedAt(Instant.now());
        r.setFreshnessSeconds(0);
        return r;
    }

    private IntraPositionSnapshotEntity openPosition(IntraRuntimeStrategyEntity runtime, BigDecimal unrealized) {
        var p = new IntraPositionSnapshotEntity();
        p.setTenantId(TENANT);
        p.setUsername(USER);
        p.setRuntime(runtime);
        p.setExecutionId(runtime.getExecutionId() == null ? 1L : runtime.getExecutionId());
        p.setMode(runtime.getMode());
        p.setInstrumentKey("NSE_INDEX|Nifty 50");
        p.setQuantityLots(new BigDecimal("1.0000"));
        p.setRealizedPnl(BigDecimal.ZERO);
        p.setUnrealizedPnl(unrealized == null ? BigDecimal.ZERO : unrealized);
        p.setStatus("OPEN");
        p.setStrategyName("Test");
        return p;
    }

    private IntraMonitorDtos.EmergencyActionRequest squareOffRequest() {
        return new IntraMonitorDtos.EmergencyActionRequest("SQUARE_OFF_ALL", null, true, "CONFIRM LIVE", "Emergency close");
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
