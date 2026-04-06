package com.inalgo.trade.admin;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.inalgo.trade.entity.MarketWatchConfigEntity;
import com.inalgo.trade.entity.TradingSignalEntity;
import com.inalgo.trade.repository.CandleRepository;
import com.inalgo.trade.repository.MarketSentimentSnapshotRepository;
import com.inalgo.trade.repository.MarketWatchConfigRepository;
import com.inalgo.trade.repository.TradingDayParamRepository;
import com.inalgo.trade.repository.TradingSignalRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MarketWatchServiceTest {

    @Mock
    private MarketWatchConfigRepository configRepository;

    @Mock
    private TradingSignalRepository signalRepository;

    @Mock
    private TradingDayParamRepository paramRepository;

    @Mock
    private MarketSentimentSnapshotRepository sentimentRepository;

    @Mock
    private CandleRepository candleRepository;

    @Test
    void saveConfig_normalizesPrimaryFieldAndSource() {
        MarketWatchService service = service();
        when(configRepository.findByTenantIdAndUsername("tenant-a", "admin")).thenReturn(Optional.empty());
        when(configRepository.save(any(MarketWatchConfigEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        MarketWatchDtos.MarketWatchConfigResponse response = service.saveConfig(
                "tenant-a",
                new MarketWatchDtos.MarketWatchConfigSaveRequest(
                        " admin ",
                        new MarketWatchDtos.MarketWatchLayoutConfig(
                                1,
                                6,
                                List.of(new MarketWatchDtos.MarketWatchTileConfig(
                                        "tile-1",
                                        "Signal focus",
                                        "trading_signal",
                                        "NSE_INDEX|Nifty 50",
                                        "MINUTES",
                                        15,
                                        null,
                                        "unsupportedField",
                                        null
                                )),
                                null
                        )
                )
        );

        assertEquals("admin", response.username());
        assertEquals(30, response.config().refreshIntervalSeconds());
        assertEquals(4, response.config().gridColumns());
        assertEquals("TRADING_SIGNAL", response.config().tiles().get(0).source());
        assertEquals("signal", response.config().tiles().get(0).primaryField());

        ArgumentCaptor<MarketWatchConfigEntity> captor = ArgumentCaptor.forClass(MarketWatchConfigEntity.class);
        verify(configRepository).save(captor.capture());
        assertEquals("tenant-a", captor.getValue().getTenantId());
        assertEquals("admin", captor.getValue().getUsername());
        assertNotNull(captor.getValue().getConfigJson());
    }

    @Test
    void saveConfig_preservesGroupsAndGroupIdOnTiles() {
        MarketWatchService service = service();
        when(configRepository.findByTenantIdAndUsername("tenant-a", "admin")).thenReturn(Optional.empty());
        when(configRepository.save(any(MarketWatchConfigEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        MarketWatchDtos.MarketWatchGroupConfig group =
                new MarketWatchDtos.MarketWatchGroupConfig("grp-1", "Indices");
        MarketWatchDtos.MarketWatchTileConfig tile =
                new MarketWatchDtos.MarketWatchTileConfig(
                        "tile-1", "NIFTY Signal", "TRADING_SIGNAL",
                        "NSE_INDEX|Nifty 50", "minutes", 15, null, "signal", "grp-1");

        MarketWatchDtos.MarketWatchConfigResponse response = service.saveConfig(
                "tenant-a",
                new MarketWatchDtos.MarketWatchConfigSaveRequest(
                        "admin",
                        new MarketWatchDtos.MarketWatchLayoutConfig(30, 4, List.of(tile), List.of(group))));

        assertEquals(1, response.config().groups().size());
        assertEquals("grp-1", response.config().groups().get(0).id());
        assertEquals("Indices", response.config().groups().get(0).name());
        assertEquals("grp-1", response.config().tiles().get(0).groupId());
    }

    @Test
    void getData_mapsSelectedSignalFieldIntoGenericTilePayload() throws Exception {
        ObjectMapper objectMapper = new ObjectMapper();
        MarketWatchService service = service(objectMapper);
        String json = objectMapper.writeValueAsString(new MarketWatchDtos.MarketWatchLayoutConfig(
                60,
                2,
                List.of(new MarketWatchDtos.MarketWatchTileConfig(
                        "tile-1",
                        "Signal focus",
                        "TRADING_SIGNAL",
                        "NSE_INDEX|Nifty 50",
                        "minutes",
                        15,
                        null,
                        "currentClose",
                        null
                )),
                null
        ));
        when(configRepository.findByTenantIdAndUsername("tenant-a", "admin"))
                .thenReturn(Optional.of(new MarketWatchConfigEntity("tenant-a", "admin", json)));

        TradingSignalEntity entity = org.mockito.Mockito.mock(TradingSignalEntity.class);
        when(entity.getSignal()).thenReturn("SELL");
        when(entity.getCurrentClose()).thenReturn(new BigDecimal("23134.65"));
        when(entity.getPreviousClose()).thenReturn(new BigDecimal("23106.85"));
        when(entity.getDma9()).thenReturn(new BigDecimal("23151.28"));
        when(entity.getDma26()).thenReturn(new BigDecimal("23199.35"));
        when(entity.getDma110()).thenReturn(new BigDecimal("23373.20"));
        when(entity.getSignalDate()).thenReturn(LocalDate.of(2026, 3, 20));
        when(signalRepository.search(eq("tenant-a"), eq("NSE_INDEX|Nifty 50"), eq("minutes"), eq(15), eq(null), eq(null), eq(null), any()))
                .thenReturn(new PageImpl<>(List.of(entity)));

        MarketWatchDtos.MarketWatchDataResponse response = service.getData("tenant-a", "admin");

        assertEquals(1, response.tiles().size());
        MarketWatchDtos.MarketWatchTileResult tile = response.tiles().get(0);
        assertEquals("currentClose", tile.primaryField());
        assertEquals("Current Close", tile.primaryLabel());
        assertEquals("23134.65", tile.primaryValue());
        assertEquals("SELL", tile.statusLabel());
        assertEquals("negative", tile.statusTone());
        assertEquals("Signal", tile.fields().get(0).label());
    }

    private MarketWatchService service() {
        return service(new ObjectMapper());
    }

    private MarketWatchService service(ObjectMapper objectMapper) {
        return new MarketWatchService(configRepository, signalRepository, paramRepository, sentimentRepository, candleRepository, objectMapper);
    }
}
