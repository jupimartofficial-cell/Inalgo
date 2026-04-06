package com.inalgo.trade.admin;

import com.inalgo.trade.support.TestDatabaseSupport;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.Date;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;

@SpringBootTest
@TestPropertySource(properties = {
        "upstox.migration.enabled=false",
        "upstox.option-chain.enabled=false",
        "spring.task.scheduling.enabled=false"
})
@Transactional
class BacktestAnalyticsServicePostgresIntegrationTest {
    private static final String TEST_SCHEMA = TestDatabaseSupport.createIsolatedSchema("backtest_analytics");

    @DynamicPropertySource
    static void registerDatasource(DynamicPropertyRegistry registry) {
        TestDatabaseSupport.registerIsolatedSchemaProperties(registry, TEST_SCHEMA);
    }

    @AfterAll
    static void dropSchema() {
        TestDatabaseSupport.dropSchema(TEST_SCHEMA);
    }

    @Autowired
    private BacktestAnalyticsService backtestAnalyticsService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void listTradingDayParams_supportsNullOptionalFilters() {
        String tenantId = "tenant-analytics-grid";
        jdbcTemplate.update(
                """
                        INSERT INTO trading_day_param (
                            tenant_id, trade_date, instrument_key, orb_high, orb_low, orb_breakout, orb_breakdown, today_open, today_close
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                tenantId,
                Date.valueOf(LocalDate.of(2026, 3, 14)),
                "NSE_INDEX|Nifty 50",
                new BigDecimal("22050.50"),
                new BigDecimal("22010.20"),
                "Yes",
                "No",
                new BigDecimal("22020.10"),
                new BigDecimal("22045.00")
        );

        Page<AdminDtos.TradingDayParamResponse> page = backtestAnalyticsService.listTradingDayParams(
                tenantId,
                null,
                null,
                null,
                0,
                25
        );

        assertEquals(1, page.getTotalElements());
        assertEquals("NSE_INDEX|Nifty 50", page.getContent().getFirst().instrumentKey());
    }

    @Test
    void listTradingSignals_supportsNullOptionalFilters() {
        String tenantId = "tenant-analytics-grid";
        jdbcTemplate.update(
                """
                        INSERT INTO trading_signal (
                            tenant_id, instrument_key, timeframe_unit, timeframe_interval, signal_date,
                            previous_close, current_close, dma_9, dma_26, dma_110, signal
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                tenantId,
                "NSE_INDEX|Nifty 50",
                "minutes",
                5,
                Date.valueOf(LocalDate.of(2026, 3, 14)),
                new BigDecimal("22012.30"),
                new BigDecimal("22044.60"),
                new BigDecimal("22030.20"),
                new BigDecimal("22018.80"),
                new BigDecimal("21990.10"),
                "BUY"
        );

        Page<AdminDtos.TradingSignalResponse> page = backtestAnalyticsService.listTradingSignals(
                tenantId,
                null,
                null,
                null,
                null,
                null,
                null,
                0,
                25
        );

        assertEquals(1, page.getTotalElements());
        assertEquals("BUY", page.getContent().getFirst().signal());
    }

    @Test
    void listTradingSignals_supportsSignalFilter() {
        String tenantId = "tenant-analytics-signal-filter";
        jdbcTemplate.update(
                """
                        INSERT INTO trading_signal (
                            tenant_id, instrument_key, timeframe_unit, timeframe_interval, signal_date,
                            previous_close, current_close, dma_9, dma_26, dma_110, signal
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                tenantId,
                "NSE_INDEX|Nifty 50",
                "minutes",
                15,
                Date.valueOf(LocalDate.of(2026, 3, 14)),
                new BigDecimal("22012.30"),
                new BigDecimal("22044.60"),
                new BigDecimal("22030.20"),
                new BigDecimal("22018.80"),
                new BigDecimal("21990.10"),
                "BUY"
        );
        jdbcTemplate.update(
                """
                        INSERT INTO trading_signal (
                            tenant_id, instrument_key, timeframe_unit, timeframe_interval, signal_date,
                            previous_close, current_close, dma_9, dma_26, dma_110, signal
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                tenantId,
                "NSE_INDEX|Nifty Bank",
                "minutes",
                15,
                Date.valueOf(LocalDate.of(2026, 3, 14)),
                new BigDecimal("49012.30"),
                new BigDecimal("48944.60"),
                new BigDecimal("48930.20"),
                new BigDecimal("48918.80"),
                new BigDecimal("48990.10"),
                "SELL"
        );

        Page<AdminDtos.TradingSignalResponse> page = backtestAnalyticsService.listTradingSignals(
                tenantId,
                null,
                null,
                null,
                "SELL",
                null,
                null,
                0,
                25
        );

        assertEquals(1, page.getTotalElements());
        assertEquals("SELL", page.getContent().getFirst().signal());
        assertEquals("NSE_INDEX|Nifty Bank", page.getContent().getFirst().instrumentKey());
    }
}
