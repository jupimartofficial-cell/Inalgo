package com.inalgo.trade.admin;

import com.inalgo.trade.service.IndiaMarketHoursProperties;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class IntraTradeScanWindowResolverTest {

    @Test
    void resolve_waitsForNextTradingDayOnConfiguredHoliday() {
        IntraTradeScanWindowResolver resolver = new IntraTradeScanWindowResolver(
                new IndiaMarketHoursProperties(
                        "Asia/Kolkata",
                        LocalTime.of(9, 15),
                        LocalTime.of(15, 30),
                        List.of(LocalDate.of(2026, 3, 24))
                )
        );

        IntraTradeScanWindowResolver.LiveScanWindow window = resolver.resolve(
                LocalDateTime.of(2026, 3, 24, 10, 0),
                LocalTime.of(9, 35),
                LocalTime.of(15, 15),
                5
        );

        assertFalse(window.ready());
        assertEquals(IntraTradeScanWindowResolver.WaitingReason.NEXT_TRADING_DAY, window.waitingReason());
    }
}
