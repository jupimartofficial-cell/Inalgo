package com.inalgo.trade.upstox;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.ValidationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Service;
import org.springframework.util.StreamUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

/**
 * Service wrapping the Upstox v2 Trading API for order placement and portfolio
 * management. All operations are scoped to the requesting tenant's access token.
 *
 * <p>Supported operations:
 * <ul>
 *   <li>Place intraday market or limit orders</li>
 *   <li>Cancel open orders</li>
 *   <li>Fetch order book</li>
 *   <li>Fetch net and day positions</li>
 * </ul>
 *
 * <p>Authorization: every call passes the tenant-scoped Bearer token via the
 * {@link UpstoxClientConfig} request interceptor. No token management is done
 * here directly.
 */
@Service
public class UpstoxOrderService {

    private static final Logger log = LoggerFactory.getLogger(UpstoxOrderService.class);

    private static final String PRODUCT_INTRADAY = "I";
    private static final String VALIDITY_DAY = "DAY";
    private static final String ORDER_TYPE_MARKET = "MARKET";
    private static final String ORDER_TYPE_LIMIT = "LIMIT";
    private static final String ORDER_TAG_PREFIX = "intra_trade_";

    private final RestClient upstoxRestClient;
    private final RestClient upstoxOrderRestClient;
    private final ObjectMapper objectMapper;

    public UpstoxOrderService(
            @Qualifier("upstoxRestClient") RestClient upstoxRestClient,
            @Qualifier("upstoxOrderRestClient") RestClient upstoxOrderRestClient,
            ObjectMapper objectMapper
    ) {
        this.upstoxRestClient = upstoxRestClient;
        this.upstoxOrderRestClient = upstoxOrderRestClient;
        this.objectMapper = objectMapper;
    }

