package com.inalgo.trade.admin;

import com.inalgo.trade.entity.TradingSignalEntity;
import com.inalgo.trade.repository.CandleRepository;
import com.inalgo.trade.repository.TradingSignalRepository;
import com.inalgo.trade.service.IndiaMarketHoursProperties;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class IntraMonitorMapperTest {

    @Test
    void resolveSignal_prefersStoredTradingSignalForExecutionTimeframe() {
        TradingSignalRepository tradingSignalRepository = mock(TradingSignalRepository.class);
        CandleRepository candleRepository = mock(CandleRepository.class);
        TradingSignalEntity signal = mock(TradingSignalEntity.class);
        when(signal.getSignal()).thenReturn("SELL");
        when(tradingSignalRepository.findTopByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeIntervalAndSignalDateLessThanEqualOrderBySignalDateDescUpdatedAtDesc(
                "tenant-a",
                "NSE_INDEX|Nifty Bank",
                "minutes",
                5,
                Instant.parse("2026-03-27T04:10:00Z").atZone(new IndiaMarketHoursProperties("Asia/Kolkata", LocalTime.of(9, 15), LocalTime.of(15, 30), List.of()).zone()).toLocalDate()
        )).thenReturn(Optional.of(signal));

        IntraMonitorMapper mapper = new IntraMonitorMapper(
                tradingSignalRepository,
                candleRepository,
                new IndiaMarketHoursProperties("Asia/Kolkata", LocalTime.of(9, 15), LocalTime.of(15, 30), List.of())
        );

        IntraTradeDtos.IntraTradeExecutionResponse execution = new IntraTradeDtos.IntraTradeExecutionResponse(
                10L,
                "admin",
                12L,
                "LIVE",
                "WAITING_ENTRY",
                "Simple Breakdown",
                "NSE_INDEX|Nifty Bank",
                "minutes",
                5,
                "Waiting",
                Instant.parse("2026-03-27T04:10:00Z"),
                Instant.parse("2026-03-27T04:10:00Z"),
                Instant.parse("2026-03-27T04:10:00Z"),
                null,
                new AdminDtos.BacktestRunResponse(null, List.of(), BigDecimal.ZERO, BigDecimal.ZERO, 0, 0, 0, 0, 0, BigDecimal.ZERO, 0, 0, List.of())
        );

        assertEquals("SELL", mapper.resolveSignal("tenant-a", execution));
    }
}
