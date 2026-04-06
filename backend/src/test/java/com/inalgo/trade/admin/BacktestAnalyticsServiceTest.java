package com.inalgo.trade.admin;

import com.inalgo.trade.entity.MarketSentimentSnapshotEntity;
import com.inalgo.trade.repository.MarketSentimentSnapshotRepository;
import com.inalgo.trade.entity.TradingDayParamEntity;
import com.inalgo.trade.entity.TradingSignalEntity;
import com.inalgo.trade.repository.TradingDayParamRepository;
import com.inalgo.trade.repository.TradingSignalRepository;
import jakarta.validation.ValidationException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BacktestAnalyticsServiceTest {

    @Mock
    private TradingSignalRepository tradingSignalRepository;

    @Mock
    private TradingDayParamRepository tradingDayParamRepository;

    @Mock
    private MarketSentimentSnapshotRepository marketSentimentSnapshotRepository;

    private BacktestAnalyticsService service;

    @BeforeEach
    void setUp() {
        service = new BacktestAnalyticsService(tradingSignalRepository, tradingDayParamRepository, marketSentimentSnapshotRepository);
    }

    @Test
    void listTradingSignals_normalizesFiltersAndMapsResponse() {
        TradingSignalEntity entity = org.mockito.Mockito.mock(TradingSignalEntity.class);
        Instant now = Instant.parse("2026-03-14T10:15:30Z");
        when(entity.getId()).thenReturn(10L);
        when(entity.getInstrumentKey()).thenReturn("NSE_INDEX|Nifty 50");
        when(entity.getTimeframeUnit()).thenReturn("minutes");
        when(entity.getTimeframeInterval()).thenReturn(5);
        when(entity.getSignalDate()).thenReturn(LocalDate.of(2026, 3, 14));
        when(entity.getPreviousClose()).thenReturn(new BigDecimal("22001.25"));
        when(entity.getCurrentClose()).thenReturn(new BigDecimal("22031.50"));
        when(entity.getDma9()).thenReturn(new BigDecimal("22020.10"));
        when(entity.getDma26()).thenReturn(new BigDecimal("22010.25"));
        when(entity.getDma110()).thenReturn(new BigDecimal("21980.75"));
        when(entity.getSignal()).thenReturn("BUY");
        when(entity.getCreatedAt()).thenReturn(now.minusSeconds(120));
        when(entity.getUpdatedAt()).thenReturn(now);

        LocalDate fromDate = LocalDate.of(2026, 3, 1);
        LocalDate toDate = LocalDate.of(2026, 3, 14);
        when(tradingSignalRepository.search(
                eq("tenant-a"),
                eq("NSE_INDEX|Nifty 50"),
                eq("minutes"),
                eq(5),
                eq("BUY"),
                eq(fromDate),
                eq(toDate),
                any(PageRequest.class)
        )).thenReturn(new PageImpl<>(List.of(entity)));

        Page<AdminDtos.TradingSignalResponse> response = service.listTradingSignals(
                " tenant-a ",
                " NSE_INDEX|Nifty 50 ",
                " MINUTES ",
                5,
                " buy ",
                fromDate,
                toDate,
                -5,
                800
        );

        assertEquals(1, response.getTotalElements());
        AdminDtos.TradingSignalResponse row = response.getContent().getFirst();
        assertEquals(Long.valueOf(10L), row.id());
        assertEquals("BUY", row.signal());
        assertEquals(new BigDecimal("22031.50"), row.currentClose());

        ArgumentCaptor<PageRequest> pageRequestCaptor = ArgumentCaptor.forClass(PageRequest.class);
        verify(tradingSignalRepository).search(
                eq("tenant-a"),
                eq("NSE_INDEX|Nifty 50"),
                eq("minutes"),
                eq(5),
                eq("BUY"),
                eq(fromDate),
                eq(toDate),
                pageRequestCaptor.capture()
        );
        PageRequest pageRequest = pageRequestCaptor.getValue();
        assertEquals(0, pageRequest.getPageNumber());
        assertEquals(500, pageRequest.getPageSize());
        assertEquals("DESC", pageRequest.getSort().getOrderFor("signalDate").getDirection().name());
    }

    @Test
    void listTradingSignals_rejectsInvalidDateRange() {
        LocalDate fromDate = LocalDate.of(2026, 3, 15);
        LocalDate toDate = LocalDate.of(2026, 3, 14);

        assertThrows(ValidationException.class, () -> service.listTradingSignals(
                "tenant-a",
                null,
                null,
                null,
                null,
                fromDate,
                toDate,
                0,
                25
        ));
    }

    @Test
    void listTradingSignals_rejectsInvalidSignalFilter() {
        assertThrows(ValidationException.class, () -> service.listTradingSignals(
                "tenant-a",
                null,
                null,
                null,
                "INVALID",
                null,
                null,
                0,
                25
        ));
    }

    @Test
    void listTradingDayParams_normalizesInstrumentAndDefaultsPaging() {
        TradingDayParamEntity entity = org.mockito.Mockito.mock(TradingDayParamEntity.class);
        Instant now = Instant.parse("2026-03-14T10:15:30Z");
        when(entity.getId()).thenReturn(20L);
        when(entity.getTradeDate()).thenReturn(LocalDate.of(2026, 3, 14));
        when(entity.getInstrumentKey()).thenReturn("NSE_INDEX|Nifty Bank");
        when(entity.getOrbHigh()).thenReturn(new BigDecimal("49300.25"));
        when(entity.getOrbLow()).thenReturn(new BigDecimal("49120.10"));
        when(entity.getGapType()).thenReturn("Gap Up");
        when(entity.getUpdatedAt()).thenReturn(now);

        when(tradingDayParamRepository.search(
                eq("tenant-a"),
                eq("NSE_INDEX|Nifty Bank"),
                eq(null),
                eq(null),
                any(PageRequest.class)
        )).thenReturn(new PageImpl<>(List.of(entity)));

        Page<AdminDtos.TradingDayParamResponse> response = service.listTradingDayParams(
                "tenant-a",
                " NSE_INDEX|Nifty Bank ",
                null,
                null,
                null,
                null
        );

        assertEquals(1, response.getTotalElements());
        AdminDtos.TradingDayParamResponse row = response.getContent().getFirst();
        assertEquals(Long.valueOf(20L), row.id());
        assertEquals("NSE_INDEX|Nifty Bank", row.instrumentKey());
        assertEquals("Gap Up", row.gapType());

        ArgumentCaptor<PageRequest> pageRequestCaptor = ArgumentCaptor.forClass(PageRequest.class);
        verify(tradingDayParamRepository).search(
                eq("tenant-a"),
                eq("NSE_INDEX|Nifty Bank"),
                eq(null),
                eq(null),
                pageRequestCaptor.capture()
        );
        PageRequest pageRequest = pageRequestCaptor.getValue();
        assertEquals(0, pageRequest.getPageNumber());
        assertEquals(25, pageRequest.getPageSize());
        assertEquals("DESC", pageRequest.getSort().getOrderFor("tradeDate").getDirection().name());
    }

    @Test
    void listMarketSentiments_normalizesFiltersAndMapsResponse() {
        MarketSentimentSnapshotEntity entity = org.mockito.Mockito.mock(MarketSentimentSnapshotEntity.class);
        Instant now = Instant.parse("2026-03-21T10:15:30Z");
        when(entity.getId()).thenReturn(30L);
        when(entity.getMarketScope()).thenReturn("GLOBAL_NEWS");
        when(entity.getMarketName()).thenReturn("Global Market Trend");
        when(entity.getEvaluationType()).thenReturn("NEWS");
        when(entity.getTrendStatus()).thenReturn("BEAR");
        when(entity.getReason()).thenReturn("BEAR from matched conflict headlines");
        when(entity.getSourceCount()).thenReturn(5);
        when(entity.getEvidenceCount()).thenReturn(3);
        when(entity.getSourceNames()).thenReturn("Google News, CNBC World");
        when(entity.getSnapshotAt()).thenReturn(now);
        when(entity.getUpdatedAt()).thenReturn(now);

        when(marketSentimentSnapshotRepository.search(
                eq("tenant-a"),
                eq("GLOBAL_NEWS"),
                eq("BEAR"),
                eq(null),
                eq(null),
                any(PageRequest.class)
        )).thenReturn(new PageImpl<>(List.of(entity)));

        Page<AdminDtos.MarketSentimentResponse> response = service.listMarketSentiments(
                " tenant-a ",
                " global_news ",
                " bear ",
                null,
                null,
                -1,
                800
        );

        assertEquals(1, response.getTotalElements());
        AdminDtos.MarketSentimentResponse row = response.getContent().getFirst();
        assertEquals(Long.valueOf(30L), row.id());
        assertEquals("GLOBAL_NEWS", row.marketScope());
        assertEquals("BEAR", row.trendStatus());

        ArgumentCaptor<PageRequest> pageRequestCaptor = ArgumentCaptor.forClass(PageRequest.class);
        verify(marketSentimentSnapshotRepository).search(
                eq("tenant-a"),
                eq("GLOBAL_NEWS"),
                eq("BEAR"),
                eq(null),
                eq(null),
                pageRequestCaptor.capture()
        );
        PageRequest pageRequest = pageRequestCaptor.getValue();
        assertEquals(0, pageRequest.getPageNumber());
        assertEquals(500, pageRequest.getPageSize());
        assertEquals("DESC", pageRequest.getSort().getOrderFor("snapshotAt").getDirection().name());
    }
}