    /**
     * Places an intraday order via Upstox v2 API.
     *
     * @param request order details
     * @param scanId optional execution scan ID used as order tag
     * @return order result with orderId on success
     */
    public UpstoxOrderDtos.IntraOrderResult placeOrder(
            UpstoxOrderDtos.IntraOrderRequest request,
            String scanId
    ) {
        validateOrderRequest(request);

        boolean isMarket = request.orderType() == null || ORDER_TYPE_MARKET.equalsIgnoreCase(request.orderType());
        BigDecimal price = isMarket ? BigDecimal.ZERO : Objects.requireNonNullElse(request.limitPrice(), BigDecimal.ZERO);
        String tag = buildTag(scanId, request.tag());

        Map<String, Object> body = Map.ofEntries(
                Map.entry("instrument_token", request.instrumentToken()),
                Map.entry("transaction_type", request.transactionType().toUpperCase()),
                Map.entry("order_type", isMarket ? ORDER_TYPE_MARKET : ORDER_TYPE_LIMIT),
                Map.entry("product", PRODUCT_INTRADAY),
                Map.entry("validity", VALIDITY_DAY),
                Map.entry("quantity", request.quantity()),
                Map.entry("price", price),
                Map.entry("trigger_price", 0),
                Map.entry("disclosed_quantity", 0),
                Map.entry("is_amo", false),
                Map.entry("tag", tag)
        );

        try {
            String payload = upstoxOrderRestClient.post()
                    .uri("/v2/order/place")
                    .body(body)
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, (req, resp) -> {
                        String errorBody = readBody(resp);
                        throw buildOrderPlacementException(resp.getStatusCode().value(), errorBody);
                    })
                    .body(String.class);

            String orderId = extractOrderId(payload)
                    .or(() -> lookupOrderIdByTag(tag))
                    .orElse(null);
            if (orderId == null || orderId.isBlank()) {
                throw new ValidationException("Upstox order placement returned no order ID");
            }

            log.info("Placed intraday {} order for {} qty={} orderId={} tag={}",
                    request.transactionType(), request.instrumentToken(), request.quantity(), orderId, tag);

            return new UpstoxOrderDtos.IntraOrderResult(
                    orderId,
                    request.instrumentToken(),
                    null,
                    request.transactionType(),
                    request.quantity(),
                    0,
                    isMarket ? ORDER_TYPE_MARKET : ORDER_TYPE_LIMIT,
                    price,
                    null,
                    tag,
                    "PLACED",
                    "Order placed successfully"
            );
        } catch (UpstoxOrderException ex) {
            log.warn("Order placement rejected with Upstox code {} (reason={}): {}",
                    ex.errorCode(), ex.reason(), ex.getMessage());
            throw ex;
        } catch (ValidationException ex) {
            log.warn("Order placement rejected: {}", ex.getMessage());
            throw ex;
        } catch (RestClientException ex) {
            String message = "Failed to call Upstox order API: " + ex.getMessage();
            log.error(message, ex);
            throw new UpstoxOrderException(
                    message,
                    UpstoxOrderException.Reason.API_CONNECTIVITY,
                    null,
                    0,
                    ex
            );
        }
    }

    /**
     * Fetches all orders for the current trading session.
     *
     * @return list of order details from the Upstox order book
     */
    public UpstoxOrderDtos.IntraOrdersResponse fetchOrders(String tenantId) {
        try {
            String payload = upstoxRestClient.get()
                    .uri("/v2/order/retrieve-all")
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, (req, resp) -> {
                        String body = readBody(resp);
                        throw new ValidationException("Upstox orders error (" + resp.getStatusCode() + "): " + body);
                    })
                    .body(String.class);

            List<UpstoxOrderDtos.OrderDetail> details = parseOrderDetails(payload);

            List<UpstoxOrderDtos.IntraOrderResult> orders = details.stream()
                    .map(d -> new UpstoxOrderDtos.IntraOrderResult(
                            d.orderId(),
                            d.instrumentToken(),
                            d.tradingSymbol(),
                            d.transactionType(),
                            d.quantity(),
                            Objects.requireNonNullElse(d.filledQuantity(), 0),
                            d.orderType(),
                            d.price(),
                            d.averagePrice(),
                            d.tag(),
                            d.status(),
                            Objects.requireNonNullElse(d.statusMessage(), "")
                    ))
                    .toList();

            return new UpstoxOrderDtos.IntraOrdersResponse(tenantId, orders, orders.size());
        } catch (JsonProcessingException ex) {
            throw new ValidationException("Failed to parse Upstox orders: " + ex.getOriginalMessage(), ex);
        } catch (RestClientException ex) {
            throw new ValidationException("Failed to fetch Upstox orders: " + ex.getMessage(), ex);
        }
    }

    /**
     * Cancels an open order by order ID.
     *
     * @param orderId Upstox order ID to cancel
     */
    public void cancelOrder(String orderId) {
        if (orderId == null || orderId.isBlank()) {
            throw new ValidationException("orderId is required for cancellation");
        }
        try {
            upstoxOrderRestClient.delete()
                    .uri("/v2/order/cancel?order_id={orderId}", orderId)
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, (req, resp) -> {
                        throw new ValidationException("Failed to cancel order " + orderId + ": " + resp.getStatusCode());
                    })
                    .toBodilessEntity();
            log.info("Cancelled Upstox order {}", orderId);
        } catch (RestClientException ex) {
            throw new ValidationException("Failed to cancel Upstox order: " + ex.getMessage(), ex);
        }
    }

    /**
     * Fetches current day and net positions.
     *
     * @return position summary list
     */
    public UpstoxOrderDtos.IntraPositionsResponse fetchPositions(String tenantId) {
        try {
            String payload = upstoxRestClient.get()
                    .uri("/v2/portfolio/short-term-positions")
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, (req, resp) -> {
                        String body = readBody(resp);
                        throw new ValidationException("Upstox positions error (" + resp.getStatusCode() + "): " + body);
                    })
                    .body(String.class);

            List<UpstoxOrderDtos.PositionDetail> raw = parsePositionDetails(payload);

            List<UpstoxOrderDtos.IntraPositionSummary> summaries = raw.stream()
                    .map(p -> new UpstoxOrderDtos.IntraPositionSummary(
                            p.instrumentToken(),
                            p.tradingSymbol(),
                            p.quantity(),
                            p.buyPrice(),
                            p.sellPrice(),
                            p.ltp(),
                            p.pnl()
                    ))
                    .toList();

            return new UpstoxOrderDtos.IntraPositionsResponse(tenantId, summaries, summaries.size());
        } catch (JsonProcessingException ex) {
            throw new ValidationException("Failed to parse Upstox positions: " + ex.getOriginalMessage(), ex);
        } catch (RestClientException ex) {
            throw new ValidationException("Failed to fetch Upstox positions: " + ex.getMessage(), ex);
        }
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private void validateOrderRequest(UpstoxOrderDtos.IntraOrderRequest request) {
        if (request.instrumentToken() == null || request.instrumentToken().isBlank()) {
            throw new ValidationException("instrumentToken is required");
        }
        if (request.transactionType() == null ||
                (!"BUY".equalsIgnoreCase(request.transactionType()) && !"SELL".equalsIgnoreCase(request.transactionType()))) {
            throw new ValidationException("transactionType must be BUY or SELL");
        }
        if (request.quantity() == null || request.quantity() < 1) {
            throw new ValidationException("quantity must be >= 1");
        }
    }

    private String buildTag(String scanId, String customTag) {
        String base = ORDER_TAG_PREFIX + (scanId != null ? scanId : "manual");
        if (customTag != null && !customTag.isBlank()) {
            return base + "_" + customTag;
        }
        return base;
    }

    private String readBody(org.springframework.http.client.ClientHttpResponse response) {
        try {
            return StreamUtils.copyToString(response.getBody(), StandardCharsets.UTF_8);
        } catch (Exception ex) {
            return "unable to read response body";
        }
    }

    private UpstoxOrderException buildOrderPlacementException(int httpStatus, String errorBody) {
        ParsedUpstoxError parsedError = parseUpstoxError(errorBody);
        UpstoxOrderException.Reason reason = "UDAPI1154".equalsIgnoreCase(parsedError.errorCode())
                ? UpstoxOrderException.Reason.STATIC_IP_RESTRICTION
                : UpstoxOrderException.Reason.PROVIDER_REJECTION;
        String message = "Order placement failed: " + httpStatus + (httpStatus == 403 ? " FORBIDDEN" : "");
        if (parsedError.message() != null) {
            message += " — " + parsedError.message();
        }
        if (parsedError.errorCode() != null) {
            message += " [" + parsedError.errorCode() + "]";
        }
        return new UpstoxOrderException(message, reason, parsedError.errorCode(), httpStatus);
    }

    private ParsedUpstoxError parseUpstoxError(String errorBody) {
        if (errorBody == null || errorBody.isBlank()) {
            return new ParsedUpstoxError(null, null);
        }
        try {
            JsonNode root = objectMapper.readTree(errorBody);
            JsonNode errorNode = root.path("errors");
            JsonNode firstError = errorNode.isArray() && !errorNode.isEmpty() ? errorNode.get(0) : null;
            String code = firstError == null ? null : textOrNull(firstError.path("errorCode"));
            if (code == null && firstError != null) {
                code = textOrNull(firstError.path("error_code"));
            }
            String message = firstError == null ? null : textOrNull(firstError.path("message"));
            return new ParsedUpstoxError(code, message);
        } catch (Exception ex) {
            return new ParsedUpstoxError(null, errorBody);
        }
    }

    private List<UpstoxOrderDtos.OrderDetail> parseOrderDetails(String payload) throws JsonProcessingException {
        JsonNode root = readRootNode(payload);
        JsonNode dataNode = root.isArray() ? root : root.path("data");
        return readList(dataNode, UpstoxOrderDtos.OrderDetail.class);
    }

    private List<UpstoxOrderDtos.PositionDetail> parsePositionDetails(String payload) throws JsonProcessingException {
        JsonNode root = readRootNode(payload);
        JsonNode dataNode = root.isArray() ? root : root.path("data");
        return readList(dataNode, UpstoxOrderDtos.PositionDetail.class);
    }

    private JsonNode readRootNode(String payload) throws JsonProcessingException {
        if (payload == null || payload.isBlank()) {
            return objectMapper.createArrayNode();
        }
        return objectMapper.readTree(payload);
    }

    private <T> List<T> readList(JsonNode dataNode, Class<T> itemType) throws JsonProcessingException {
        if (dataNode == null || dataNode.isMissingNode() || dataNode.isNull()) {
            return List.of();
        }
        if (!dataNode.isArray()) {
            throw new JsonProcessingException("Expected Upstox payload array but received " + dataNode.getNodeType()) {};
        }
        List<T> items = new ArrayList<>();
        for (JsonNode itemNode : dataNode) {
            items.add(objectMapper.treeToValue(itemNode, itemType));
        }
        return items;
    }

    private Optional<String> extractOrderId(String payload) {
        if (payload == null || payload.isBlank()) {
            return Optional.empty();
        }
        try {
            JsonNode root = objectMapper.readTree(payload);
            JsonNode data = root.path("data");
            String direct = textOrNull(data.path("order_id"));
            if (direct != null) return Optional.of(direct);
            String camel = textOrNull(data.path("orderId"));
            if (camel != null) return Optional.of(camel);
            if (data.isArray() && !data.isEmpty()) {
                String arrayOrderId = textOrNull(data.get(0).path("order_id"));
                if (arrayOrderId != null) return Optional.of(arrayOrderId);
            }
        } catch (Exception ex) {
            log.warn("Unable to parse place-order payload for order_id: {}", ex.getMessage());
        }
        return Optional.empty();
    }

    private Optional<String> lookupOrderIdByTag(String tag) {
        if (tag == null || tag.isBlank()) {
            return Optional.empty();
        }
        for (int attempt = 1; attempt <= 3; attempt++) {
            try {
                String payload = upstoxRestClient.get()
                        .uri("/v2/order/retrieve-all")
                        .retrieve()
                        .onStatus(HttpStatusCode::isError, (req, resp) -> {
                            String body = readBody(resp);
                            throw new ValidationException("Upstox orders error (" + resp.getStatusCode() + "): " + body);
                        })
                        .body(String.class);
                List<UpstoxOrderDtos.OrderDetail> details = parseOrderDetails(payload);
                Optional<String> fromBook = details.stream()
                        .filter(detail -> tag.equals(detail.tag()))
                        .map(UpstoxOrderDtos.OrderDetail::orderId)
                        .filter(id -> id != null && !id.isBlank())
                        .findFirst();
                if (fromBook.isPresent()) {
                    log.info("Recovered order ID {} from order book using tag {}", fromBook.get(), tag);
                    return fromBook;
                }
                Thread.sleep(250L * attempt);
            } catch (JsonProcessingException parseEx) {
                log.warn("Order-book payload parse failed for tag {}: {}", tag, parseEx.getMessage());
            } catch (ValidationException ex) {
                log.warn("Order-book fallback attempt {} failed for tag {}: {}", attempt, tag, ex.getMessage());
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
                return Optional.empty();
            }
        }
        return Optional.empty();
    }

    private String textOrNull(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }
        String text = node.asText(null);
        return text == null || text.isBlank() ? null : text;
    }

    private record ParsedUpstoxError(String errorCode, String message) {}
}
