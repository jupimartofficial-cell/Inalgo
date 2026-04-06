package com.inalgo.trade.upstox;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonAlias;
import java.math.BigDecimal;
import java.util.List;

/**
 * DTOs for Upstox v2 order placement and portfolio management APIs.
 *
 * <p>Upstox API returns snake_case JSON. Records that map directly to Upstox
 * API responses carry {@code @JsonProperty} annotations so Jackson can bind
 * the fields correctly without a global naming-strategy override.
 */
public final class UpstoxOrderDtos {
    private UpstoxOrderDtos() {}

    // ─── Place Order ──────────────────────────────────────────────────────────

    public record PlaceOrderRequest(
            String instrumentToken,
            String transactionType,   // BUY or SELL
            String orderType,         // MARKET, LIMIT, SL, SL-M
            String product,           // I (intraday), D (delivery)
            String validity,          // DAY, IOC
            Integer quantity,
            BigDecimal price,         // 0 for MARKET orders
            BigDecimal triggerPrice,  // 0 for MARKET orders
            Integer disclosedQuantity,
            Boolean isAmo,            // after-market order
            String tag                // optional tag for identification
    ) {}

    public record PlaceOrderResponse(
            String status,
            PlaceOrderData data
    ) {}

    public record PlaceOrderData(
            @JsonProperty("order_id") @JsonAlias("orderId") String orderId
    ) {}

    // ─── Get Orders ───────────────────────────────────────────────────────────

    public record OrderBookResponse(
            String status,
            List<OrderDetail> data
    ) {}

    public record OrderDetail(
            @JsonProperty("order_id") String orderId,
            @JsonProperty("status") String status,
            @JsonProperty("instrument_token") String instrumentToken,
            @JsonProperty("trading_symbol") String tradingSymbol,
            @JsonProperty("transaction_type") String transactionType,
            @JsonProperty("order_type") String orderType,
            @JsonProperty("product") String product,
            @JsonProperty("quantity") Integer quantity,
            @JsonProperty("filled_quantity") Integer filledQuantity,
            @JsonProperty("price") BigDecimal price,
            @JsonProperty("average_price") BigDecimal averagePrice,
            @JsonProperty("trigger_price") BigDecimal triggerPrice,
            @JsonProperty("validity") String validity,
            @JsonProperty("tag") String tag,
            @JsonProperty("order_timestamp") String orderTimestamp,
            @JsonProperty("status_message") String statusMessage
    ) {}

    // ─── Positions ────────────────────────────────────────────────────────────

    // Upstox /v2/portfolio/short-term-positions returns data as a flat list
    public record PositionsResponse(
            String status,
            List<PositionDetail> data
    ) {}

    public record PositionDetail(
            @JsonProperty("instrument_token") String instrumentToken,
            @JsonProperty("trading_symbol") String tradingSymbol,
            @JsonProperty("exchange") String exchange,
            @JsonProperty("product") String product,
            @JsonProperty("quantity") @JsonAlias({"net_quantity", "net_qty"}) Integer quantity,
            @JsonProperty("buy_quantity") Integer buyQuantity,
            @JsonProperty("sell_quantity") Integer sellQuantity,
            @JsonProperty("buy_price") BigDecimal buyPrice,
            @JsonProperty("sell_price") BigDecimal sellPrice,
            @JsonProperty("last_price") @JsonAlias("ltp") BigDecimal ltp,
            @JsonProperty("pnl") @JsonAlias({"day_pnl", "unrealized_pnl"}) BigDecimal pnl,
            @JsonProperty("day_buy_value") BigDecimal dayBuyValue,
            @JsonProperty("day_sell_value") BigDecimal daySellValue,
            @JsonProperty("buy_value") BigDecimal buyValue,
            @JsonProperty("sell_value") BigDecimal sellValue
    ) {}

    // ─── Internal view models ─────────────────────────────────────────────────

    public record IntraOrderRequest(
            String instrumentToken,
            String transactionType,
            Integer quantity,
            String orderType,
            BigDecimal limitPrice,
            String tag
    ) {}

    public record IntraOrderResult(
            String orderId,
            String instrumentToken,
            String tradingSymbol,
            String transactionType,
            Integer quantity,
            Integer filledQuantity,
            String orderType,
            BigDecimal limitPrice,
            BigDecimal averagePrice,
            String tag,
            String status,
            String message
    ) {}

    public record IntraOrdersResponse(
            String tenantId,
            List<IntraOrderResult> orders,
            int count
    ) {}

    public record IntraPositionSummary(
            String instrumentToken,
            String tradingSymbol,
            Integer netQuantity,
            BigDecimal avgBuyPrice,
            BigDecimal avgSellPrice,
            BigDecimal ltp,
            BigDecimal pnl
    ) {}

    public record IntraPositionsResponse(
            String tenantId,
            List<IntraPositionSummary> positions,
            int count
    ) {}
}
