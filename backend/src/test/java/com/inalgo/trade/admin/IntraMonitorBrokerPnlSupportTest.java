package com.inalgo.trade.admin;

import com.inalgo.trade.entity.IntraPositionSnapshotEntity;
import com.inalgo.trade.entity.IntraRuntimeStrategyEntity;
import com.inalgo.trade.repository.IntraPositionSnapshotRepository;
import com.inalgo.trade.upstox.UpstoxOrderDtos;
import com.inalgo.trade.upstox.UpstoxOrderService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class IntraMonitorBrokerPnlSupportTest {

    @Mock private IntraPositionSnapshotRepository positionRepository;
    @Mock private UpstoxOrderService upstoxOrderService;

    private IntraMonitorBrokerPnlSupport support;

    @BeforeEach
    void setUp() {
        support = new IntraMonitorBrokerPnlSupport(positionRepository, upstoxOrderService);
    }

    @Test
    void resolveLiveRuntimeBrokerMtm_usesBrokerPnlWhenInstrumentOwnershipUnique() {
        IntraRuntimeStrategyEntity runtime = runtime(11L, 101L, "LIVE", "ENTERED");
        IntraPositionSnapshotEntity openPosition = liveOpenPosition(runtime, "NSE_FO|52618");

        when(positionRepository.findAllByTenantIdAndUsernameAndExecutionIdIn("local-desktop", "admin", List.of(101L)))
                .thenReturn(List.of(openPosition));
        when(upstoxOrderService.fetchPositions("local-desktop")).thenReturn(new UpstoxOrderDtos.IntraPositionsResponse(
                "local-desktop",
                List.of(new UpstoxOrderDtos.IntraPositionSummary(
                        "NSE_FO|52618",
                        "BANKNIFTY 50900 PE",
                        30,
                        new BigDecimal("207.50"),
                        BigDecimal.ZERO,
                        new BigDecimal("266.15"),
                        new BigDecimal("7230.00")
                )),
                1
        ));

        var mtm = support.resolveLiveRuntimeBrokerMtm("local-desktop", "admin", List.of(runtime));

        assertThat(mtm).containsEntry(11L, new BigDecimal("7230.00"));
    }

    @Test
    void resolveLiveRuntimeBrokerMtm_skipsSharedInstrumentAcrossRuntimes() {
        IntraRuntimeStrategyEntity runtimeA = runtime(21L, 201L, "LIVE", "ENTERED");
        IntraRuntimeStrategyEntity runtimeB = runtime(22L, 202L, "LIVE", "ENTERED");
        IntraPositionSnapshotEntity positionA = liveOpenPosition(runtimeA, "NSE_FO|52618");
        IntraPositionSnapshotEntity positionB = liveOpenPosition(runtimeB, "NSE_FO|52618");

        when(positionRepository.findAllByTenantIdAndUsernameAndExecutionIdIn("local-desktop", "admin", List.of(201L, 202L)))
                .thenReturn(List.of(positionA, positionB));
        when(upstoxOrderService.fetchPositions("local-desktop")).thenReturn(new UpstoxOrderDtos.IntraPositionsResponse(
                "local-desktop",
                List.of(new UpstoxOrderDtos.IntraPositionSummary(
                        "NSE_FO|52618",
                        "BANKNIFTY 50900 PE",
                        30,
                        new BigDecimal("207.50"),
                        BigDecimal.ZERO,
                        new BigDecimal("266.15"),
                        new BigDecimal("7230.00")
                )),
                1
        ));

        var mtm = support.resolveLiveRuntimeBrokerMtm("local-desktop", "admin", List.of(runtimeA, runtimeB));

        assertThat(mtm).isEmpty();
    }

    @Test
    void resolveLivePositionBrokerOverrides_setsLtpAndPnlForUniqueLiveOpenPosition() {
        IntraRuntimeStrategyEntity runtime = runtime(31L, 301L, "LIVE", "ENTERED");
        IntraPositionSnapshotEntity position = liveOpenPosition(runtime, "NSE_FO|52618");

        when(positionRepository.findAllByTenantIdAndUsernameAndModeAndStatus("local-desktop", "admin", "LIVE", "OPEN"))
                .thenReturn(List.of(position));
        when(upstoxOrderService.fetchPositions("local-desktop")).thenReturn(new UpstoxOrderDtos.IntraPositionsResponse(
                "local-desktop",
                List.of(new UpstoxOrderDtos.IntraPositionSummary(
                        "NSE_FO|52618",
                        "BANKNIFTY 50900 PE",
                        30,
                        new BigDecimal("207.50"),
                        BigDecimal.ZERO,
                        new BigDecimal("266.15"),
                        new BigDecimal("1759.50")
                )),
                1
        ));

        var overrides = support.resolveLivePositionBrokerOverrides("local-desktop", "admin", List.of(position));

        assertThat(overrides).containsKey(position.getId());
        assertThat(overrides.get(position.getId()).ltp()).isEqualByComparingTo("266.15");
        assertThat(overrides.get(position.getId()).pnl()).isEqualByComparingTo("1759.50");
    }

    private static IntraRuntimeStrategyEntity runtime(Long runtimeId, Long executionId, String mode, String status) {
        IntraRuntimeStrategyEntity runtime = new IntraRuntimeStrategyEntity();
        setId(runtime, runtimeId);
        runtime.setTenantId("local-desktop");
        runtime.setUsername("admin");
        runtime.setExecutionId(executionId);
        runtime.setStrategyName("OHL First candle BreakDown");
        runtime.setMode(mode);
        runtime.setStatus(status);
        runtime.setDataRefreshedAt(Instant.now().minusSeconds(5));
        return runtime;
    }

    private static IntraPositionSnapshotEntity liveOpenPosition(IntraRuntimeStrategyEntity runtime, String instrumentToken) {
        IntraPositionSnapshotEntity row = new IntraPositionSnapshotEntity();
        setId(row, runtime.getId() + 1000);
        row.setTenantId("local-desktop");
        row.setUsername("admin");
        row.setRuntime(runtime);
        row.setExecutionId(runtime.getExecutionId());
        row.setMode("LIVE");
        row.setStatus("OPEN");
        row.setInstrumentKey(instrumentToken);
        row.setTradeInstrumentKey(instrumentToken);
        row.setStrategyName(runtime.getStrategyName());
        return row;
    }

    private static void setId(Object entity, Long value) {
        try {
            var field = entity.getClass().getDeclaredField("id");
            field.setAccessible(true);
            field.set(entity, value);
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }
}
