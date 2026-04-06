package com.inalgo.trade.upstox;

import jakarta.validation.ValidationException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class UpstoxClientTest {

    private UpstoxClient upstoxClient;
    private MockRestServiceServer server;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder()
                .baseUrl("https://api.upstox.com")
                .defaultHeader("Authorization", "Bearer token");
        server = MockRestServiceServer.bindTo(builder).build();
        upstoxClient = new UpstoxClient(builder.build());
    }

    @ParameterizedTest
    @CsvSource({
            "1minute,minutes,1",
            "5minute,minutes,5",
            "15minute,minutes,15",
            "30minute,minutes,30",
            "60minute,minutes,60",
            "1day,days,1",
            "1week,weeks,1",
            "1month,months,1"
    })
    void fetchIntradayCandles_supportsMvpTimeframes(String timeframe, String expectedUnit, int expectedInterval) {
        server.expect(requestTo("https://api.upstox.com/v3/historical-candle/intraday/NSE_INDEX%7CNifty%2050/" + expectedUnit + "/" + expectedInterval))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess("""
                        {"status":"success","data":{"candles":[["2025-01-01T09:15:00+05:30",100,101,99,100.5,1000]]}}
                        """, MediaType.APPLICATION_JSON));

        UpstoxCandleResponse response = upstoxClient.fetchIntradayCandles("NSE_INDEX|Nifty 50", timeframe);

        assertEquals("success", response.status());
        assertEquals(1, response.candleCount());
    }

    @ParameterizedTest
    @CsvSource({
            "1minute,minutes,1",
            "5minute,minutes,5",
            "15minute,minutes,15",
            "30minute,minutes,30",
            "60minute,minutes,60",
            "1day,days,1",
            "1week,weeks,1",
            "1month,months,1"
    })
    void fetchHistoricalCandles_supportsMvpTimeframes(String timeframe, String expectedUnit, int expectedInterval) {
        server.expect(requestTo("https://api.upstox.com/v3/historical-candle/NSE_EQ%7CINE848E01016/" + expectedUnit + "/" + expectedInterval + "/2025-01-02/2025-01-01"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess("""
                        {"status":"success","data":{"candles":[["2025-01-01T09:15:00+05:30",100,101,99,100.5,1000]]}}
                        """, MediaType.APPLICATION_JSON));

        UpstoxCandleResponse response = upstoxClient.fetchHistoricalCandles(
                "NSE_EQ|INE848E01016",
                timeframe,
                LocalDate.of(2025, 1, 2),
                LocalDate.of(2025, 1, 1)
        );

        assertEquals("success", response.status());
        assertEquals(1, response.candleCount());
    }

    @Test
    void fetchHistoricalCandles_withInvalidDates_throwsValidationException() {
        assertThrows(ValidationException.class, () -> upstoxClient.fetchHistoricalCandles(
                "NSE_INDEX|Nifty 50",
                "1day",
                LocalDate.of(2024, 1, 1),
                LocalDate.of(2024, 1, 2)
        ));
    }

    @Test
    void fetchIntradayCandles_withUnsupportedInterval_throwsValidationException() {
        assertThrows(ValidationException.class, () -> upstoxClient.fetchIntradayCandles("NSE_INDEX|Nifty 50", "3minute"));
    }

    @Test
    void fetchOptionChain_returnsFullRows() {
        server.expect(requestTo("https://api.upstox.com/v2/option/chain?instrument_key=NSE_INDEX%7CNifty%2050&expiry_date=2026-03-26"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess("""
                        {
                          "status":"success",
                          "data":[
                            {
                              "expiry":"2026-03-26",
                              "strike_price":22500,
                              "underlying_spot_price":22472.6,
                              "pcr":1.02,
                              "call_options":{
                                "instrument_key":"NSE_FO|12345",
                                "market_data":{"ltp":115.5,"volume":1400,"oi":11000,"prev_oi":10000},
                                "option_greeks":{"iv":14.2,"delta":0.43,"gamma":0.0031,"theta":-13.8,"vega":8.2}
                              },
                              "put_options":{
                                "instrument_key":"NSE_FO|54321",
                                "market_data":{"ltp":104.8,"volume":1200,"oi":9800,"prev_oi":9300},
                                "option_greeks":{"iv":15.1,"delta":-0.55,"gamma":0.0030,"theta":-12.5,"vega":8.4}
                              }
                            }
                          ]
                        }
                        """, MediaType.APPLICATION_JSON));

        UpstoxOptionChainResponse response = upstoxClient.fetchOptionChain("NSE_INDEX|Nifty 50", LocalDate.of(2026, 3, 26));

        assertEquals("success", response.status());
        assertEquals(1, response.rowCount());
        assertEquals("NSE_FO|12345", response.rows().getFirst().callOptions().instrumentKey());
        assertEquals(22500, response.rows().getFirst().strikePrice().intValue());
    }

    @Test
    void fetchOptionContracts_returnsContracts() {
        server.expect(requestTo("https://api.upstox.com/v2/option/contract?instrument_key=NSE_INDEX%7CNifty%2050"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess("""
                        {
                          "status":"success",
                          "data":[
                            {"instrument_key":"NSE_FO|111","underlying_key":"NSE_INDEX|Nifty 50","expiry":"2026-03-26","strike_price":22500},
                            {"instrument_key":"NSE_FO|112","underlying_key":"NSE_INDEX|Nifty 50","expiry":"2026-04-30","strike_price":22600}
                          ]
                        }
                        """, MediaType.APPLICATION_JSON));

        UpstoxOptionContractResponse response = upstoxClient.fetchOptionContracts("NSE_INDEX|Nifty 50");

        assertEquals("success", response.status());
        assertEquals(2, response.contractCount());
        assertEquals(LocalDate.of(2026, 3, 26), response.contracts().getFirst().expiry());
    }
}
