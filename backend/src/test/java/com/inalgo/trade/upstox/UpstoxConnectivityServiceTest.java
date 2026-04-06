package com.inalgo.trade.upstox;

import jakarta.validation.ValidationException;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class UpstoxConnectivityServiceTest {

    @Test
    void runConnectivityTest_testsAllSupportedTimeframes() {
        UpstoxClient client = mock(UpstoxClient.class);
        when(client.fetchIntradayCandles(anyString(), anyString()))
                .thenReturn(new UpstoxCandleResponse("success", 12, List.of()));
        when(client.fetchHistoricalCandles(anyString(), anyString(), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(new UpstoxCandleResponse("success", 300, List.of()));

        UpstoxConnectivityService service = new UpstoxConnectivityService(client);
        UpstoxConnectivityTestRequest request = new UpstoxConnectivityTestRequest(
                List.of("NSE_INDEX|Nifty 50", "NSE_INDEX|Nifty Bank"),
                List.of("1minute", "5minute", "15minute", "30minute", "60minute", "1day", "1week", "1month"),
                LocalDate.of(2024, 1, 1),
                LocalDate.of(2024, 1, 10),
                2
        );

        UpstoxConnectivityTestResponse response = service.runConnectivityTest(request);

        assertEquals(32, response.totalChecks());
        assertEquals(32, response.successCount());
        assertEquals(0, response.failureCount());
    }

    @Test
    void runConnectivityTest_withUnsupportedTimeframe_throwsValidationException() {
        UpstoxClient client = mock(UpstoxClient.class);
        UpstoxConnectivityService service = new UpstoxConnectivityService(client);

        UpstoxConnectivityTestRequest request = new UpstoxConnectivityTestRequest(
                List.of("NSE_INDEX|Nifty 50"),
                List.of("3minute"),
                LocalDate.of(2024, 1, 1),
                LocalDate.of(2024, 1, 10),
                1
        );

        assertThrows(ValidationException.class, () -> service.runConnectivityTest(request));
    }
}
