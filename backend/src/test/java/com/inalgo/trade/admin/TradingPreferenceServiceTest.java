package com.inalgo.trade.admin;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.inalgo.trade.entity.TradingPreferenceEntity;
import com.inalgo.trade.repository.TradingPreferenceRepository;
import jakarta.validation.ValidationException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TradingPreferenceServiceTest {

    @Mock
    private TradingPreferenceRepository tradingPreferenceRepository;

    @Test
    void getPreferences_returnsEmptyPayloadWhenNotConfigured() {
        TradingPreferenceService service = new TradingPreferenceService(tradingPreferenceRepository, new ObjectMapper());
        when(tradingPreferenceRepository.findByTenantIdAndUsername("tenant-a", "admin")).thenReturn(Optional.empty());

        AdminDtos.TradingPreferencesResponse response = service.getPreferences("tenant-a", "admin");

        assertEquals("admin", response.username());
        assertNull(response.preferences());
    }

    @Test
    void savePreferences_persistsNormalizedPayload() {
        TradingPreferenceService service = new TradingPreferenceService(tradingPreferenceRepository, new ObjectMapper());
        when(tradingPreferenceRepository.findByTenantIdAndUsername("tenant-a", "admin")).thenReturn(Optional.empty());
        when(tradingPreferenceRepository.save(any(TradingPreferenceEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AdminDtos.TradingPreferencesSaveRequest request = new AdminDtos.TradingPreferencesSaveRequest(
                " admin ",
                new AdminDtos.TradingPreferencesPayload(
                        0,
                        List.of(new AdminDtos.TradingTabPreference(
                                " Desk 1 ",
                                List.of(
                                        new AdminDtos.TradingChartPreference(" c1 ", " NSE_INDEX|Nifty 50 ", " MINUTES ", 1, 30, 320, " SPLIT "),
                                        new AdminDtos.TradingChartPreference(" c2 ", " NSE_INDEX|Nifty Bank ", " days ", 1, 30, 360, " WIDE ")
                                )
                        ))
                )
        );

        AdminDtos.TradingPreferencesResponse response = service.savePreferences("tenant-a", request);

        assertEquals("admin", response.username());
        assertEquals(1, response.preferences().tabs().size());
        assertEquals("Desk 1", response.preferences().tabs().get(0).name());
        assertEquals("minutes", response.preferences().tabs().get(0).charts().get(0).timeframeUnit());
        assertEquals("split", response.preferences().tabs().get(0).charts().get(0).layout());

        ArgumentCaptor<TradingPreferenceEntity> captor = ArgumentCaptor.forClass(TradingPreferenceEntity.class);
        verify(tradingPreferenceRepository).save(captor.capture());
        assertEquals("tenant-a", captor.getValue().getTenantId());
        assertEquals("admin", captor.getValue().getUsername());
    }

    @Test
    void savePreferences_rejectsInvalidLayout() {
        TradingPreferenceService service = new TradingPreferenceService(tradingPreferenceRepository, new ObjectMapper());

        AdminDtos.TradingPreferencesSaveRequest request = new AdminDtos.TradingPreferencesSaveRequest(
                "admin",
                new AdminDtos.TradingPreferencesPayload(
                        0,
                        List.of(new AdminDtos.TradingTabPreference(
                                "Desk 1",
                                List.of(
                                        new AdminDtos.TradingChartPreference("c1", "NSE_INDEX|Nifty 50", "minutes", 1, 30, 320, "invalid"),
                                        new AdminDtos.TradingChartPreference("c2", "NSE_INDEX|Nifty Bank", "minutes", 5, 30, 320, "split")
                                )
                        ))
                )
        );

        assertThrows(ValidationException.class, () -> service.savePreferences("tenant-a", request));
    }
}
