package com.inalgo.trade.upstox;

import com.inalgo.trade.entity.CandleEntity;
import com.inalgo.trade.entity.UpstoxMigrationStateEntity;
import com.inalgo.trade.repository.CandleRepository;
import com.inalgo.trade.repository.UpstoxMigrationStateRepository;
import com.inalgo.trade.support.TestDatabaseSupport;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@SpringBootTest
@TestPropertySource(properties = {
        "upstox.migration.enabled=true",
        "upstox.option-chain.enabled=false",
        "upstox.migration.streams[0].tenant-id=tenant-int",
        "upstox.migration.streams[0].instrument-key=NSE_EQ|INE848E01016",
        "upstox.migration.streams[0].interval=1minute",
        "upstox.migration.streams[0].bootstrap-from-date=2026-03-01",
        "spring.task.scheduling.enabled=false"
})
class UpstoxHistoricalMigrationPostgresIntegrationTest {
    private static final String TEST_SCHEMA = TestDatabaseSupport.createIsolatedSchema("upstox_historical_migration");

    @DynamicPropertySource
    static void registerDatasource(DynamicPropertyRegistry registry) {
        TestDatabaseSupport.registerIsolatedSchemaProperties(registry, TEST_SCHEMA);
    }

    @AfterAll
    static void dropSchema() {
        TestDatabaseSupport.dropSchema(TEST_SCHEMA);
    }

    @Autowired
    private UpstoxHistoricalMigrationService migrationService;

    @Autowired
    private CandleRepository candleRepository;

    @Autowired
    private UpstoxMigrationStateRepository stateRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @MockBean
    private UpstoxClient upstoxClient;

    @Test
    void migrateTick_persistsCandleRowsAndIsIdempotentInPostgres() {
        LocalDate bootstrapFrom = LocalDate.now().minusDays(1);
        Instant ts = bootstrapFrom.atTime(9, 15).atOffset(java.time.ZoneOffset.ofHoursMinutes(5, 30)).toInstant();

        when(upstoxClient.fetchHistoricalCandles(
                eq("NSE_EQ|INE848E01016"),
                eq("minutes"),
                eq(1),
                any(LocalDate.class),
                any(LocalDate.class)
        )).thenReturn(new UpstoxCandleResponse("success", 1,
                List.of(List.of(ts.toString(), "100.10", "101.20", "99.90", "100.80", 1234))));

        UpstoxMigrationStateEntity state = null;
        for (int index = 0; index < 12; index++) {
            migrationService.migrateTick();
            state = stateRepository
                    .findByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeInterval(
                            "tenant-int", "NSE_EQ|INE848E01016", "minutes", 1)
                    .orElseThrow();
            if (state.isCompleted()) {
                break;
            }
        }

        migrationService.migrateTick();

        CandleEntity candle = candleRepository.findByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeIntervalAndCandleTs(
                "tenant-int",
                "NSE_EQ|INE848E01016",
                "minutes",
                1,
                ts
        ).orElseThrow();

        assertEquals(new BigDecimal("100.100000"), candle.getOpenPrice().setScale(6));
        assertEquals(1234L, candle.getVolume());

        long candleCount = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM candles", Long.class);
        assertEquals(1L, candleCount);

        state = stateRepository
                .findByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeInterval(
                        "tenant-int", "NSE_EQ|INE848E01016", "minutes", 1)
                .orElseThrow();

        assertTrue(state.isCompleted());
        assertNotNull(state.getNextFromDate());
        assertTrue(state.getNextFromDate().isAfter(LocalDate.now().minusDays(1)));
    }
}
