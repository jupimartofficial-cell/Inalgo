package com.inalgo.trade.upstox;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;
import static org.springframework.http.HttpStatus.FORBIDDEN;

class UpstoxOrderServiceTest {

    private UpstoxOrderService upstoxOrderService;
    private MockRestServiceServer server;
    private MockRestServiceServer orderServer;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder()
                .baseUrl("https://api.upstox.com")
                .defaultHeader("Authorization", "Bearer token");
        server = MockRestServiceServer.bindTo(builder).build();
        RestClient portfolioClient = builder.build();
        RestClient.Builder orderBuilder = RestClient.builder()
                .baseUrl("https://api-hft.upstox.com")
                .defaultHeader("Authorization", "Bearer token");
        orderServer = MockRestServiceServer.bindTo(orderBuilder).build();
        RestClient orderClient = orderBuilder.build();
        upstoxOrderService = new UpstoxOrderService(portfolioClient, orderClient, new ObjectMapper().findAndRegisterModules());
    }

    @Test
    void placeOrder_mapsSnakeCaseOrderId() {
        orderServer.expect(requestTo("https://api-hft.upstox.com/v2/order/place"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess("""
                        {
                          "status": "success",
                          "data": {
                            "order_id": "250330000123"
                          }
                        }
                        """, MediaType.APPLICATION_JSON));

        UpstoxOrderDtos.IntraOrderResult result = upstoxOrderService.placeOrder(
                new UpstoxOrderDtos.IntraOrderRequest("NSE_FO|52618", "BUY", 15, "MARKET", BigDecimal.ZERO, "tag-1"),
                "91"
        );

        assertEquals("250330000123", result.orderId());
        assertEquals("PLACED", result.status());
    }

    @Test
    void placeOrder_recoversOrderIdFromOrderBookWhenPlaceResponseOmitsIt() {
        orderServer.expect(requestTo("https://api-hft.upstox.com/v2/order/place"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess("""
                        {
                          "status": "success",
                          "data": {}
                        }
                        """, MediaType.APPLICATION_JSON));

        server.expect(requestTo("https://api.upstox.com/v2/order/retrieve-all"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess("""
                        [
                          {
                            "order_id": "250330000321",
                            "status": "complete",
                            "instrument_token": "NSE_FO|52618",
                            "trading_symbol": "BANKNIFTY30MAR50000CE",
                            "transaction_type": "BUY",
                            "order_type": "MARKET",
                            "product": "I",
                            "quantity": 15,
                            "filled_quantity": 15,
                            "price": 0,
                            "average_price": 110.25,
                            "tag": "intra_trade_91_leg-1-ENTRY",
                            "order_timestamp": "2026-03-30 10:05:01",
                            "status_message": null
                          }
                        ]
                        """, MediaType.APPLICATION_JSON));

        UpstoxOrderDtos.IntraOrderResult result = upstoxOrderService.placeOrder(
                new UpstoxOrderDtos.IntraOrderRequest("NSE_FO|52618", "BUY", 15, "MARKET", BigDecimal.ZERO, "leg-1-ENTRY"),
                "91"
        );

        assertNotNull(result.orderId());
        assertEquals("250330000321", result.orderId());
    }

    @Test
    void placeOrder_mapsStaticIpRestrictionToTypedException() {
        orderServer.expect(requestTo("https://api-hft.upstox.com/v2/order/place"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withStatus(FORBIDDEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("""
                                {
                                  "status": "error",
                                  "errors": [
                                    {
                                      "errorCode": "UDAPI1154",
                                      "message": "Access to this API is blocked due to static IP restrictions."
                                    }
                                  ]
                                }
                                """));

        UpstoxOrderException ex = assertThrows(UpstoxOrderException.class, () -> upstoxOrderService.placeOrder(
                new UpstoxOrderDtos.IntraOrderRequest("NSE_FO|52618", "BUY", 15, "MARKET", BigDecimal.ZERO, "leg-1-ENTRY"),
                "91"
        ));

        assertEquals("UDAPI1154", ex.errorCode());
        assertEquals(403, ex.httpStatus());
        assertEquals(UpstoxOrderException.Reason.STATIC_IP_RESTRICTION, ex.reason());
    }

    @Test
    void fetchOrders_acceptsDocumentedArrayPayloadWithUserReadableTimestamps() {
        server.expect(requestTo("https://api.upstox.com/v2/order/retrieve-all"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess("""
                        [
                          {
                            "order_id": "250327000001",
                            "status": "complete",
                            "instrument_token": "NSE_FO|52618",
                            "trading_symbol": "BANKNIFTY27MAR50000CE",
                            "transaction_type": "BUY",
                            "order_type": "MARKET",
                            "product": "I",
                            "quantity": 15,
                            "filled_quantity": 15,
                            "price": 0,
                            "average_price": 112.5,
                            "tag": "intra_trade_42",
                            "order_timestamp": "2026-03-27 09:15:00",
                            "status_message": null
                          }
                        ]
                        """, MediaType.APPLICATION_JSON));

        UpstoxOrderDtos.IntraOrdersResponse response = upstoxOrderService.fetchOrders("local-desktop");

        assertEquals(1, response.count());
        assertEquals("250327000001", response.orders().getFirst().orderId());
        assertEquals("BANKNIFTY27MAR50000CE", response.orders().getFirst().tradingSymbol());
        assertEquals("complete", response.orders().getFirst().status());
    }

    @Test
    void fetchOrders_acceptsWrappedDataPayload() {
        server.expect(requestTo("https://api.upstox.com/v2/order/retrieve-all"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess("""
                        {
                          "status": "success",
                          "data": [
                            {
                              "order_id": "250327000002",
                              "status": "rejected",
                              "instrument_token": "NSE_FO|52619",
                              "trading_symbol": "BANKNIFTY27MAR50000PE",
                              "transaction_type": "SELL",
                              "order_type": "SL-M",
                              "product": "I",
                              "quantity": 15,
                              "filled_quantity": 0,
                              "price": 0,
                              "average_price": 0,
                              "tag": "intra_trade_43",
                              "order_timestamp": "2026-03-27 09:16:00",
                              "status_message": "Rejected by RMS"
                            }
                          ]
                        }
                        """, MediaType.APPLICATION_JSON));

        UpstoxOrderDtos.IntraOrdersResponse response = upstoxOrderService.fetchOrders("local-desktop");

        assertEquals(1, response.count());
        assertEquals("Rejected by RMS", response.orders().getFirst().message());
    }

    @Test
    void fetchPositions_mapsLastPriceIntoLtp() {
        server.expect(requestTo("https://api.upstox.com/v2/portfolio/short-term-positions"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess("""
                        {
                          "status": "success",
                          "data": [
                            {
                              "instrument_token": "NSE_FO|52618",
                              "trading_symbol": "BANKNIFTY27MAR50000CE",
                              "quantity": 15,
                              "buy_price": 105.25,
                              "sell_price": 0,
                              "last_price": 112.50,
                              "pnl": 1087.50
                            }
                          ]
                        }
                        """, MediaType.APPLICATION_JSON));

        UpstoxOrderDtos.IntraPositionsResponse response = upstoxOrderService.fetchPositions("local-desktop");

        assertEquals(1, response.count());
        assertEquals(0, new BigDecimal("112.50").compareTo(response.positions().getFirst().ltp()));
        assertEquals(0, new BigDecimal("105.25").compareTo(response.positions().getFirst().avgBuyPrice()));
        assertEquals(0, new BigDecimal("1087.50").compareTo(response.positions().getFirst().pnl()));
    }

    @Test
    void fetchPositions_supportsNetQuantityAndDayPnlAliases() {
        server.expect(requestTo("https://api.upstox.com/v2/portfolio/short-term-positions"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess("""
                        {
                          "status": "success",
                          "data": [
                            {
                              "instrument_token": "NSE_FO|52618",
                              "trading_symbol": "BANKNIFTY27MAR50000CE",
                              "net_quantity": 25,
                              "buy_price": 101.10,
                              "sell_price": 0,
                              "last_price": 103.55,
                              "day_pnl": 612.50
                            }
                          ]
                        }
                        """, MediaType.APPLICATION_JSON));

        UpstoxOrderDtos.IntraPositionsResponse response = upstoxOrderService.fetchPositions("local-desktop");

        assertEquals(1, response.count());
        assertEquals(25, response.positions().getFirst().netQuantity());
        assertEquals(0, new BigDecimal("612.50").compareTo(response.positions().getFirst().pnl()));
    }
}
